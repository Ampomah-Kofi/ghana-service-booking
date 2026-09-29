-- Admin category management: super admins only, every change audit-logged.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

create temp table t (key text primary key, id uuid);
grant all on t to anon, authenticated;

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame, not an admin
select throws_ok($$ select public.admin_save_category(null, 'Pet grooming', 'pet-grooming', null, '{}', 180, true, 'new category') $$,
  'BZ403', null, 'business owners cannot manage categories');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');  -- super admin
select throws_ok($$ select public.admin_save_category(null, 'Pet grooming', 'pet-grooming', null, '{}', 180, true, '') $$,
  'BZ422', null, 'a reason is required');
insert into t select 'pets', public.admin_save_category(null, 'Pet grooming', 'pet-grooming', 'Dogs and cats', '{dog,cat,groomer}', 180, false, 'Requested by providers');
select results_eq($$ select action, reason, before is null, (after ->> 'slug') from public.admin_actions where target_id = (select id::text from t where key = 'pets') $$,
  $$ values ('category.create', 'Requested by providers', true, 'pet-grooming') $$, 'creation is audit-logged');
select isnt_empty($$ select id from public.categories where slug = 'pet-grooming' $$, 'admins see inactive categories');

select lives_ok($$ select public.admin_save_category((select id from t where key = 'pets'), 'Pet grooming', 'pet-grooming', 'Dogs and cats', '{dog,cat}', 180, true, 'Launching it') $$,
  'admin activates the category');
select results_eq($$ select (before ->> 'is_active')::boolean, (after ->> 'is_active')::boolean from public.admin_actions
                     where target_id = (select id::text from t where key = 'pets') and action = 'category.update' $$,
  $$ values (false, true) $$, 'updates record before and after');
select throws_ok($$ select public.admin_save_category(null, 'Barbers again', 'barbers', null, '{}', 1, true, 'dupe') $$,
  'BZ409', null, 'duplicate slugs are rejected');

reset role;
insert into public.platform_admins (user_id, role) values ('a0000000-0000-4000-8000-000000000006', 'moderator');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.admin_save_category(null, 'X category', 'x-category', null, '{}', 1, true, 'moderators try') $$,
  'BZ403', null, 'moderators cannot manage categories');
select pg_temp.act_as(null);
select is_empty($$ select id from public.categories where slug = 'pet-grooming' and not is_active $$, 'anon never sees inactive categories');

select * from finish();
rollback;
