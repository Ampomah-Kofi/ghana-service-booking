-- Phase 5 booking functions. Errors: BZ401/403/404/409/422/429 (see src/server/businesses/errors.ts).

-- Is [p_start, p_end) inside the staff member's working time on that local day?
-- Working time = business hours ∩ staff hours (staff hours only if they have their own).
create or replace function private.within_working_hours(p_staff_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz        text;
  v_business  uuid;
  v_uses_biz  boolean;
  v_ls        timestamp;
  v_le        timestamp;
  v_dow       int;
  v_span      public.timerange;
begin
  select b.timezone, b.id, s.uses_business_hours into v_tz, v_business, v_uses_biz
  from public.staff s join public.businesses b on b.id = s.business_id
  where s.id = p_staff_id;
  if v_tz is null then return false; end if;

  v_ls := p_start at time zone v_tz;
  v_le := p_end at time zone v_tz;
  -- No appointment crosses local midnight (overnight hours are out of scope for the MVP).
  if v_le::date <> v_ls::date and not (v_le::date = v_ls::date + 1 and v_le::time = '00:00') then
    return false;
  end if;
  v_dow := extract(isodow from v_ls);
  v_span := public.timerange(v_ls::time, case when v_le::time = '00:00' then '24:00'::time else v_le::time end, '[)');

  if not exists (select 1 from public.business_hours h
                 where h.business_id = v_business and h.weekday = v_dow and h.during @> v_span) then
    return false;
  end if;
  if not v_uses_biz and not exists (select 1 from public.staff_working_hours w
                                    where w.staff_id = p_staff_id and w.weekday = v_dow and w.during @> v_span) then
    return false;
  end if;
  return true;
end;
$$;

-- Busy time for the public availability calculator: who is busy when, and nothing else
-- (no customer names, no reasons). Appointments come with their buffers.
create or replace function public.get_busy_intervals(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns table (staff_id uuid, starts_at timestamptz, ends_at timestamptz, kind text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_published_business(p_business_id) or private.is_business_member(p_business_id)) then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'range must be positive and at most 62 days' using errcode = 'BZ422';
  end if;
  return query
  select a.staff_id, lower(a.occupied), upper(a.occupied), 'appointment'::text
  from public.appointments a
  where a.business_id = p_business_id
    and a.status in ('pending', 'confirmed', 'arrived', 'completed')
    and a.occupied && tstzrange(p_from, p_to, '[)')
  union all
  select s.id, lower(bt.during), upper(bt.during), 'block'::text
  from public.blocked_times bt
  join public.staff s on s.business_id = bt.business_id and (bt.staff_id = s.id or bt.staff_id is null)
  where bt.business_id = p_business_id
    and s.deleted_at is null
    and bt.during && tstzrange(p_from, p_to, '[)');
end;
$$;

-- ---------------------------------------------------------------------------
-- The one place online bookings are created. Tries each candidate staff member
-- in order; the exclusion constraint is the final arbiter under concurrency.
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
        service_name, price_minor, price_type, currency_code, deposit_minor,
        customer_name, customer_phone_e164, customer_note, payment_status,
        idempotency_key, rescheduled_from_id, created_by)
      values (
        p_business_id, p_service_id, v_staff_id, v_client_id, v_uid, v_status, 'online',
        p_starts_at, v_ends_at, v_rules.buffer_before_minutes, v_rules.buffer_after_minutes,
        v_svc.name, v_svc.price_minor, v_svc.price_type, v_svc.currency_code, v_svc.deposit_minor,
        v_name, v_phone, nullif(trim(coalesce(p_note, '')), ''),
        case when v_svc.deposit_minor is not null then 'pending'::public.payment_status end,
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

create or replace function public.book_appointment(
  p_business_id     uuid,
  p_service_id      uuid,
  p_staff_ids       uuid[],
  p_starts_at       timestamptz,
  p_customer_name   text,
  p_customer_phone  text default null,
  p_note            text default null,
  p_idempotency_key text default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select private.book_online(p_business_id, p_service_id, p_staff_ids, p_starts_at, p_customer_name,
                             p_customer_phone, p_note, p_idempotency_key, null);
$$;

-- ---------------------------------------------------------------------------
-- Customer self-service, within the business's cancellation window.
-- ---------------------------------------------------------------------------
create or replace function private.customer_change_allowed(p_appointment public.appointments)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window int;
begin
  if p_appointment.id is null or p_appointment.customer_user_id is distinct from auth.uid() then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  if p_appointment.status not in ('pending', 'confirmed') then
    raise exception 'this booking can no longer be changed' using errcode = 'BZ409';
  end if;
  select r.cancellation_window_hours into v_window from public.booking_rules r where r.business_id = p_appointment.business_id;
  if p_appointment.starts_at - now() < make_interval(hours => coalesce(v_window, 0)) then
    raise exception 'it''s too late to change this booking online; please call the business' using errcode = 'BZ409';
  end if;
end;
$$;

create or replace function public.cancel_my_appointment(p_appointment_id uuid, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  perform private.customer_change_allowed(v_appt);
  perform set_config('app.status_reason', coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'), true);
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'), 200)
   where id = p_appointment_id;
end;
$$;

-- Reschedule = cancel + rebook in ONE transaction: if the new time is taken, nothing changes.
create or replace function public.reschedule_my_appointment(p_appointment_id uuid, p_staff_ids uuid[], p_starts_at timestamptz)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  perform private.customer_change_allowed(v_appt);
  perform set_config('app.status_reason', 'Rescheduled by customer', true);
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = 'Rescheduled'
   where id = p_appointment_id;
  perform set_config('app.status_reason', '', true);
  return private.book_online(v_appt.business_id, v_appt.service_id, p_staff_ids, p_starts_at, v_appt.customer_name,
                             v_appt.customer_phone_e164, v_appt.customer_note, null, v_appt.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Time off may not be placed over live bookings (completes ADR-0003 for blocks).
-- ---------------------------------------------------------------------------
create or replace function public.create_blocked_time(
  p_business_id  uuid,
  p_staff_id     uuid,
  p_starts_local timestamp,
  p_ends_local   timestamp,
  p_reason       text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tz     text;
  v_start  timestamptz;
  v_end    timestamptz;
  v_id     uuid;
  v_sid    uuid;
  v_count  int;
begin
  if not (private.can_manage_business(p_business_id)
          or (p_staff_id is not null and exists (
                select 1 from public.staff s
                where s.id = p_staff_id and s.business_id = p_business_id and s.user_id = auth.uid() and s.deleted_at is null))) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if p_staff_id is not null and not exists (
       select 1 from public.staff s where s.id = p_staff_id and s.business_id = p_business_id and s.deleted_at is null) then
    raise exception 'unknown staff member' using errcode = 'BZ422';
  end if;
  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  v_start := p_starts_local at time zone v_tz;
  v_end := p_ends_local at time zone v_tz;
  if v_end <= v_start then
    raise exception 'the end must be after the start' using errcode = 'BZ422';
  end if;
  if v_end <= now() then
    raise exception 'that time is already in the past' using errcode = 'BZ422';
  end if;
  if v_end - v_start > interval '120 days' then
    raise exception 'time off can be at most 120 days at a time' using errcode = 'BZ422';
  end if;

  for v_sid in select s.id from public.staff s
               where s.business_id = p_business_id and (p_staff_id is null or s.id = p_staff_id)
               order by s.id loop
    perform private.lock_staff(v_sid);
  end loop;

  select count(*) into v_count from public.appointments a
   where a.business_id = p_business_id and (p_staff_id is null or a.staff_id = p_staff_id)
     and a.status in ('pending', 'confirmed', 'arrived')
     and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_start, v_end, '[)');
  if v_count > 0 then
    raise exception 'there % % booking% in that time; move or cancel % first',
      case when v_count = 1 then 'is' else 'are' end, v_count, case when v_count = 1 then '' else 's' end,
      case when v_count = 1 then 'it' else 'them' end
      using errcode = 'BZ409';
  end if;

  insert into public.blocked_times (business_id, staff_id, during, reason, created_by)
  values (p_business_id, p_staff_id, tstzrange(v_start, v_end, '[)'), nullif(trim(p_reason), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- People with upcoming bookings can't be removed until those are moved or cancelled.
create or replace function public.remove_staff_member(p_staff_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff public.staff;
begin
  select * into v_staff from public.staff s where s.id = p_staff_id and s.deleted_at is null;
  if v_staff.id is null or not private.can_manage_business(v_staff.business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if v_staff.user_id is not null and exists (
       select 1 from public.business_members m
       where m.business_id = v_staff.business_id and m.user_id = v_staff.user_id and m.role = 'owner') then
    raise exception 'the owner can''t be removed from the team; turn off online bookings instead' using errcode = 'BZ409';
  end if;
  if exists (select 1 from public.appointments a
             where a.staff_id = p_staff_id and a.status in ('pending', 'confirmed', 'arrived') and a.ends_at > now()) then
    raise exception 'this person has upcoming bookings; move or cancel them first' using errcode = 'BZ409';
  end if;
  update public.staff set deleted_at = now(), is_active = false where id = p_staff_id;
  delete from public.staff_services where staff_id = p_staff_id;
  update public.staff_invites set revoked_at = now() where staff_id = p_staff_id and accepted_at is null and revoked_at is null;
  if v_staff.user_id is not null then
    delete from public.business_members where business_id = v_staff.business_id and user_id = v_staff.user_id and role <> 'owner';
  end if;
end;
$$;

revoke all on function private.within_working_hours(uuid, timestamptz, timestamptz),
                       private.book_online(uuid, uuid, uuid[], timestamptz, text, text, text, text, uuid),
                       private.customer_change_allowed(public.appointments)
  from public, anon, authenticated;
revoke all on function public.book_appointment(uuid, uuid, uuid[], timestamptz, text, text, text, text),
                       public.cancel_my_appointment(uuid, text),
                       public.reschedule_my_appointment(uuid, uuid[], timestamptz)
  from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid[], timestamptz, text, text, text, text),
                          public.cancel_my_appointment(uuid, text),
                          public.reschedule_my_appointment(uuid, uuid[], timestamptz)
  to authenticated;
grant execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated;
