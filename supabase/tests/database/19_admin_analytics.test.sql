-- Phase 10: admins find businesses and people through narrow functions; suspensions need the right
-- role and a reason, are audited, and are enforced in the database; provider insights are private
-- to the business's owners and managers.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed: Kwame (…001) owns b1; Ama (…002) owns b2 where Efua (…003) is staff; Kojo (…004) owns b3
-- where Akosua (…005) is manager; Yaw (…006) is a customer; …009 is super_admin. For this test,
-- Demo Owner (…007) is also a moderator and Akosua is support (rolled back at the end).
insert into public.platform_admins (user_id, role) values
  ('a0000000-0000-4000-8000-000000000007', 'moderator'),
  ('a0000000-0000-4000-8000-000000000005', 'support');
update public.businesses set status = 'published', published_at = coalesce(published_at, now())
 where id = 'b0000000-0000-4000-8000-000000000001';
update public.profiles set suspended_at = null, suspension_reason = null;

-- ── Overview and lookups: admins only ─────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.admin_platform_stats() $$, 'BZ403', null, 'a customer cannot see platform stats');
select throws_ok($$ select * from public.admin_list_users() $$, 'BZ403', null, 'nor list people');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.admin_list_businesses() $$, 'BZ403', null, 'a business owner cannot list businesses');
select throws_ok($$ select public.admin_get_user('a0000000-0000-4000-8000-000000000006') $$, 'BZ403', null,
                 'nor look people up');
select pg_temp.act_as(null);
select throws_ok($$ select public.admin_platform_stats() $$, '42501', null, 'anonymous visitors cannot call it at all');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');
select ok((public.admin_platform_stats() ->> 'users')::int >= 8, 'support sees platform stats');
select is((select count(*)::int from public.admin_list_businesses('Kwame')), 1, 'support finds a business by name');
select is((select owner_name from public.admin_list_businesses('kwame-cuts')), 'Kwame Mensah', 'with its owner');
select is((select count(*)::int from public.admin_list_users('024 000 0006')), 0, 'no match for an unknown number');
select is((select full_name from public.admin_list_users('020 000 0006')), 'Yaw Adjei', 'finds a person by phone as typed');
select is((public.admin_get_business('b0000000-0000-4000-8000-000000000001') ->> 'name'), 'Kwame Cuts', 'reads a business');
select is((public.admin_get_user('a0000000-0000-4000-8000-000000000006') ->> 'full_name'), 'Yaw Adjei', 'reads a person');

-- ── Suspending needs super_admin or moderator, and a reason ───────────────
select throws_ok($$ select public.admin_set_business_suspended('b0000000-0000-4000-8000-000000000001', true, 'Spam') $$,
                 'BZ403', null, 'support cannot suspend');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.admin_set_business_suspended('b0000000-0000-4000-8000-000000000001', true, '') $$,
                 'BZ422', null, 'a reason is required');
select is(public.admin_set_business_suspended('b0000000-0000-4000-8000-000000000001', true, 'Fake photos reported'),
          'suspended'::public.business_status, 'a moderator suspends Kwame Cuts');
select throws_ok($$ select public.admin_set_business_suspended('b0000000-0000-4000-8000-000000000001', true, 'Again') $$,
                 'BZ409', null, 'not twice');

select pg_temp.act_as(null);
select is((select count(*)::int from public.businesses where id = 'b0000000-0000-4000-8000-000000000001'), 0,
          'the public no longer sees a suspended business');
select is((select count(*)::int from public.search_businesses('Kwame Cuts')), 0, 'nor finds it in search');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.publish_business('b0000000-0000-4000-8000-000000000001') $$,
                 'BZ403', null, 'the owner cannot re-publish it');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select is(public.admin_set_business_suspended('b0000000-0000-4000-8000-000000000001', false, 'Owner sent real photos'),
          'published'::public.business_status, 'restored straight back to live');
select pg_temp.as_system();
select results_eq($$ select action, admin_user_id::text from public.admin_actions
                     where target_id = 'b0000000-0000-4000-8000-000000000001' and action like 'business.%'
                       and action in ('business.suspend', 'business.restore') order by id $$,
                  $$ values ('business.suspend', 'a0000000-0000-4000-8000-000000000007'),
                            ('business.restore', 'a0000000-0000-4000-8000-000000000007') $$,
                  'both changes are in the audit log, by who');

-- ── Suspending a person ──────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.admin_set_user_suspended('a0000000-0000-4000-8000-000000000007', true, 'Test') $$,
                 'BZ409', null, 'not yourself');
select throws_ok($$ select public.admin_set_user_suspended('a0000000-0000-4000-8000-000000000009', true, 'Test') $$,
                 'BZ409', null, 'not another admin');
select lives_ok($$ select public.admin_set_user_suspended('a0000000-0000-4000-8000-000000000006', true, 'Abusive reviews') $$,
                'a moderator suspends Yaw');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select results_eq($$ select reason from public.my_suspension() $$, $$ values ('Abusive reviews'::text) $$,
                  'Yaw can see why');
select throws_ok($$ update public.profiles set suspended_at = null where id = 'a0000000-0000-4000-8000-000000000006' $$,
                 '42501', null, 'and cannot clear it himself');
select throws_ok(
  $$ select public.book_appointment('b0000000-0000-4000-8000-000000000001',
       (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut'),
       array[(select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001' limit 1)],
       date_trunc('day', now()) + interval '5 days 10 hours', 'Yaw Adjei', '+233200000006') $$,
  'BZ423', null, 'a suspended customer cannot book');
select throws_ok($$ select public.create_business('Yaw Barbers', 'solo', (select id from public.categories where slug = 'barbers'), 'GH') $$,
                 'BZ423', null, 'nor open a business');
select is((select count(*)::int from public.appointments where customer_user_id = 'a0000000-0000-4000-8000-000000000006') >= 0,
          true, 'but can still see their own bookings');

-- A business can still add a phone booking for them (the business is acting, not Yaw).
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.create_manual_appointment('b0000000-0000-4000-8000-000000000001',
       (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut'),
       (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001' limit 1),
       date_trunc('day', now()) + interval '6 days 11 hours', null, 'Yaw Adjei', '+233200000006', null, false, true) $$,
  'a business can still book a suspended person by phone');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');
select lives_ok($$ select public.admin_set_user_suspended('a0000000-0000-4000-8000-000000000006', false, 'Appeal accepted') $$,
                'a super admin restores Yaw');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.my_suspension()), 0, 'Yaw is no longer suspended');

-- ── Insights: owners and managers only, each for their own business ──────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select ok(public.business_insights('b0000000-0000-4000-8000-000000000001', 30) ? 'per_day', 'Kwame sees his insights');
select is(jsonb_array_length(public.business_insights('b0000000-0000-4000-8000-000000000001', 7) -> 'per_day'), 7,
          'one row per day of the period');
select is((public.business_insights('b0000000-0000-4000-8000-000000000001', 45) ->> 'days')::int, 30,
          'odd periods fall back to 30 days');
select throws_ok($$ select public.business_insights('b0000000-0000-4000-8000-000000000002', 30) $$,
                 'BZ404', null, 'Business A cannot read Business B''s insights');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.business_insights('b0000000-0000-4000-8000-000000000002', 30) $$,
                 'BZ404', null, 'staff cannot read their business''s insights');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');
select ok(public.business_insights('b0000000-0000-4000-8000-000000000003', 30) ? 'customers',
          'a manager can read their business''s insights');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.business_insights('b0000000-0000-4000-8000-000000000001', 30) $$,
                 'BZ404', null, 'customers cannot read insights');

-- Numbers add up: a completed visit last week counts and its value is the price.
select pg_temp.as_system();
delete from public.reviews where business_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.notifications where business_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.payments where business_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.appointments where business_id = 'b0000000-0000-4000-8000-000000000001';
insert into public.appointments (business_id, service_id, staff_id, source, status, starts_at, ends_at, occupied,
                                 service_name, price_minor, price_type, currency_code, customer_name)
select 'b0000000-0000-4000-8000-000000000001', sv.id, st.id, 'walk_in', s.status, t, t + interval '30 minutes',
       tstzrange(t, t + interval '30 minutes'), 'Low cut', 5000, 'fixed', 'GHS', 'Walk-in'
  from public.services sv, public.staff st,
       (values ('completed'::public.appointment_status, now() - interval '2 days'),
               ('no_show'::public.appointment_status, now() - interval '3 days'),
               ('cancelled'::public.appointment_status, now() - interval '4 days')) as s(status, t)
 where sv.business_id = 'b0000000-0000-4000-8000-000000000001' and sv.name = 'Low cut'
   and st.business_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is(public.business_insights('b0000000-0000-4000-8000-000000000001', 7) -> 'by_status',
          '{"completed": 1, "no_show": 1, "cancelled": 1}'::jsonb, 'counts each outcome');
select is((public.business_insights('b0000000-0000-4000-8000-000000000001', 7) ->> 'completed_value_minor')::int, 5000,
          'completed value is the price of completed visits');

select * from finish();
rollback;
