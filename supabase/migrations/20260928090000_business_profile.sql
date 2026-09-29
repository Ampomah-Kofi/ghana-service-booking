-- Phase 2: business profile tables used by provider onboarding.
-- business_categories, business_locations, booking_rules, staff (basic), business_photos.
-- Design: docs/data-model.md. Tenant isolation: ADR-0002.

-- ---------------------------------------------------------------------------
-- Categories a business is listed in (MVP UI: exactly one, the primary)
-- ---------------------------------------------------------------------------
create table public.business_categories (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  category_id  uuid not null references public.categories (id),
  is_primary   boolean not null default false,
  primary key (business_id, category_id)
);
create unique index business_categories_one_primary on public.business_categories (business_id) where is_primary;
create index business_categories_category_id on public.business_categories (category_id);

-- ---------------------------------------------------------------------------
-- Location. city_id from the reference list, or locality_text when the town
-- isn't listed yet (admins map it later). region/country are derived from the city.
-- ---------------------------------------------------------------------------
create table public.business_locations (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  country_code   char(2) not null references public.countries (code),
  region_id      uuid references public.regions (id),
  city_id        uuid references public.cities (id),
  area_id        uuid references public.areas (id),
  locality_text  text check (char_length(locality_text) between 2 and 80),
  address_line   text check (char_length(address_line) <= 200),
  landmark       text check (char_length(landmark) <= 200),
  directions     text check (char_length(directions) <= 500),
  -- Plain lat/lng are what the app reads and writes; geo is derived for distance search (GiST).
  lat            numeric(8, 6) check (lat between -90 and 90),
  lng            numeric(9, 6) check (lng between -180 and 180),
  geo            extensions.geography(point, 4326)
                   generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  is_primary     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, id),
  check (city_id is not null or locality_text is not null),
  check ((lat is null) = (lng is null))
);
create unique index business_locations_one_primary on public.business_locations (business_id) where is_primary;
create index business_locations_geo on public.business_locations using gist (geo);
create index business_locations_city_area on public.business_locations (city_id, area_id);
create index business_locations_region_id on public.business_locations (region_id);
create index business_locations_area_id on public.business_locations (area_id);
create index business_locations_country_code on public.business_locations (country_code);
create trigger business_locations_set_updated_at before update on public.business_locations
  for each row execute function private.set_updated_at();

-- Keep the location hierarchy consistent: area ∈ city ∈ region ∈ country.
create or replace function private.business_locations_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_region_id uuid;
  v_country   char(2);
begin
  if new.city_id is not null then
    select c.region_id, r.country_code into v_region_id, v_country
    from public.cities c join public.regions r on r.id = c.region_id
    where c.id = new.city_id;
    new.region_id := v_region_id;
    new.country_code := v_country;
    new.locality_text := null;
  end if;
  if new.area_id is not null
     and not exists (select 1 from public.areas a where a.id = new.area_id and a.city_id is not distinct from new.city_id) then
    raise exception 'area does not belong to the selected city' using errcode = '23514';
  end if;
  if new.country_code <> (select b.country_code from public.businesses b where b.id = new.business_id) then
    raise exception 'location country must match the business country' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger business_locations_normalize before insert or update on public.business_locations
  for each row execute function private.business_locations_normalize();

-- ---------------------------------------------------------------------------
-- Booking rules (1:1). Defaults are created by create_business(); edited in Phase 3.
-- ---------------------------------------------------------------------------
create table public.booking_rules (
  business_id                uuid primary key references public.businesses (id) on delete cascade,
  slot_interval_minutes      smallint not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  min_notice_minutes         int not null default 60 check (min_notice_minutes between 0 and 10080),
  max_advance_days           int not null default 60 check (max_advance_days between 1 and 365),
  buffer_before_minutes      smallint not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes       smallint not null default 0 check (buffer_after_minutes between 0 and 240),
  cancellation_window_hours  int not null default 2 check (cancellation_window_hours between 0 and 336),
  reschedule_window_hours    int not null default 2 check (reschedule_window_hours between 0 and 336),
  auto_confirm               boolean not null default true,
  allow_guest_booking        boolean not null default true,
  pending_hold_minutes       smallint not null default 15 check (pending_hold_minutes between 5 and 120),
  updated_at                 timestamptz not null default now()
);
create trigger booking_rules_set_updated_at before update on public.booking_rules
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff (basic). A solo business has exactly one staff row: the owner.
-- Services, hours and invites arrive in Phase 3.
-- ---------------------------------------------------------------------------
create table public.staff (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  user_id                  uuid references public.profiles (id) on delete set null,
  display_name             text not null check (char_length(display_name) between 1 and 80),
  role_title               text check (char_length(role_title) <= 60),
  bio                      text check (char_length(bio) <= 1000),
  photo_path               text,
  uses_business_hours      boolean not null default true,
  accepts_online_bookings  boolean not null default true,
  is_active                boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  unique (business_id, id),
  unique (business_id, user_id)
);
create index staff_user_id on public.staff (user_id);
create trigger staff_set_updated_at before update on public.staff
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Portfolio photos. Two renditions per photo (client-resized): small (400px) and large (1200px).
-- Files live in the public-media bucket under businesses/{business_id}/photos/.
-- ---------------------------------------------------------------------------
create table public.business_photos (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  path_small   text not null,
  path_large   text not null,
  width        int check (width between 1 and 4000),
  height       int check (height between 1 and 4000),
  caption      text check (char_length(caption) <= 200),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  check (path_small like 'businesses/' || business_id::text || '/photos/%'),
  check (path_large like 'businesses/' || business_id::text || '/photos/%')
);
create index business_photos_business on public.business_photos (business_id, sort_order);

create or replace function private.business_photos_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.business_photos where business_id = new.business_id) >= 12 then
    raise exception 'a business can have at most 12 portfolio photos' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger business_photos_limit before insert on public.business_photos
  for each row execute function private.business_photos_limit();

-- Logo lives on businesses.logo_path; enforce it points into the business's own folder.
alter table public.businesses
  add constraint businesses_logo_path_own_folder
  check (logo_path is null or logo_path like 'businesses/' || id::text || '/logo/%');
alter table public.businesses
  add constraint businesses_cover_path_own_folder
  check (cover_path is null or cover_path like 'businesses/' || id::text || '/%');

-- ---------------------------------------------------------------------------
-- RLS: public can read config of published businesses; members read all of
-- their own; owners/managers write. (Pattern "public config", data-model §5.)
-- ---------------------------------------------------------------------------
alter table public.business_categories enable row level security;
alter table public.business_locations  enable row level security;
alter table public.booking_rules       enable row level security;
alter table public.staff               enable row level security;
alter table public.business_photos     enable row level security;

create policy "public or members read" on public.business_categories for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers insert" on public.business_categories for insert to authenticated
  with check ((select private.can_manage_business(business_id)));
create policy "managers update" on public.business_categories for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy "managers delete" on public.business_categories for delete to authenticated
  using ((select private.can_manage_business(business_id)));

create policy "public or members read" on public.business_locations for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers insert" on public.business_locations for insert to authenticated
  with check ((select private.can_manage_business(business_id)));
create policy "managers update" on public.business_locations for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy "managers delete" on public.business_locations for delete to authenticated
  using ((select private.can_manage_business(business_id)));

create policy "public or members read" on public.booking_rules for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers update" on public.booking_rules for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
-- Rows are created by create_business(); never inserted or deleted by clients.
revoke update on public.booking_rules from anon, authenticated;
grant update (slot_interval_minutes, min_notice_minutes, max_advance_days, buffer_before_minutes, buffer_after_minutes,
              cancellation_window_hours, reschedule_window_hours, auto_confirm, allow_guest_booking, pending_hold_minutes)
  on public.booking_rules to authenticated;

create policy "public reads active staff; members read all" on public.staff for select to anon, authenticated
  using ((is_active and deleted_at is null and (select private.is_published_business(business_id)))
         or (select private.is_business_member(business_id)));
create policy "managers insert" on public.staff for insert to authenticated
  with check ((select private.can_manage_business(business_id)));
create policy "managers update" on public.staff for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
-- No delete policy: staff are soft-deleted (deleted_at) so past appointments keep their staff.
revoke update on public.staff from anon, authenticated;
grant update (display_name, role_title, bio, photo_path, uses_business_hours, accepts_online_bookings, is_active, sort_order, deleted_at)
  on public.staff to authenticated;

create policy "public or members read" on public.business_photos for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers insert" on public.business_photos for insert to authenticated
  with check ((select private.can_manage_business(business_id)));
create policy "managers update" on public.business_photos for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
create policy "managers delete" on public.business_photos for delete to authenticated
  using ((select private.can_manage_business(business_id)));
revoke update on public.business_photos from anon, authenticated;
grant update (caption, sort_order) on public.business_photos to authenticated;

-- Wizard can change solo/team and the logo path.
grant update (kind) on public.businesses to authenticated;
