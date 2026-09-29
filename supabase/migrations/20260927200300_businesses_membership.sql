-- Tenant root: businesses + business_members, plus the RLS helper functions every
-- tenant table will use. ADR-0002.

create type public.member_role     as enum ('owner', 'manager', 'staff');
create type public.business_status as enum ('draft', 'published', 'suspended', 'deactivated');
create type public.business_kind   as enum ('solo', 'team');

create table public.businesses (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                       check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name               text not null check (char_length(name) between 2 and 120),
  description        text check (char_length(description) <= 2000),
  kind               public.business_kind not null default 'solo',
  status             public.business_status not null default 'draft',
  country_code       char(2) not null references public.countries (code),
  currency_code      char(3) not null references public.currencies (code),
  timezone           text not null default 'Africa/Accra',
  phone_e164         text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp_e164      text check (whatsapp_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email              text check (char_length(email) <= 320),
  logo_path          text,
  cover_path         text,
  -- denormalised read models (maintained by triggers/jobs in later phases; never used for authorization)
  rating_avg         numeric(3, 2),
  rating_count       int not null default 0,
  next_available_at  timestamptz,
  created_by         uuid not null references public.profiles (id),
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index businesses_status on public.businesses (status) where deleted_at is null;
create index businesses_country_code on public.businesses (country_code);
create index businesses_currency_code on public.businesses (currency_code);
create index businesses_created_by on public.businesses (created_by);
create index businesses_name_trgm on public.businesses using gin (name extensions.gin_trgm_ops);
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();

-- Reject unknown IANA zones (availability is computed in this zone).
create or replace function private.businesses_validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger businesses_validate_timezone before insert or update of timezone on public.businesses
  for each row execute function private.businesses_validate_timezone();

create table public.business_members (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null,
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_id on public.business_members (user_id);

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER lets them read business_members without
-- recursing into its own RLS. STABLE, pinned search_path, in the unexposed
-- `private` schema. Policies call them as (select private.fn(...)) so they
-- are evaluated once per statement.
-- ---------------------------------------------------------------------------
create or replace function private.has_business_role(p_business_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_business_role(p_business_id, array['owner', 'manager', 'staff']::public.member_role[]);
$$;

create or replace function private.can_manage_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_business_role(p_business_id, array['owner', 'manager']::public.member_role[]);
$$;

create or replace function private.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_business_role(p_business_id, array['owner']::public.member_role[]);
$$;

create or replace function private.is_published_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'published' and b.deleted_at is null
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.is_platform_admin()                                  to anon, authenticated;
grant execute on function private.has_business_role(uuid, public.member_role[])        to anon, authenticated;
grant execute on function private.is_business_member(uuid)                             to anon, authenticated;
grant execute on function private.can_manage_business(uuid)                            to anon, authenticated;
grant execute on function private.is_business_owner(uuid)                              to anon, authenticated;
grant execute on function private.is_published_business(uuid)                          to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.businesses       enable row level security;
alter table public.business_members enable row level security;

create policy "published businesses are public" on public.businesses for select to anon, authenticated
  using (status = 'published' and deleted_at is null);
create policy "members read their businesses" on public.businesses for select to authenticated
  using ((select private.is_business_member(id)));
create policy "managers update their businesses" on public.businesses for update to authenticated
  using ((select private.can_manage_business(id)))
  with check ((select private.can_manage_business(id)));
-- No insert/delete policies: creation goes through create_business() (Phase 2), which
-- inserts the business and the owner membership atomically; deletion is soft (deleted_at) via functions.
-- Only content columns are directly updatable. status, slug, ownership and read models go through functions.
revoke update on public.businesses from anon, authenticated;
grant update (name, description, phone_e164, whatsapp_e164, email, logo_path, cover_path, timezone)
  on public.businesses to authenticated;

create policy "members read their team" on public.business_members for select to authenticated
  using ((select private.is_business_member(business_id)));
-- Membership changes go through invite/accept/remove functions (Phase 3), owner only.
