-- Phase 3: services, staff ↔ services, opening/working hours, blocked times,
-- staff invites, admin audit log. Design: docs/data-model.md; tenancy: ADR-0002.

create type public.price_type as enum ('fixed', 'from');

-- A range over wall-clock time of day. '24:00' is a valid time, so "open until midnight" works.
create type public.timerange as range (subtype = time);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  category_id       uuid references public.categories (id),
  name              text not null check (char_length(name) between 1 and 120),
  description       text check (char_length(description) <= 1000),
  price_minor       int not null check (price_minor between 0 and 100000000),
  price_type        public.price_type not null default 'fixed',
  currency_code     char(3) not null references public.currencies (code),
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
create index services_business on public.services (business_id, sort_order) where deleted_at is null;
create index services_category_id on public.services (category_id);
create index services_currency_code on public.services (currency_code);
create trigger services_set_updated_at before update on public.services
  for each row execute function private.set_updated_at();

-- A service is priced in its business's currency.
create or replace function private.services_currency_matches_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency_code <> (select b.currency_code from public.businesses b where b.id = new.business_id) then
    raise exception 'service currency must match the business currency' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger services_currency_matches_business before insert or update of currency_code, business_id on public.services
  for each row execute function private.services_currency_matches_business();

-- Composite FKs: a staff member of business A can never be linked to a service of business B.
create table public.staff_services (
  business_id  uuid not null,
  staff_id     uuid not null,
  service_id   uuid not null,
  primary key (staff_id, service_id),
  foreign key (business_id, staff_id) references public.staff (business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services (business_id, id) on delete cascade
);
create index staff_services_service on public.staff_services (service_id);
create index staff_services_business_staff on public.staff_services (business_id, staff_id);
create index staff_services_business_service on public.staff_services (business_id, service_id);

-- ---------------------------------------------------------------------------
-- Hours. Several rows per ISO weekday (1 = Monday) = split shifts / breaks.
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  during       public.timerange not null
                 check (not isempty(during) and lower(during) is not null and upper(during) is not null
                        and lower_inc(during) and not upper_inc(during)),
  exclude using gist (business_id with =, weekday with =, during with &&)
);

create table public.staff_working_hours (       -- used only when staff.uses_business_hours = false
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null,
  staff_id     uuid not null,
  weekday      smallint not null check (weekday between 1 and 7),
  during       public.timerange not null
                 check (not isempty(during) and lower(during) is not null and upper(during) is not null
                        and lower_inc(during) and not upper_inc(during)),
  foreign key (business_id, staff_id) references public.staff (business_id, id) on delete cascade,
  exclude using gist (staff_id with =, weekday with =, during with &&)
);
create index staff_working_hours_business_staff on public.staff_working_hours (business_id, staff_id);

-- ---------------------------------------------------------------------------
-- Blocked times: time off, holidays, one-off breaks. staff_id null = whole business.
-- Written only via create_blocked_time() (takes the per-staff lock, ADR-0003).
-- ---------------------------------------------------------------------------
create table public.blocked_times (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  staff_id     uuid,
  during       tstzrange not null
                 check (not isempty(during) and lower(during) is not null and upper(during) is not null),
  reason       text check (char_length(reason) <= 200),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (business_id, staff_id) references public.staff (business_id, id) on delete cascade
);
create index blocked_times_staff_during on public.blocked_times using gist (staff_id, during);
create index blocked_times_business_during on public.blocked_times using gist (business_id, during);
create index blocked_times_business_staff on public.blocked_times (business_id, staff_id);
create index blocked_times_created_by on public.blocked_times (created_by);

-- ---------------------------------------------------------------------------
-- Staff invites. The owner shares a link; only the person with the invited,
-- verified phone number can accept it. Only a hash of the token is stored.
-- ---------------------------------------------------------------------------
create table public.staff_invites (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  staff_id      uuid not null,
  phone_e164    text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  role          public.member_role not null default 'staff' check (role in ('staff', 'manager')),
  token_hash    text not null unique,
  invited_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  accepted_by   uuid references public.profiles (id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (business_id, staff_id) references public.staff (business_id, id) on delete cascade
);
create unique index staff_invites_one_pending on public.staff_invites (staff_id)
  where accepted_at is null and revoked_at is null;
create index staff_invites_business_staff on public.staff_invites (business_id, staff_id);
create index staff_invites_invited_by on public.staff_invites (invited_by);
create index staff_invites_accepted_by on public.staff_invites (accepted_by);

-- ---------------------------------------------------------------------------
-- Admin audit log (append-only). Written only inside admin_* functions.
-- ---------------------------------------------------------------------------
create table public.admin_actions (
  id             bigint generated always as identity primary key,
  admin_user_id  uuid not null references public.profiles (id),
  action         text not null check (char_length(action) between 3 and 80),
  target_table   text not null,
  target_id      text not null,
  reason         text not null check (char_length(reason) between 3 and 500),
  before         jsonb,
  after          jsonb,
  created_at     timestamptz not null default now()
);
create index admin_actions_target on public.admin_actions (target_table, target_id, created_at desc);
create index admin_actions_admin on public.admin_actions (admin_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.services            enable row level security;
alter table public.staff_services      enable row level security;
alter table public.business_hours      enable row level security;
alter table public.staff_working_hours enable row level security;
alter table public.blocked_times       enable row level security;
alter table public.staff_invites       enable row level security;
alter table public.admin_actions       enable row level security;

create policy "public reads active services; members read all" on public.services for select to anon, authenticated
  using ((is_active and deleted_at is null and (select private.is_published_business(business_id)))
         or (select private.is_business_member(business_id)));
create policy "managers insert" on public.services for insert to authenticated
  with check ((select private.can_manage_business(business_id)));
create policy "managers update" on public.services for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
-- No delete policy: services are soft-deleted so past appointments keep their service.
revoke update on public.services from anon, authenticated;
grant update (category_id, name, description, price_minor, price_type, duration_minutes, deposit_minor, is_active, sort_order, deleted_at)
  on public.services to authenticated;

create policy "public or members read" on public.staff_services for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
-- Writes via set_service_staff() / set_staff_services() (atomic replace).

create policy "public or members read" on public.business_hours for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
create policy "public or members read" on public.staff_working_hours for select to anon, authenticated
  using ((select private.is_published_business(business_id)) or (select private.is_business_member(business_id)));
-- Writes via set_business_hours() / set_staff_hours() (atomic replace of a whole week).

-- Reasons can be private ("hospital appointment"), so only members read blocked times.
-- The public sees busy intervals through a function in Phase 5.
create policy "members read" on public.blocked_times for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy "managers or the staff member delete" on public.blocked_times for delete to authenticated
  using ((select private.can_manage_business(business_id))
         or (staff_id is not null and staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid()))));

create policy "managers read" on public.staff_invites for select to authenticated
  using ((select private.can_manage_business(business_id)));

create policy "admins read" on public.admin_actions for select to authenticated
  using ((select private.is_platform_admin()));
revoke insert, update, delete, truncate on public.admin_actions from anon, authenticated;

-- Admins also see inactive categories (to manage them).
create policy "admins read all categories" on public.categories for select to authenticated
  using ((select private.is_platform_admin()));
