-- Foundation: extensions, the private helper schema, shared trigger functions.
-- See docs/architecture.md §4 and ADR-0002.

create extension if not exists btree_gist with schema extensions;  -- uuid "=" inside GiST exclusion constraints (ADR-0003)
create extension if not exists pg_trgm    with schema extensions;  -- fuzzy search (ADR-0007)
create extension if not exists unaccent   with schema extensions;  -- accent-insensitive search (ADR-0007)
create extension if not exists postgis    with schema extensions;  -- geography(Point) for areas/cities/locations (ADR-0007)

-- `private` holds RLS helpers and trigger functions. It is NOT in the API's
-- exposed schemas (supabase/config.toml [api].schemas), so none of it is
-- callable over PostgREST. Roles only get USAGE so policies can call helpers.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
