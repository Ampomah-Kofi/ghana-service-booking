-- Phase 4: marketplace search (ADR-0007). Postgres only: a weighted tsvector per
-- business + pg_trgm for fuzzy names/places + PostGIS distance.

alter table public.businesses add column search_document tsvector;
create index businesses_search_document on public.businesses using gin (search_document);
create index businesses_published_recent on public.businesses (published_at desc) where status = 'published' and deleted_at is null;
create index categories_name_trgm on public.categories using gin (lower(name) extensions.gin_trgm_ops);
create index regions_name_trgm on public.regions using gin (name extensions.gin_trgm_ops);

-- Accent-insensitive, language-neutral text (names are multilingual, so no stemming).
create or replace function private.search_text(p_text text)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(extensions.unaccent(coalesce(p_text, '')));
$$;

-- Rebuilds one business's search document from its name (A), categories, keywords and
-- services (B), places (C) and description (D).
create or replace function private.refresh_business_search(p_business_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.businesses b
     set search_document =
           setweight(to_tsvector('simple', private.search_text(b.name)), 'A')
        || setweight(to_tsvector('simple', private.search_text(coalesce((
              select string_agg(c.name || ' ' || array_to_string(c.search_keywords, ' '), ' ')
              from public.business_categories bc join public.categories c on c.id = bc.category_id
              where bc.business_id = b.id), ''))), 'B')
        || setweight(to_tsvector('simple', private.search_text(coalesce((
              select string_agg(sv.name, ' ') from public.services sv
              where sv.business_id = b.id and sv.is_active and sv.deleted_at is null), ''))), 'B')
        || setweight(to_tsvector('simple', private.search_text(coalesce((
              select concat_ws(' ', a.name, ci.name, r.name, l.locality_text)
              from public.business_locations l
              left join public.areas a on a.id = l.area_id
              left join public.cities ci on ci.id = l.city_id
              left join public.regions r on r.id = l.region_id
              where l.business_id = b.id and l.is_primary), ''))), 'C')
        || setweight(to_tsvector('simple', private.search_text(coalesce(b.description, ''))), 'D')
   where b.id = p_business_id;
end;
$$;

create or replace function private.refresh_business_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_business_search(coalesce(new.business_id, old.business_id));
  return null;
end;
$$;

create or replace function private.businesses_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_business_search(new.id);
  return null;
end;
$$;

create trigger businesses_search_refresh after insert or update of name, description on public.businesses
  for each row execute function private.businesses_search_trigger();
create trigger business_categories_search_refresh after insert or update or delete on public.business_categories
  for each row execute function private.refresh_business_search_trigger();
create trigger business_locations_search_refresh after insert or update or delete on public.business_locations
  for each row execute function private.refresh_business_search_trigger();
create trigger services_search_refresh after insert or update of name, is_active, deleted_at or delete on public.services
  for each row execute function private.refresh_business_search_trigger();

-- Category names/keywords changing affects every business in that category.
create or replace function private.categories_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_business_search(bc.business_id)
  from public.business_categories bc where bc.category_id = new.id;
  return null;
end;
$$;
create trigger categories_search_refresh after update of name, search_keywords on public.categories
  for each row execute function private.categories_search_trigger();

select private.refresh_business_search(id) from public.businesses;

-- ---------------------------------------------------------------------------
-- Understanding a query: "Barber in East Legon" → what = "Barber", where = "East Legon".
-- Resolves the "what" to a category (by name or keyword, typo-tolerant) and the
-- "where" to an area or a city. Reference data only, so it runs as the caller.
-- ---------------------------------------------------------------------------
create or replace function public.match_search_terms(p_what text, p_where text, p_country_code char(2))
returns table (
  category_id uuid, category_name text, category_slug text,
  area_id uuid, area_name text, city_id uuid, city_name text, region_id uuid, region_name text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_what  text := trim(private.search_text(p_what));
  v_where text := trim(private.search_text(p_where));
begin
  if v_what <> '' then
    select c.id, c.name, c.slug into category_id, category_name, category_slug
    from public.categories c
    cross join lateral (
      select greatest(
        extensions.similarity(lower(c.name), v_what),
        coalesce((select max(extensions.similarity(k, v_what)) from unnest(c.search_keywords) k), 0),
        -- "barbers" vs keyword "barber", "photographers" vs "photographer"
        coalesce((select max(extensions.similarity(k, regexp_replace(v_what, 's$', ''))) from unnest(c.search_keywords) k), 0)
      ) as score
    ) m
    where c.is_active and m.score >= 0.5
    order by m.score desc, c.sort_order
    limit 1;
  end if;

  if v_where <> '' then
    select a.id, a.name, ci.id, ci.name into area_id, area_name, city_id, city_name
    from public.areas a
    join public.cities ci on ci.id = a.city_id
    join public.regions r on r.id = ci.region_id and r.country_code = p_country_code
    where extensions.similarity(private.search_text(a.name), v_where) >= 0.45
    order by extensions.similarity(private.search_text(a.name), v_where) desc
    limit 1;

    if area_id is null then
      select ci.id, ci.name into city_id, city_name
      from public.cities ci
      join public.regions r on r.id = ci.region_id and r.country_code = p_country_code
      where extensions.similarity(private.search_text(ci.name), v_where) >= 0.4
      order by extensions.similarity(private.search_text(ci.name), v_where) desc
      limit 1;
    end if;

    if area_id is null and city_id is null then
      select r.id, r.name into region_id, region_name
      from public.regions r
      where r.country_code = p_country_code
        and extensions.similarity(private.search_text(r.name), regexp_replace(v_where, ' region$', '')) >= 0.5
      order by extensions.similarity(private.search_text(r.name), v_where) desc
      limit 1;
    end if;
  end if;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- The marketplace search. Returns public card data for PUBLISHED businesses only.
-- SECURITY DEFINER so it can use fast joins instead of per-row RLS checks; the
-- published/not-deleted filters below are therefore the access rule.
-- ---------------------------------------------------------------------------
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
    from public.services sv where sv.business_id = s.id and sv.is_active and sv.deleted_at is null) pr on true
  order by
    case when p_sort = 'distance' then s.dist end asc nulls last,
    case when p_sort = 'newest' then s.published_at end desc nulls last,
    s.score desc, s.published_at desc, s.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function private.search_text(text), private.refresh_business_search(uuid) from public, anon, authenticated;
grant execute on function private.search_text(text) to anon, authenticated;  -- used inside match_search_terms (runs as caller)
grant execute on function public.match_search_terms(text, text, char) to anon, authenticated;
grant execute on function public.search_businesses(text, uuid, uuid, uuid, uuid, double precision, double precision, int, text, int, int) to anon, authenticated;

-- Clients never write the search document.
revoke update (search_document) on public.businesses from anon, authenticated;
