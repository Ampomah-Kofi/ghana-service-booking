-- Phase 10: admin (suspensions, platform stats, business and user lookups, all changes audited)
-- and provider insights. Admins read through narrow SECURITY DEFINER functions; RLS on tenant
-- tables is unchanged.

-- ---------------------------------------------------------------------------
-- 1. Suspended accounts: can sign in and see their own things, but can't create anything.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column suspended_at      timestamptz,
  add column suspension_reason text check (char_length(suspension_reason) <= 500);
-- No column grants: people can't clear their own suspension.

create or replace function private.is_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.suspended_at is not null from public.profiles p where p.id = p_user), false);
$$;

-- Refuses new bookings, reviews, reports and businesses from a suspended account (whatever the path).
create or replace function private.block_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;  -- system and service-role writes
  end if;
  if tg_table_name = 'appointments' then
    -- A business adding a booking for a customer is not the customer acting.
    if (to_jsonb(new) ->> 'source') <> 'online' or (to_jsonb(new) ->> 'created_by') is distinct from v_uid::text then
      return new;
    end if;
  end if;
  if private.is_suspended(v_uid) then
    raise exception 'your account is suspended. Contact support if you think this is a mistake' using errcode = 'BZ403';
  end if;
  return new;
end;
$$;
create trigger appointments_block_suspended before insert on public.appointments
  for each row execute function private.block_suspended();
create trigger reviews_block_suspended before insert on public.reviews
  for each row execute function private.block_suspended();
create trigger review_reports_block_suspended before insert on public.review_reports
  for each row execute function private.block_suspended();
create trigger businesses_block_suspended before insert on public.businesses
  for each row execute function private.block_suspended();

-- ---------------------------------------------------------------------------
-- 2. Platform overview (any admin).
-- ---------------------------------------------------------------------------
create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  select jsonb_build_object(
    'users',              (select count(*) from public.profiles p where p.deleted_at is null),
    'users_new_7d',       (select count(*) from public.profiles p where p.deleted_at is null and p.created_at > now() - interval '7 days'),
    'users_suspended',    (select count(*) from public.profiles p where p.suspended_at is not null),
    'businesses',         (select jsonb_object_agg(s, c) from (
                             select b.status::text as s, count(*) as c from public.businesses b
                              where b.deleted_at is null group by b.status) t),
    'businesses_new_7d',  (select count(*) from public.businesses b where b.deleted_at is null and b.created_at > now() - interval '7 days'),
    'bookings_7d',        (select count(*) from public.appointments a where a.created_at > now() - interval '7 days'),
    'bookings_30d',       (select count(*) from public.appointments a where a.created_at > now() - interval '30 days'),
    'visits_30d',         (select jsonb_object_agg(s, c) from (
                             select a.status::text as s, count(*) as c from public.appointments a
                              where a.starts_at between now() - interval '30 days' and now() group by a.status) t),
    'verification_pending', (select count(*) from public.businesses b where b.verification_status = 'pending' and b.deleted_at is null),
    'review_reports_open',  (select count(distinct rr.review_id) from public.review_reports rr
                              join public.reviews r on r.id = rr.review_id where r.status = 'published'),
    'reviews_30d',        (select count(*) from public.reviews r where r.created_at > now() - interval '30 days')
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Finding businesses and people (any admin; only what support needs).
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_businesses(
  p_query text default null, p_status public.business_status default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, name text, slug text, status public.business_status,
               verification_status public.business_verification, place text, owner_name text, owner_phone text,
               bookings_30d bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  return query
    select b.id, b.name, b.slug, b.status, b.verification_status,
           coalesce(ci.name, l.locality_text),
           o.full_name, o.phone_e164,
           (select count(*) from public.appointments a where a.business_id = b.id and a.created_at > now() - interval '30 days'),
           b.created_at
      from public.businesses b
      left join lateral (select * from public.business_locations bl where bl.business_id = b.id order by bl.is_primary desc limit 1) l on true
      left join public.cities ci on ci.id = l.city_id
      left join lateral (select p.full_name, p.phone_e164 from public.business_members m join public.profiles p on p.id = m.user_id
                          where m.business_id = b.id and m.role = 'owner' limit 1) o on true
     where b.deleted_at is null
       and (p_status is null or b.status = p_status)
       and (v_q is null or b.name ilike '%' || v_q || '%' or b.slug ilike '%' || v_q || '%'
            or coalesce(ci.name, l.locality_text, '') ilike '%' || v_q || '%')
     order by b.created_at desc
     limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_get_business(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'kind', b.kind, 'status', b.status,
    'verification_status', b.verification_status, 'phone', b.phone_e164, 'whatsapp', b.whatsapp_e164, 'email', b.email,
    'created_at', b.created_at, 'published_at', b.published_at, 'rating_avg', b.rating_avg, 'rating_count', b.rating_count,
    'owners', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone_e164,
                                                             'suspended', p.suspended_at is not null)), '[]')
                 from public.business_members m join public.profiles p on p.id = m.user_id
                where m.business_id = b.id and m.role = 'owner'),
    'team_size', (select count(*) from public.staff s where s.business_id = b.id and s.deleted_at is null),
    'services', (select count(*) from public.services sv where sv.business_id = b.id and sv.deleted_at is null),
    'bookings_30d', (select count(*) from public.appointments a where a.business_id = b.id and a.created_at > now() - interval '30 days'),
    'bookings_total', (select count(*) from public.appointments a where a.business_id = b.id),
    'open_reports', (select count(*) from public.review_reports rr where rr.business_id = b.id)
  ) into v
  from public.businesses b where b.id = p_business_id and b.deleted_at is null;
  if v is null then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  return v;
end;
$$;

create or replace function public.admin_list_users(p_query text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, full_name text, phone_e164 text, email text, created_at timestamptz,
               suspended_at timestamptz, businesses_owned bigint, bookings bigint, admin_role public.admin_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '');
begin
  perform private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  return query
    select p.id, p.full_name, p.phone_e164, p.email, p.created_at, p.suspended_at,
           (select count(*) from public.business_members m where m.user_id = p.id and m.role = 'owner'),
           (select count(*) from public.appointments a where a.customer_user_id = p.id),
           pa.role
      from public.profiles p
      left join public.platform_admins pa on pa.user_id = p.id
     where p.deleted_at is null
       and (v_q is null or p.full_name ilike '%' || v_q || '%' or coalesce(p.email, '') ilike '%' || v_q || '%'
            -- "024 123 4567" and "+233241234567" both find +233241234567 (last 9 digits).
            or (v_digits is not null and char_length(v_digits) >= 6
                and p.phone_e164 like '%' || right(v_digits, 9) || '%'))
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'phone', p.phone_e164, 'email', p.email, 'created_at', p.created_at,
    'suspended_at', p.suspended_at, 'suspension_reason', p.suspension_reason,
    'admin_role', (select pa.role from public.platform_admins pa where pa.user_id = p.id),
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'role', m.role, 'status', b.status)
                                             order by b.name), '[]')
                     from public.business_members m join public.businesses b on b.id = m.business_id
                    where m.user_id = p.id and b.deleted_at is null),
    'bookings', (select count(*) from public.appointments a where a.customer_user_id = p.id),
    'cancelled', (select count(*) from public.appointments a where a.customer_user_id = p.id and a.status = 'cancelled'),
    'no_shows', (select count(*) from public.appointments a where a.customer_user_id = p.id and a.status = 'no_show'),
    'reviews', (select count(*) from public.reviews r where r.user_id = p.id),
    'reports_made', (select count(*) from public.review_reports rr where rr.reporter_id = p.id)
  ) into v
  from public.profiles p where p.id = p_user_id and p.deleted_at is null;
  if v is null then
    raise exception 'person not found' using errcode = 'BZ404';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Suspend / restore (super_admin, moderator). Always with a reason; always audited.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_business_suspended(p_business_id uuid, p_suspended boolean, p_reason text)
returns public.business_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin(array['super_admin', 'moderator']::public.admin_role[]);
  v_biz   public.businesses;
  v_new   public.business_status;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason for the audit log' using errcode = 'BZ422';
  end if;
  select * into v_biz from public.businesses b where b.id = p_business_id and b.deleted_at is null for update;
  if v_biz.id is null then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  if p_suspended then
    if v_biz.status = 'suspended' then
      raise exception 'already suspended' using errcode = 'BZ409';
    end if;
    v_new := 'suspended';
  else
    if v_biz.status <> 'suspended' then
      raise exception 'this business isn''t suspended' using errcode = 'BZ409';
    end if;
    -- Back to where it was: live if it had been published, otherwise a draft to finish.
    v_new := case when v_biz.published_at is not null then 'published' else 'draft' end;
  end if;
  update public.businesses set status = v_new where id = p_business_id;
  insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
  values (v_admin, case when p_suspended then 'business.suspend' else 'business.restore' end, 'businesses',
          p_business_id::text, trim(p_reason),
          jsonb_build_object('status', v_biz.status, 'name', v_biz.name), jsonb_build_object('status', v_new));
  return v_new;
end;
$$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin(array['super_admin', 'moderator']::public.admin_role[]);
  v_prof  public.profiles;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason for the audit log' using errcode = 'BZ422';
  end if;
  if p_user_id = v_admin then
    raise exception 'you can''t suspend yourself' using errcode = 'BZ409';
  end if;
  if exists (select 1 from public.platform_admins pa where pa.user_id = p_user_id) then
    raise exception 'admins are managed separately' using errcode = 'BZ409';
  end if;
  select * into v_prof from public.profiles p where p.id = p_user_id and p.deleted_at is null for update;
  if v_prof.id is null then
    raise exception 'person not found' using errcode = 'BZ404';
  end if;
  if p_suspended = (v_prof.suspended_at is not null) then
    raise exception '%', case when p_suspended then 'already suspended' else 'this account isn''t suspended' end
      using errcode = 'BZ409';
  end if;
  update public.profiles
     set suspended_at = case when p_suspended then now() end,
         suspension_reason = case when p_suspended then left(trim(p_reason), 500) end
   where id = p_user_id;
  insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
  values (v_admin, case when p_suspended then 'user.suspend' else 'user.restore' end, 'profiles', p_user_id::text,
          trim(p_reason), jsonb_build_object('suspended_at', v_prof.suspended_at),
          jsonb_build_object('suspended', p_suspended));
end;
$$;

-- Am I suspended? (the app shows a notice; the triggers above do the enforcing)
create or replace function public.my_suspension()
returns table (suspended_at timestamptz, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.suspended_at, p.suspension_reason from public.profiles p
   where p.id = auth.uid() and p.suspended_at is not null;
$$;

-- ---------------------------------------------------------------------------
-- 5. Provider insights (SPEC §16): owners and managers of the business, in its timezone.
-- ---------------------------------------------------------------------------
create or replace function public.business_insights(p_business_id uuid, p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     text;
  v_days   int := case when p_days in (7, 30, 90) then p_days else 30 end;
  v_to     date;
  v_from   date;
  v_start  timestamptz;
  v_end    timestamptz;
  v_result jsonb;
begin
  if not private.has_business_role(p_business_id, array['owner', 'manager']::public.member_role[]) then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  v_to := (now() at time zone v_tz)::date;
  v_from := v_to - (v_days - 1);
  v_start := v_from::timestamp at time zone v_tz;
  v_end := (v_to + 1)::timestamp at time zone v_tz;

  with appts as (
    select a.*, (a.starts_at at time zone v_tz)::date as local_day
      from public.appointments a
     where a.business_id = p_business_id and a.starts_at >= v_start and a.starts_at < v_end
       -- A reschedule cancels the old booking; count only the new one.
       and not (a.status = 'cancelled' and coalesce(a.cancellation_reason, '') = 'Rescheduled')
  ),
  days as (
    select d::date as day from generate_series(v_from, v_to, interval '1 day') d
  ),
  first_visits as (
    -- A client's first booking at this business ever (not counting cancellations).
    select a.client_id, min(a.starts_at) as first_at
      from public.appointments a
     where a.business_id = p_business_id and a.client_id is not null and a.status <> 'cancelled'
     group by a.client_id
  ),
  clients as (
    select distinct a.client_id from appts a where a.client_id is not null and a.status <> 'cancelled'
  )
  select jsonb_build_object(
    'days', v_days, 'from', v_from, 'to', v_to, 'timezone', v_tz,
    'bookings', (select count(*) from appts),
    'by_status', (select coalesce(jsonb_object_agg(s, c), '{}') from (
                    select a.status::text as s, count(*) as c from appts a group by a.status) t),
    'by_source', (select coalesce(jsonb_object_agg(s, c), '{}') from (
                    select a.source::text as s, count(*) as c from appts a group by a.source) t),
    'per_day', (select jsonb_agg(jsonb_build_object(
                         'day', d.day,
                         'bookings', (select count(*) from appts a where a.local_day = d.day and a.status <> 'cancelled'),
                         'completed', (select count(*) from appts a where a.local_day = d.day and a.status = 'completed'))
                       order by d.day)
                  from days d),
    'completed_value_minor', (select coalesce(sum(coalesce(a.final_price_minor, a.price_minor)), 0)
                                from appts a where a.status = 'completed'),
    'recorded_minor', (select coalesce(sum(p.amount_minor), 0) from public.payments p
                        where p.business_id = p_business_id and p.refunded_at is null
                          and p.paid_at >= v_start and p.paid_at < v_end),
    'refunded_minor', (select coalesce(sum(p.amount_minor), 0) from public.payments p
                        where p.business_id = p_business_id and p.refunded_at >= v_start and p.refunded_at < v_end),
    'currency', (select b.currency_code from public.businesses b where b.id = p_business_id),
    'top_services', (select coalesce(jsonb_agg(t order by t.count desc, t.name), '[]') from (
                       select a.service_name as name, count(*) as count,
                              sum(coalesce(a.final_price_minor, a.price_minor)) filter (where a.status = 'completed') as completed_value_minor
                         from appts a where a.status <> 'cancelled'
                        group by a.service_name order by count(*) desc, a.service_name limit 5) t),
    'top_staff', (select coalesce(jsonb_agg(t order by t.count desc, t.name), '[]') from (
                    select coalesce(s.display_name, 'Someone') as name, count(*) as count
                      from appts a left join public.staff s on s.id = a.staff_id
                     where a.status <> 'cancelled'
                     group by s.display_name order by count(*) desc, s.display_name limit 5) t),
    'customers', (select jsonb_build_object(
                    'total', count(*),
                    'new', count(*) filter (where fv.first_at >= v_start),
                    'returning', count(*) filter (where fv.first_at < v_start))
                    from clients c join first_visits fv on fv.client_id = c.client_id)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.admin_platform_stats() from public, anon;
revoke all on function public.admin_list_businesses(text, public.business_status, int, int) from public, anon;
revoke all on function public.admin_get_business(uuid) from public, anon;
revoke all on function public.admin_list_users(text, int, int) from public, anon;
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_set_business_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.my_suspension() from public, anon;
revoke all on function public.business_insights(uuid, int) from public, anon;
grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_businesses(text, public.business_status, int, int) to authenticated;
grant execute on function public.admin_get_business(uuid) to authenticated;
grant execute on function public.admin_list_users(text, int, int) to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_set_business_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.my_suspension() to authenticated;
grant execute on function public.business_insights(uuid, int) to authenticated;
revoke all on function private.is_suspended(uuid) from public, anon, authenticated;
