-- Verified businesses (ADR-0015): a check mark a platform admin grants after checking the owner's
-- details. Owners apply; only admins decide; every decision is in the audit log. Renaming a verified
-- business removes the check until it's checked again (the name is what was verified).

create type public.business_verification as enum ('none', 'pending', 'verified', 'declined');

alter table public.businesses
  add column verification_status       public.business_verification not null default 'none',
  add column verification_requested_at timestamptz,
  add column verified_at               timestamptz,
  add constraint businesses_verified_has_date check (verification_status <> 'verified' or verified_at is not null);
-- No column grants: owners can read these (their row is readable) but never write them directly.

-- The admin's note to the owner ("We couldn't reach you on…"). Business rows are public, so the note
-- lives in its own table that only the owner and platform admins can read. Written by the functions only.
create table public.business_verification_notes (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  note        text not null check (char_length(note) between 1 and 300),
  updated_at  timestamptz not null default now()
);
alter table public.business_verification_notes enable row level security;
create policy "owner or admin reads the note" on public.business_verification_notes
  for select to authenticated
  using ((select private.is_business_owner(business_id)) or (select private.is_platform_admin()));
revoke all on public.business_verification_notes from anon;
grant select on public.business_verification_notes to authenticated;

create index businesses_verification_pending on public.businesses (verification_requested_at)
  where verification_status = 'pending';

-- An owner asks for the check. Published pages only (there must be something to check).
create or replace function public.request_business_verification(p_business_id uuid)
returns public.business_verification
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.business_verification;
  v_published boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  if not private.is_business_owner(p_business_id) then
    raise exception 'only the owner can apply for verification' using errcode = 'BZ403';
  end if;
  select b.verification_status, b.status = 'published' into v_status, v_published
    from public.businesses b where b.id = p_business_id and b.deleted_at is null for update;
  if v_status is null then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  if not v_published then
    raise exception 'publish your page first' using errcode = 'BZ409';
  end if;
  if v_status in ('pending', 'verified') then
    return v_status;  -- nothing to do; asking twice is harmless
  end if;
  update public.businesses
     set verification_status = 'pending', verification_requested_at = now()
   where id = p_business_id;
  delete from public.business_verification_notes where business_id = p_business_id;
  return 'pending';
end;
$$;

-- An admin decides: 'verified', 'declined', or 'none' (remove a check). Always audited.
create or replace function public.admin_set_business_verification(
  p_business_id uuid, p_status public.business_verification, p_reason text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := private.require_admin(array['super_admin', 'moderator', 'support']::public.admin_role[]);
  v_before jsonb;
  v_after  jsonb;
begin
  if p_status = 'pending' then
    raise exception 'decide verified, declined or none' using errcode = 'BZ422';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason for the audit log' using errcode = 'BZ422';
  end if;
  select jsonb_build_object('verification_status', b.verification_status, 'verified_at', b.verified_at, 'name', b.name)
    into v_before from public.businesses b where b.id = p_business_id and b.deleted_at is null for update;
  if v_before is null then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  update public.businesses
     set verification_status = p_status,
         verified_at = case when p_status = 'verified' then now() end
   where id = p_business_id;
  if nullif(trim(coalesce(p_note, '')), '') is null then
    delete from public.business_verification_notes where business_id = p_business_id;
  else
    insert into public.business_verification_notes (business_id, note) values (p_business_id, left(trim(p_note), 300))
    on conflict (business_id) do update set note = excluded.note, updated_at = now();
  end if;
  select jsonb_build_object('verification_status', b.verification_status, 'verified_at', b.verified_at, 'name', b.name,
                            'note', nullif(trim(coalesce(p_note, '')), ''))
    into v_after from public.businesses b where b.id = p_business_id;
  insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
  values (v_admin, 'business.verification', 'businesses', p_business_id::text, trim(p_reason), v_before, v_after);
end;
$$;

-- The name is what was checked: a verified business that renames itself goes back to unverified.
create or replace function private.businesses_rename_unverifies()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name and old.verification_status in ('verified', 'pending') then
    new.verification_status := 'none';
    new.verified_at := null;
    new.verification_requested_at := null;
  end if;
  return new;
end;
$$;
create trigger businesses_rename_unverifies before update of name on public.businesses
  for each row execute function private.businesses_rename_unverifies();

revoke all on function public.request_business_verification(uuid) from public, anon;
revoke all on function public.admin_set_business_verification(uuid, public.business_verification, text, text) from public, anon;
grant execute on function public.request_business_verification(uuid) to authenticated;
grant execute on function public.admin_set_business_verification(uuid, public.business_verification, text, text) to authenticated;

-- Result cards carry the check (a new last column, so the functions are recreated).
drop function public.search_businesses(text, uuid, uuid, uuid, uuid, double precision, double precision, int, text, int, int);
drop function public.my_favorite_businesses(int, int);

create or replace function public.search_businesses(
  p_text         text default null,
  p_category_id  uuid default null,
  p_area_id      uuid default null,
  p_city_id      uuid default null,
  p_region_id    uuid default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_radius_km    int default 25,
  p_sort         text default 'relevance',   -- relevance | distance | newest
  p_limit        int default 20,
  p_offset       int default 0
)
returns table (
  id uuid, slug text, name text, logo_path text, photo_path text,
  category_name text, category_slug text, area_name text, city_name text, locality_text text,
  min_price_minor int, has_from_price boolean, currency_code char(3),
  rating_avg numeric, rating_count int, next_available_at timestamptz, published_at timestamptz,
  distance_m double precision, rank real, total_count bigint, is_verified boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_words text[];
  v_query tsquery;
  v_text  text := trim(private.search_text(p_text));
  v_point extensions.geography;
begin
  if p_limit not between 1 and 50 or p_offset not between 0 and 1000 then
    raise exception 'limit must be 1-50 and offset 0-1000' using errcode = 'BZ422';
  end if;
  if p_radius_km not between 1 and 200 then
    raise exception 'radius must be 1-200 km' using errcode = 'BZ422';
  end if;
  if p_lat is not null and p_lng is not null then
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;
  -- Prefix match on each word ("barb" finds "barber"); only letters/digits reach to_tsquery.
  v_words := array(select w from regexp_split_to_table(v_text, '[^a-z0-9]+') w where length(w) >= 2 limit 6);
  if cardinality(v_words) > 0 then
    v_query := to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(v_words) w), ' & '));
  end if;

  return query
  with candidates as (
    select b.id, b.slug, b.name, b.logo_path, b.rating_avg, b.rating_count, b.next_available_at, b.published_at,
           b.search_document, b.verification_status,
           l.area_id, l.city_id, l.region_id, l.locality_text, l.geo
    from public.businesses b
    left join public.business_locations l on l.business_id = b.id and l.is_primary
    where b.status = 'published' and b.deleted_at is null
      and (p_category_id is null or exists (
            select 1 from public.business_categories bc where bc.business_id = b.id and bc.category_id = p_category_id))
      and (p_area_id is null or l.city_id = (select a.city_id from public.areas a where a.id = p_area_id))
      and (p_city_id is null or l.city_id = p_city_id)
      and (p_region_id is null or l.region_id = p_region_id)
      and (v_point is null or extensions.st_dwithin(l.geo, v_point, p_radius_km * 1000))
      and (v_query is null or b.search_document @@ v_query
           or extensions.similarity(private.search_text(b.name), v_text) >= 0.3)
  ),
  scored as (
    select c.*,
           case when v_point is not null and c.geo is not null then extensions.st_distance(c.geo, v_point) end as dist,
           (case when v_query is not null then ts_rank(c.search_document, v_query) else 0 end
            + case when v_text <> '' then extensions.similarity(private.search_text(c.name), v_text) else 0 end
            -- the exact neighbourhood asked for first, then the rest of its city
            + case when p_area_id is not null and c.area_id = p_area_id then 1 else 0 end
            + coalesce(c.rating_avg, 0) / 50)::real as score
    from candidates c
  )
  select s.id, s.slug, s.name, s.logo_path,
         (select ph.path_small from public.business_photos ph where ph.business_id = s.id order by ph.sort_order, ph.created_at limit 1),
         pc.name, pc.slug, a.name, ci.name, s.locality_text,
         pr.min_price, pr.has_from, pr.currency_code,
         s.rating_avg, s.rating_count, s.next_available_at, s.published_at,
         s.dist, s.score, count(*) over (), s.verification_status = 'verified'
  from scored s
  left join lateral (
    select c.name, c.slug from public.business_categories bc join public.categories c on c.id = bc.category_id
    where bc.business_id = s.id and bc.is_primary limit 1) pc on true
  left join public.areas a on a.id = s.area_id
  left join public.cities ci on ci.id = s.city_id
  left join lateral (
    select min(sv.price_minor)::int as min_price, bool_or(sv.price_type = 'from') as has_from, min(sv.currency_code)::char(3) as currency_code
    from public.services sv where sv.business_id = s.id and sv.is_active and sv.deleted_at is null
      and sv.price_type <> 'on_request') pr on true
  order by
    case when p_sort = 'distance' then s.dist end asc nulls last,
    case when p_sort = 'newest' then s.published_at end desc nulls last,
    s.score desc, s.published_at desc, s.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.my_favorite_businesses(p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, slug text, name text, logo_path text, photo_path text,
  category_name text, category_slug text, area_name text, city_name text, locality_text text,
  min_price_minor int, has_from_price boolean, currency_code char(3),
  rating_avg numeric, rating_count int, next_available_at timestamptz, published_at timestamptz,
  distance_m double precision, rank real, total_count bigint, saved_at timestamptz, is_verified boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  if p_limit not between 1 and 100 or p_offset not between 0 and 1000 then
    raise exception 'limit must be 1-100 and offset 0-1000' using errcode = 'BZ422';
  end if;
  return query
  select b.id, b.slug, b.name, b.logo_path,
         (select ph.path_small from public.business_photos ph where ph.business_id = b.id order by ph.sort_order, ph.created_at limit 1),
         pc.name, pc.slug, a.name, ci.name, l.locality_text,
         pr.min_price, pr.has_from, pr.currency_code,
         b.rating_avg, b.rating_count, b.next_available_at, b.published_at,
         null::double precision, 0::real, count(*) over (), f.created_at, b.verification_status = 'verified'
  from public.favorites f
  join public.businesses b on b.id = f.business_id and b.status = 'published' and b.deleted_at is null
  left join public.business_locations l on l.business_id = b.id and l.is_primary
  left join lateral (
    select c.name, c.slug from public.business_categories bc join public.categories c on c.id = bc.category_id
    where bc.business_id = b.id and bc.is_primary limit 1) pc on true
  left join public.areas a on a.id = l.area_id
  left join public.cities ci on ci.id = l.city_id
  left join lateral (
    select min(sv.price_minor)::int as min_price, bool_or(sv.price_type = 'from') as has_from, min(sv.currency_code)::char(3) as currency_code
    from public.services sv where sv.business_id = b.id and sv.is_active and sv.deleted_at is null
      and sv.price_type <> 'on_request') pr on true
  where f.user_id = auth.uid()
  order by f.created_at desc, b.id
  limit p_limit offset p_offset;
end;
$$;

grant execute on function public.search_businesses(text, uuid, uuid, uuid, uuid, double precision, double precision, int, text, int, int) to anon, authenticated;
revoke all on function public.my_favorite_businesses(int, int) from public, anon;
grant execute on function public.my_favorite_businesses(int, int) to authenticated;
