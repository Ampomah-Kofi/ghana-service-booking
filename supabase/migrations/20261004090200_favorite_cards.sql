-- The caller's saved businesses as result cards (same shape as search_businesses), newest first.
-- Only published businesses; a saved business that unpublishes drops out until it's back.
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
    from public.services sv where sv.business_id = b.id and sv.is_active and sv.deleted_at is null) pr on true
  where f.user_id = auth.uid()
  order by f.created_at desc, b.id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function public.my_favorite_businesses(int, int) from public, anon;
grant execute on function public.my_favorite_businesses(int, int) to authenticated;
