-- Phase 3 functions. SQLSTATEs as in Phase 2: BZ401/403/404/409/422/429.

-- ---------------------------------------------------------------------------
-- Weekly hours: [{"weekday":1,"opens":"09:00","closes":"13:00"}, …]
-- ---------------------------------------------------------------------------
create or replace function private.parse_week_hours(p_hours jsonb)
returns table (weekday smallint, during public.timerange)
language plpgsql
immutable
set search_path = ''
as $$
declare
  item    jsonb;
  v_day   int;
  v_open  time;
  v_close time;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then
    raise exception 'hours must be a list' using errcode = 'BZ422';
  end if;
  if jsonb_array_length(p_hours) > 28 then
    raise exception 'too many time ranges' using errcode = 'BZ422';
  end if;
  for item in select * from jsonb_array_elements(p_hours) loop
    begin
      v_day := (item ->> 'weekday')::int;
      v_open := (item ->> 'opens')::time;
      v_close := (item ->> 'closes')::time;
    exception when others then
      raise exception 'each time range needs a weekday, an opening time and a closing time' using errcode = 'BZ422';
    end;
    if v_day is null or v_day not between 1 and 7 or v_open is null or v_close is null then
      raise exception 'each time range needs a weekday, an opening time and a closing time' using errcode = 'BZ422';
    end if;
    if v_close <= v_open then
      raise exception 'closing time must be after opening time' using errcode = 'BZ422';
    end if;
    if extract(minute from v_open)::int % 5 <> 0 or extract(minute from v_close)::int % 5 <> 0
       or extract(second from v_open) <> 0 or extract(second from v_close) <> 0 then
      raise exception 'use times in 5-minute steps' using errcode = 'BZ422';
    end if;
    weekday := v_day;
    during := public.timerange(v_open, v_close, '[)');
    return next;
  end loop;
end;
$$;

create or replace function public.set_business_hours(p_business_id uuid, p_hours jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  delete from public.business_hours where business_id = p_business_id;
  begin
    insert into public.business_hours (business_id, weekday, during)
    select p_business_id, h.weekday, h.during from private.parse_week_hours(p_hours) h;
  exception when exclusion_violation then
    raise exception 'opening times overlap on the same day' using errcode = 'BZ422';
  end;
end;
$$;

create or replace function public.set_staff_hours(p_staff_id uuid, p_uses_business_hours boolean, p_hours jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select s.business_id into v_business_id from public.staff s where s.id = p_staff_id and s.deleted_at is null;
  if v_business_id is null or not private.can_manage_business(v_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  update public.staff set uses_business_hours = p_uses_business_hours where id = p_staff_id;
  delete from public.staff_working_hours where staff_id = p_staff_id;
  if not p_uses_business_hours then
    if p_hours is null or jsonb_array_length(p_hours) = 0 then
      raise exception 'add at least one working period, or use the business hours' using errcode = 'BZ422';
    end if;
    begin
      insert into public.staff_working_hours (business_id, staff_id, weekday, during)
      select v_business_id, p_staff_id, h.weekday, h.during from private.parse_week_hours(p_hours) h;
    exception when exclusion_violation then
      raise exception 'working times overlap on the same day' using errcode = 'BZ422';
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who performs what (atomic replace from either side)
-- ---------------------------------------------------------------------------
create or replace function public.set_service_staff(p_service_id uuid, p_staff_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select sv.business_id into v_business_id from public.services sv where sv.id = p_service_id and sv.deleted_at is null;
  if v_business_id is null or not private.can_manage_business(v_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if exists (select 1 from unnest(coalesce(p_staff_ids, '{}')) sid
             where not exists (select 1 from public.staff s
                               where s.id = sid and s.business_id = v_business_id and s.deleted_at is null)) then
    raise exception 'unknown staff member' using errcode = 'BZ422';
  end if;
  delete from public.staff_services where service_id = p_service_id;
  insert into public.staff_services (business_id, staff_id, service_id)
  select distinct v_business_id, sid, p_service_id from unnest(coalesce(p_staff_ids, '{}')) sid;
end;
$$;

create or replace function public.set_staff_services(p_staff_id uuid, p_service_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select s.business_id into v_business_id from public.staff s where s.id = p_staff_id and s.deleted_at is null;
  if v_business_id is null or not private.can_manage_business(v_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if exists (select 1 from unnest(coalesce(p_service_ids, '{}')) svid
             where not exists (select 1 from public.services sv
                               where sv.id = svid and sv.business_id = v_business_id and sv.deleted_at is null)) then
    raise exception 'unknown service' using errcode = 'BZ422';
  end if;
  delete from public.staff_services where staff_id = p_staff_id;
  insert into public.staff_services (business_id, staff_id, service_id)
  select distinct v_business_id, p_staff_id, svid from unnest(coalesce(p_service_ids, '{}')) svid;
end;
$$;

-- Soft-remove a staff member: hidden from customers, loses access, history kept.
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
  update public.staff set deleted_at = now(), is_active = false where id = p_staff_id;
  delete from public.staff_services where staff_id = p_staff_id;
  update public.staff_invites set revoked_at = now() where staff_id = p_staff_id and accepted_at is null and revoked_at is null;
  if v_staff.user_id is not null then
    delete from public.business_members where business_id = v_staff.business_id and user_id = v_staff.user_id and role <> 'owner';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocked times. Local wall-clock input, converted with the business timezone.
-- Takes the per-staff advisory lock that booking will also take (ADR-0003);
-- the check against existing appointments is added in Phase 5.
-- ---------------------------------------------------------------------------
create or replace function private.lock_staff(p_staff_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staff:' || p_staff_id::text, 0));
$$;

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
    perform private.lock_staff(v_sid);  -- stable order: no deadlocks
  end loop;

  insert into public.blocked_times (business_id, staff_id, during, reason, created_by)
  values (p_business_id, p_staff_id, tstzrange(v_start, v_end, '[)'), nullif(trim(p_reason), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff invites
-- ---------------------------------------------------------------------------
create or replace function private.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function public.invite_staff(p_staff_id uuid, p_phone_e164 text, p_role public.member_role default 'staff')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff public.staff;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');  -- 244 random bits
begin
  select * into v_staff from public.staff s where s.id = p_staff_id and s.deleted_at is null;
  if v_staff.id is null or not private.can_manage_business(v_staff.business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if p_role not in ('staff', 'manager') then
    raise exception 'invites can be for staff or managers' using errcode = 'BZ422';
  end if;
  if p_role = 'manager' and not private.is_business_owner(v_staff.business_id) then
    raise exception 'only the owner can invite managers' using errcode = 'BZ403';
  end if;
  if v_staff.user_id is not null then
    raise exception 'this team member already has an account linked' using errcode = 'BZ409';
  end if;
  if p_phone_e164 !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid phone number' using errcode = 'BZ422';
  end if;
  update public.staff_invites set revoked_at = now()
   where staff_id = p_staff_id and accepted_at is null and revoked_at is null;
  insert into public.staff_invites (business_id, staff_id, phone_e164, role, token_hash, invited_by)
  values (v_staff.business_id, p_staff_id, p_phone_e164, p_role, private.hash_invite_token(v_token), auth.uid());
  return v_token;
end;
$$;

create or replace function public.revoke_staff_invite(p_staff_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  select s.business_id into v_business_id from public.staff s where s.id = p_staff_id;
  if v_business_id is null or not private.can_manage_business(v_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  update public.staff_invites set revoked_at = now()
   where staff_id = p_staff_id and accepted_at is null and revoked_at is null;
end;
$$;

-- What the invite page shows before accepting. Reveals nothing without the token.
create or replace function public.get_staff_invite(p_token text)
returns table (business_name text, staff_name text, role public.member_role, phone_hint text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.staff_invites;
  v_phone  text;
begin
  if auth.uid() is null then
    raise exception 'sign in to view this invite' using errcode = 'BZ401';
  end if;
  select * into v_invite from public.staff_invites i where i.token_hash = private.hash_invite_token(p_token);
  if v_invite.id is null then
    raise exception 'invite not found' using errcode = 'BZ404';
  end if;
  select p.phone_e164 into v_phone from public.profiles p where p.id = auth.uid();
  return query
  select b.name, s.display_name, v_invite.role,
         left(v_invite.phone_e164, 4) || ' ••• ' || right(v_invite.phone_e164, 4),
         case when v_invite.accepted_at is not null then 'used'
              when v_invite.revoked_at is not null then 'revoked'
              when v_invite.expires_at < now() then 'expired'
              when v_phone is distinct from v_invite.phone_e164 then 'wrong_phone'
              else 'valid' end
  from public.businesses b join public.staff s on s.id = v_invite.staff_id
  where b.id = v_invite.business_id;
end;
$$;

create or replace function public.accept_staff_invite(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.staff_invites;
  v_phone  text;
begin
  if v_uid is null then
    raise exception 'sign in to accept this invite' using errcode = 'BZ401';
  end if;
  select * into v_invite from public.staff_invites i where i.token_hash = private.hash_invite_token(p_token) for update;
  if v_invite.id is null then
    raise exception 'invite not found' using errcode = 'BZ404';
  end if;
  if v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at < now() then
    raise exception 'this invite is no longer valid; ask for a new one' using errcode = 'BZ409';
  end if;
  select p.phone_e164 into v_phone from public.profiles p where p.id = v_uid;
  if v_phone is distinct from v_invite.phone_e164 then
    raise exception 'this invite is for a different phone number; sign in with the number it was sent to' using errcode = 'BZ403';
  end if;
  if exists (select 1 from public.staff s where s.business_id = v_invite.business_id and s.user_id = v_uid and s.deleted_at is null) then
    raise exception 'you are already on this team' using errcode = 'BZ409';
  end if;

  update public.staff set user_id = v_uid where id = v_invite.staff_id and user_id is null;
  if not found then
    raise exception 'this team member already has an account linked' using errcode = 'BZ409';
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (v_invite.business_id, v_uid, v_invite.role)
  on conflict (business_id, user_id) do nothing;
  update public.staff_invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  return v_invite.business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing now also needs bookable services and opening hours.
-- ---------------------------------------------------------------------------
create or replace function public.business_publish_readiness(p_business_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
  v_b public.businesses;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  select * into v_b from public.businesses b where b.id = p_business_id;
  if not exists (select 1 from public.business_categories bc where bc.business_id = p_business_id and bc.is_primary) then
    v_missing := array_append(v_missing, 'category');
  end if;
  if not exists (select 1 from public.business_locations l where l.business_id = p_business_id and l.is_primary) then
    v_missing := array_append(v_missing, 'location');
  end if;
  if v_b.phone_e164 is null and v_b.whatsapp_e164 is null then
    v_missing := array_append(v_missing, 'contact');
  end if;
  -- At least one active service that an active team member performs.
  if not exists (select 1 from public.services sv
                 join public.staff_services ss on ss.service_id = sv.id
                 join public.staff s on s.id = ss.staff_id
                 where sv.business_id = p_business_id and sv.is_active and sv.deleted_at is null
                   and s.is_active and s.deleted_at is null) then
    v_missing := array_append(v_missing, 'services');
  end if;
  if not exists (select 1 from public.business_hours h where h.business_id = p_business_id) then
    v_missing := array_append(v_missing, 'hours');
  end if;
  return v_missing;
end;
$$;

-- New businesses start with Mon–Sat 09:00–18:00 so the hours step is a quick check, not a chore.
create or replace function public.create_business(
  p_name          text,
  p_kind          public.business_kind,
  p_category_id   uuid,
  p_country_code  char(2)
)
returns table (id uuid, slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_name      text := trim(p_name);
  v_country   public.countries;
  v_slug      text;
  v_id        uuid;
  v_staff_nm  text;
  attempt     int := 0;
begin
  if v_uid is null then
    raise exception 'sign in to create a business' using errcode = 'BZ401';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'business name must be 2 to 120 characters' using errcode = 'BZ422';
  end if;
  select * into v_country from public.countries c where c.code = p_country_code and c.is_active;
  if v_country.code is null then
    raise exception 'country not supported' using errcode = 'BZ422';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'unknown category' using errcode = 'BZ422';
  end if;
  if (select count(*) from public.businesses b where b.created_by = v_uid and b.deleted_at is null) >= 5 then
    raise exception 'you can create at most 5 businesses' using errcode = 'BZ429';
  end if;

  loop
    attempt := attempt + 1;
    v_slug := private.next_free_slug(private.slugify(v_name));
    begin
      insert into public.businesses (slug, name, kind, status, country_code, currency_code, timezone, created_by)
      values (v_slug, v_name, p_kind, 'draft', v_country.code, v_country.currency_code, v_country.default_timezone, v_uid)
      returning businesses.id into v_id;
      exit;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;

  insert into public.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.booking_rules (business_id) values (v_id);
  insert into public.business_categories (business_id, category_id, is_primary) values (v_id, p_category_id, true);
  insert into public.business_hours (business_id, weekday, during)
  select v_id, d, public.timerange('09:00', '18:00', '[)') from generate_series(1, 6) d;

  select coalesce(nullif(trim(p.full_name), ''), v_name) into v_staff_nm from public.profiles p where p.id = v_uid;
  insert into public.staff (business_id, user_id, display_name, sort_order)
  values (v_id, v_uid, left(coalesce(v_staff_nm, v_name), 80), 0);

  return query select v_id, v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: categories (audited). Super admins only.
-- ---------------------------------------------------------------------------
create or replace function private.require_admin(p_roles public.admin_role[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.platform_admins a where a.user_id = v_uid and a.role = any (p_roles)) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  return v_uid;
end;
$$;

create or replace function public.admin_save_category(
  p_id           uuid,
  p_name         text,
  p_slug         text,
  p_description  text,
  p_keywords     text[],
  p_sort_order   int,
  p_is_active    boolean,
  p_reason       text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := private.require_admin(array['super_admin']::public.admin_role[]);
  v_before jsonb;
  v_after  jsonb;
  v_id     uuid;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason for the audit log' using errcode = 'BZ422';
  end if;
  begin
    if p_id is null then
      insert into public.categories (name, slug, description, search_keywords, sort_order, is_active)
      values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_description), ''), coalesce(p_keywords, '{}'), p_sort_order, p_is_active)
      returning id into v_id;
    else
      select to_jsonb(c) into v_before from public.categories c where c.id = p_id;
      if v_before is null then
        raise exception 'category not found' using errcode = 'BZ404';
      end if;
      update public.categories
         set name = trim(p_name), slug = lower(trim(p_slug)), description = nullif(trim(p_description), ''),
             search_keywords = coalesce(p_keywords, '{}'), sort_order = p_sort_order, is_active = p_is_active
       where id = p_id
      returning id into v_id;
    end if;
  exception
    when unique_violation then raise exception 'that category slug is taken' using errcode = 'BZ409';
    when check_violation then raise exception 'check the name and slug (lowercase letters, numbers, hyphens)' using errcode = 'BZ422';
  end;
  select to_jsonb(c) into v_after from public.categories c where c.id = v_id;
  insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
  values (v_admin, case when p_id is null then 'category.create' else 'category.update' end,
          'categories', v_id::text, trim(p_reason), v_before, v_after);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function private.parse_week_hours(jsonb), private.lock_staff(uuid), private.hash_invite_token(text),
                       private.require_admin(public.admin_role[])
  from public, anon, authenticated;

revoke all on function public.set_business_hours(uuid, jsonb),
                       public.set_staff_hours(uuid, boolean, jsonb),
                       public.set_service_staff(uuid, uuid[]),
                       public.set_staff_services(uuid, uuid[]),
                       public.remove_staff_member(uuid),
                       public.create_blocked_time(uuid, uuid, timestamp, timestamp, text),
                       public.invite_staff(uuid, text, public.member_role),
                       public.revoke_staff_invite(uuid),
                       public.get_staff_invite(text),
                       public.accept_staff_invite(text),
                       public.admin_save_category(uuid, text, text, text, text[], int, boolean, text)
  from public, anon;
grant execute on function public.set_business_hours(uuid, jsonb),
                          public.set_staff_hours(uuid, boolean, jsonb),
                          public.set_service_staff(uuid, uuid[]),
                          public.set_staff_services(uuid, uuid[]),
                          public.remove_staff_member(uuid),
                          public.create_blocked_time(uuid, uuid, timestamp, timestamp, text),
                          public.invite_staff(uuid, text, public.member_role),
                          public.revoke_staff_invite(uuid),
                          public.get_staff_invite(text),
                          public.accept_staff_invite(text),
                          public.admin_save_category(uuid, text, text, text, text[], int, boolean, text)
  to authenticated;
