-- Tenant isolation for Phase 2 profile tables:
-- business_categories, business_locations, booking_rules, staff, business_photos.
-- Fixtures: seed.sql (Kwame a…01 owns b…01 published; Ama a…02 owns b…02 published, Efua a…03 staff there;
-- Kojo a…04 owns b…03 draft, Akosua a…05 manager there; Yaw a…06 customer).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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

reset role;
insert into public.business_photos (business_id, path_small, path_large)
values ('b0000000-0000-4000-8000-000000000003', 'businesses/b0000000-0000-4000-8000-000000000003/photos/a-400.webp',
        'businesses/b0000000-0000-4000-8000-000000000003/photos/a-1200.webp');

-- ---------------------------------------------------------------- public reads only published tenants
select pg_temp.act_as(null);
select set_eq($$ select business_id from public.business_locations where business_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003') $$,
  array['b0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid],
  'anon reads locations of published businesses only');
select set_eq($$ select business_id from public.business_categories where business_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003') $$,
  array['b0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid],
  'anon reads categories of published businesses only');
select is((select count(*) from public.staff where business_id = 'b0000000-0000-4000-8000-000000000003'), 0::bigint,
  'anon cannot see staff of a draft business');
select is_empty($$ select id from public.business_photos $$, 'anon cannot see photos of a draft business');
select is((select count(*) from public.booking_rules where business_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003')), 2::bigint, 'anon reads booking rules of published businesses only');

-- ---------------------------------------------------------------- members read their draft business
select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');  -- Akosua, manager of draft osu
select isnt_empty($$ select id from public.business_photos where business_id = 'b0000000-0000-4000-8000-000000000003' $$,
  'manager reads their draft business photos');
select isnt_empty($$ select id from public.business_locations where business_id = 'b0000000-0000-4000-8000-000000000003' $$,
  'manager reads their draft business location');

-- ---------------------------------------------------------------- cross-tenant writes
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame (owner A)
select is_empty($$ update public.business_locations set landmark = 'hacked'
                   where business_id = 'b0000000-0000-4000-8000-000000000002' returning id $$,
  'owner A cannot update B''s location');
select throws_ok($$ insert into public.business_locations (business_id, country_code, locality_text)
                    values ('b0000000-0000-4000-8000-000000000002', 'GH', 'Injected') $$,
  '42501', null, 'owner A cannot add a location to B');
select is_empty($$ delete from public.business_categories where business_id = 'b0000000-0000-4000-8000-000000000002' returning category_id $$,
  'owner A cannot remove B''s category');
select throws_ok($$ insert into public.staff (business_id, display_name) values ('b0000000-0000-4000-8000-000000000002', 'Spy') $$,
  '42501', null, 'owner A cannot add staff to B');
select is_empty($$ update public.staff set display_name = 'Renamed' where business_id = 'b0000000-0000-4000-8000-000000000002' returning id $$,
  'owner A cannot rename B''s staff');
select is_empty($$ update public.booking_rules set min_notice_minutes = 0 where business_id = 'b0000000-0000-4000-8000-000000000002' returning business_id $$,
  'owner A cannot change B''s booking rules');
select throws_ok($$ insert into public.business_photos (business_id, path_small, path_large)
                    values ('b0000000-0000-4000-8000-000000000002',
                            'businesses/b0000000-0000-4000-8000-000000000002/photos/x-400.webp',
                            'businesses/b0000000-0000-4000-8000-000000000002/photos/x-1200.webp') $$,
  '42501', null, 'owner A cannot add photos to B');
select is_empty($$ delete from public.business_photos where business_id = 'b0000000-0000-4000-8000-000000000003' returning id $$,
  'owner A cannot delete another tenant''s photos');

-- ---------------------------------------------------------------- own writes
select isnt_empty($$ update public.business_locations set landmark = 'Opposite the Shell station'
                     where business_id = 'b0000000-0000-4000-8000-000000000001' returning id $$,
  'owner updates own location');
select isnt_empty($$ update public.booking_rules set min_notice_minutes = 30
                     where business_id = 'b0000000-0000-4000-8000-000000000001' returning business_id $$,
  'owner updates own booking rules');
select throws_ok($$ insert into public.booking_rules (business_id) values ('b0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'booking rules rows cannot be inserted by clients');
select throws_ok($$ update public.staff set user_id = 'a0000000-0000-4000-8000-000000000006'
                    where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'staff.user_id cannot be reassigned directly');
select throws_ok($$ update public.business_photos set path_large = 'businesses/x/photos/evil.webp'
                    where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'photo paths cannot be edited directly');

-- ---------------------------------------------------------------- staff role (Efua) is read-only
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select isnt_empty($$ select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000002' $$,
  'staff read their team');
select is_empty($$ update public.business_locations set landmark = 'staff edit'
                   where business_id = 'b0000000-0000-4000-8000-000000000002' returning id $$,
  'staff cannot edit the business location');

-- ---------------------------------------------------------------- constraints
reset role;
select throws_ok($$ insert into public.business_photos (business_id, path_small, path_large)
                    values ('b0000000-0000-4000-8000-000000000001',
                            'businesses/b0000000-0000-4000-8000-000000000002/photos/x-400.webp',
                            'businesses/b0000000-0000-4000-8000-000000000002/photos/x-1200.webp') $$,
  '23514', null, 'photo paths must point into the business''s own folder');
select throws_ok($$ update public.businesses set logo_path = 'businesses/b0000000-0000-4000-8000-000000000002/logo/x.webp'
                    where id = 'b0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'logo path must point into the business''s own folder');
select throws_ok($$ insert into public.business_locations (business_id, country_code, city_id, area_id, is_primary)
                    select 'b0000000-0000-4000-8000-000000000001', 'GH',
                           (select id from public.cities where slug = 'kumasi'),
                           (select id from public.areas where slug = 'osu'), false $$,
  '23514', null, 'an area must belong to the selected city');
select throws_ok($$ insert into public.business_locations (business_id, country_code, is_primary)
                    values ('b0000000-0000-4000-8000-000000000001', 'GH', false) $$,
  '23514', null, 'a location needs a city or a town name');
select is((select l.region_id = c.region_id from public.business_locations l join public.cities c on c.id = l.city_id
           where l.business_id = 'b0000000-0000-4000-8000-000000000001'), true,
  'region is derived from the city');

insert into public.business_photos (business_id, path_small, path_large)
select 'b0000000-0000-4000-8000-000000000001',
       'businesses/b0000000-0000-4000-8000-000000000001/photos/' || g || '-400.webp',
       'businesses/b0000000-0000-4000-8000-000000000001/photos/' || g || '-1200.webp'
from generate_series(1, 12) g;
select throws_ok($$ insert into public.business_photos (business_id, path_small, path_large)
                    values ('b0000000-0000-4000-8000-000000000001',
                            'businesses/b0000000-0000-4000-8000-000000000001/photos/13-400.webp',
                            'businesses/b0000000-0000-4000-8000-000000000001/photos/13-1200.webp') $$,
  '23514', null, 'at most 12 portfolio photos');

select * from finish();
rollback;
