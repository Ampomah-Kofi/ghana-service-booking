-- Reference data: currencies, countries, regions → cities → areas, categories.
-- Platform-managed data, not code (CLAUDE.md §Conventions). Anyone can read it.
-- Writes happen through migrations/seed now, and through audited admin functions in Phase 10.

create table public.currencies (
  code        char(3) primary key check (code ~ '^[A-Z]{3}$'),   -- ISO 4217
  name        text not null,
  symbol      text not null,                                     -- display override, e.g. 'GH₵'
  minor_unit  smallint not null default 2 check (minor_unit between 0 and 4)
);

create table public.countries (
  code              char(2) primary key check (code ~ '^[A-Z]{2}$'),     -- ISO 3166-1 alpha-2
  name              text not null,
  currency_code     char(3) not null references public.currencies (code),
  calling_code      text not null check (calling_code ~ '^[0-9]{1,4}$'),  -- '233'
  default_timezone  text not null,                                        -- IANA, e.g. 'Africa/Accra'
  is_active         boolean not null default false
);
create index countries_currency_code on public.countries (currency_code);

create table public.regions (
  id            uuid primary key default gen_random_uuid(),
  country_code  char(2) not null references public.countries (code),
  name          text not null,
  slug          text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  unique (country_code, slug)
);

create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references public.regions (id),
  name       text not null,
  slug       text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  centroid   extensions.geography(point, 4326),
  unique (region_id, slug)
);
create index cities_name_trgm on public.cities using gin (name extensions.gin_trgm_ops);

create table public.areas (                  -- neighbourhood: East Legon, Osu, Adum …
  id        uuid primary key default gen_random_uuid(),
  city_id   uuid not null references public.cities (id),
  name      text not null,
  slug      text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  centroid  extensions.geography(point, 4326),
  unique (city_id, slug)
);
create index areas_name_trgm on public.areas using gin (name extensions.gin_trgm_ops);

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid references public.categories (id),
  name             text not null check (char_length(name) between 1 and 80),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description      text check (char_length(description) <= 500),
  icon             text,
  search_keywords  text[] not null default '{}',
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index categories_parent_id on public.categories (parent_id);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

-- RLS: public read. No write policies = no client writes.
alter table public.currencies enable row level security;
alter table public.countries  enable row level security;
alter table public.regions    enable row level security;
alter table public.cities     enable row level security;
alter table public.areas      enable row level security;
alter table public.categories enable row level security;

create policy "reference data is public" on public.currencies for select to anon, authenticated using (true);
create policy "reference data is public" on public.countries  for select to anon, authenticated using (true);
create policy "reference data is public" on public.regions    for select to anon, authenticated using (true);
create policy "reference data is public" on public.cities     for select to anon, authenticated using (true);
create policy "reference data is public" on public.areas      for select to anon, authenticated using (true);
-- Inactive categories are hidden from the public. Admin read comes with the admin console (Phase 10).
create policy "active categories are public" on public.categories for select to anon, authenticated using (is_active);
