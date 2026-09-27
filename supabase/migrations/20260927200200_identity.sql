-- Identity: profiles (1:1 with auth.users), platform admins, consent records.
-- ADR-0004. `customer_profiles` from SPEC §19 is merged into `profiles` (docs/data-model.md §2).

create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text check (char_length(full_name) <= 120),
  -- Format guard only. Real validation is libphonenumber-js in the app (CLAUDE.md).
  phone_e164       text unique check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email            text check (char_length(email) <= 320),
  avatar_path      text,
  country_code     char(2) references public.countries (code),
  locale           text not null default 'en' check (char_length(locale) between 2 and 10),
  notify_sms       boolean not null default true,
  notify_whatsapp  boolean not null default true,
  notify_email     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index profiles_country_code on public.profiles (country_code);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Supabase Auth stores phones without the leading '+' (e.g. '233200000001').
create or replace function private.auth_phone_to_e164(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_phone is null or p_phone = '' then null
              when left(p_phone, 1) = '+' then p_phone
              else '+' || p_phone end;
$$;

-- Create the profile when an auth user is created, and keep phone/email in sync.
-- SECURITY DEFINER: runs as the migration owner so it can write profiles, which has no insert policy.
create or replace function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, phone_e164, email, full_name)
    values (
      new.id,
      private.auth_phone_to_e164(new.phone),
      nullif(new.email, ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
    );
  else
    update public.profiles
       set phone_e164 = private.auth_phone_to_e164(new.phone),
           email      = nullif(new.email, '')
     where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.handle_auth_user_change() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_auth_user_change();
create trigger on_auth_user_contact_changed
  after update of phone, email on auth.users
  for each row
  when (old.phone is distinct from new.phone or old.email is distinct from new.email)
  execute function private.handle_auth_user_change();

create type public.admin_role as enum ('super_admin', 'moderator', 'support');

create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  role        public.admin_role not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);
create index platform_admins_created_by on public.platform_admins (created_by);

-- Act 843: record what was agreed, when, and to which version. Append-only.
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('terms', 'privacy', 'marketing_sms', 'marketing_whatsapp', 'marketing_email')),
  granted     boolean not null,
  version     text not null check (char_length(version) between 1 and 40),
  source      text not null check (char_length(source) between 1 and 40),
  created_at  timestamptz not null default now()
);
create index consents_user_kind on public.consents (user_id, kind, created_at desc);

-- Helper for policies. SECURITY DEFINER so it can read platform_admins,
-- which regular users cannot. Pinned search_path.
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- RLS
alter table public.profiles        enable row level security;
alter table public.platform_admins enable row level security;
alter table public.consents        enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Phone/email come from Auth, and deletion from delete_my_account() (Phase 7), so only these columns are editable.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_path, country_code, locale, notify_sms, notify_whatsapp, notify_email)
  on public.profiles to authenticated;

create policy "admins read admin list" on public.platform_admins for select to authenticated
  using ((select private.is_platform_admin()));

create policy "users read own consents" on public.consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users record own consents" on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke update, delete on public.consents from anon, authenticated;
