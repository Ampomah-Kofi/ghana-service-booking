-- Phase 6: providers manage appointments (SPEC §8). Every write goes through a function
-- that checks who is acting; the exclusion constraint (ADR-0003) still has the final word.

-- For "from" prices: what the customer actually paid, recorded when the visit is completed.
alter table public.appointments add column final_price_minor int check (final_price_minor >= 0);

-- ---------------------------------------------------------------------------
-- Who may act on an appointment: the business's owners/managers, or the staff
-- member it belongs to (staff see and handle only their own column of the calendar).
-- ---------------------------------------------------------------------------
create or replace function private.can_act_on_staff(p_business_id uuid, p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_business(p_business_id)
      or exists (select 1 from public.staff s
                 where s.id = p_staff_id and s.business_id = p_business_id
                   and s.user_id = auth.uid() and s.deleted_at is null);
$$;

-- A client record for the business: an existing one by id, or found/created by phone, or created by name.
create or replace function private.resolve_client(p_business_id uuid, p_client_id uuid, p_name text, p_phone text)
returns public.business_clients
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_client public.business_clients;
  v_name   text := nullif(trim(coalesce(p_name, '')), '');
  v_phone  text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if p_client_id is not null then
    select * into v_client from public.business_clients c where c.id = p_client_id and c.business_id = p_business_id;
    if v_client.id is null then
      raise exception 'client not found' using errcode = 'BZ404';
    end if;
    return v_client;
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'enter a valid phone number' using errcode = 'BZ422';
  end if;
  if v_phone is not null then
    select * into v_client from public.business_clients c where c.business_id = p_business_id and c.phone_e164 = v_phone;
    if v_client.id is not null then return v_client; end if;
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'enter the client''s name' using errcode = 'BZ422';
  end if;
  insert into public.business_clients (business_id, full_name, phone_e164)
  values (p_business_id, v_name, v_phone)
  returning * into v_client;
  return v_client;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phone bookings and walk-ins, created by the provider.
-- Differences from online booking: no minimum notice or advance window, the provider
-- may go outside hours/time off on purpose, and walk-ins start as "arrived".
-- Overlaps are refused exactly as for online bookings.
-- ---------------------------------------------------------------------------
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
  v_client := private.resolve_client(p_business_id, p_client_id, p_client_name, p_client_phone);
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
      service_name, price_minor, price_type, currency_code, deposit_minor,
      customer_name, customer_phone_e164, customer_note, payment_status, created_by)
    values (
      p_business_id, p_service_id, p_staff_id, v_client.id, v_client.user_id,
      case when p_walk_in then 'arrived' else 'confirmed' end::public.appointment_status,
      case when p_walk_in then 'walk_in' else 'manual' end::public.appointment_source,
      p_starts_at, v_ends, coalesce(v_rules.buffer_before_minutes, 0), coalesce(v_rules.buffer_after_minutes, 0),
      v_svc.name, v_svc.price_minor, v_svc.price_type, v_svc.currency_code, v_svc.deposit_minor,
      v_client.full_name, v_client.phone_e164, nullif(trim(coalesce(p_note, '')), ''), null, v_uid)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'that person already has a booking then' using errcode = 'BZ409', detail = 'overlap';
  end;
  perform set_config('app.status_reason', '', true);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status changes. Allowed moves (anything else is refused):
--   pending   → confirmed, arrived, cancelled, no_show
--   confirmed → arrived, completed, cancelled, no_show
--   arrived   → completed, confirmed (undo), cancelled
--   completed → arrived (undo, within 7 days)
--   no_show   → confirmed (undo, within 7 days)
--   cancelled → (final; book again instead)
-- Arrived is allowed from 1 hour before the start; completed and no-show only once it has started.
-- ---------------------------------------------------------------------------
create or replace function public.set_appointment_status(
  p_appointment_id    uuid,
  p_status            public.appointment_status,
  p_reason            text default null,
  p_final_price_minor int default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt   public.appointments;
  v_from   public.appointment_status;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.id is null or not private.can_act_on_staff(v_appt.business_id, v_appt.staff_id) then
    raise exception 'appointment not found' using errcode = 'BZ404';
  end if;
  v_from := v_appt.status;
  if p_final_price_minor is not null and (p_status <> 'completed' or p_final_price_minor < 0) then
    raise exception 'a final price can only be recorded when completing' using errcode = 'BZ422';
  end if;
  if v_from = p_status then return; end if;  -- a double tap is harmless

  if not (
       (v_from = 'pending'   and p_status in ('confirmed', 'arrived', 'cancelled', 'no_show'))
    or (v_from = 'confirmed' and p_status in ('arrived', 'completed', 'cancelled', 'no_show'))
    or (v_from = 'arrived'   and p_status in ('completed', 'confirmed', 'cancelled'))
    or (v_from = 'completed' and p_status = 'arrived' and v_appt.ends_at > now() - interval '7 days')
    or (v_from = 'no_show'   and p_status = 'confirmed' and v_appt.ends_at > now() - interval '7 days')
  ) then
    raise exception 'a % appointment can''t be marked %', replace(v_from::text, '_', '-'), replace(p_status::text, '_', '-')
      using errcode = 'BZ409';
  end if;
  if p_status = 'arrived' and v_appt.starts_at > now() + interval '1 hour' then
    raise exception 'it''s too early to mark this as arrived' using errcode = 'BZ409';
  end if;
  if p_status in ('completed', 'no_show') and v_appt.starts_at > now() then
    raise exception 'this appointment hasn''t started yet' using errcode = 'BZ409';
  end if;
  if char_length(coalesce(v_reason, '')) > 200 then
    raise exception 'the reason can be at most 200 characters' using errcode = 'BZ422';
  end if;

  perform set_config('app.status_reason', coalesce(v_reason, ''), true);
  begin
    update public.appointments
       set status = p_status,
           final_price_minor = case when p_status = 'completed' then coalesce(p_final_price_minor, final_price_minor)
                                    when v_from = 'completed' then null else final_price_minor end,
           cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
           cancelled_by = case when p_status = 'cancelled' then auth.uid() else cancelled_by end,
           cancellation_reason = case when p_status = 'cancelled' then left(coalesce(v_reason, 'Cancelled by the business'), 200)
                                      else cancellation_reason end
     where id = p_appointment_id;
  exception when exclusion_violation then
    -- Undoing a no-show re-occupies the time, which may have been given to someone else.
    raise exception 'that time has been booked by someone else since' using errcode = 'BZ409';
  end;
  perform set_config('app.status_reason', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Move and/or reassign (managers). Updates in place and records the move in history.
-- ---------------------------------------------------------------------------
create or replace function public.move_appointment(
  p_appointment_id       uuid,
  p_staff_id             uuid,
  p_starts_at            timestamptz,
  p_allow_outside_hours  boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_ends timestamptz;
  v_tz   text;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id for update;
  if v_appt.id is null or not private.can_manage_business(v_appt.business_id) then
    raise exception 'appointment not found' using errcode = 'BZ404';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'only upcoming appointments can be moved' using errcode = 'BZ409';
  end if;
  if not exists (select 1 from public.staff s join public.staff_services ss on ss.staff_id = s.id
                 where s.id = p_staff_id and s.business_id = v_appt.business_id and s.deleted_at is null
                   and s.is_active and ss.service_id = v_appt.service_id) then
    raise exception 'this team member doesn''t offer that service' using errcode = 'BZ422';
  end if;
  if p_starts_at < now() - interval '1 day' or p_starts_at > now() + interval '366 days' then
    raise exception 'choose a time between yesterday and a year from now' using errcode = 'BZ422';
  end if;
  v_ends := p_starts_at + (v_appt.ends_at - v_appt.starts_at);

  -- Lock both people in a fixed order (no deadlocks between two moves).
  perform private.lock_staff(x) from unnest(array[least(v_appt.staff_id, p_staff_id), greatest(v_appt.staff_id, p_staff_id)]) x;
  if not p_allow_outside_hours then
    if not private.within_working_hours(p_staff_id, p_starts_at, v_ends) then
      raise exception 'that''s outside working hours' using errcode = 'BZ409', detail = 'outside_hours';
    end if;
    if exists (select 1 from public.blocked_times bt
               where bt.business_id = v_appt.business_id and (bt.staff_id = p_staff_id or bt.staff_id is null)
                 and bt.during && tstzrange(p_starts_at, v_ends, '[)')) then
      raise exception 'that time is blocked off' using errcode = 'BZ409', detail = 'blocked';
    end if;
  end if;

  begin
    update public.appointments set staff_id = p_staff_id, starts_at = p_starts_at, ends_at = v_ends
     where id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'that person already has a booking then' using errcode = 'BZ409', detail = 'overlap';
  end;

  select b.timezone into v_tz from public.businesses b where b.id = v_appt.business_id;
  insert into public.appointment_status_history (business_id, appointment_id, from_status, to_status, changed_by, reason)
  values (v_appt.business_id, v_appt.id, v_appt.status, v_appt.status, auth.uid(),
          'Moved from ' || to_char(v_appt.starts_at at time zone v_tz, 'Dy DD Mon HH24:MI')
          || case when p_staff_id <> v_appt.staff_id
                  then ' (' || (select s.display_name from public.staff s where s.id = v_appt.staff_id) || ')' else '' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Clients (managers): add/edit, and a summary view for the Clients tab.
-- ---------------------------------------------------------------------------
create or replace function public.save_business_client(
  p_business_id uuid,
  p_client_id   uuid,
  p_name        text,
  p_phone       text,
  p_notes       text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'enter the client''s name' using errcode = 'BZ422';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'enter a valid phone number' using errcode = 'BZ422';
  end if;
  if char_length(coalesce(p_notes, '')) > 2000 then
    raise exception 'notes can be at most 2000 characters' using errcode = 'BZ422';
  end if;
  begin
    if p_client_id is null then
      insert into public.business_clients (business_id, full_name, phone_e164, notes)
      values (p_business_id, v_name, v_phone, nullif(trim(coalesce(p_notes, '')), ''))
      returning id into v_id;
    else
      update public.business_clients
         set full_name = v_name, phone_e164 = v_phone, notes = nullif(trim(coalesce(p_notes, '')), '')
       where id = p_client_id and business_id = p_business_id
      returning id into v_id;
      if v_id is null then
        raise exception 'client not found' using errcode = 'BZ404';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'another client already has that phone number' using errcode = 'BZ409';
  end;
  return v_id;
end;
$$;

-- Runs as the caller (security_invoker), so RLS on clients and appointments applies:
-- managers see their business's clients; nobody else sees any rows.
create view public.business_client_summaries with (security_invoker = true) as
select c.id, c.business_id, c.user_id, c.full_name, c.phone_e164, c.notes, c.created_at,
       count(a.id) filter (where a.status = 'completed')::int                         as visits,
       count(a.id) filter (where a.status = 'no_show')::int                           as no_shows,
       count(a.id) filter (where a.status in ('pending', 'confirmed') and a.starts_at > now())::int as upcoming,
       max(a.starts_at) filter (where a.status in ('completed', 'arrived'))           as last_visit_at,
       coalesce(sum(coalesce(a.final_price_minor, a.price_minor)) filter (where a.status = 'completed'), 0)::bigint as spent_minor
from public.business_clients c
left join public.appointments a on a.client_id = c.id and a.business_id = c.business_id
group by c.id;

revoke all on public.business_client_summaries from anon;
grant select on public.business_client_summaries to authenticated;

-- Staff may read the status history of their own appointments (the sheet shows it).
create policy "staff read their own" on public.appointment_status_history for select to authenticated
  using (appointment_id in (select a.id from public.appointments a
                            join public.staff s on s.id = a.staff_id
                            where s.user_id = (select auth.uid())));

revoke all on function private.can_act_on_staff(uuid, uuid),
                       private.resolve_client(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.create_manual_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text, text, boolean, boolean),
                       public.set_appointment_status(uuid, public.appointment_status, text, int),
                       public.move_appointment(uuid, uuid, timestamptz, boolean),
                       public.save_business_client(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.create_manual_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text, text, boolean, boolean),
                          public.set_appointment_status(uuid, public.appointment_status, text, int),
                          public.move_appointment(uuid, uuid, timestamptz, boolean),
                          public.save_business_client(uuid, uuid, text, text, text)
  to authenticated;
