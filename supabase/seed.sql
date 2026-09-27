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
--   +233200000009  Admin  platform super_admin

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
insert into public.currencies (code, name, symbol, minor_unit) values
  ('GHS', 'Ghana cedi', 'GH₵', 2);

insert into public.countries (code, name, currency_code, calling_code, default_timezone, is_active) values
  ('GH', 'Ghana', 'GHS', '233', 'Africa/Accra', true);

insert into public.regions (country_code, name, slug) values
  ('GH', 'Ahafo', 'ahafo'),
  ('GH', 'Ashanti', 'ashanti'),
  ('GH', 'Bono', 'bono'),
  ('GH', 'Bono East', 'bono-east'),
  ('GH', 'Central', 'central'),
  ('GH', 'Eastern', 'eastern'),
  ('GH', 'Greater Accra', 'greater-accra'),
  ('GH', 'North East', 'north-east'),
  ('GH', 'Northern', 'northern'),
  ('GH', 'Oti', 'oti'),
  ('GH', 'Savannah', 'savannah'),
  ('GH', 'Upper East', 'upper-east'),
  ('GH', 'Upper West', 'upper-west'),
  ('GH', 'Volta', 'volta'),
  ('GH', 'Western', 'western'),
  ('GH', 'Western North', 'western-north');

-- City centroids are approximate (city centre), good enough for map centring and "near me" fallback.
-- Towns not listed here can still be entered as free text (business_locations.locality_text).
insert into public.cities (region_id, name, slug, centroid)
select r.id, c.name, c.slug, extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography
from (values
  ('greater-accra', 'Accra',      'accra',      5.6037, -0.1870),
  ('greater-accra', 'Tema',       'tema',       5.6698, -0.0166),
  ('ashanti',       'Kumasi',     'kumasi',     6.6885, -1.6244),
  ('western',       'Takoradi',   'takoradi',   4.8845, -1.7554),
  ('central',       'Cape Coast', 'cape-coast', 5.1053, -1.2466),
  ('northern',      'Tamale',     'tamale',     9.4008, -0.8393),
  ('greater-accra', 'Ashaiman',   'ashaiman',   5.6950, -0.0330),
  ('central',       'Kasoa',      'kasoa',      5.5340, -0.4240),
  ('central',       'Winneba',    'winneba',    5.3511, -0.6231),
  ('eastern',       'Koforidua',  'koforidua',  6.0941, -0.2591),
  ('volta',         'Ho',         'ho',         6.6008,  0.4713),
  ('ashanti',       'Obuasi',     'obuasi',     6.2024, -1.6663),
  ('bono',          'Sunyani',    'sunyani',    7.3349, -2.3123),
  ('bono-east',     'Techiman',   'techiman',   7.5909, -1.9395),
  ('upper-west',    'Wa',         'wa',        10.0601, -2.5099),
  ('upper-east',    'Bolgatanga', 'bolgatanga',10.7856, -0.8514)
) as c(region_slug, name, slug, lat, lng)
join public.regions r on r.slug = c.region_slug and r.country_code = 'GH';

insert into public.areas (city_id, name, slug)
select ci.id, a.name, a.slug
from (values
  ('accra', 'East Legon', 'east-legon'), ('accra', 'Osu', 'osu'), ('accra', 'Airport Residential', 'airport-residential'),
  ('accra', 'Labone', 'labone'), ('accra', 'Cantonments', 'cantonments'), ('accra', 'Dansoman', 'dansoman'),
  ('accra', 'Madina', 'madina'), ('accra', 'Adenta', 'adenta'), ('accra', 'Spintex', 'spintex'),
  ('accra', 'Achimota', 'achimota'), ('accra', 'Kaneshie', 'kaneshie'), ('accra', 'Lapaz', 'lapaz'),
  ('accra', 'Dzorwulu', 'dzorwulu'), ('accra', 'Tesano', 'tesano'), ('accra', 'Haatso', 'haatso'),
  ('accra', 'Teshie', 'teshie'), ('accra', 'Nungua', 'nungua'), ('accra', 'Labadi', 'labadi'),
  ('tema', 'Community 1', 'community-1'), ('tema', 'Community 25', 'community-25'),
  ('tema', 'Sakumono', 'sakumono'), ('tema', 'Tema New Town', 'tema-new-town'),
  ('kumasi', 'Adum', 'adum'), ('kumasi', 'Asokwa', 'asokwa'), ('kumasi', 'Bantama', 'bantama'),
  ('kumasi', 'Ahodwo', 'ahodwo'), ('kumasi', 'Nhyiaeso', 'nhyiaeso'), ('kumasi', 'Kwadaso', 'kwadaso'),
  ('kumasi', 'Suame', 'suame'), ('kumasi', 'Ayeduase', 'ayeduase'),
  ('takoradi', 'Market Circle', 'market-circle'), ('takoradi', 'Anaji', 'anaji'), ('takoradi', 'Effiakuma', 'effiakuma'),
  ('cape-coast', 'Pedu', 'pedu'), ('cape-coast', 'Abura', 'abura'), ('cape-coast', 'Kotokuraba', 'kotokuraba'),
  ('tamale', 'Lamashegu', 'lamashegu'), ('tamale', 'Vittin', 'vittin'), ('tamale', 'Kalpohin', 'kalpohin')
) as a(city_slug, name, slug)
join public.cities ci on ci.slug = a.city_slug;

-- SPEC §7 seed categories.
insert into public.categories (name, slug, icon, sort_order, search_keywords) values
  ('Barbers',            'barbers',            'scissors',   10,  '{barber,barbershop,haircut,fade,"low cut",shave,beard,trim}'),
  ('Hair salons',        'hair-salons',        'sparkles',   20,  '{salon,hair,hairdresser,hairstylist,relaxer,"silk press",wig,weave,frontal}'),
  ('Braids & locs',      'braids-locs',        'waves',      30,  '{braids,braider,cornrows,"knotless braids",twists,locs,dreadlocks,retwist}'),
  ('Nails',              'nails',              'hand',       40,  '{nails,"nail tech",manicure,pedicure,acrylics,gel,"press on"}'),
  ('Makeup',             'makeup',             'brush',      50,  '{makeup,"makeup artist",mua,bridal,glam}'),
  ('Beauty',             'beauty',             'flower',     60,  '{beauty,lashes,brows,waxing,facial,skincare,"lash extensions"}'),
  ('Spa & massage',      'spa-massage',        'leaf',       70,  '{spa,massage,"deep tissue",relaxation,wellness,sauna}'),
  ('Tattoo & piercing',  'tattoo-piercing',    'pen-tool',   80,  '{tattoo,piercing,"tattoo artist",ink}'),
  ('Medical & wellness', 'medical-wellness',   'heart-pulse',90,  '{clinic,physiotherapy,physio,dentist,nutritionist,wellness,therapy}'),
  ('Fitness',            'fitness',            'dumbbell',   100, '{gym,"personal trainer",fitness,yoga,pilates,trainer}'),
  ('Photography',        'photography',        'camera',     110, '{photographer,photography,photoshoot,portrait,wedding,videographer}'),
  ('Home services',      'home-services',      'home',       120, '{"home service",plumber,electrician,handyman,"home visit"}'),
  ('Cleaning',           'cleaning',           'spray-can',  130, '{cleaning,cleaner,"home cleaning","deep cleaning","office cleaning",laundry}'),
  ('Repairs',            'repairs',            'wrench',     140, '{repair,"phone repair","laptop repair",appliance,mechanic,tailor}'),
  ('Tutoring',           'tutoring',           'book-open',  150, '{tutor,tutoring,lessons,"extra classes",wassce,bece,coding}'),
  ('Consulting',         'consulting',         'briefcase',  160, '{consultant,consulting,advisor,coach,lawyer,accountant}'),
  ('Event services',     'event-services',     'party-popper',170,'{events,decor,"event planner",dj,mc,catering,rentals}');

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
