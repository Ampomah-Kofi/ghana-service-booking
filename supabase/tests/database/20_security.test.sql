-- Phase 11: structural security guarantees that must hold for every table and function added later
-- (docs/security.md). If one of these fails, a new migration forgot a rule.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- SECURITY DEFINER functions run with elevated rights, so each must pin search_path (no hijacking
-- through a user-created schema or object).
select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'every SECURITY DEFINER function pins search_path');

-- Visitors who aren't signed in can call only these read functions (plus the range type constructors).
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
        and p.proname not in ('timerange', 'timemultirange') $$,
  array['get_busy_intervals', 'get_busy_intervals_many', 'match_search_terms', 'search_businesses'],
  'anon can execute only the public read functions');

-- The private schema isn't exposed through the API (config.toml: schemas = public, graphql_public);
-- anon only needs it for RLS. The only elevated (SECURITY DEFINER) functions anon can run there are
-- the RLS helpers, which answer yes/no about the caller.
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.prosecdef and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'execute') $$,
  array['can_manage_business', 'has_business_role', 'is_business_member', 'is_business_owner',
        'is_platform_admin', 'is_published_business'],
  'anon can reach only the RLS helper functions in private');

select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.table_privileges
      where grantee = 'anon' and table_schema = 'public'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') $$,
  'anon has no write privileges on any table');

select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.table_privileges
      where grantee = 'authenticated' and table_schema = 'public'
        and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER') $$,
  'signed-in users cannot truncate or attach triggers');

-- Every public table has RLS switched on (00_rls_coverage checks policies too).
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS is on for every public table');

-- Every foreign key has an index on its referencing column (fast joins, deletes that don't scan).
select is_empty(
  $$ select c.conrelid::regclass::text || '(' || a.attname || ')'
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]) $$,
  'every foreign key is indexed');

-- Review reports are rate limited per person (20 a day).
select is((select count(*)::int from pg_trigger where tgname = 'review_reports_rate_limit' and not tgisinternal), 1,
          'review reports are rate limited');

select * from finish();
rollback;
