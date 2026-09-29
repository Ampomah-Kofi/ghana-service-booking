-- ADR-0017: Booker GH is not a payment platform. No money moves through the app and there are
-- no deposits. The customer says how they'll pay, the business shows its own Mobile Money or bank
-- details to that customer, and the business marks the booking paid once it has the money.
-- This undoes the online-payment parts of 20261008090000..090400 (forward-only; nothing was released).

-- ---------------------------------------------------------------------------
-- 1. Remove online payments: jobs, webhooks, holds, automatic refunds, payout accounts.
-- ---------------------------------------------------------------------------
drop trigger if exists appointments_payment_policy on public.appointments;
drop trigger if exists booking_rules_need_payout on public.booking_rules;

drop function if exists public.start_payment(uuid, public.payment_kind, public.payment_method, text, text, text);
drop function if exists public.set_payment_reference(uuid, text);
drop function if exists public.abandon_payment(uuid, text);
drop function if exists public.apply_payment_event(text, text, text, text, int, text, jsonb);
drop function if exists public.record_manual_payment(uuid, int, public.payment_method, text);
drop function if exists public.request_refund(uuid, text);
drop function if exists public.claim_refunds(int);
drop function if exists public.finish_refund(uuid, boolean, text, text);
drop function if exists public.stale_pending_payments(int, int);
drop function if exists public.expire_payment_holds();
drop function if exists public.set_payout_account(uuid, public.payout_method, text, text, text, text, text);
drop function if exists private.expire_holds(uuid);
drop function if exists private.queue_refunds(uuid, text);
drop function if exists private.appointments_payment_policy();
drop function if exists private.booking_rules_need_payout();
drop function if exists private.notify_payment(public.appointments, text, text, int, char);

drop table if exists public.payment_events;
drop table if exists public.payments;
drop table if exists public.business_payout_accounts;
drop type if exists public.payout_method;
drop type if exists public.payment_kind;
drop type if exists public.payment_attempt_status;
drop type if exists public.payment_method;

alter table public.booking_rules
  drop column if exists collect_deposits_online,
  drop column if exists allow_full_payment_online,
  drop column if exists refund_deposit_on_no_show;

-- The notification trigger watched hold_expires_at; it's recreated without it in section 5.
drop trigger appointments_notify on public.appointments;
drop index if exists public.appointments_holds;
alter table public.appointments drop column if exists hold_expires_at;

-- No deposits (ADR-0017). Dropping the columns also drops their checks and column grants.
alter table public.services drop column if exists deposit_minor;
alter table public.appointments drop column if exists deposit_minor;

-- ---------------------------------------------------------------------------
-- 2. How people pay: accepted methods (public), the customer's choice (per booking).
-- ---------------------------------------------------------------------------
create type public.payment_method as enum ('cash', 'mobile_money', 'bank_transfer', 'card');

alter table public.booking_rules
  add column accepted_payment_methods public.payment_method[] not null default '{cash}'
    check (cardinality(accepted_payment_methods) between 1 and 4);
grant update (accepted_payment_methods) on public.booking_rules to authenticated;

alter table public.appointments add column payment_method_choice public.payment_method;

-- ---------------------------------------------------------------------------
-- 3. The business's own payment details, shown only to its booked customers.
-- ---------------------------------------------------------------------------
create table public.business_payment_details (
  business_id         uuid primary key references public.businesses (id) on delete cascade,
  momo_network        text check (momo_network in ('mtn', 'telecel', 'airteltigo')),
  momo_number_e164    text check (momo_number_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  momo_account_name   text check (char_length(momo_account_name) between 2 and 120),
  bank_name           text check (char_length(bank_name) between 2 and 80),
  bank_account_name   text check (char_length(bank_account_name) between 2 and 120),
  bank_account_number text check (bank_account_number ~ '^[0-9]{6,20}$'),
  updated_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  -- Each set is all or nothing, and at least one set is filled in.
  check ((momo_network is null) = (momo_number_e164 is null) and (momo_number_e164 is null) = (momo_account_name is null)),
  check ((bank_name is null) = (bank_account_number is null) and (bank_account_number is null) = (bank_account_name is null)),
  check (momo_number_e164 is not null or bank_account_number is not null)
);
alter table public.business_payment_details enable row level security;
-- Owners and managers see their own; admins for support. Customers only through
-- get_booking_payment_details (their own booking). Written only by set_payment_details.
create policy "managers or admin read" on public.business_payment_details for select to authenticated
  using ((select private.can_manage_business(business_id)) or (select private.is_platform_admin()));
revoke all on public.business_payment_details from anon, authenticated;
grant select on public.business_payment_details to authenticated;

create or replace function public.set_payment_details(
  p_business_id uuid,
  p_momo_network text default null, p_momo_number text default null, p_momo_account_name text default null,
  p_bank_name text default null, p_bank_account_name text default null, p_bank_account_number text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_momo boolean := nullif(trim(coalesce(p_momo_number, '')), '') is not null;
  v_bank boolean := nullif(regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g'), '') is not null;
begin
  if not private.is_business_owner(p_business_id) then
    raise exception 'only the owner can change the payment details' using errcode = 'BZ403';
  end if;
  if not v_momo and not v_bank then
    delete from public.business_payment_details where business_id = p_business_id;
    return;
  end if;
  insert into public.business_payment_details as d (business_id, momo_network, momo_number_e164, momo_account_name,
                                                    bank_name, bank_account_name, bank_account_number, updated_by)
  values (p_business_id,
          case when v_momo then p_momo_network end,
          case when v_momo then trim(p_momo_number) end,
          case when v_momo then nullif(trim(coalesce(p_momo_account_name, '')), '') end,
          case when v_bank then nullif(trim(coalesce(p_bank_name, '')), '') end,
          case when v_bank then nullif(trim(coalesce(p_bank_account_name, '')), '') end,
          case when v_bank then regexp_replace(p_bank_account_number, '\s', '', 'g') end,
          auth.uid())
  on conflict (business_id) do update
    set momo_network = excluded.momo_network, momo_number_e164 = excluded.momo_number_e164,
        momo_account_name = excluded.momo_account_name, bank_name = excluded.bank_name,
        bank_account_name = excluded.bank_account_name, bank_account_number = excluded.bank_account_number,
        updated_by = excluded.updated_by, updated_at = now();
exception when check_violation or not_null_violation then
  raise exception 'check the payment details' using errcode = 'BZ422';
end;
$$;

-- What the customer of a booking needs to pay the business directly: only the details for the
-- method they chose (all of them if they haven't chosen), and only for their own booking.
create or replace function public.get_booking_payment_details(p_appointment_id uuid)
returns table (momo_network text, momo_number_e164 text, momo_account_name text,
               bank_name text, bank_account_name text, bank_account_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if v_appt.id is null or auth.uid() is null
     or not (v_appt.customer_user_id = auth.uid() or private.is_business_member(v_appt.business_id)) then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  return query
    select case when coalesce(v_appt.payment_method_choice, 'mobile_money') = 'mobile_money' then d.momo_network end,
           case when coalesce(v_appt.payment_method_choice, 'mobile_money') = 'mobile_money' then d.momo_number_e164 end,
           case when coalesce(v_appt.payment_method_choice, 'mobile_money') = 'mobile_money' then d.momo_account_name end,
           case when coalesce(v_appt.payment_method_choice, 'bank_transfer') = 'bank_transfer' then d.bank_name end,
           case when coalesce(v_appt.payment_method_choice, 'bank_transfer') = 'bank_transfer' then d.bank_account_name end,
           case when coalesce(v_appt.payment_method_choice, 'bank_transfer') = 'bank_transfer' then d.bank_account_number end
      from public.business_payment_details d
     where d.business_id = v_appt.business_id
       and v_appt.status in ('pending', 'confirmed', 'arrived', 'completed');
end;
$$;

-- The customer says how they'll pay (information only), from the business's accepted methods.
create or replace function public.choose_payment_method(p_appointment_id uuid, p_method public.payment_method)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt     public.appointments;
  v_accepted public.payment_method[];
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.id is null or auth.uid() is null or v_appt.customer_user_id is distinct from auth.uid() then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'this booking can''t be changed' using errcode = 'BZ409';
  end if;
  select r.accepted_payment_methods into v_accepted from public.booking_rules r where r.business_id = v_appt.business_id;
  if p_method is null or not (p_method = any (coalesce(v_accepted, '{cash}'))) then
    raise exception 'the business doesn''t take that way of paying' using errcode = 'BZ422';
  end if;
  update public.appointments set payment_method_choice = p_method where id = p_appointment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Payments the business says it received (a record, not a transaction).
-- ---------------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id),
  appointment_id   uuid not null,
  customer_user_id uuid references public.profiles (id) on delete set null,
  method           public.payment_method not null,
  amount_minor     int not null check (amount_minor > 0 and amount_minor <= 100000000),
  currency_code    char(3) not null references public.currencies (code),
  note             text check (char_length(note) <= 200),
  recorded_by      uuid references public.profiles (id) on delete set null,
  paid_at          timestamptz not null default now(),
  refunded_at      timestamptz,
  refund_note      text check (char_length(refund_note) <= 200),
  refunded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (business_id, appointment_id) references public.appointments (business_id, id)
);
create index payments_appointment on public.payments (appointment_id, created_at);
create index payments_business_paid on public.payments (business_id, paid_at desc);
create index payments_customer on public.payments (customer_user_id) where customer_user_id is not null;
create index payments_currency_code on public.payments (currency_code);
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
alter table public.payments enable row level security;
-- The customer sees their own; owners and managers their business's; admins all. Staff don't see
-- amounts. Nobody writes directly.
create policy "own, managed or admin" on public.payments for select to authenticated
  using (customer_user_id = (select auth.uid())
         or (select private.has_business_role(business_id, array['owner', 'manager']::public.member_role[]))
         or (select private.is_platform_admin()));
revoke all on public.payments from anon;
grant select on public.payments to authenticated;

-- appointments.payment_status follows what's been recorded.
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
  v_status   public.payment_status;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if v_appt.id is null then return; end if;
  select coalesce(sum(p.amount_minor) filter (where p.refunded_at is null), 0), bool_or(p.refunded_at is not null)
    into v_paid, v_refunded
    from public.payments p where p.appointment_id = p_appointment_id;
  v_status := case
    when v_paid = 0 and coalesce(v_refunded, false) then 'refunded'
    when v_paid > 0 and v_paid >= coalesce(v_appt.final_price_minor, v_appt.price_minor)
         and coalesce(v_appt.final_price_minor, v_appt.price_minor) > 0 then 'paid'
    when v_paid > 0 then 'partially_paid'
    else null
  end::public.payment_status;
  if v_status is distinct from v_appt.payment_status then
    update public.appointments set payment_status = v_status where id = p_appointment_id;
  end if;
end;
$$;

-- A small in-app receipt for the customer (no text message: the business already has their money).
create or replace function private.notify_payment_receipt(a public.appointments, p_payment_id uuid, p_amount int,
                                                          p_currency char(3))
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if a.customer_user_id is null then return; end if;
  perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, null, 'in_app', 'payment.received',
            private.appointment_payload(a) || jsonb_build_object('amount_minor', p_amount, 'currency', p_currency),
            now(), 'paid:' || p_payment_id);
end;
$$;

-- Any member of the business marks money received (cash, MoMo, bank, card at the shop).
create or replace function public.record_payment(
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
  if p_method is null then
    raise exception 'choose how they paid' using errcode = 'BZ422';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000 then
    raise exception 'enter the amount received' using errcode = 'BZ422';
  end if;
  select coalesce(sum(p.amount_minor), 0) into v_paid from public.payments p
   where p.appointment_id = p_appointment_id and p.refunded_at is null;
  if v_appt.price_type = 'fixed' and v_appt.final_price_minor is null
     and v_paid + p_amount_minor > v_appt.price_minor then
    raise exception 'that''s more than the price' using errcode = 'BZ422';
  end if;
  insert into public.payments (business_id, appointment_id, customer_user_id, method, amount_minor, currency_code,
                               note, recorded_by)
  values (v_appt.business_id, v_appt.id, v_appt.customer_user_id, p_method, p_amount_minor, v_appt.currency_code,
          nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid())
  returning id into v_id;
  perform private.refresh_payment_status(v_appt.id);
  perform private.notify_payment_receipt(v_appt, v_id, p_amount_minor, v_appt.currency_code);
  return v_id;
end;
$$;

-- Owners and managers record money given back (handed back or sent back by the business).
create or replace function public.mark_payment_refunded(p_payment_id uuid, p_note text)
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
  if v_pay.refunded_at is not null then
    raise exception 'already marked refunded' using errcode = 'BZ409';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then
    raise exception 'say why (the customer sees it)' using errcode = 'BZ422';
  end if;
  update public.payments set refunded_at = now(), refunded_by = auth.uid(), refund_note = left(trim(p_note), 200)
   where id = p_payment_id;
  perform private.refresh_payment_status(v_pay.appointment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Booking goes back to its pre-deposit shape (no holds, no deposit snapshot).
-- ---------------------------------------------------------------------------
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
  v_status := case when v_rules.auto_confirm then 'confirmed' else 'pending' end;

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

    continue when not private.within_working_hours(v_staff_id, p_starts_at, v_ends_at);
    continue when exists (
      select 1 from public.blocked_times bt
      where bt.business_id = p_business_id and (bt.staff_id = v_staff_id or bt.staff_id is null)
        and bt.during && tstzrange(p_starts_at, v_ends_at, '[)'));

    begin
      insert into public.appointments (
        business_id, service_id, staff_id, client_id, customer_user_id, status, source,
        starts_at, ends_at, buffer_before_minutes, buffer_after_minutes,
        service_name, price_minor, price_type, currency_code,
        customer_name, customer_phone_e164, customer_note,
        idempotency_key, rescheduled_from_id, created_by)
      values (
        p_business_id, p_service_id, v_staff_id, v_client_id, v_uid, v_status, 'online',
        p_starts_at, v_ends_at, v_rules.buffer_before_minutes, v_rules.buffer_after_minutes,
        v_svc.name, v_svc.price_minor, v_svc.price_type, v_svc.currency_code,
        v_name, v_phone, nullif(trim(coalesce(p_note, '')), ''),
        p_idempotency_key, p_rescheduled_from, v_uid)
      returning id into v_appt_id;
      return v_appt_id;
    exception when exclusion_violation then
      null;  -- someone else just took this person at this time; try the next candidate
    end;
  end loop;

  raise exception 'that time was just taken; please choose another' using errcode = 'BZ409';
end;
$$;

-- A customer reschedule keeps their payment choice and anything already recorded as paid.
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
  perform set_config('app.status_reason', 'Rescheduled by customer', true);
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = 'Rescheduled'
   where id = p_appointment_id;
  perform set_config('app.status_reason', '', true);
  v_new := private.book_online(v_appt.business_id, v_appt.service_id, p_staff_ids, p_starts_at, v_appt.customer_name,
                               v_appt.customer_phone_e164, v_appt.customer_note, null, v_appt.id);
  update public.appointments set payment_method_choice = v_appt.payment_method_choice where id = v_new;
  update public.payments set appointment_id = v_new where appointment_id = p_appointment_id;
  perform private.refresh_payment_status(p_appointment_id);
  perform private.refresh_payment_status(v_new);
  return v_new;
end;
$$;

create or replace function public.create_manual_appointment(
  p_business_id          uuid,
  p_service_id           uuid,
  p_staff_id             uuid,
  p_starts_at            timestamptz,
  p_client_id            uuid default null,
  p_client_name          text default null,
  p_client_phone         text default null,
  p_note                 text default null,
  p_walk_in              boolean default false,
  p_allow_outside_hours  boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_rules  public.booking_rules;
  v_svc    public.services;
  v_client public.business_clients;
  v_ends   timestamptz;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'sign in to continue' using errcode = 'BZ401';
  end if;
  if not private.can_act_on_staff(p_business_id, p_staff_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  select * into v_svc from public.services sv
   where sv.id = p_service_id and sv.business_id = p_business_id and sv.deleted_at is null;
  if v_svc.id is null then
    raise exception 'choose a service' using errcode = 'BZ422';
  end if;
  if not exists (select 1 from public.staff s join public.staff_services ss on ss.staff_id = s.id
                 where s.id = p_staff_id and s.business_id = p_business_id and s.deleted_at is null
                   and s.is_active and ss.service_id = p_service_id) then
    raise exception 'this team member doesn''t offer that service' using errcode = 'BZ422';
  end if;
  if p_starts_at is null or p_starts_at < now() - interval '1 day' or p_starts_at > now() + interval '366 days' then
    raise exception 'choose a time between yesterday and a year from now' using errcode = 'BZ422';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'the note can be at most 500 characters' using errcode = 'BZ422';
  end if;

  select * into v_rules from public.booking_rules r where r.business_id = p_business_id;
  -- An anonymous walk-in (no name, no phone) gets no client record, so the client list stays clean.
  if p_walk_in and p_client_id is null and nullif(trim(coalesce(p_client_name, '')), '') is null
     and nullif(trim(coalesce(p_client_phone, '')), '') is null then
    v_client.full_name := 'Walk-in';
  else
    v_client := private.resolve_client(p_business_id, p_client_id, p_client_name, p_client_phone);
  end if;
  v_ends := p_starts_at + make_interval(mins => v_svc.duration_minutes);

  perform private.lock_staff(p_staff_id);
  if not p_allow_outside_hours then
    if not private.within_working_hours(p_staff_id, p_starts_at, v_ends) then
      raise exception 'that''s outside working hours' using errcode = 'BZ409', detail = 'outside_hours';
    end if;
    if exists (select 1 from public.blocked_times bt
               where bt.business_id = p_business_id and (bt.staff_id = p_staff_id or bt.staff_id is null)
                 and bt.during && tstzrange(p_starts_at, v_ends, '[)')) then
      raise exception 'that time is blocked off' using errcode = 'BZ409', detail = 'blocked';
    end if;
  end if;

  perform set_config('app.status_reason', case when p_walk_in then 'Walk-in' else 'Added by the business' end, true);
  begin
    insert into public.appointments (
      business_id, service_id, staff_id, client_id, customer_user_id, status, source,
      starts_at, ends_at, buffer_before_minutes, buffer_after_minutes,
      service_name, price_minor, price_type, currency_code,
      customer_name, customer_phone_e164, customer_note, payment_status, created_by)
    values (
      p_business_id, p_service_id, p_staff_id, v_client.id, v_client.user_id,
      case when p_walk_in then 'arrived' else 'confirmed' end::public.appointment_status,
      case when p_walk_in then 'walk_in' else 'manual' end::public.appointment_source,
      p_starts_at, v_ends, coalesce(v_rules.buffer_before_minutes, 0), coalesce(v_rules.buffer_after_minutes, 0),
      v_svc.name, v_svc.price_minor, v_svc.price_type, v_svc.currency_code,
      v_client.full_name, v_client.phone_e164, nullif(trim(coalesce(p_note, '')), ''), null, v_uid)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'that person already has a booking then' using errcode = 'BZ409', detail = 'overlap';
  end;
  perform set_config('app.status_reason', '', true);
  return v_id;
end;
$$;

-- Notifications: as in Phase 8 (no holds to wait for).
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
    if new.source = 'walk_in' then
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
create trigger appointments_notify after insert or update of status, starts_at, staff_id on public.appointments
  for each row execute function private.appointments_notify();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.set_payment_details(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.get_booking_payment_details(uuid) from public, anon;
revoke all on function public.choose_payment_method(uuid, public.payment_method) from public, anon;
revoke all on function public.record_payment(uuid, int, public.payment_method, text) from public, anon;
revoke all on function public.mark_payment_refunded(uuid, text) from public, anon;
grant execute on function public.set_payment_details(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_booking_payment_details(uuid) to authenticated;
grant execute on function public.choose_payment_method(uuid, public.payment_method) to authenticated;
grant execute on function public.record_payment(uuid, int, public.payment_method, text) to authenticated;
grant execute on function public.mark_payment_refunded(uuid, text) to authenticated;
revoke all on function private.refresh_payment_status(uuid) from public, anon, authenticated;
revoke all on function private.notify_payment_receipt(public.appointments, uuid, int, char) from public, anon, authenticated;
