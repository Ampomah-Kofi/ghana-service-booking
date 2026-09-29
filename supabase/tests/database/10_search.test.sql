-- Marketplace search: query understanding, published-only results, live search documents, limits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

create function pg_temp.find(p_what text, p_where text) returns text[] language sql as $$
  select coalesce(array_agg(s.slug order by s.rank desc, s.slug), '{}')
  from public.match_search_terms(p_what, p_where, 'GH') m,
       lateral public.search_businesses(p_category_id => m.category_id, p_area_id => m.area_id, p_city_id => m.city_id, p_region_id => m.region_id) s;
$$;

select pg_temp.act_as(null);

-- ---------------------------------------------------------------- query understanding
select results_eq($$ select category_slug, area_name, city_name from public.match_search_terms('Barber', 'East Legon', 'GH') $$,
  $$ values ('barbers', 'East Legon', 'Accra') $$, '"Barber in East Legon" → Barbers in East Legon, Accra');
select results_eq($$ select category_slug, city_name from public.match_search_terms('photographers', 'kumasi', 'GH') $$,
  $$ values ('photography', 'Kumasi') $$, 'plural and lowercase still match');
select results_eq($$ select city_name from public.match_search_terms('', 'Acra', 'GH') $$, $$ values ('Accra') $$, 'typos in town names are tolerated');
select results_eq($$ select area_name from public.match_search_terms('', 'eastlegon', 'GH') $$, $$ values ('East Legon') $$, 'missing spaces are tolerated');
select results_eq($$ select category_slug from public.match_search_terms('home cleaning', '', 'GH') $$, $$ values ('cleaning') $$, 'multi-word keywords match');
select results_eq($$ select category_id is null, city_id is null from public.match_search_terms('zzzz', 'Atlantis', 'GH') $$,
  $$ values (true, true) $$, 'nonsense matches nothing');

-- ---------------------------------------------------------------- SPEC §11 examples on seed data
select is(pg_temp.find('Barber', 'East Legon'), array['kwame-cuts'], 'Barber in East Legon');
select is(pg_temp.find('Braids', 'Kumasi'), array['ama-braids'], 'Braids in Kumasi');
select is(pg_temp.find('Photographer', 'Kumasi'), array['lens-by-kofi'], 'Photographer in Kumasi');
select is(pg_temp.find('Massage', ''), array['calm-touch-spa'], 'Massage (the draft spa is not listed)');
select is(pg_temp.find('Home cleaning', ''), array['sparkle-home-cleaning'], 'Home cleaning');
select is((select array_agg(slug) from public.search_businesses(p_category_id => (select id from public.categories where slug = 'nails'),
            p_lat => 5.6360, p_lng => -0.1550, p_sort => 'distance')), array['glow-nails-east-legon'], 'Nails near me (by distance)');

-- ---------------------------------------------------------------- free text and visibility
select ok('kwame-cuts' = any (select slug from public.search_businesses(p_text => 'fade')), 'service names are searchable ("fade" → Skin fade)');
select ok('kwame-cuts' = any (select slug from public.search_businesses(p_text => 'kwam')), 'name prefixes match');
select is((select count(*) from public.search_businesses(p_text => 'glow') where slug = 'osu-glow-spa'), 0::bigint, 'draft businesses never appear');

reset role;
update public.services set name = 'Hot towel shave' where name = 'Beard trim';
select pg_temp.act_as(null);
select ok('kwame-cuts' = any (select slug from public.search_businesses(p_text => 'towel')), 'renaming a service updates the search document');

reset role;
update public.businesses set status = 'suspended' where slug = 'kwame-cuts';
select pg_temp.act_as(null);
select is(pg_temp.find('Barber', 'East Legon'), '{}'::text[], 'suspended businesses disappear from search');

select throws_ok($$ select * from public.search_businesses(p_limit => 500) $$, 'BZ422', null, 'page size is capped');

select * from finish();
rollback;
