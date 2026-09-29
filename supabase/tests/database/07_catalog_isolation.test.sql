-- Tenant isolation for Phase 3 tables: services, staff_services, business_hours,
-- staff_working_hours, blocked_times, staff_invites, admin_actions.
-- Fixtures: seed.sql (Kwame a…01 owns b…01; Ama a…02 owns b…02 + Efua a…03 staff; Kojo a…04 owns draft b…03 + Akosua a…05 manager; Yaw a…06; admin a…09).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

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
       (select id from public.staff where display_name = 'Efua') as efua_staff;
grant select on ids to anon, authenticated;

reset role;
insert into public.services (business_id, name, price_minor, currency_code, duration_minutes, is_active)
values ('b0000000-0000-4000-8000-000000000001', 'Hidden service', 1000, 'GHS', 15, false);
insert into public.blocked_times (business_id, staff_id, during, reason)
values ('b0000000-0000-4000-8000-000000000002', (select efua_staff from ids), tstzrange(now() + interval '1 day', now() + interval '2 days'), 'Private reason');
insert into public.staff_invites (business_id, staff_id, phone_e164, token_hash)
values ('b0000000-0000-4000-8000-000000000002', (select efua_staff from ids), '+233249990009', 'hash-for-test');

-- ---------------------------------------------------------------- public reads
select pg_temp.act_as(null);
select is((select count(*) from public.services where business_id = 'b0000000-0000-4000-8000-000000000003'), 0::bigint,
  'anon cannot see services of a draft business');
select is((select count(*) from public.services where name = 'Hidden service'), 0::bigint, 'anon cannot see inactive services');
select ok((select count(*) from public.services where business_id = 'b0000000-0000-4000-8000-000000000001') = 3, 'anon sees the 3 active services of a published business');
select ok((select count(*) from public.business_hours where business_id = 'b0000000-0000-4000-8000-000000000002') > 0, 'anon reads opening hours of published businesses');
select is((select count(*) from public.business_hours where business_id = 'b0000000-0000-4000-8000-000000000003'), 0::bigint, 'anon cannot read hours of a draft business');
select is_empty($$ select id from public.blocked_times $$, 'anon cannot read blocked times (reasons are private)');
select is_empty($$ select id from public.staff_invites $$, 'anon cannot read invites');

-- ---------------------------------------------------------------- cross-tenant
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select is_empty($$ select id from public.blocked_times $$, 'owner A cannot read B''s blocked times');
select is_empty($$ select id from public.staff_invites $$, 'owner A cannot read B''s invites');
select is_empty($$ update public.services set price_minor = 1 where id = (select ama_service from ids) returning id $$,
  'owner A cannot change B''s prices');
select throws_ok($$ insert into public.services (business_id, name, price_minor, currency_code, duration_minutes)
                    values ('b0000000-0000-4000-8000-000000000002', 'Spy', 1, 'GHS', 15) $$,
  '42501', null, 'owner A cannot add services to B');
select throws_ok($$ insert into public.staff_services (business_id, staff_id, service_id)
                    values ('b0000000-0000-4000-8000-000000000001', (select kwame_staff from ids), (select kwame_service from ids)) $$,
  '42501', null, 'staff/service links are never written directly');
select throws_ok($$ insert into public.business_hours (business_id, weekday, during)
                    values ('b0000000-0000-4000-8000-000000000001', 7, '[09:00,10:00)') $$,
  '42501', null, 'hours are never written directly');
select throws_ok($$ insert into public.blocked_times (business_id, during)
                    values ('b0000000-0000-4000-8000-000000000001', tstzrange(now(), now() + interval '1 hour')) $$,
  '42501', null, 'blocked times are never inserted directly (create_blocked_time takes the lock)');
select is_empty($$ delete from public.blocked_times returning id $$, 'owner A cannot delete B''s blocked times');
select throws_ok($$ update public.services set business_id = 'b0000000-0000-4000-8000-000000000002' where id = (select kwame_service from ids) $$,
  '42501', null, 'a service cannot be moved to another business');

-- ---------------------------------------------------------------- own tenant
select isnt_empty($$ update public.services set price_minor = 5500 where id = (select kwame_service from ids) returning id $$,
  'owner updates own prices');
select isnt_empty($$ select id from public.services where name = 'Hidden service' $$, 'members see their inactive services');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua (staff at Ama's)
select isnt_empty($$ select id from public.blocked_times $$, 'staff read their business''s blocked times');
select is_empty($$ select id from public.staff_invites $$, 'staff cannot read invites');
select is_empty($$ update public.services set price_minor = 1 where id = (select ama_service from ids) returning id $$,
  'staff cannot change prices');
select isnt_empty($$ delete from public.blocked_times where staff_id = (select efua_staff from ids) returning id $$,
  'staff can delete their own time off');

-- ---------------------------------------------------------------- admin audit log
select is_empty($$ select id from public.admin_actions $$, 'non-admins cannot read the audit log');
select throws_ok($$ insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason)
                    values ('a0000000-0000-4000-8000-000000000003', 'fake.action', 'x', 'y', 'forged') $$,
  '42501', null, 'nobody writes the audit log directly');

select * from finish();
rollback;
