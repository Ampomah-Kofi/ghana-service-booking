-- Phase 3 functions: hours, staff hours, service ↔ staff links, blocked times,
-- staff removal, invites, admin categories.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

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

create temp table ids as
select (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut') as kwame_service,
       (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000002' and name = 'Twists') as ama_service,
       (select id from public.staff where display_name = 'Kwame') as kwame_staff,
       (select id from public.staff where display_name = 'Ama') as ama_staff,
       (select id from public.staff where display_name = 'Efua') as efua_staff,
       (select id from public.staff where display_name = 'Abena') as abena_staff;
grant select on ids to anon, authenticated;
-- Deterministic on any local database: demo/E2E appointments are removed in this rolled-back transaction.
delete from public.payment_events;
delete from public.payments;
delete from public.appointments;
create temp table t (key text primary key, val text);
grant all on t to anon, authenticated;

-- ---------------------------------------------------------------- business hours
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select lives_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001',
  '[{"weekday":1,"opens":"08:00","closes":"12:00"},{"weekday":1,"opens":"13:00","closes":"20:00"},{"weekday":7,"opens":"14:00","closes":"24:00"}]') $$,
  'owner sets a week with a lunch break and a late Sunday');
select results_eq($$ select weekday, lower(during)::text, upper(during)::text from public.business_hours
                     where business_id = 'b0000000-0000-4000-8000-000000000001' order by weekday, lower(during) $$,
  $$ values (1::smallint, '08:00:00', '12:00:00'), (1::smallint, '13:00:00', '20:00:00'), (7::smallint, '14:00:00', '24:00:00') $$,
  'the whole week is replaced atomically');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001',
  '[{"weekday":2,"opens":"09:00","closes":"13:00"},{"weekday":2,"opens":"12:00","closes":"18:00"}]') $$,
  'BZ422', null, 'overlapping ranges on one day are rejected');
select is((select count(*) from public.business_hours where business_id = 'b0000000-0000-4000-8000-000000000001'), 3::bigint,
  'a rejected update leaves the previous hours untouched');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001', '[{"weekday":2,"opens":"18:00","closes":"09:00"}]') $$,
  'BZ422', null, 'closing must be after opening');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001', '[{"weekday":8,"opens":"09:00","closes":"10:00"}]') $$,
  'BZ422', null, 'weekday must be 1–7');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001', '[{"weekday":2,"opens":"09:07","closes":"10:00"}]') $$,
  'BZ422', null, 'times use 5-minute steps');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001', '[{"weekday":2,"opens":"nine","closes":"10:00"}]') $$,
  'BZ422', null, 'garbage times are rejected cleanly');
select throws_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000002', '[]') $$,
  'BZ403', null, 'owner A cannot change B''s hours');
select lives_ok($$ select public.set_business_hours('b0000000-0000-4000-8000-000000000001', '[]') $$, 'closing every day is allowed');
select is(public.business_publish_readiness('b0000000-0000-4000-8000-000000000001'), array['hours'], 'no hours makes the business not ready');

-- ---------------------------------------------------------------- staff hours
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');  -- Ama
select lives_ok($$ select public.set_staff_hours((select efua_staff from ids), false, '[{"weekday":3,"opens":"10:00","closes":"14:00"}]') $$,
  'owner sets a staff member''s own hours');
select results_eq($$ select uses_business_hours from public.staff where id = (select efua_staff from ids) $$, $$ values (false) $$,
  'staff member switched to their own hours');
select throws_ok($$ select public.set_staff_hours((select efua_staff from ids), false, '[]') $$,
  'BZ422', null, 'own hours need at least one period');
select lives_ok($$ select public.set_staff_hours((select efua_staff from ids), true, null) $$, 'back to business hours');
select is((select count(*) from public.staff_working_hours where staff_id = (select efua_staff from ids)), 0::bigint,
  'switching back clears personal hours');
select throws_ok($$ select public.set_staff_hours((select kwame_staff from ids), true, null) $$, 'BZ403', null, 'cannot edit another business''s staff hours');

-- ---------------------------------------------------------------- service ↔ staff
select throws_ok($$ select public.set_service_staff((select ama_service from ids), array[(select kwame_staff from ids)]) $$,
  'BZ422', null, 'a service cannot be given to staff from another business');
select lives_ok($$ select public.set_service_staff((select ama_service from ids), array[(select efua_staff from ids)]) $$, 'assign own staff');
select results_eq($$ select staff_id from public.staff_services where service_id = (select ama_service from ids) $$,
  $$ select efua_staff from ids $$, 'assignment replaced atomically');
select throws_ok($$ select public.set_staff_services((select efua_staff from ids), array[(select kwame_service from ids)]) $$,
  'BZ422', null, 'a staff member cannot be given another business''s service');

-- ---------------------------------------------------------------- blocked times (Accra = UTC+0; tested with a DST zone too)
select lives_ok($$ insert into t values ('block1', public.create_blocked_time('b0000000-0000-4000-8000-000000000002', (select efua_staff from ids),
                   (current_date + 3 + time '09:00')::timestamp, (current_date + 3 + time '12:00')::timestamp, 'Clinic')::text) $$,
  'owner blocks a staff member''s morning');
select is((select during from public.blocked_times where id = (select val::uuid from t where key = 'block1')),
          tstzrange(((current_date + 3 + time '09:00') at time zone 'Africa/Accra'), ((current_date + 3 + time '12:00') at time zone 'Africa/Accra'), '[)'),
  'local times are converted with the business timezone');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', null,
                    (current_date + 3 + time '12:00')::timestamp, (current_date + 3 + time '09:00')::timestamp, null) $$,
  'BZ422', null, 'end must be after start');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', null,
                    (current_date - 3)::timestamp, (current_date - 2)::timestamp, null) $$,
  'BZ422', null, 'blocks entirely in the past are rejected');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', (select kwame_staff from ids),
                    (current_date + 3)::timestamp, (current_date + 4)::timestamp, null) $$,
  'BZ422', null, 'cannot block another business''s staff');

reset role;
update public.businesses set timezone = 'Europe/London' where id = 'b0000000-0000-4000-8000-000000000002';
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
insert into t values ('dst', public.create_blocked_time('b0000000-0000-4000-8000-000000000002', null,
                      timestamp '2027-03-28 00:00', timestamp '2027-03-29 00:00', 'DST day')::text);
select is((select upper(during) - lower(during) from public.blocked_times where id = (select val::uuid from t where key = 'dst')),
          interval '23 hours', 'a whole local day on a DST change is 23 real hours (timezone-aware, not Ghana-only)');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua (staff)
select lives_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', (select efua_staff from ids),
                   (current_date + 5)::timestamp, (current_date + 6)::timestamp, 'Day off') $$, 'staff can block their own time');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', (select ama_staff from ids),
                    (current_date + 5)::timestamp, (current_date + 6)::timestamp, 'Not mine') $$,
  'BZ403', null, 'staff cannot block someone else''s time');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000002', null,
                    (current_date + 5)::timestamp, (current_date + 6)::timestamp, 'Holiday') $$,
  'BZ403', null, 'staff cannot close the whole business');

-- ---------------------------------------------------------------- invites
reset role;
insert into auth.users (id, phone) values ('c0000000-0000-4000-8000-000000000031', '233249990031'), ('c0000000-0000-4000-8000-000000000032', '233249990032');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');  -- Kojo, owner of osu (Abena has no login)
insert into t values ('token', public.invite_staff((select abena_staff from ids), '+233249990031', 'staff'));
select is(char_length((select val from t where key = 'token')), 64, 'invite returns a long random token');
select isnt((select token_hash from public.staff_invites where staff_id = (select abena_staff from ids)), (select val from t where key = 'token'),
  'only a hash of the token is stored');

select pg_temp.act_as('c0000000-0000-4000-8000-000000000032');  -- someone else who got the link
select results_eq($$ select status from public.get_staff_invite((select val from t where key = 'token')) $$, $$ values ('wrong_phone') $$,
  'the preview tells a different phone it cannot accept');
select throws_ok($$ select public.accept_staff_invite((select val from t where key = 'token')) $$, 'BZ403', null,
  'a forwarded link cannot be accepted by another phone number');

select pg_temp.act_as('c0000000-0000-4000-8000-000000000031');  -- Abena
select lives_ok($$ select public.accept_staff_invite((select val from t where key = 'token')) $$, 'the invited phone accepts');
select results_eq($$ select role::text from public.business_members where user_id = 'c0000000-0000-4000-8000-000000000031' $$,
  $$ values ('staff') $$, 'accepting grants staff membership');
select throws_ok($$ select public.accept_staff_invite((select val from t where key = 'token')) $$, 'BZ409', null, 'an invite works once');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');  -- Akosua (manager)
select throws_ok($$ select public.invite_staff((select kojo from (select id as kojo from public.staff where display_name = 'Kojo') k), '+233249990033', 'manager') $$,
  'BZ403', null, 'only the owner can invite managers');

-- ---------------------------------------------------------------- remove staff
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');  -- Kojo
select lives_ok($$ select public.remove_staff_member((select abena_staff from ids)) $$, 'owner removes a team member');
select is_empty($$ select 1 from public.business_members where user_id = 'c0000000-0000-4000-8000-000000000031' $$,
  'a removed team member loses access');

select * from finish();
rollback;
