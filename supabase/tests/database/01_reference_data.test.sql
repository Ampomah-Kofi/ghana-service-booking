begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

insert into public.categories (name, slug, is_active) values ('Hidden test category', 'hidden-test-category', false);

select pg_temp.act_as(null);
select is((select count(*) from public.currencies where code = 'GHS'), 1::bigint, 'anon reads currencies');
select is((select count(*) from public.regions where country_code = 'GH'), 16::bigint, 'anon reads all 16 Ghana regions');
select ok((select count(*) from public.categories) >= 17, 'anon reads active categories');
select is((select count(*) from public.categories where slug = 'hidden-test-category'), 0::bigint, 'inactive categories are hidden');
select throws_ok(
  $$ insert into public.categories (name, slug) values ('Injected', 'injected') $$,
  '42501', null, 'anon cannot insert categories'
);

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is_empty(
  $$ update public.currencies set symbol = 'X' where code = 'GHS' returning code $$,
  'authenticated users cannot update reference data'
);
select pg_temp.act_as(null);
select is((select symbol from public.currencies where code = 'GHS'), 'GH₵', 'currency symbol unchanged');

select * from finish();
rollback;
