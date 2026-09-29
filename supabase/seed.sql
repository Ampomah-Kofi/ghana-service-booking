-- Local/staging seed. NEVER run against production (production gets reference data only,
-- via a dedicated migration when we go live, see docs/dev-setup.md §4).
--
-- Demo sign-in: phone OTP with the fixed test code 123456 (supabase/config.toml [auth.sms.test_otp]).
--   +233200000001  Kwame  owner   kwame-cuts    (solo barber, published)
--   +233200000002  Ama    owner   ama-braids    (team, published)
--   +233200000003  Efua   staff   ama-braids
--   +233200000004  Kojo   owner   osu-glow-spa  (team, draft)
--   +233200000005  Akosua manager osu-glow-spa
--   +233200000006  Yaw    customer (no business)
--   +233200000007  Demo   owner   5 more published businesses (marketplace/search demo)
--   +233200000009  Admin  platform super_admin

-- Reference data (currencies, countries, regions, cities, areas, categories) comes from the
-- migration 20261011090100_reference_data.sql, so every environment has it. Demo data only below.

-- ---------------------------------------------------------------------------
-- Demo users (auth.users → profiles via trigger)
-- ---------------------------------------------------------------------------
-- GoTrue scans these token columns as non-null strings, so they must be '' (not NULL).
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.phone, now(),
       '{"provider":"phone","providers":["phone"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name), now(), now(),
       '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, '233200000001', 'Kwame Mensah'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, '233200000002', 'Ama Owusu'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, '233200000003', 'Efua Asante'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, '233200000004', 'Kojo Boateng'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, '233200000005', 'Akosua Darko'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, '233200000006', 'Yaw Adjei'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, '233200000007', 'Demo Owner'),
  ('a0000000-0000-4000-8000-000000000009'::uuid, '233200000009', 'Platform Admin')
) as u(id, phone, full_name);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true), 'phone', now(), now(), now()
from auth.users u
where u.id::text like 'a0000000-0000-4000-8000-%';

update public.profiles set country_code = 'GH' where id::text like 'a0000000-0000-4000-8000-%';

insert into public.platform_admins (user_id, role) values
  ('a0000000-0000-4000-8000-000000000009', 'super_admin');

-- ---------------------------------------------------------------------------
-- Demo businesses
-- ---------------------------------------------------------------------------
insert into public.businesses (id, slug, name, description, kind, status, country_code, currency_code,
                               phone_e164, whatsapp_e164, created_by, published_at) values
  ('b0000000-0000-4000-8000-000000000001', 'kwame-cuts', 'Kwame Cuts',
   'Clean fades and sharp line-ups in East Legon. Walk-ins welcome.', 'solo', 'published', 'GH', 'GHS',
   '+233200000001', '+233200000001', 'a0000000-0000-4000-8000-000000000001', now()),
  ('b0000000-0000-4000-8000-000000000002', 'ama-braids', 'Ama Braids Studio',
   'Knotless braids, twists and locs by a team of three in Kumasi.', 'team', 'published', 'GH', 'GHS',
   '+233200000002', '+233200000002', 'a0000000-0000-4000-8000-000000000002', now()),
  ('b0000000-0000-4000-8000-000000000003', 'osu-glow-spa', 'Osu Glow Spa',
   'Massage, facials and nails in Osu.', 'team', 'draft', 'GH', 'GHS',
   '+233200000004', null, 'a0000000-0000-4000-8000-000000000004', null);

insert into public.business_members (business_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'owner'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'staff'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'owner'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005', 'manager');

-- Demo business profiles (mirrors what create_business() + onboarding would produce).
insert into public.business_categories (business_id, category_id, is_primary)
select b.id, c.id, true
from (values ('b0000000-0000-4000-8000-000000000001'::uuid, 'barbers'),
             ('b0000000-0000-4000-8000-000000000002'::uuid, 'braids-locs'),
             ('b0000000-0000-4000-8000-000000000003'::uuid, 'spa-massage')) as b(id, cat)
join public.categories c on c.slug = b.cat;

insert into public.business_locations (business_id, country_code, city_id, area_id, address_line, landmark, lat, lng)
select v.id, 'GH', ci.id, a.id, v.address, v.landmark, v.lat, v.lng
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'accra',  'east-legon', 'Lagos Avenue', 'Opposite the Shell filling station', 5.6350, -0.1560),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'kumasi', 'adum',       'Prempeh II Street, 1st floor', 'Behind Kejetia market', 6.6930, -1.6230),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'accra',  'osu',        'Oxford Street', 'Next to the Osu Castle junction', 5.5560, -0.1820)
) as v(id, city, area, address, landmark, lat, lng)
join public.cities ci on ci.slug = v.city
join public.areas a on a.city_id = ci.id and a.slug = v.area;

insert into public.booking_rules (business_id)
select id from public.businesses where id::text like 'b0000000-0000-4000-8000-%';

insert into public.staff (business_id, user_id, display_name, role_title, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Kwame', 'Barber', 0),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Ama', 'Lead braider', 0),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'Efua', 'Braider', 1),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'Kojo', 'Massage therapist', 0);

-- Services, team and hours (Phase 3)
insert into public.staff (business_id, user_id, display_name, role_title, sort_order) values
  ('b0000000-0000-4000-8000-000000000003', null, 'Abena', 'Beauty therapist', 1);

insert into public.services (business_id, name, description, price_minor, price_type, currency_code, duration_minutes, sort_order)
values
  ('b0000000-0000-4000-8000-000000000001', 'Low cut', 'Clippers all over, clean line-up.', 5000, 'fixed', 'GHS', 30, 0),
  ('b0000000-0000-4000-8000-000000000001', 'Skin fade', 'Fade to the skin with a sharp line-up.', 8000, 'fixed', 'GHS', 45, 1),
  ('b0000000-0000-4000-8000-000000000001', 'Beard trim', null, 3000, 'fixed', 'GHS', 20, 2),
  ('b0000000-0000-4000-8000-000000000002', 'Knotless braids (medium)', 'Hair extensions included.', 35000, 'from', 'GHS', 240, 0),
  ('b0000000-0000-4000-8000-000000000002', 'Twists', null, 25000, 'from', 'GHS', 180, 1),
  ('b0000000-0000-4000-8000-000000000002', 'Loc retwist', null, 15000, 'fixed', 'GHS', 120, 2),
  ('b0000000-0000-4000-8000-000000000003', 'Deep tissue massage', null, 30000, 'fixed', 'GHS', 60, 0),
  ('b0000000-0000-4000-8000-000000000003', 'Facial', null, 25000, 'fixed', 'GHS', 60, 1),
  ('b0000000-0000-4000-8000-000000000003', 'Manicure', null, 10000, 'fixed', 'GHS', 45, 2);

-- Who does what: owners do everything in their business; Efua does braids and twists; Abena does facials and manicures.
insert into public.staff_services (business_id, staff_id, service_id)
select s.business_id, s.id, sv.id
from public.staff s join public.services sv on sv.business_id = s.business_id
where s.business_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')
  and (s.display_name <> 'Efua' or sv.name in ('Knotless braids (medium)', 'Twists'))
union all
select s.business_id, s.id, sv.id
from public.staff s join public.services sv on sv.business_id = s.business_id
where s.business_id = 'b0000000-0000-4000-8000-000000000003'
  and ((s.display_name = 'Kojo' and sv.name = 'Deep tissue massage') or (s.display_name = 'Abena' and sv.name <> 'Deep tissue massage'));

-- Kwame: Mon–Sat 08:00–20:00. Ama Braids: Tue–Sun with a lunch break. Osu Glow: Mon–Sat 10:00–19:00.
insert into public.business_hours (business_id, weekday, during)
select 'b0000000-0000-4000-8000-000000000001'::uuid, d, '[08:00,20:00)'::public.timerange from generate_series(1, 6) d
union all
select 'b0000000-0000-4000-8000-000000000002'::uuid, d, r::public.timerange
from generate_series(2, 7) d cross join (values ('[09:00,13:00)'), ('[14:00,19:00)')) as t(r)
union all
select 'b0000000-0000-4000-8000-000000000003'::uuid, d, '[10:00,19:00)'::public.timerange from generate_series(1, 6) d;

-- Efua works shorter days (Tue–Sat 10:00–16:00).
update public.staff set uses_business_hours = false where display_name = 'Efua';
insert into public.staff_working_hours (business_id, staff_id, weekday, during)
select s.business_id, s.id, d, '[10:00,16:00)'::public.timerange
from public.staff s cross join generate_series(2, 6) d
where s.display_name = 'Efua';

-- More published businesses for the marketplace (Phase 4): each SPEC §11 example query has a real answer.
insert into public.businesses (id, slug, name, description, kind, status, country_code, currency_code, phone_e164, whatsapp_e164, created_by, published_at)
values
  ('b0000000-0000-4000-8000-000000000004', 'lens-by-kofi', 'Lens by Kofi', 'Portraits, graduations and weddings in Kumasi.', 'solo', 'published', 'GH', 'GHS', '+233200000007', '+233200000007', 'a0000000-0000-4000-8000-000000000007', now() - interval '20 days'),
  ('b0000000-0000-4000-8000-000000000005', 'sparkle-home-cleaning', 'Sparkle Home Cleaning', 'Deep and regular home cleaning in Tema and Accra.', 'team', 'published', 'GH', 'GHS', '+233200000007', '+233200000007', 'a0000000-0000-4000-8000-000000000007', now() - interval '10 days'),
  ('b0000000-0000-4000-8000-000000000006', 'glow-nails-east-legon', 'Glow Nails', 'Gel, acrylics and pedicures near the American House junction.', 'solo', 'published', 'GH', 'GHS', '+233200000007', '+233200000007', 'a0000000-0000-4000-8000-000000000007', now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000007', 'calm-touch-spa', 'Calm Touch Spa', 'Swedish and deep tissue massage in Airport Residential.', 'team', 'published', 'GH', 'GHS', '+233200000007', null, 'a0000000-0000-4000-8000-000000000007', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000008', 'kumasi-maths-tutors', 'Kumasi Maths Tutors', 'WASSCE and BECE maths lessons at home or online.', 'solo', 'published', 'GH', 'GHS', '+233200000007', '+233200000007', 'a0000000-0000-4000-8000-000000000007', now() - interval '40 days');

insert into public.business_members (business_id, user_id, role)
select id, 'a0000000-0000-4000-8000-000000000007', 'owner' from public.businesses where id::text between 'b0000000-0000-4000-8000-000000000004' and 'b0000000-0000-4000-8000-000000000008';

insert into public.business_categories (business_id, category_id, is_primary)
select v.id, c.id, true
from (values ('b0000000-0000-4000-8000-000000000004'::uuid, 'photography'), ('b0000000-0000-4000-8000-000000000005'::uuid, 'cleaning'),
             ('b0000000-0000-4000-8000-000000000006'::uuid, 'nails'), ('b0000000-0000-4000-8000-000000000007'::uuid, 'spa-massage'),
             ('b0000000-0000-4000-8000-000000000008'::uuid, 'tutoring')) as v(id, cat)
join public.categories c on c.slug = v.cat;

insert into public.business_locations (business_id, country_code, city_id, area_id, address_line, landmark, lat, lng)
select v.id, 'GH', ci.id, a.id, v.address, v.landmark, v.lat, v.lng
from (values
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'kumasi', 'ahodwo', 'Ahodwo Roundabout', 'Opposite the Golden Tulip hotel', 6.6680, -1.6270),
  ('b0000000-0000-4000-8000-000000000005'::uuid, 'tema', 'community-25', 'Community 25 Mall road', null, 5.7030, -0.0200),
  ('b0000000-0000-4000-8000-000000000006'::uuid, 'accra', 'east-legon', 'American House, 2nd floor', 'Near the American House junction', 5.6370, -0.1540),
  ('b0000000-0000-4000-8000-000000000007'::uuid, 'accra', 'airport-residential', 'Airport Residential', 'Behind the Airport Shell station', 5.6010, -0.1790),
  ('b0000000-0000-4000-8000-000000000008'::uuid, 'kumasi', 'asokwa', 'Asokwa', null, 6.6700, -1.6100)
) as v(id, city, area, address, landmark, lat, lng)
join public.cities ci on ci.slug = v.city
join public.areas a on a.city_id = ci.id and a.slug = v.area;

insert into public.booking_rules (business_id)
select id from public.businesses where id::text between 'b0000000-0000-4000-8000-000000000004' and 'b0000000-0000-4000-8000-000000000008';

insert into public.staff (business_id, user_id, display_name, role_title)
select id, 'a0000000-0000-4000-8000-000000000007', split_part(name, ' ', 1), null
from public.businesses where id::text between 'b0000000-0000-4000-8000-000000000004' and 'b0000000-0000-4000-8000-000000000008';

insert into public.services (business_id, name, price_minor, price_type, currency_code, duration_minutes)
values
  ('b0000000-0000-4000-8000-000000000004', 'Portrait session', 40000, 'from', 'GHS', 60),
  ('b0000000-0000-4000-8000-000000000004', 'Graduation shoot', 60000, 'fixed', 'GHS', 90),
  ('b0000000-0000-4000-8000-000000000005', 'Home cleaning (2 bedrooms)', 30000, 'fixed', 'GHS', 180),
  ('b0000000-0000-4000-8000-000000000005', 'Deep cleaning', 55000, 'from', 'GHS', 300),
  ('b0000000-0000-4000-8000-000000000006', 'Gel manicure', 12000, 'fixed', 'GHS', 45),
  ('b0000000-0000-4000-8000-000000000006', 'Acrylic full set', 20000, 'fixed', 'GHS', 90),
  ('b0000000-0000-4000-8000-000000000007', 'Swedish massage', 35000, 'fixed', 'GHS', 60),
  ('b0000000-0000-4000-8000-000000000008', 'Maths lesson', 8000, 'fixed', 'GHS', 60);

insert into public.staff_services (business_id, staff_id, service_id)
select s.business_id, s.id, sv.id
from public.staff s join public.services sv on sv.business_id = s.business_id
where s.business_id::text between 'b0000000-0000-4000-8000-000000000004' and 'b0000000-0000-4000-8000-000000000008';

insert into public.business_hours (business_id, weekday, during)
select b.id, d, '[09:00,18:00)'::public.timerange
from public.businesses b cross join generate_series(1, 6) d
where b.id::text between 'b0000000-0000-4000-8000-000000000004' and 'b0000000-0000-4000-8000-000000000008';

