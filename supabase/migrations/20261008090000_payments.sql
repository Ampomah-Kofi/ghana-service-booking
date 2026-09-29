-- Phase 9: payments, deposits, Mobile Money (ADR-0005, ADR-0017). Money goes straight to the
-- business through the provider; this ledger records attempts, holds the slot while a deposit is
-- paid, applies provider webhooks exactly once, and queues refunds by the business's policy.

create type public.payment_kind           as enum ('deposit', 'balance', 'full');
create type public.payment_method         as enum ('mobile_money', 'card', 'cash');
create type public.payment_attempt_status as enum ('pending', 'paid', 'failed', 'expired', 'refund_pending', 'refunded');

-- Business choices (plain words in Settings).
alter table public.booking_rules
  add column collect_deposits_online   boolean not null default false,
  add column allow_full_payment_online boolean not null default false,
  add column refund_deposit_on_no_show boolean not null default false;
grant update (collect_deposits_online, allow_full_payment_online, refund_deposit_on_no_show)
  on public.booking_rules to authenticated;

-- A booking waiting for its deposit: the slot is held (status 'pending') until this time.
alter table public.appointments
  add column hold_expires_at timestamptz,
  add constraint appointments_business_id_id unique (business_id, id);
create index appointments_holds on public.appointments (hold_expires_at) where hold_expires_at is not null;

-- ---------------------------------------------------------------------------
-- Payments: one row per attempt. Written only by the functions below.
-- ---------------------------------------------------------------------------
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id),
  appointment_id     uuid not null,
  customer_user_id   uuid references public.profiles (id) on delete set null,
  kind               public.payment_kind not null,
  method             public.payment_method not null,
  provider           text not null check (provider ~ '^[a-z][a-z0-9_-]{1,29}$'),
  status             public.payment_attempt_status not null default 'pending',
  amount_minor       int not null check (amount_minor > 0),
  currency_code      char(3) not null references public.currencies (code),
  idempotency_key    text not null unique check (char_length(idempotency_key) between 8 and 120),
  provider_reference text check (char_length(provider_reference) between 1 and 200),
  momo_network       text check (momo_network in ('mtn', 'telecel', 'airteltigo')),
  payer_phone_e164   text check (payer_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  failure_reason     text check (char_length(failure_reason) <= 300),
  note               text check (char_length(note) <= 200),
  recorded_by        uuid references public.profiles (id) on delete set null,
  paid_at            timestamptz,
  refund_requested_at timestamptz,
  refunded_at        timestamptz,
  refund_reference   text check (char_length(refund_reference) <= 200),
  refund_attempts    smallint not null default 0,
  next_refund_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (business_id, appointment_id) references public.appointments (business_id, id),
  unique (provider, provider_reference),
  check (method <> 'mobile_money' or provider in ('cash', 'manual') or (payer_phone_e164 is not null and momo_network is not null)),
  check (status <> 'paid' or paid_at is not null)
);
create index payments_appointment on public.payments (appointment_id, created_at);
create index payments_business_created on public.payments (business_id, created_at desc);
create index payments_customer on public.payments (customer_user_id, created_at desc) where customer_user_id is not null;
create index payments_pending on public.payments (created_at) where status = 'pending';
create index payments_refunds on public.payments (next_refund_at) where status = 'refund_pending';
create index payments_currency_code on public.payments (currency_code);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

alter table public.payments enable row level security;
-- The customer sees their own; owners and managers see their business's; admins see all (audit).
-- Staff don't see money. Nobody writes directly.
create policy "own, managed or admin" on public.payments for select to authenticated
  using (customer_user_id = (select auth.uid())
         or (select private.has_business_role(business_id, array['owner', 'manager']::public.member_role[]))
         or (select private.is_platform_admin()));
revoke all on public.payments from anon;
grant select on public.payments to authenticated;

-- Webhook inbox: stored first, processed once. unique(provider, event id) makes redelivery a no-op.
create table public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 200),
  payment_id        uuid references public.payments (id),
  payload           jsonb not null default '{}',
  result            text,
  received_at       timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index payment_events_payment on public.payment_events (payment_id);
alter table public.payment_events enable row level security;
create policy "admins read" on public.payment_events for select to authenticated
  using ((select private.is_platform_admin()));
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;

-- ---------------------------------------------------------------------------
-- appointments.payment_status (SPEC §13) follows its payments.
-- ---------------------------------------------------------------------------
create or replace function private.refresh_payment_status(p_appointment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt     public.appointments;
  v_paid     bigint;
  v_refunded boolean;
  v_last     public.payment_attempt_status;
  v_due      int;
  v_status   public.payment_status;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if v_appt.id is null then return; end if;
  select coalesce(sum(p.amount_minor) filter (where p.status in ('paid', 'refund_pending')), 0),
         bool_or(p.status = 'refunded')
    into v_paid, v_refunded
    from public.payments p where p.appointment_id = p_appointment_id;
  select p.status into v_last from public.payments p where p.appointment_id = p_appointment_id
   order by p.created_at desc limit 1;
  v_due := coalesce(v_appt.final_price_minor, v_appt.price_minor);
  v_status := case
    when v_paid = 0 and coalesce(v_refunded, false) then 'refunded'
    when v_paid > 0 and v_due > 0 and v_paid >= v_due then 'paid'
    when v_paid > 0 then 'partially_paid'
    when v_last = 'failed' then 'failed'
    when v_appt.deposit_minor is not null then 'pending'
    else null
  end::public.payment_status;
  if v_status is distinct from v_appt.payment_status then
    update public.appointments set payment_status = v_status where id = p_appointment_id;
  end if;
end;
$$;

-- Unpaid holds past their time: cancel the booking (frees the slot) and close the attempts.
create or replace function private.expire_holds(p_staff_id uuid default null)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform set_config('app.status_reason', 'Payment not completed in time', true);
  with expired as (
    update public.appointments a
       set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Payment not completed in time'
     where a.status = 'pending' and a.hold_expires_at < now()
       and (p_staff_id is null or a.staff_id = p_staff_id)
    returning a.id)
  select coalesce(array_agg(id), '{}') into v_ids from expired;
  perform set_config('app.status_reason', '', true);
  update public.payments set status = 'expired', failure_reason = 'The hold ran out before payment'
   where appointment_id = any (v_ids) and status = 'pending';
  return cardinality(v_ids);
end;
$$;

-- The job's entry point (service role): release every expired hold.
create or replace function public.expire_payment_holds()
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  select private.expire_holds(null);
$$;

-- Booking: deposits collected online hold the slot (changes marked Phase 9).
create or replace function private.book_online(
  p_business_id      uuid,
  p_service_id       uuid,
  p_staff_ids        uuid[],
  p_starts_at        timestamptz,
  p_customer_name    text,
  p_customer_phone   text,
  p_note             text,
  p_idempotency_key  text,
  p_rescheduled_from uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_biz       public.businesses;
  v_rules     public.booking_rules;
  v_svc       public.services;
  v_phone     text := nullif(trim(coalesce(p_customer_phone, '')), '');
  v_name      text := trim(coalesce(p_customer_name, ''));
  v_ends_at   timestamptz;
  v_staff_id  uuid;
  v_client_id uuid;
  v_appt_id   uuid;
  v_status    public.appointment_status;
  v_hold      boolean;
begin
  if v_uid is null then
    raise exception 'sign in to book' using errcode = 'BZ401';
  end if;
  if p_idempotency_key is not null then
    select a.id into v_appt_id from public.appointments a where a.created_by = v_uid and a.idempotency_key = p_idempotency_key;
    if v_appt_id is not null then return v_appt_id; end if;  -- a retried request gets the same booking
  end if;

  select * into v_biz from public.businesses b where b.id = p_business_id and b.deleted_at is null;
  select * into v_rules from public.booking_rules r where r.business_id = p_business_id;
  select * into v_svc from public.services sv
   where sv.id = p_service_id and sv.business_id = p_business_id and sv.is_active and sv.deleted_at is null;
  if v_biz.id is null or v_biz.status <> 'published' or v_rules.business_id is null or v_svc.id is null then
    raise exception 'this service can''t be booked online' using errcode = 'BZ422';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'enter your name' using errcode = 'BZ422';
  end if;
  if v_phone is null then
    select p.phone_e164 into v_phone from public.profiles p where p.id = v_uid;
  end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'a phone number is needed so the business can reach you' using errcode = 'BZ422';
  end if;
  if p_starts_at < now() + make_interval(mins => v_rules.min_notice_minutes) then
    raise exception 'that time is too soon to book online' using errcode = 'BZ422';
  end if;
  if p_starts_at > now() + make_interval(days => v_rules.max_advance_days) then
    raise exception 'that date is too far ahead' using errcode = 'BZ422';
  end if;
  -- Abuse guard that cannot be bypassed by calling the API directly.
  if (select count(*) from public.appointments a where a.created_by = v_uid and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many bookings in a short time; please try again later' using errcode = 'BZ429';
  end if;
  if p_staff_ids is null or cardinality(p_staff_ids) = 0 or cardinality(p_staff_ids) > 50 then
    raise exception 'choose who you''d like to see' using errcode = 'BZ422';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_svc.duration_minutes);
  -- Phase 9: a deposit collected online holds the slot as 'pending' until it's paid (or the hold
  -- expires). A reschedule keeps a deposit already paid, so no new hold.
  v_hold := v_svc.deposit_minor is not null and v_rules.collect_deposits_online
            and not (p_rescheduled_from is not null and exists (
              select 1 from public.payments pm where pm.appointment_id = p_rescheduled_from
                 and pm.status = 'paid' and pm.kind in ('deposit', 'full')));
  v_status := case when v_hold then 'pending' when v_rules.auto_confirm then 'confirmed' else 'pending' end;

  -- The business's client record: by account, then by phone.
  select c.id into v_client_id from public.business_clients c where c.business_id = p_business_id and c.user_id = v_uid;
  if v_client_id is null then
    select c.id into v_client_id from public.business_clients c where c.business_id = p_business_id and c.phone_e164 = v_phone;
    if v_client_id is not null then
      update public.business_clients set user_id = v_uid where id = v_client_id and user_id is null;
    else
      insert into public.business_clients (business_id, user_id, full_name, phone_e164)
      values (p_business_id, v_uid, v_name, v_phone)
      returning id into v_client_id;
    end if;
  end if;

  foreach v_staff_id in array p_staff_ids loop
    continue when not exists (
      select 1 from public.staff s join public.staff_services ss on ss.staff_id = s.id
      where s.id = v_staff_id and s.business_id = p_business_id and s.is_active and s.deleted_at is null
        and s.accepts_online_bookings and ss.service_id = p_service_id);

    perform private.lock_staff(v_staff_id);  -- serialises with create_blocked_time() for this person
    perform private.expire_holds(v_staff_id); -- unpaid holds past their time free the slot first

    continue when not private.within_working_hours(v_staff_id, p_starts_at, v_ends_at);
    continue when exists (
      select 1 from public.blocked_times bt
      where bt.business_id = p_business_id and (bt.staff_id = v_staff_id or bt.staff_id is null)
        and bt.during && tstzrange(p_starts_at, v_ends_at, '[)'));

    begin
      insert into public.appointments (
        business_id, service_id, staff_id, client_id, customer_user_id, status, source,
        starts_at, ends_at, buffer_before_minutes, buffer_after_minutes,
        service_name, price_minor, price_type, currency_code, deposit_minor,
        customer_name, customer_phone_e164, customer_note, payment_status,
        idempotency_key, rescheduled_from_id, created_by, hold_expires_at)
      values (
        p_business_id, p_service_id, v_staff_id, v_client_id, v_uid, v_status, 'online',
        p_starts_at, v_ends_at, v_rules.buffer_before_minutes, v_rules.buffer_after_minutes,
        v_svc.name, v_svc.price_minor, v_svc.price_type, v_svc.currency_code, v_svc.deposit_minor,
        v_name, v_phone, nullif(trim(coalesce(p_note, '')), ''),
        case when v_svc.deposit_minor is not null then 'pending'::public.payment_status end,
        p_idempotency_key, p_rescheduled_from, v_uid,
        case when v_hold then now() + make_interval(mins => v_rules.pending_hold_minutes) end)
      returning id into v_appt_id;
      return v_appt_id;
    exception when exclusion_violation then
      null;  -- someone else just took this person at this time; try the next candidate
    end;
  end loop;

  raise exception 'that time was just taken; please choose another' using errcode = 'BZ409';
end;
$$;


-- Notifications wait for the deposit (changes marked Phase 9).
create or replace function private.appointments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean;
begin
  if tg_op = 'INSERT' then
    -- Phase 9: waiting for a deposit. Nobody is told yet; the news goes out when it's paid.
    if new.source = 'walk_in' or new.hold_expires_at is not null then
      return null;
    end if;
    if new.rescheduled_from_id is not null then
      perform private.notify_customer(new, 'booking.moved', now(), 'moved:' || new.id, true);
      perform private.notify_business(new, 'provider.moved_by_customer', now(), 'moved:' || new.id, false, false);
    elsif new.status = 'confirmed' then
      perform private.notify_customer(new, 'booking.confirmed', now(), 'confirmed:' || new.id, true);
      if new.source = 'online' then
        perform private.notify_business(new, 'provider.new_booking', now(), 'new:' || new.id, true, false);
      end if;
    elsif new.status = 'pending' then
      perform private.notify_customer(new, 'booking.requested', now(), 'requested:' || new.id, false);
      perform private.notify_business(new, 'provider.needs_confirmation', now(), 'new:' || new.id, true, false);
    end if;
    if new.status = 'confirmed' then
      perform private.schedule_reminders(new);
    end if;
    return null;
  end if;

  -- Phase 9: the deposit arrived (hold released): now it's a real booking, told like a new one.
  if old.hold_expires_at is not null and new.hold_expires_at is null and new.status in ('pending', 'confirmed') then
    if new.status = 'confirmed' then
      perform private.notify_customer(new, 'booking.confirmed', now(), 'confirmed:' || new.id, true);
      perform private.notify_business(new, 'provider.new_booking', now(), 'new:' || new.id, true, false);
      perform private.schedule_reminders(new);
    else
      perform private.notify_customer(new, 'booking.requested', now(), 'requested:' || new.id, false);
      perform private.notify_business(new, 'provider.needs_confirmation', now(), 'new:' || new.id, true, false);
    end if;
    return null;
  end if;
  -- A hold that ran out: the customer saw the countdown; no "cancelled" messages.
  if old.hold_expires_at is not null and new.status = 'cancelled' then
    return null;
  end if;

  -- UPDATE: status changes first.
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'confirmed' then
      perform private.notify_customer(new, 'booking.confirmed', now(), 'confirmed:' || new.id, true);
      perform private.schedule_reminders(new);
    elsif new.status = 'cancelled' then
      perform private.cancel_pending_notifications(new.id);
      if coalesce(new.cancellation_reason, '') <> 'Rescheduled' and old.status in ('pending', 'confirmed', 'arrived') then
        if new.cancelled_by is not null and new.cancelled_by = new.customer_user_id then
          perform private.notify_business(new, 'provider.cancelled_by_customer', now(), 'cancelled:' || new.id, true, false);
        elsif new.source <> 'walk_in' then
          perform private.notify_customer(new, 'booking.cancelled', now(), 'cancelled:' || new.id, true);
        end if;
      end if;
    elsif new.status = 'completed' then
      perform private.cancel_pending_notifications(new.id, 'reminder.%');
      perform private.cancel_pending_notifications(new.id, 'provider.upcoming');
      if new.customer_user_id is not null
         and not exists (select 1 from public.reviews r where r.appointment_id = new.id) then
        perform private.enqueue_notification(new.business_id, new.id, new.customer_user_id, null, 'in_app', 'review.request',
                                             private.appointment_payload(new), now() + interval '2 hours', 'review:' || new.id);
      end if;
    elsif new.status = 'no_show' then
      perform private.cancel_pending_notifications(new.id);
    elsif old.status = 'completed' then
      -- Completion undone: no rating prompt.
      perform private.cancel_pending_notifications(new.id, 'review.request');
    end if;
    return null;
  end if;

  -- Same status, new time or person (moved by the business).
  v_live := new.status in ('pending', 'confirmed');
  if v_live and (new.starts_at is distinct from old.starts_at or new.staff_id is distinct from old.staff_id) then
    perform private.cancel_pending_notifications(new.id);
    if new.source <> 'walk_in' then
      perform private.notify_customer(new, 'booking.moved', now(),
                                      'moved:' || new.id || ':' || extract(epoch from new.starts_at)::bigint || ':' || new.staff_id, true);
    end if;
    if new.status = 'confirmed' then
      perform private.schedule_reminders(new);
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- The customer starts paying. The server then asks the provider for a charge.
-- ---------------------------------------------------------------------------
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

  insert into public.payments (business_id, appointment_id, customer_user_id, kind, method, provider, amount_minor,
                               currency_code, idempotency_key, momo_network, payer_phone_e164)
  values (v_appt.business_id, v_appt.id, v_appt.customer_user_id, p_kind, p_method, p_provider, v_amount,
          v_appt.currency_code, v_key, case when p_method = 'mobile_money' then p_network end,
          case when p_method = 'mobile_money' then p_phone end)
  returning id into v_id;
  perform private.refresh_payment_status(v_appt.id);
  return query select v_id, v_key, v_amount, v_appt.currency_code;
end;
$$;

-- The provider's reference for an attempt (server, service role), so webhooks can find it.
create or replace function public.set_payment_reference(p_payment_id uuid, p_reference text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.payments set provider_reference = p_reference
   where id = p_payment_id and provider_reference is null;
$$;

create or replace function private.notify_payment(a public.appointments, p_template text, p_key text,
                                                  p_amount int, p_currency char(3))
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := private.appointment_payload(a) || jsonb_build_object('amount_minor', p_amount, 'currency', p_currency);
  v_prof    public.profiles;
  v_phone   text := a.customer_phone_e164;
  v_text    public.notification_channel := 'sms';
begin
  if a.customer_user_id is not null then
    select * into v_prof from public.profiles p where p.id = a.customer_user_id;
    perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, null, 'in_app', p_template, v_payload, now(), p_key);
    v_phone := coalesce(v_phone, v_prof.phone_e164);
    v_text := case when v_prof.notify_sms then 'sms' when v_prof.notify_whatsapp then 'whatsapp' end;
  end if;
  if v_phone is not null and v_text is not null then
    perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, v_phone, v_text, p_template, v_payload, now(), p_key);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A provider event (verified webhook, or reconciliation), applied exactly once.
-- Returns what happened: applied · duplicate · unknown_payment · ignored · mismatch.
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment_event(
  p_provider      text,
  p_event_id      text,
  p_reference     text,
  p_outcome       text,          -- 'paid' | 'failed' | 'refunded'
  p_amount_minor  int,
  p_currency      text,
  p_payload       jsonb default '{}'
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_pay   public.payments;
  v_appt  public.appointments;
  v_rules public.booking_rules;
  v_result text;
begin
  insert into public.payment_events (provider, provider_event_id, payload)
  values (p_provider, p_event_id, coalesce(p_payload, '{}'))
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event;
  if v_event is null then
    return 'duplicate';
  end if;

  select * into v_pay from public.payments p where p.provider = p_provider and p.provider_reference = p_reference for update;
  if v_pay.id is null then
    update public.payment_events set result = 'unknown_payment' where id = v_event;
    return 'unknown_payment';
  end if;
  select * into v_appt from public.appointments a where a.id = v_pay.appointment_id for update;

  if p_outcome = 'paid' and v_pay.status in ('pending', 'failed', 'expired') then
    if p_amount_minor is distinct from v_pay.amount_minor or p_currency is distinct from v_pay.currency_code::text then
      v_result := 'mismatch';   -- never mark paid on a different amount; a person looks at it
    else
      update public.payments set status = 'paid', paid_at = now(), failure_reason = null where id = v_pay.id;
      if v_appt.status = 'cancelled' then
        -- Money arrived after the hold ran out or the booking was cancelled: give it back.
        update public.payments set status = 'refund_pending', refund_requested_at = now(), next_refund_at = now(),
               note = 'Paid after the booking had ended'
         where id = v_pay.id;
      elsif v_appt.hold_expires_at is not null then
        select * into v_rules from public.booking_rules r where r.business_id = v_appt.business_id;
        update public.appointments
           set hold_expires_at = null,
               status = case when v_rules.auto_confirm then 'confirmed'::public.appointment_status else status end
         where id = v_appt.id;
      else
        perform private.notify_payment(v_appt, 'payment.received', 'paid:' || v_pay.id, v_pay.amount_minor, v_pay.currency_code);
      end if;
      v_result := 'applied';
    end if;
  elsif p_outcome = 'failed' and v_pay.status = 'pending' then
    update public.payments set status = 'failed', failure_reason = left(coalesce(p_payload ->> 'reason', 'Declined'), 300)
     where id = v_pay.id;
    v_result := 'applied';
  elsif p_outcome = 'refunded' and v_pay.status in ('refund_pending', 'paid') then
    update public.payments set status = 'refunded', refunded_at = now() where id = v_pay.id;
    perform private.notify_payment(v_appt, 'payment.refunded', 'refunded:' || v_pay.id, v_pay.amount_minor, v_pay.currency_code);
    v_result := 'applied';
  else
    v_result := 'ignored';     -- already final, or an out-of-order event
  end if;
  update public.payment_events set payment_id = v_pay.id, result = v_result where id = v_event;
  perform private.refresh_payment_status(v_appt.id);
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- At the visit: the business records cash, or Mobile Money sent straight to its number.
-- ---------------------------------------------------------------------------
create or replace function public.record_manual_payment(
  p_appointment_id uuid, p_amount_minor int, p_method public.payment_method, p_note text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_paid bigint;
  v_id   uuid;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.id is null or not private.is_business_member(v_appt.business_id) then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  if v_appt.status in ('cancelled', 'no_show') then
    raise exception 'this booking was not kept' using errcode = 'BZ409';
  end if;
  if p_method = 'card' then
    raise exception 'record cash or Mobile Money' using errcode = 'BZ422';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000 then
    raise exception 'enter the amount received' using errcode = 'BZ422';
  end if;
  select coalesce(sum(p.amount_minor), 0) into v_paid from public.payments p
   where p.appointment_id = p_appointment_id and p.status in ('paid', 'refund_pending');
  if v_appt.price_type = 'fixed' and v_appt.final_price_minor is null
     and v_paid + p_amount_minor > v_appt.price_minor then
    raise exception 'that''s more than the price' using errcode = 'BZ422';
  end if;
  insert into public.payments (business_id, appointment_id, customer_user_id, kind, method, provider, status,
                               amount_minor, currency_code, idempotency_key, note, recorded_by, paid_at)
  values (v_appt.business_id, v_appt.id, v_appt.customer_user_id,
          case when v_paid = 0 then 'full' else 'balance' end::public.payment_kind, p_method,
          case when p_method = 'cash' then 'cash' else 'manual' end, 'paid',
          p_amount_minor, v_appt.currency_code, 'manual:' || gen_random_uuid(),
          nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid(), now())
  returning id into v_id;
  perform private.refresh_payment_status(v_appt.id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Refunds: queued here, sent by the job through the provider (cash is handed back in person).
-- ---------------------------------------------------------------------------
create or replace function private.queue_refunds(p_appointment_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Cash and manual payments are settled in person, so they are marked refunded straight away.
  update public.payments
     set status = case when provider in ('cash', 'manual') then 'refunded' else 'refund_pending' end::public.payment_attempt_status,
         refund_requested_at = now(),
         refunded_at = case when provider in ('cash', 'manual') then now() end,
         next_refund_at = case when provider in ('cash', 'manual') then null else now() end,
         note = left(p_reason, 200)
   where appointment_id = p_appointment_id and status = 'paid';
  perform private.refresh_payment_status(p_appointment_id);
end;
$$;

-- Owners and managers can refund a payment themselves (e.g. a goodwill refund).
create or replace function public.request_refund(p_payment_id uuid, p_reason text)
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
  if v_pay.id is null or not private.has_business_role(v_pay.business_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'payment not found' using errcode = 'BZ404';
  end if;
  if v_pay.status <> 'paid' then
    raise exception 'only a completed payment can be refunded' using errcode = 'BZ409';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'say why (the customer sees it)' using errcode = 'BZ422';
  end if;
  update public.payments
     set status = case when provider in ('cash', 'manual') then 'refunded' else 'refund_pending' end::public.payment_attempt_status,
         refund_requested_at = now(),
         refunded_at = case when provider in ('cash', 'manual') then now() end,
         next_refund_at = case when provider in ('cash', 'manual') then null else now() end,
         note = left(trim(p_reason), 200)
   where id = p_payment_id;
  perform private.refresh_payment_status(v_pay.appointment_id);
end;
$$;

-- Policy on cancel / no-show (plan §5): cancelled by anyone → refund; no-show → only if the
-- business chose that. Reschedules move the money instead (reschedule_my_appointment).
create or replace function private.appointments_payment_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund_no_show boolean;
begin
  if new.status = old.status then
    return null;
  end if;
  if new.status = 'cancelled' and coalesce(new.cancellation_reason, '') <> 'Rescheduled' then
    perform private.queue_refunds(new.id, case when new.cancelled_by is not null and new.cancelled_by = new.customer_user_id
                                               then 'Cancelled by customer in time' else 'Cancelled by the business' end);
  elsif new.status = 'no_show' then
    select r.refund_deposit_on_no_show into v_refund_no_show from public.booking_rules r where r.business_id = new.business_id;
    if coalesce(v_refund_no_show, false) then
      perform private.queue_refunds(new.id, 'No-show (business refunds deposits)');
    end if;
  end if;
  return null;
end;
$$;
create trigger appointments_payment_policy after update of status on public.appointments
  for each row execute function private.appointments_payment_policy();

-- The job: refunds due (service role). Claims with SKIP LOCKED so two workers never double-refund.
create or replace function public.claim_refunds(p_limit int default 20)
returns table (payment_id uuid, provider text, provider_reference text, amount_minor int, currency_code char(3),
               idempotency_key text)
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select p.id from public.payments p
     where p.status = 'refund_pending' and p.next_refund_at <= now() and p.refund_attempts < 6
     order by p.next_refund_at
     limit least(greatest(p_limit, 1), 100)
     for update skip locked)
  update public.payments p
     set refund_attempts = p.refund_attempts + 1,
         next_refund_at = now() + interval '10 minutes'   -- a crash mid-refund retries later
    from due where p.id = due.id
  returning p.id, p.provider, p.provider_reference, p.amount_minor, p.currency_code, 'refund:' || p.id;
$$;

create or replace function public.finish_refund(p_payment_id uuid, p_ok boolean, p_reference text default null,
                                                p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pay  public.payments;
  v_appt public.appointments;
begin
  select * into v_pay from public.payments p where p.id = p_payment_id for update;
  if v_pay.id is null or v_pay.status <> 'refund_pending' then
    return;
  end if;
  if p_ok then
    update public.payments set status = 'refunded', refunded_at = now(), refund_reference = left(p_reference, 200),
                               failure_reason = null, next_refund_at = null
     where id = p_payment_id;
    select * into v_appt from public.appointments a where a.id = v_pay.appointment_id;
    perform private.notify_payment(v_appt, 'payment.refunded', 'refunded:' || v_pay.id, v_pay.amount_minor, v_pay.currency_code);
  else
    -- Back off: 1, 5, 15, 60, 240 minutes; after six tries it waits for a person (Phase 10 admin).
    update public.payments
       set failure_reason = left(coalesce(p_error, 'Refund failed'), 300),
           next_refund_at = now() + (array[1, 5, 15, 60, 240, 1440])[least(v_pay.refund_attempts, 6)] * interval '1 minute'
     where id = p_payment_id;
  end if;
  perform private.refresh_payment_status(v_pay.appointment_id);
end;
$$;

-- Reconciliation (service role): attempts still pending after a while (webhooks get lost).
create or replace function public.stale_pending_payments(p_older_than_minutes int default 10, p_limit int default 50)
returns table (payment_id uuid, provider text, provider_reference text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.provider, p.provider_reference from public.payments p
   where p.status = 'pending' and p.provider_reference is not null
     and p.created_at < now() - make_interval(mins => p_older_than_minutes)
   order by p.created_at
   limit least(greatest(p_limit, 1), 200);
$$;

-- A customer reschedule keeps what they already paid (money moves to the new booking).
create or replace function public.reschedule_my_appointment(p_appointment_id uuid, p_staff_ids uuid[], p_starts_at timestamptz)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_new  uuid;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  perform private.customer_change_allowed(v_appt);
  if v_appt.hold_expires_at is not null then
    raise exception 'pay the deposit first, or book a new time' using errcode = 'BZ409';
  end if;
  perform set_config('app.status_reason', 'Rescheduled by customer', true);
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = 'Rescheduled'
   where id = p_appointment_id;
  perform set_config('app.status_reason', '', true);
  v_new := private.book_online(v_appt.business_id, v_appt.service_id, p_staff_ids, p_starts_at, v_appt.customer_name,
                               v_appt.customer_phone_e164, v_appt.customer_note, null, v_appt.id);
  update public.payments set appointment_id = v_new
   where appointment_id = p_appointment_id and status in ('paid', 'refund_pending');
  perform private.refresh_payment_status(p_appointment_id);
  perform private.refresh_payment_status(v_new);
  return v_new;
end;
$$;

-- Hold releases tell people too (appointments_notify now also watches hold_expires_at).
drop trigger appointments_notify on public.appointments;
create trigger appointments_notify after insert or update of status, starts_at, staff_id, hold_expires_at on public.appointments
  for each row execute function private.appointments_notify();

revoke all on function public.start_payment(uuid, public.payment_kind, public.payment_method, text, text, text) from public, anon;
revoke all on function public.set_payment_reference(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_payment_event(text, text, text, text, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_manual_payment(uuid, int, public.payment_method, text) from public, anon;
revoke all on function public.request_refund(uuid, text) from public, anon;
revoke all on function public.claim_refunds(int) from public, anon, authenticated;
revoke all on function public.finish_refund(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.stale_pending_payments(int, int) from public, anon, authenticated;
revoke all on function public.expire_payment_holds() from public, anon, authenticated;
grant execute on function public.start_payment(uuid, public.payment_kind, public.payment_method, text, text, text) to authenticated;
grant execute on function public.record_manual_payment(uuid, int, public.payment_method, text) to authenticated;
grant execute on function public.request_refund(uuid, text) to authenticated;
grant execute on function public.set_payment_reference(uuid, text) to service_role;
grant execute on function public.apply_payment_event(text, text, text, text, int, text, jsonb) to service_role;
grant execute on function public.claim_refunds(int) to service_role;
grant execute on function public.finish_refund(uuid, boolean, text, text) to service_role;
grant execute on function public.stale_pending_payments(int, int) to service_role;
grant execute on function public.expire_payment_holds() to service_role;
