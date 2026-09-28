-- "Price on request": no amount (stored as 0), never counted as a starting price, and the
-- business enters the final amount when completing (like "from" prices).
alter table public.services
  add constraint services_on_request_has_no_amount check (price_type <> 'on_request' or price_minor = 0);
alter table public.services
  add constraint services_on_request_no_deposit check (price_type <> 'on_request' or deposit_minor is null);

-- Starting prices ignore "on request" services (otherwise cards would say "From GH₵ 0").
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
  distance_m double precision, rank real, total_count bigint
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
           b.search_document,
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
         s.dist, s.score, count(*) over ()
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
  distance_m double precision, rank real, total_count bigint, saved_at timestamptz
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
         null::double precision, 0::real, count(*) over (), f.created_at
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
