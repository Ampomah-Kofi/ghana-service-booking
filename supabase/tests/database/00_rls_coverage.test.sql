-- Meta-tests: guard rails that must hold for EVERY table and function, now and in future migrations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '{}'::text[],
  'every table in public has RLS enabled'
);

-- Tables that intentionally have RLS on and zero policies (service-key only) go in this allowlist.
select is(
  (select coalesce(array_agg(c.relname::text order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
      and c.relname not in (/* allowlist, e.g. 'payment_events' */ '')),
  '{}'::text[],
  'every table in public has at least one policy (or is allowlisted as service-only)'
);

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  '{}'::text[],
  'every SECURITY DEFINER function pins its search_path'
);

select ok(
  not has_function_privilege('authenticated', 'private.handle_auth_user_change()', 'execute')
  and not has_function_privilege('anon', 'private.handle_auth_user_change()', 'execute'),
  'clients cannot call the auth-user trigger function'
);

select ok(
  not has_table_privilege('authenticated', 'public.businesses', 'update')
  and has_column_privilege('authenticated', 'public.businesses', 'name', 'update')
  and not has_column_privilege('authenticated', 'public.businesses', 'status', 'update'),
  'businesses: only content columns are directly updatable'
);

select * from finish();
rollback;
