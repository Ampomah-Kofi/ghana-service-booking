-- =============================================================================
--  DRAFT: NOT A MIGRATION. DO NOT APPLY. (moved to supabase/drafts/ in Phase 1)
-- =============================================================================
--  Phase 0 draft of the initial schema. It is kept for review only and will be
--  split into real, timestamped migrations in Phase 1
--  (e.g. 20261001120000_initial_schema.sql).
--
--  The Supabase CLI only applies files named <timestamp>_<name>.sql, so the
--  leading underscore keeps `supabase db reset` from picking this file up.
--
--  Checked on 2026-09-27: loads cleanly into a plain PostgreSQL 16 with stub
--  `auth`/`storage` schemas and a stub `geography` type (PostGIS was not
--  available locally). It has NOT been run on Supabase yet.
--
--  Conventions (see CLAUDE.md, docs/data-model.md):
--   * money: integer minor units (*_minor) plus an ISO-4217 currency_code
--   * time: timestamptz (UTC); business-local wall-clock only in *_hours tables
--   * weekday: ISO 8601, 1 = Monday … 7 = Sunday (matches extract(isodow))
--   * every tenant-owned table has business_id and RLS enabled
--   * helper functions live in schema `private`, which PostgREST does not expose
--   * multi-step writes (booking, status changes, creating a business) go
--     through SECURITY DEFINER functions, not direct table writes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions & schemas
-- -----------------------------------------------------------------------------
create extension if not exists btree_gist with schema extensions;  -- uuid "=" in GiST exclusion
create extension if not exists pg_trgm    with schema extensions;  -- fuzzy name search
create extension if not exists unaccent   with schema extensions;  -- accent-insensitive search
create extension if not exists postgis    with schema extensions;  -- geography(Point) + distance

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, anon;  -- needed so RLS policies can call helpers

-- A range over wall-clock time-of-day, used for opening/working hours.
-- '24:00' is a valid `time`, so "open until midnight" is expressible.
create type public.timerange as range (subtype = time);

-- -----------------------------------------------------------------------------
-- 1. Enums (internal states only; nothing country-specific)
-- -----------------------------------------------------------------------------
create type public.member_role        as enum ('owner', 'manager', 'staff');
create type public.admin_role         as enum ('super_admin', 'moderator', 'support');
create type public.business_status    as enum ('draft', 'published', 'suspended', 'deactivated');
create type public.business_kind      as enum ('solo', 'team');
create type public.appointment_status as enum ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('online', 'manual', 'walk_in');
create type public.payment_status     as enum ('pending', 'paid', 'partially_paid', 'failed', 'refunded');
create type public.payment_kind       as enum ('deposit', 'full', 'balance');
create type public.payment_method     as enum ('mobile_money', 'card', 'cash', 'other');
create type public.price_type         as enum ('fixed', 'from');
create type public.notification_channel as enum ('sms', 'whatsapp', 'email', 'in_app');
create type public.notification_status  as enum ('queued', 'sending', 'sent', 'failed', 'cancelled');
create type public.review_status      as enum ('published', 'hidden', 'removed');

-- -----------------------------------------------------------------------------
-- 2. Shared trigger helpers
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Reference data (platform-managed; public read, admin write)
-- -----------------------------------------------------------------------------
create table public.currencies (
  code        char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name        text not null,
  symbol      text not null,               -- 'GH₵'
  minor_unit  smallint not null default 2 check (minor_unit between 0 and 4)
);

create table public.countries (
  code              char(2) primary key check (code ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  name              text not null,
  currency_code     char(3) not null references public.currencies(code),
  calling_code      text not null check (calling_code ~ '^[0-9]{1,4}$'), -- '233'
  default_timezone  text not null,                                        -- 'Africa/Accra'
  is_active         boolean not null default false
);

create table public.regions (
  id            uuid primary key default gen_random_uuid(),
  country_code  char(2) not null references public.countries(code),
  name          text not null,
  slug          text not null,
  unique (country_code, slug)
);

create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references public.regions(id),
  name       text not null,
  slug       text not null,
  centroid   extensions.geography(point, 4326),
  unique (region_id, slug)
);

create table public.areas (                  -- neighbourhood: East Legon, Osu, Adum …
  id        uuid primary key default gen_random_uuid(),
  city_id   uuid not null references public.cities(id),
  name      text not null,
  slug      text not null,
  centroid  extensions.geography(point, 4326),
  unique (city_id, slug)
);
create index areas_name_trgm on public.areas using gin (name extensions.gin_trgm_ops);

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.categories(id),
  name             text not null,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text,
  icon             text,
  search_keywords  text[] not null default '{}',   -- {'barber','haircut','fade','low cut'}
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Identity
-- -----------------------------------------------------------------------------
-- 1:1 with auth.users. Created by trigger on auth.users insert (Phase 1).
-- SPEC lists `users` + `customer_profiles`: auth.users *is* users, and every
-- person is a potential customer, so customer fields live here.
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text check (char_length(full_name) <= 120),
  phone_e164       text unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'), -- format guard only; real validation = libphonenumber in app
  email            text,
  avatar_path      text,
  country_code     char(2) references public.countries(code),
  locale           text not null default 'en',
  notify_sms       boolean not null default true,
  notify_whatsapp  boolean not null default true,
  notify_email     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz                          -- set on account deletion; row anonymised
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.platform_admins (
  user_id     uuid primary key references public.profiles(id),
  role        public.admin_role not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id)
);

create table public.consents (             -- Act 843: record what was agreed, when, to which version
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('terms','privacy','marketing_sms','marketing_whatsapp','marketing_email')),
  granted     boolean not null,
  version     text not null,
  source      text not null,               -- 'web_signup', 'booking_form', 'settings'
  created_at  timestamptz not null default now()
);
create index consents_user_kind on public.consents (user_id, kind, created_at desc);

-- -----------------------------------------------------------------------------
-- 5. Tenant root
-- -----------------------------------------------------------------------------
create table public.businesses (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name             text not null check (char_length(name) between 2 and 120),
  description      text check (char_length(description) <= 2000),
  kind             public.business_kind not null default 'solo',
  status           public.business_status not null default 'draft',
  country_code     char(2) not null references public.countries(code),
  currency_code    char(3) not null references public.currencies(code),
  timezone         text not null default 'Africa/Accra',   -- IANA; validated in app + trigger (Phase 1)
  phone_e164       text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp_e164    text check (whatsapp_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email            text,
  logo_path        text,
  cover_path       text,
  -- denormalised read models (maintained by triggers/jobs; never trusted for authz)
  rating_avg       numeric(3,2),
  rating_count     int not null default 0,
  next_available_at timestamptz,
  search_vector    tsvector,
  created_by       uuid not null references public.profiles(id),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index businesses_status on public.businesses (status) where deleted_at is null;
create index businesses_search on public.businesses using gin (search_vector);
create index businesses_name_trgm on public.businesses using gin (name extensions.gin_trgm_ops);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();

create table public.business_members (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.member_role not null,
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user on public.business_members (user_id);

-- -----------------------------------------------------------------------------
-- 6. RLS helper functions (SECURITY DEFINER so they can read business_members
--    without recursing into its own RLS; search_path pinned).
-- -----------------------------------------------------------------------------
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

create or replace function private.has_business_role(p_business_id uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function private.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_business_role(p_business_id, array['owner','manager','staff']::public.member_role[]);
$$;

create or replace function private.can_manage_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_business_role(p_business_id, array['owner','manager']::public.member_role[]);
$$;

create or replace function private.is_published_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses b
                 where b.id = p_business_id and b.status = 'published' and b.deleted_at is null);
$$;

grant execute on all functions in schema private to authenticated, anon;

-- -----------------------------------------------------------------------------
-- 7. Business configuration
-- -----------------------------------------------------------------------------
create table public.business_categories (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  category_id  uuid not null references public.categories(id),
  is_primary   boolean not null default false,
  primary key (business_id, category_id)
);
create unique index business_categories_one_primary on public.business_categories (business_id) where is_primary;

create table public.business_locations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  country_code  char(2) not null references public.countries(code),
  region_id     uuid references public.regions(id),
  city_id       uuid references public.cities(id),
  area_id       uuid references public.areas(id),
  address_line  text,
  landmark      text,                     -- "Opposite Total filling station"
  directions    text,
  geo           extensions.geography(point, 4326),   -- optional
  is_primary    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, id)
);
create unique index business_locations_one_primary on public.business_locations (business_id) where is_primary;
create index business_locations_geo  on public.business_locations using gist (geo);
create index business_locations_city on public.business_locations (city_id, area_id);

create table public.booking_rules (
  business_id                uuid primary key references public.businesses(id) on delete cascade,
  slot_interval_minutes      smallint not null default 15 check (slot_interval_minutes in (5,10,15,20,30,60)),
  min_notice_minutes         int not null default 60   check (min_notice_minutes between 0 and 10080),
  max_advance_days           int not null default 60   check (max_advance_days between 1 and 365),
  buffer_before_minutes      smallint not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes       smallint not null default 0 check (buffer_after_minutes between 0 and 240),
  cancellation_window_hours  int not null default 2   check (cancellation_window_hours between 0 and 336),
  reschedule_window_hours    int not null default 2   check (reschedule_window_hours between 0 and 336),
  auto_confirm               boolean not null default true,
  allow_guest_booking        boolean not null default true,
  pending_hold_minutes       smallint not null default 15 check (pending_hold_minutes between 5 and 120),
  updated_at                 timestamptz not null default now()
);

create table public.business_hours (         -- several rows per weekday = split shift / lunch break
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  during       public.timerange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  exclude using gist (business_id with =, weekday with =, during with &&)
);

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  category_id       uuid references public.categories(id),
  name              text not null check (char_length(name) between 1 and 120),
  description       text check (char_length(description) <= 1000),
  price_minor       int not null check (price_minor >= 0),
  price_type        public.price_type not null default 'fixed',
  currency_code     char(3) not null references public.currencies(code),
  duration_minutes  smallint not null check (duration_minutes between 5 and 720 and duration_minutes % 5 = 0),
  deposit_minor     int check (deposit_minor > 0),
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (business_id, id),
  check (deposit_minor is null or deposit_minor <= price_minor)
);
create index services_business on public.services (business_id) where deleted_at is null;
create trigger services_updated_at before update on public.services
  for each row execute function private.set_updated_at();

create table public.staff (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses(id) on delete cascade,
  user_id                  uuid references public.profiles(id) on delete set null,  -- null = no login
  display_name             text not null check (char_length(display_name) between 1 and 80),
  role_title               text,
  bio                      text check (char_length(bio) <= 1000),
  photo_path               text,
  uses_business_hours      boolean not null default true,   -- solo default: no separate schedule
  accepts_online_bookings  boolean not null default true,
  is_active                boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  unique (business_id, id),
  unique (business_id, user_id)
);
create trigger staff_updated_at before update on public.staff
  for each row execute function private.set_updated_at();

-- Composite FKs (business_id, x_id) make it impossible to link a staff member
-- of business A to a service of business B, even through a buggy code path.
create table public.staff_services (
  business_id  uuid not null,
  staff_id     uuid not null,
  service_id   uuid not null,
  primary key (staff_id, service_id),
  foreign key (business_id, staff_id)   references public.staff(business_id, id)    on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);
create index staff_services_service on public.staff_services (service_id);

create table public.staff_working_hours (    -- only used when staff.uses_business_hours = false
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  staff_id     uuid not null,
  weekday      smallint not null check (weekday between 1 and 7),
  during       public.timerange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  foreign key (business_id, staff_id) references public.staff(business_id, id) on delete cascade,
  exclude using gist (staff_id with =, weekday with =, during with &&)
);

create table public.blocked_times (          -- time off, one-off breaks, holidays; staff_id null = whole business
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  staff_id     uuid,
  during       tstzrange not null check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  reason       text check (char_length(reason) <= 200),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  foreign key (business_id, staff_id) references public.staff(business_id, id) on delete cascade
);
create index blocked_times_staff_during    on public.blocked_times using gist (staff_id, during);
create index blocked_times_business_during on public.blocked_times using gist (business_id, during);

-- -----------------------------------------------------------------------------
-- 8. Clients & appointments
-- -----------------------------------------------------------------------------
-- A business's own view of a customer (covers walk-ins with no account).
create table public.business_clients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete set null,
  full_name    text not null check (char_length(full_name) between 1 and 120),
  phone_e164   text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, id)
);
create unique index business_clients_user  on public.business_clients (business_id, user_id)    where user_id is not null;
create unique index business_clients_phone on public.business_clients (business_id, phone_e164) where phone_e164 is not null;

create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses(id),
  location_id            uuid,
  service_id             uuid not null,
  staff_id               uuid not null,
  client_id              uuid,
  customer_user_id       uuid references public.profiles(id) on delete set null,
  status                 public.appointment_status not null default 'pending',
  source                 public.appointment_source not null,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  buffer_before_minutes  smallint not null default 0,
  buffer_after_minutes   smallint not null default 0,
  occupied               tstzrange not null,          -- set by trigger: [starts - before, ends + after)
  -- snapshots: the record stays correct if the service/price/customer changes later
  service_name           text not null,
  price_minor            int not null check (price_minor >= 0),
  currency_code          char(3) not null references public.currencies(code),
  deposit_minor          int check (deposit_minor >= 0),
  customer_name          text not null,
  customer_phone_e164    text check (customer_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  customer_note          text check (char_length(customer_note) <= 500),
  payment_status         public.payment_status,       -- null = nothing to pay online
  hold_expires_at        timestamptz,                 -- pending + deposit: released when passed
  rescheduled_from_id    uuid references public.appointments(id),
  cancelled_at           timestamptz,
  cancelled_by           uuid references public.profiles(id),
  cancellation_reason    text,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, staff_id)    references public.staff(business_id, id),
  foreign key (business_id, service_id)  references public.services(business_id, id),
  foreign key (business_id, client_id)   references public.business_clients(business_id, id),
  foreign key (business_id, location_id) references public.business_locations(business_id, id),

  -- ★ THE double-booking guarantee (ADR-0003): no two live appointments of the
  -- same staff member may overlap, including buffers, whatever the app does.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    occupied with &&
  ) where (status in ('pending', 'confirmed', 'arrived', 'completed'))
);
create index appointments_business_starts on public.appointments (business_id, starts_at);
create index appointments_staff_starts    on public.appointments (staff_id, starts_at);
create index appointments_customer        on public.appointments (customer_user_id, starts_at desc) where customer_user_id is not null;
create index appointments_holds           on public.appointments (hold_expires_at) where status = 'pending' and hold_expires_at is not null;

create or replace function private.appointments_set_occupied() returns trigger
language plpgsql as $$
begin
  new.occupied := tstzrange(
    new.starts_at - make_interval(mins => new.buffer_before_minutes),
    new.ends_at   + make_interval(mins => new.buffer_after_minutes),
    '[)');
  return new;
end $$;
create trigger appointments_occupied before insert or update of starts_at, ends_at, buffer_before_minutes, buffer_after_minutes
  on public.appointments for each row execute function private.appointments_set_occupied();
create trigger appointments_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

create table public.appointment_status_history (
  id              bigint generated always as identity primary key,
  business_id     uuid not null references public.businesses(id),
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  from_status     public.appointment_status,
  to_status       public.appointment_status not null,
  changed_by      uuid references public.profiles(id),
  reason          text,
  created_at      timestamptz not null default now()
);
create index appointment_status_history_appt on public.appointment_status_history (appointment_id, created_at);

create or replace function private.appointments_log_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.appointment_status_history (business_id, appointment_id, from_status, to_status, changed_by, reason)
    values (new.business_id, new.id,
            case when tg_op = 'UPDATE' then old.status end,
            new.status, auth.uid(),
            nullif(current_setting('app.status_reason', true), ''));
  end if;
  return new;
end $$;
create trigger appointments_status_history after insert or update of status on public.appointments
  for each row execute function private.appointments_log_status();

-- -----------------------------------------------------------------------------
-- 9. Payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id),
  appointment_id      uuid not null references public.appointments(id),
  kind                public.payment_kind not null,
  method              public.payment_method not null,
  provider            text not null,                  -- 'mock', 'cash', later e.g. 'paystack'
  provider_reference  text,
  idempotency_key     text not null unique,
  amount_minor        int not null check (amount_minor > 0),
  currency_code       char(3) not null references public.currencies(code),
  status              public.payment_status not null default 'pending',
  failure_reason      text,
  metadata            jsonb not null default '{}',
  paid_at             timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_reference)
);
create index payments_appointment on public.payments (appointment_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- Raw inbound webhooks. Unique (provider, event id) = idempotent processing.
-- No RLS policies: only reachable with the service key from the webhook route.
create table public.payment_events (
  id                 bigint generated always as identity primary key,
  provider           text not null,
  provider_event_id  text not null,
  payment_id         uuid references public.payments(id),
  payload            jsonb not null,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  unique (provider, provider_event_id)
);

-- -----------------------------------------------------------------------------
-- 10. Reviews & favorites
-- -----------------------------------------------------------------------------
create table public.reviews (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses(id),
  appointment_id         uuid not null unique references public.appointments(id),  -- one review per completed appointment
  customer_user_id       uuid references public.profiles(id) on delete set null,
  service_id             uuid,
  staff_id               uuid,
  rating                 smallint not null check (rating between 1 and 5),
  body                   text check (char_length(body) <= 2000),
  status                 public.review_status not null default 'published',
  provider_response      text check (char_length(provider_response) <= 2000),
  provider_responded_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (business_id, service_id) references public.services(business_id, id),
  foreign key (business_id, staff_id)   references public.staff(business_id, id)
);
create index reviews_business on public.reviews (business_id, created_at desc) where status = 'published';

create table public.review_reports (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null references public.reviews(id) on delete cascade,
  reporter_user_id  uuid references public.profiles(id) on delete set null,
  reason            text not null check (char_length(reason) between 3 and 500),
  resolved_at       timestamptz,
  resolved_by       uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  unique (review_id, reporter_user_id)
);

create table public.favorites (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, business_id)
);

-- -----------------------------------------------------------------------------
-- 11. Media
-- -----------------------------------------------------------------------------
create table public.business_photos (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  storage_path  text not null,          -- public-media/businesses/{business_id}/photos/{id}-{w}.webp
  width         int, height int,
  caption       text check (char_length(caption) <= 200),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table public.staff_photos (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  staff_id      uuid not null,
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  foreign key (business_id, staff_id) references public.staff(business_id, id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- 12. Notifications (outbox + in-app inbox)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid references public.businesses(id) on delete cascade,
  appointment_id       uuid references public.appointments(id) on delete cascade,
  recipient_user_id    uuid references public.profiles(id) on delete cascade,
  recipient_address    text,                    -- phone/email snapshot for guests & walk-ins
  channel              public.notification_channel not null,
  template_key         text not null,           -- 'booking.confirmed.customer'
  locale               text not null default 'en',
  payload              jsonb not null default '{}',
  status               public.notification_status not null default 'queued',
  scheduled_for        timestamptz not null default now(),
  attempts             smallint not null default 0,
  last_error           text,
  provider             text,
  provider_message_id  text,
  dedupe_key           text unique,             -- e.g. 'reminder24h:{appointment_id}:sms'
  sent_at              timestamptz,
  read_at              timestamptz,             -- in_app only
  created_at           timestamptz not null default now()
);
create index notifications_due   on public.notifications (scheduled_for) where status = 'queued';
create index notifications_inbox on public.notifications (recipient_user_id, created_at desc) where channel = 'in_app';

-- -----------------------------------------------------------------------------
-- 13. Admin audit log (append-only)
-- -----------------------------------------------------------------------------
create table public.admin_actions (
  id              bigint generated always as identity primary key,
  admin_user_id   uuid not null references public.profiles(id),
  action          text not null,           -- 'business.suspend', 'review.hide', 'pii.view'
  target_table    text not null,
  target_id       text not null,
  reason          text not null check (char_length(reason) >= 3),
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);
create index admin_actions_target on public.admin_actions (target_table, target_id, created_at desc);

-- =============================================================================
-- 14. Row Level Security
-- =============================================================================
-- Rule: RLS is ON for every table in `public`. No policy for an operation =
-- denied. Complex writes go through SECURITY DEFINER functions (section 15).
alter table public.currencies                 enable row level security;
alter table public.countries                  enable row level security;
alter table public.regions                    enable row level security;
alter table public.cities                     enable row level security;
alter table public.areas                      enable row level security;
alter table public.categories                 enable row level security;
alter table public.profiles                   enable row level security;
alter table public.platform_admins            enable row level security;
alter table public.consents                   enable row level security;
alter table public.businesses                 enable row level security;
alter table public.business_members           enable row level security;
alter table public.business_categories        enable row level security;
alter table public.business_locations         enable row level security;
alter table public.booking_rules              enable row level security;
alter table public.business_hours             enable row level security;
alter table public.services                   enable row level security;
alter table public.staff                      enable row level security;
alter table public.staff_services             enable row level security;
alter table public.staff_working_hours        enable row level security;
alter table public.blocked_times              enable row level security;
alter table public.business_clients           enable row level security;
alter table public.appointments               enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.payments                   enable row level security;
alter table public.payment_events             enable row level security;
alter table public.reviews                    enable row level security;
alter table public.review_reports             enable row level security;
alter table public.favorites                  enable row level security;
alter table public.business_photos            enable row level security;
alter table public.staff_photos               enable row level security;
alter table public.notifications              enable row level security;
alter table public.admin_actions              enable row level security;

-- Reference data: anyone reads; only definer admin functions write.
create policy "public read" on public.currencies for select using (true);
create policy "public read" on public.countries  for select using (true);
create policy "public read" on public.regions    for select using (true);
create policy "public read" on public.cities     for select using (true);
create policy "public read" on public.areas      for select using (true);
create policy "public read active" on public.categories for select using (is_active or (select private.is_platform_admin()));

-- Profiles: self only. Businesses see customer details via appointment snapshots, not profiles.
create policy "self read"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "self update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "self read" on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy "self insert" on public.consents for insert to authenticated with check (user_id = (select auth.uid()));

create policy "admins read admins" on public.platform_admins for select to authenticated using ((select private.is_platform_admin()));

-- Businesses
create policy "public read published" on public.businesses for select
  using (status = 'published' and deleted_at is null);
create policy "members read own" on public.businesses for select to authenticated
  using ((select private.is_business_member(id)));
create policy "managers update" on public.businesses for update to authenticated
  using ((select private.can_manage_business(id)))
  with check ((select private.can_manage_business(id)));
-- Only content columns are updatable directly; status/slug/ownership/read models via functions.
revoke update on public.businesses from authenticated, anon;
grant update (name, description, phone_e164, whatsapp_e164, email, logo_path, cover_path, timezone)
  on public.businesses to authenticated;

create policy "members read team" on public.business_members for select to authenticated
  using ((select private.is_business_member(business_id)));
-- insert/update/delete: via invite/accept functions (Phase 2/3), owner only.

-- Pattern A: "public if published, full access for managers" (config tables)
create policy "public read" on public.business_categories for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.business_categories for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.business_locations for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.business_locations for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.booking_rules for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.booking_rules for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.business_hours for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.business_hours for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read active" on public.services for select
  using ((is_active and deleted_at is null and (select private.is_published_business(business_id)))
         or (select private.is_business_member(business_id)));
create policy "managers write" on public.services for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read active" on public.staff for select
  using ((is_active and deleted_at is null and (select private.is_published_business(business_id)))
         or (select private.is_business_member(business_id)));
create policy "managers write" on public.staff for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.staff_services for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.staff_services for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.staff_working_hours for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.staff_working_hours for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.business_photos for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.business_photos for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

create policy "public read" on public.staff_photos for select using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "managers write" on public.staff_photos for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

-- Blocked times: members read (reasons may be private, so there is no public read;
-- the public sees busy intervals via get_busy_intervals()). Writes via
-- create_blocked_time() only, because it takes the per-staff lock (ADR-0003).
create policy "members read" on public.blocked_times for select to authenticated
  using ((select private.is_business_member(business_id)));

-- Pattern B: private tenant data (PII)
create policy "managers all" on public.business_clients for all to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));

-- Appointments: three audiences, no direct writes (book_appointment / set_appointment_status).
create policy "managers read" on public.appointments for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "staff read own" on public.appointments for select to authenticated
  using (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid())));
create policy "customer read own" on public.appointments for select to authenticated
  using (customer_user_id = (select auth.uid()));

create policy "managers read" on public.appointment_status_history for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "customer read own" on public.appointment_status_history for select to authenticated
  using (appointment_id in (select a.id from public.appointments a where a.customer_user_id = (select auth.uid())));

create policy "managers read" on public.payments for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "customer read own" on public.payments for select to authenticated
  using (appointment_id in (select a.id from public.appointments a where a.customer_user_id = (select auth.uid())));
-- payment_events: no policies → no client access at all.

create policy "public read published" on public.reviews for select using (status = 'published');
create policy "author read own" on public.reviews for select to authenticated using (customer_user_id = (select auth.uid()));
create policy "members read all" on public.reviews for select to authenticated using ((select private.is_business_member(business_id)));
create policy "moderators read" on public.reviews for select to authenticated using ((select private.is_platform_admin()));
-- insert via submit_review() (checks completed appointment); response via respond_to_review().

create policy "reporter insert" on public.review_reports for insert to authenticated with check (reporter_user_id = (select auth.uid()));
create policy "moderators read" on public.review_reports for select to authenticated using ((select private.is_platform_admin()));

create policy "own favorites" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own in-app inbox" on public.notifications for select to authenticated
  using (channel = 'in_app' and recipient_user_id = (select auth.uid()));
create policy "mark read" on public.notifications for update to authenticated
  using (channel = 'in_app' and recipient_user_id = (select auth.uid()))
  with check (channel = 'in_app' and recipient_user_id = (select auth.uid()));
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create policy "admins read" on public.admin_actions for select to authenticated using ((select private.is_platform_admin()));
-- no insert/update/delete policy; written only inside admin_* definer functions.
revoke update, delete, truncate on public.admin_actions from authenticated, anon;

-- =============================================================================
-- 15. Core functions (sketches; full versions + pgTAP tests in Phase 1/5)
-- =============================================================================

-- Is [p_start, p_end) inside the staff member's working hours on that local day?
-- Uses business hours when staff.uses_business_hours, else staff hours ∩ business hours.
create or replace function private.within_working_hours(p_staff_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz        text;
  v_business  uuid;
  v_uses_biz  boolean;
  v_ls        timestamp;   -- local start (wall clock)
  v_le        timestamp;   -- local end
  v_dow       int;
  v_span      public.timerange;
begin
  select b.timezone, b.id, s.uses_business_hours into v_tz, v_business, v_uses_biz
  from public.staff s join public.businesses b on b.id = s.business_id
  where s.id = p_staff_id;

  v_ls := p_start at time zone v_tz;
  v_le := p_end   at time zone v_tz;
  -- MVP: no appointment crosses local midnight (overnight shifts are out of scope)
  if v_le::date > v_ls::date and not (v_le::date = v_ls::date + 1 and v_le::time = '00:00') then
    return false;
  end if;
  v_dow  := extract(isodow from v_ls);
  v_span := public.timerange(v_ls::time, case when v_le::time = '00:00' then '24:00'::time else v_le::time end, '[)');

  if not exists (select 1 from public.business_hours h
                 where h.business_id = v_business and h.weekday = v_dow and h.during @> v_span) then
    return false;
  end if;
  if not v_uses_biz and not exists (select 1 from public.staff_working_hours w
                 where w.staff_id = p_staff_id and w.weekday = v_dow and w.during @> v_span) then
    return false;
  end if;
  return true;
end $$;

create or replace function private.lock_staff(p_staff_id uuid) returns void
language sql as $$
  select pg_advisory_xact_lock(hashtextextended('staff:' || p_staff_id::text, 0));
$$;

-- Book an appointment. p_staff_ids is an ORDERED candidate list:
--   one element  = customer picked a staff member
--   many         = "any available", pre-ordered by the app (fair distribution)
-- Tries each candidate; the exclusion constraint is the final arbiter.
-- Errors: SQLSTATE 'BK409' slot unavailable, 'BK422' invalid request, 'BK403' forbidden, 'BK429' rate limited.
create or replace function public.book_appointment(
  p_business_id  uuid,
  p_service_id   uuid,
  p_staff_ids    uuid[],
  p_starts_at    timestamptz,
  p_customer_name  text,
  p_customer_phone text,
  p_note         text default null,
  p_source       public.appointment_source default 'online'
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_is_member  boolean := private.can_manage_business(p_business_id) or private.is_business_member(p_business_id);
  v_rules      public.booking_rules;
  v_biz        public.businesses;
  v_svc        public.services;
  v_ends_at    timestamptz;
  v_staff_id   uuid;
  v_client_id  uuid;
  v_appt_id    uuid;
  v_status     public.appointment_status;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = 'BK403';
  end if;

  select * into v_biz from public.businesses where id = p_business_id and deleted_at is null;
  select * into v_rules from public.booking_rules where business_id = p_business_id;
  select * into v_svc from public.services
    where id = p_service_id and business_id = p_business_id and is_active and deleted_at is null;
  if v_biz.id is null or v_svc.id is null or v_rules.business_id is null then
    raise exception 'unknown business or service' using errcode = 'BK422';
  end if;

  if p_source = 'online' then
    if v_biz.status <> 'published' then
      raise exception 'business not bookable' using errcode = 'BK422';
    end if;
    if p_starts_at < now() + make_interval(mins => v_rules.min_notice_minutes)
       or p_starts_at > now() + make_interval(days => v_rules.max_advance_days) then
      raise exception 'outside booking window' using errcode = 'BK422';
    end if;
    -- abuse guard that cannot be bypassed by calling PostgREST directly
    if (select count(*) from public.appointments a
        where a.created_by = v_uid and a.created_at > now() - interval '1 hour') >= 5 then
      raise exception 'too many bookings' using errcode = 'BK429';
    end if;
  elsif not v_is_member then
    raise exception 'only business members can create manual/walk-in appointments' using errcode = 'BK403';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_svc.duration_minutes);
  v_status  := case when v_svc.deposit_minor is not null and p_source = 'online' then 'pending'
                    when v_rules.auto_confirm or p_source <> 'online' then 'confirmed'
                    else 'pending' end;

  -- client record (dedupe by user, then phone)
  select id into v_client_id from public.business_clients
    where business_id = p_business_id
      and ((p_source = 'online' and user_id = v_uid) or (phone_e164 = p_customer_phone));
  if v_client_id is null then
    insert into public.business_clients (business_id, user_id, full_name, phone_e164)
    values (p_business_id, case when p_source = 'online' then v_uid end, p_customer_name, p_customer_phone)
    returning id into v_client_id;
  end if;

  foreach v_staff_id in array p_staff_ids loop
    -- candidate must belong to this business, be active, and offer the service
    continue when not exists (
      select 1 from public.staff s join public.staff_services ss on ss.staff_id = s.id
      where s.id = v_staff_id and s.business_id = p_business_id and s.is_active and s.deleted_at is null
        and ss.service_id = p_service_id
        and (p_source <> 'online' or s.accepts_online_bookings));

    perform private.lock_staff(v_staff_id);   -- serialises with create_blocked_time() for this staff

    -- release this staff member's expired holds so they don't block the slot
    update public.appointments set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'hold_expired'
      where staff_id = v_staff_id and status = 'pending' and hold_expires_at < now();

    continue when p_source = 'online' and not private.within_working_hours(v_staff_id, p_starts_at, v_ends_at);
    continue when exists (
      select 1 from public.blocked_times bt
      where bt.business_id = p_business_id
        and (bt.staff_id = v_staff_id or bt.staff_id is null)
        and bt.during && tstzrange(p_starts_at, v_ends_at, '[)'));

    begin
      insert into public.appointments (
        business_id, service_id, staff_id, client_id, customer_user_id, status, source,
        starts_at, ends_at, buffer_before_minutes, buffer_after_minutes,
        service_name, price_minor, currency_code, deposit_minor,
        customer_name, customer_phone_e164, customer_note,
        payment_status, hold_expires_at, created_by)
      values (
        p_business_id, p_service_id, v_staff_id, v_client_id,
        case when p_source = 'online' then v_uid end, v_status, p_source,
        p_starts_at, v_ends_at, v_rules.buffer_before_minutes, v_rules.buffer_after_minutes,
        v_svc.name, v_svc.price_minor, v_svc.currency_code, v_svc.deposit_minor,
        p_customer_name, p_customer_phone, p_note,
        case when v_svc.deposit_minor is not null and p_source = 'online' then 'pending'::public.payment_status end,
        case when v_status = 'pending' then now() + make_interval(mins => v_rules.pending_hold_minutes) end,
        v_uid)
      returning id into v_appt_id;
      return v_appt_id;                          -- success
    exception when exclusion_violation then
      null;                                      -- taken concurrently; try next candidate
    end;
  end loop;

  raise exception 'slot unavailable' using errcode = 'BK409';
end $$;

revoke execute on function public.book_appointment from public, anon;
grant execute on function public.book_appointment to authenticated;

-- Busy intervals for the public availability calculator. It returns NO customer
-- data, only who is busy when. Used by src/server/scheduling (ADR-0003 §Availability).
create or replace function public.get_busy_intervals(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns table (staff_id uuid, during tstzrange, kind text)  -- kind: 'appointment' (occupied incl. buffers) | 'block'
language sql stable security definer set search_path = '' as $$
  select a.staff_id, a.occupied, 'appointment'
  from public.appointments a
  where a.business_id = p_business_id
    and (private.is_published_business(p_business_id) or private.is_business_member(p_business_id))
    and a.status in ('pending','confirmed','arrived','completed')
    and not (a.status = 'pending' and a.hold_expires_at < now())
    and a.occupied && tstzrange(p_from, p_to, '[)')
    and p_to - p_from <= interval '62 days'
  union all
  select s.id, bt.during, 'block'
  from public.blocked_times bt
  join public.staff s on s.business_id = bt.business_id and (bt.staff_id = s.id or bt.staff_id is null)
  where bt.business_id = p_business_id
    and (private.is_published_business(p_business_id) or private.is_business_member(p_business_id))
    and bt.during && tstzrange(p_from, p_to, '[)')
    and p_to - p_from <= interval '62 days';
$$;
grant execute on function public.get_busy_intervals to anon, authenticated;

-- Blocked time creation takes the same per-staff lock(s) as booking, so a block
-- and a booking for the same staff can never slip past each other.
create or replace function public.create_blocked_time(p_business_id uuid, p_staff_id uuid, p_during tstzrange, p_reason text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_sid uuid;
begin
  if not (private.can_manage_business(p_business_id)
          or (p_staff_id is not null and exists (select 1 from public.staff s
               where s.id = p_staff_id and s.business_id = p_business_id and s.user_id = auth.uid()))) then
    raise exception 'forbidden' using errcode = 'BK403';
  end if;
  -- lock every affected staff in a stable order (no deadlocks)
  for v_sid in select id from public.staff
               where business_id = p_business_id and (p_staff_id is null or id = p_staff_id)
               order by id loop
    perform private.lock_staff(v_sid);
  end loop;
  if exists (select 1 from public.appointments a
             where a.business_id = p_business_id
               and (p_staff_id is null or a.staff_id = p_staff_id)
               and a.status in ('pending','confirmed','arrived')
               and tstzrange(a.starts_at, a.ends_at, '[)') && p_during) then
    raise exception 'block overlaps existing appointments' using errcode = 'BK409';
  end if;
  insert into public.blocked_times (business_id, staff_id, during, reason, created_by)
  values (p_business_id, p_staff_id, p_during, p_reason, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_blocked_time from public, anon;
grant execute on function public.create_blocked_time to authenticated;

-- Allowed status transitions (enforced in set_appointment_status, Phase 6):
--   pending   → confirmed | cancelled
--   confirmed → arrived | completed | cancelled | no_show
--   arrived   → completed | cancelled
--   completed, cancelled, no_show → (terminal; corrections are admin-only and audited)
-- Who may do what:
--   owner/manager: any allowed transition
--   staff:         arrived/completed/no_show on their own appointments
--   customer:      cancel own pending/confirmed, only if starts_at - now() >= cancellation_window_hours

-- =============================================================================
-- 16. Storage policies (example): bucket `public-media`
--     path convention: businesses/{business_id}/{kind}/{file}
-- =============================================================================
create policy "public-media read" on storage.objects for select
  using (bucket_id = 'public-media');
create policy "public-media managers write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media'
              and (storage.foldername(name))[1] = 'businesses'
              and (select private.can_manage_business(((storage.foldername(name))[2])::uuid)));
create policy "public-media managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media'
         and (storage.foldername(name))[1] = 'businesses'
         and (select private.can_manage_business(((storage.foldername(name))[2])::uuid)));
