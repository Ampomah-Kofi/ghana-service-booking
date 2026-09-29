-- Reference data for every environment, production included (Phase 11). Until now it lived only in
-- supabase/seed.sql, which must never run on production (it also creates demo users). Idempotent: safe
-- on a database that already has these rows. Countries, cities and categories stay data, not code
-- (CLAUDE.md): admins add more categories in /admin/categories, and more places are plain inserts.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
insert into public.currencies (code, name, symbol, minor_unit) values
  ('GHS', 'Ghana cedi', 'GH₵', 2)
on conflict do nothing;


insert into public.countries (code, name, currency_code, calling_code, default_timezone, is_active) values
  ('GH', 'Ghana', 'GHS', '233', 'Africa/Accra', true)
on conflict do nothing;


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
  ('GH', 'Western North', 'western-north')
on conflict do nothing;


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
join public.regions r on r.slug = c.region_slug and r.country_code = 'GH'
on conflict do nothing;


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
join public.cities ci on ci.slug = a.city_slug
on conflict do nothing;


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
  ('Photography',        'photography',        'camera',     110, '{photographer,photography,photoshoot,portrait,wedding,"product photos"}'),
  ('Home services',      'home-services',      'home',       120, '{"home service",handyman,"home visit",painter,painting,tiler,fumigation}'),
  ('Cleaning',           'cleaning',           'spray-can',  130, '{cleaning,cleaner,"home cleaning","deep cleaning","office cleaning","post-construction cleaning"}'),
  ('Repairs',            'repairs',            'wrench',     140, '{repair,repairs,fix,"shoe repair",cobbler,"watch repair",welder,welding}'),
  ('Tutoring',           'tutoring',           'book-open',  150, '{tutor,tutoring,lessons,"extra classes",wassce,bece,coding}'),
  ('Consulting',         'consulting',         'briefcase',  160, '{consultant,consulting,advisor,coach,lawyer,accountant}'),
  ('Event services',     'event-services',     'party-popper',170,'{events,decor,decorator,"event planner",rentals,"canopy rental",ushers}'),
  -- Trades and everyday services (added after Phase 7): many of these travel to the customer.
  ('Electricians',       'electricians',       'zap',        121, '{electrician,electrical,wiring,rewiring,socket,"prepaid meter",sparky,"light installation","ceiling fan"}'),
  ('Plumbers',           'plumbers',           'droplet',    122, '{plumber,plumbing,"burst pipe",leak,"water tank",borehole,toilet,"water heater"}'),
  ('Laundry',            'laundry',            'shirt',      135, '{laundry,"dry cleaning",ironing,"wash and fold",laundromat}'),
  ('AC & appliance repair','ac-appliance-repair','snowflake', 141, '{"ac repair","air conditioner",aircon,"ac servicing",fridge,freezer,"washing machine","deep freezer"}'),
  ('Phone & laptop repair','phone-laptop-repair','smartphone',142, '{"phone repair","screen replacement","laptop repair","computer repair","phone battery",iphone,samsung}'),
  ('Auto mechanics',     'auto-mechanics',     'car',        143, '{mechanic,"fitting shop","car repair","car service","auto electrician",vulcanizer,vulcaniser,"car wash","wheel alignment"}'),
  ('Tailors & fashion',  'tailors-fashion',    'scissors',   144, '{tailor,seamstress,dressmaker,designer,kaba,slit,kente,"african print",alterations,"wedding dress",fashion}'),
  ('Carpentry',          'carpentry',          'hammer',     145, '{carpenter,carpentry,furniture,woodwork,cabinet,"kitchen cabinet",wardrobe,door}'),
  ('Driving lessons',    'driving-lessons',    'steering',   155, '{"driving school","driving lessons","driving instructor","learn to drive"}'),
  ('DJs & MCs',          'djs-mcs',            'music',      171, '{dj,deejay,mc,"master of ceremonies","sound system","pa system",hypeman,"wedding dj"}'),
  ('Catering',           'catering',           'chef-hat',   172, '{caterer,catering,"small chops","party food",jollof,baker,cakes,"cake maker",chef}'),
  -- Creators and gig work: booked by date for events, shoots and campaigns.
  ('Influencers & creators','influencers-creators','megaphone',180, '{influencer,"content creator",creator,ugc,"brand ambassador",tiktoker,instagrammer,youtuber,"sponsored post",promo,ads,advert,"brand deal"}'),
  ('Musicians & bands',  'musicians-bands',    'mic',        173, '{musician,band,"live band",singer,saxophonist,"highlife band","praise team",instrumentalist,drummer,guitarist,trumpeter}'),
  ('Videography',        'videography',        'video',      111, '{videographer,videography,"music video","wedding video",drone,"event coverage",editor,"video editing"}'),
  ('Graphic design',     'graphic-design',     'pen-tool',   181, '{"graphic designer","graphic design",logo,flyer,branding,poster,"social media design","business card"}'),
  ('Copywriting',        'copywriting',        'feather',    182, '{copywriter,copywriting,writer,"content writing",captions,script,"cv writing",proofreading}')
on conflict do nothing;
