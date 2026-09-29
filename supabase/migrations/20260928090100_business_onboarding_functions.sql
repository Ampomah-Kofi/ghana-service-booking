-- Phase 2: onboarding functions. Multi-table or invariant writes go through
-- SECURITY DEFINER functions that check auth.uid() explicitly (ADR-0002).
-- Error SQLSTATEs (mapped to AppError codes in src/server/businesses):
--   BZ401 not signed in · BZ403 forbidden · BZ404 not found · BZ409 conflict
--   BZ422 invalid / not ready · BZ429 limit reached

-- ---------------------------------------------------------------------------
-- Slugs
-- ---------------------------------------------------------------------------
create or replace function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'about', 'account', 'admin', 'api', 'app', 'auth', 'book', 'booking', 'bookings', 'business', 'businesses',
    'categories', 'category', 'dashboard', 'dev', 'explore', 'favorites', 'help', 'hyia', 'login', 'logout',
    'me', 'new', 'onboarding', 'privacy', 'search', 'settings', 'sign-in', 'sign-out', 'signup', 'static',
    'support', 'terms', 'www'
  ]);
$$;

create or replace function private.slugify(p_text text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  v := lower(extensions.unaccent(coalesce(p_text, '')));
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from v);
  v := trim(both '-' from left(v, 50));
  if char_length(v) < 3 then
    v := 'business' || case when v = '' then '' else '-' || v end;
  end if;
  return v;
end;
$$;

-- First free slug for a base: base, base-2, base-3, …
create or replace function private.next_free_slug(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_candidate text := p_base;
  n int := 1;
begin
  while private.is_reserved_slug(v_candidate)
        or exists (select 1 from public.businesses where slug = v_candidate) loop
    n := n + 1;
    v_candidate := left(p_base, 55) || '-' || n;
  end loop;
  return v_candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_business: business + owner membership + owner staff row + booking
-- rules (+ primary category), all in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.create_business(
  p_name          text,
  p_kind          public.business_kind,
  p_category_id   uuid,
  p_country_code  char(2)
)
returns table (id uuid, slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_name      text := trim(p_name);
  v_country   public.countries;
  v_slug      text;
  v_id        uuid;
  v_staff_nm  text;
  attempt     int := 0;
begin
  if v_uid is null then
    raise exception 'sign in to create a business' using errcode = 'BZ401';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'business name must be 2 to 120 characters' using errcode = 'BZ422';
  end if;
  select * into v_country from public.countries c where c.code = p_country_code and c.is_active;
  if v_country.code is null then
    raise exception 'country not supported' using errcode = 'BZ422';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'unknown category' using errcode = 'BZ422';
  end if;
  if (select count(*) from public.businesses b where b.created_by = v_uid and b.deleted_at is null) >= 5 then
    raise exception 'you can create at most 5 businesses' using errcode = 'BZ429';
  end if;

  -- Concurrent creates can race for the same slug; retry on the unique index.
  loop
    attempt := attempt + 1;
    v_slug := private.next_free_slug(private.slugify(v_name));
    begin
      insert into public.businesses (slug, name, kind, status, country_code, currency_code, timezone, created_by)
      values (v_slug, v_name, p_kind, 'draft', v_country.code, v_country.currency_code, v_country.default_timezone, v_uid)
      returning businesses.id into v_id;
      exit;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;

  insert into public.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.booking_rules (business_id) values (v_id);
  insert into public.business_categories (business_id, category_id, is_primary) values (v_id, p_category_id, true);

  select coalesce(nullif(trim(p.full_name), ''), v_name) into v_staff_nm from public.profiles p where p.id = v_uid;
  insert into public.staff (business_id, user_id, display_name, sort_order)
  values (v_id, v_uid, left(coalesce(v_staff_nm, v_name), 80), 0);

  return query select v_id, v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace the primary category (atomic delete + insert).
-- ---------------------------------------------------------------------------
create or replace function public.set_primary_category(p_business_id uuid, p_category_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception 'unknown category' using errcode = 'BZ422';
  end if;
  delete from public.business_categories where business_id = p_business_id and is_primary;
  insert into public.business_categories (business_id, category_id, is_primary)
  values (p_business_id, p_category_id, true)
  on conflict (business_id, category_id) do update set is_primary = true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Web address. Editable until first publish, then locked (shared links and QR codes).
-- ---------------------------------------------------------------------------
create or replace function public.set_business_slug(p_business_id uuid, p_slug text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_slug text := lower(trim(p_slug));
  v_published_at timestamptz;
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  select b.published_at into v_published_at from public.businesses b where b.id = p_business_id;
  if v_published_at is not null then
    raise exception 'the web address is locked after the first publish' using errcode = 'BZ409';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 60 then
    raise exception 'use 3 to 60 lowercase letters, numbers and single hyphens' using errcode = 'BZ422';
  end if;
  if private.is_reserved_slug(v_slug) then
    raise exception 'that web address is reserved' using errcode = 'BZ409';
  end if;
  begin
    update public.businesses set slug = v_slug where id = p_business_id;
  exception when unique_violation then
    raise exception 'that web address is taken' using errcode = 'BZ409';
  end;
  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing
-- ---------------------------------------------------------------------------
-- What's missing before a business can publish. Empty array = ready.
create or replace function public.business_publish_readiness(p_business_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[] := '{}';
  v_b public.businesses;
begin
  if not private.is_business_member(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  select * into v_b from public.businesses b where b.id = p_business_id;
  if not exists (select 1 from public.business_categories bc where bc.business_id = p_business_id and bc.is_primary) then
    v_missing := array_append(v_missing, 'category');
  end if;
  if not exists (select 1 from public.business_locations l where l.business_id = p_business_id and l.is_primary) then
    v_missing := array_append(v_missing, 'location');
  end if;
  if v_b.phone_e164 is null and v_b.whatsapp_e164 is null then
    v_missing := array_append(v_missing, 'contact');
  end if;
  return v_missing;
end;
$$;

create or replace function public.publish_business(p_business_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status  public.business_status;
  v_missing text[];
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  select b.status into v_status from public.businesses b where b.id = p_business_id and b.deleted_at is null for update;
  if v_status is null then
    raise exception 'business not found' using errcode = 'BZ404';
  end if;
  if v_status = 'published' then
    return;
  end if;
  if v_status <> 'draft' then
    raise exception 'this business is % and cannot be published by its team', v_status using errcode = 'BZ403';
  end if;
  v_missing := public.business_publish_readiness(p_business_id);
  if cardinality(v_missing) > 0 then
    raise exception 'not ready to publish' using errcode = 'BZ422', detail = array_to_string(v_missing, ',');
  end if;
  update public.businesses
     set status = 'published', published_at = coalesce(published_at, now())
   where id = p_business_id;
end;
$$;

create or replace function public.unpublish_business(p_business_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_business(p_business_id) then
    raise exception 'forbidden' using errcode = 'BZ403';
  end if;
  update public.businesses set status = 'draft' where id = p_business_id and status = 'published';
end;
$$;

revoke all on function private.is_reserved_slug(text), private.slugify(text), private.next_free_slug(text) from public;
revoke all on function public.create_business(text, public.business_kind, uuid, char),
                       public.set_primary_category(uuid, uuid),
                       public.set_business_slug(uuid, text),
                       public.business_publish_readiness(uuid),
                       public.publish_business(uuid),
                       public.unpublish_business(uuid)
  from public, anon;
grant execute on function public.create_business(text, public.business_kind, uuid, char),
                          public.set_primary_category(uuid, uuid),
                          public.set_business_slug(uuid, text),
                          public.business_publish_readiness(uuid),
                          public.publish_business(uuid),
                          public.unpublish_business(uuid)
  to authenticated;
