-- Search performance check (roadmap Phase 4: p95 < 300 ms on 5k businesses).
-- Local only; everything is rolled back. Run:
--   docker exec -i supabase_db_ghana-service-booking psql -U postgres -q < scripts/perf/search_perf.sql
begin;
set local client_min_messages = warning;

-- 5,000 published businesses spread over every seeded area and category, 3 services each.
insert into public.businesses (id, slug, name, description, kind, status, country_code, currency_code, created_by, published_at)
select gen_random_uuid(), 'perf-' || g, (array['Royal','Golden','Star','Grace','Divine','Nana','Kofi','Ama','Blessed','Unique'])[1 + g % 10]
       || ' ' || (array['Cuts','Nails','Braids','Spa','Studio','Clean','Lens','Tutors','Glow','Touch'])[1 + (g / 10) % 10] || ' ' || g,
       'Quality service in town', 'solo', 'published', 'GH', 'GHS', 'a0000000-0000-4000-8000-000000000007', now() - (g || ' minutes')::interval
from generate_series(1, 5000) g;

insert into public.business_categories (business_id, category_id, is_primary)
select b.id, (select id from public.categories order by sort_order offset (abs(hashtext(b.slug)) % 17) limit 1), true
from public.businesses b where b.slug like 'perf-%';

insert into public.business_locations (business_id, country_code, city_id, area_id, lat, lng)
select b.id, 'GH', a.city_id, a.id, 5.55 + (abs(hashtext(b.slug)) % 1000) / 10000.0, -0.25 + (abs(hashtext(b.slug || 'x')) % 1000) / 5000.0
from public.businesses b
cross join lateral (select id, city_id from public.areas order by id offset (abs(hashtext(b.slug)) % 39) limit 1) a
where b.slug like 'perf-%';

insert into public.services (business_id, name, price_minor, currency_code, duration_minutes)
select b.id, (array['Low cut','Gel manicure','Knotless braids','Swedish massage','Portrait session','Deep cleaning'])[1 + (abs(hashtext(b.slug)) + n) % 6],
       1000 * (5 + n), 'GHS', 30 + 15 * n
from public.businesses b cross join generate_series(0, 2) n where b.slug like 'perf-%';

analyze public.businesses; analyze public.business_locations; analyze public.business_categories; analyze public.services;

create temp table timings (label text, ms double precision);
grant insert on timings to anon;

do $$
declare
  queries text[][] := array[
    array['Barber', 'East Legon'], array['Braids', 'Accra'], array['Nails', ''], array['Photographer', 'Kumasi'],
    array['Massage', ''], array['Home cleaning', ''], array['royal', ''], array['golden studio', 'Osu'], array['fade', ''], array['', 'Tema']];
  q text[];
  m record;
  t0 timestamptz;
  i int;
begin
  perform set_config('role', 'anon', true);
  for i in 1..10 loop
    foreach q slice 1 in array queries loop
      t0 := clock_timestamp();
      select * into m from public.match_search_terms(q[1], q[2], 'GH');
      perform * from public.search_businesses(
        p_text => case when m.category_id is null then nullif(q[1], '') end,
        p_category_id => m.category_id, p_area_id => m.area_id, p_city_id => m.city_id);
      insert into timings values (q[1] || ' | ' || q[2], extract(epoch from clock_timestamp() - t0) * 1000);
    end loop;
    t0 := clock_timestamp();
    perform * from public.search_businesses(p_category_id => (select id from public.categories where slug = 'nails'),
                                            p_lat => 5.60, p_lng => -0.18, p_sort => 'distance');
    insert into timings values ('near me (nails, 25 km)', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
  perform set_config('role', 'postgres', true);
end $$;

select count(*) as searches,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 1) as p95_ms,
       round(max(ms)::numeric, 1) as max_ms
from timings;
select label, round(avg(ms)::numeric, 1) as avg_ms from timings group by label order by 2 desc limit 5;

rollback;
