-- Phase 9 follow-up (ADR-0017): the attempt's idempotency key doubles as the merchant reference sent
-- to the provider, so starting a payment runs entirely as the customer (no secret key in the request
-- path, ADR-0002). A start the provider refused is closed by the customer's own call.
create or replace function public.start_payment(
  p_appointment_id uuid,
  p_kind           public.payment_kind,
  p_method         public.payment_method,
  p_provider       text,
  p_phone          text default null,
  p_network        text default null
)
returns table (payment_id uuid, idempotency_key text, amount_minor int, currency_code char(3))
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt    public.appointments;
  v_rules   public.booking_rules;
  v_paid    bigint;
  v_amount  int;
  v_attempt int;
  v_key     text;
  v_id      uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.id is null or v_appt.customer_user_id is distinct from auth.uid() then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'this booking can''t be paid for any more' using errcode = 'BZ409';
  end if;
  if v_appt.hold_expires_at is not null and v_appt.hold_expires_at < now() then
    raise exception 'the time to pay has run out; please book again' using errcode = 'BZ409';
  end if;
  if p_method = 'cash' or p_provider in ('cash', 'manual') then
    raise exception 'pay cash at the visit' using errcode = 'BZ422';
  end if;
  if p_provider !~ '^[a-z][a-z0-9_-]{1,29}$' then
    raise exception 'unknown payment provider' using errcode = 'BZ422';
  end if;
  if p_method = 'mobile_money' and (coalesce(p_phone, '') !~ '^\+[1-9][0-9]{6,14}$'
                                    or coalesce(p_network, '') not in ('mtn', 'telecel', 'airteltigo')) then
    raise exception 'enter your Mobile Money number and network' using errcode = 'BZ422';
  end if;
  if (select count(*) from public.payments p where p.appointment_id = p_appointment_id
        and p.created_at > now() - interval '1 hour') >= 6 then
    raise exception 'too many payment attempts; please try again later' using errcode = 'BZ429';
  end if;

  select * into v_rules from public.booking_rules r where r.business_id = v_appt.business_id;
  select coalesce(sum(p.amount_minor), 0) into v_paid from public.payments p
   where p.appointment_id = p_appointment_id and p.status in ('paid', 'refund_pending');

  if p_kind = 'deposit' then
    if v_appt.deposit_minor is null or v_paid > 0 then
      raise exception 'there''s no deposit to pay' using errcode = 'BZ409';
    end if;
    v_amount := v_appt.deposit_minor;
  else
    -- Full price / what's left, only where the business allows it and the price is known.
    if not coalesce(v_rules.allow_full_payment_online, false) or v_appt.price_type <> 'fixed' then
      raise exception 'this business takes the rest at the visit' using errcode = 'BZ422';
    end if;
    v_amount := v_appt.price_minor - v_paid;
    if v_amount <= 0 then
      raise exception 'this booking is already paid' using errcode = 'BZ409';
    end if;
    if p_kind = 'full' and v_paid > 0 then
      p_kind := 'balance';
    end if;
  end if;

  -- One live attempt at a time: an earlier unfinished one is closed.
  update public.payments set status = 'failed', failure_reason = 'Replaced by a new attempt'
   where appointment_id = p_appointment_id and status = 'pending';
  select count(*) + 1 into v_attempt from public.payments p where p.appointment_id = p_appointment_id;
  v_key := 'appt:' || p_appointment_id || ':' || p_kind || ':' || v_attempt;

  -- Our key is also the reference we give the provider (a merchant reference), so webhooks find the
  -- attempt without the request path ever needing the secret key (ADR-0017).
  insert into public.payments (business_id, appointment_id, customer_user_id, kind, method, provider, amount_minor,
                               currency_code, idempotency_key, provider_reference, momo_network, payer_phone_e164)
  values (v_appt.business_id, v_appt.id, v_appt.customer_user_id, p_kind, p_method, p_provider, v_amount,
          v_appt.currency_code, v_key, v_key, case when p_method = 'mobile_money' then p_network end,
          case when p_method = 'mobile_money' then p_phone end)
  returning id into v_id;
  perform private.refresh_payment_status(v_appt.id);
  return query select v_id, v_key, v_amount, v_appt.currency_code;
end;
$$;


create or replace function public.abandon_payment(p_payment_id uuid, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
begin
  select * into v_pay from public.payments p where p.id = p_payment_id for update;
  if v_pay.id is null or v_pay.customer_user_id is distinct from auth.uid() then
    raise exception 'payment not found' using errcode = 'BZ404';
  end if;
  if v_pay.status = 'pending' then
    update public.payments set status = 'failed',
           failure_reason = left(coalesce(nullif(trim(p_reason), ''), 'Not started'), 300)
     where id = p_payment_id;
    perform private.refresh_payment_status(v_pay.appointment_id);
  end if;
end;
$$;
revoke all on function public.abandon_payment(uuid, text) from public, anon;
grant execute on function public.abandon_payment(uuid, text) to authenticated;
