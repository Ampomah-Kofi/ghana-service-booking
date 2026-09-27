-- Phase 6: providers manage appointments. Walk-ins and phone bookings, status changes,
-- moves and reassignments, clients. Who may do what, and the no-overlap rule still holds.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

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
select
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001' and display_name = 'Kwame') as kwame,
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000002' and display_name = 'Ama') as ama,
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000002' and display_name = 'Efua') as efua,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut') as low_cut,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000002' and name = 'Twists') as twists,
  (current_date + (8 - extract(isodow from current_date)::int) + 7) as mon;
-- Deterministic on any local database: demo data (pnpm db:demo) or E2E leftovers are removed
-- inside this transaction, which is rolled back at the end.
delete from public.appointments;
create temp table t (key text primary key, id uuid);
grant select on ids to anon, authenticated;
grant all on t to anon, authenticated;

create function pg_temp.at(p_day int, p_time text) returns timestamptz language sql stable as $$
  select ((select mon from ids) + p_day + p_time::time) at time zone 'Africa/Accra'
$$;

-- Kwame's phone booking helper: (time, client name, phone, walk-in, allow outside hours, start override)
create function pg_temp.kwame_add(p_time text, p_name text, p_phone text default null,
                                  p_walk_in boolean default false, p_allow boolean default false,
                                  p_starts timestamptz default null) returns uuid language sql as $$
  select public.create_manual_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids), (select kwame from ids),
                                          coalesce(p_starts, pg_temp.at(0, p_time)), null, p_name, p_phone, null, p_walk_in, p_allow)
$$;

-- ── Who may add appointments ────────────────────────────────────────────────
select pg_temp.act_as(null);
select throws_ok($$ select pg_temp.kwame_add('10:00', 'Kofi') $$, '42501', null, 'anonymous visitors cannot add appointments');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw, a customer
select throws_ok($$ select pg_temp.kwame_add('10:00', 'Kofi') $$, 'BZ403', null, 'customers cannot add appointments to a business');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');  -- Ama, another business's owner
select throws_ok($$ select pg_temp.kwame_add('10:00', 'Kofi') $$, 'BZ403', null, 'business B cannot add appointments to business A');

-- ── Phone bookings ──────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select lives_ok($$ insert into t select 'phone_10', pg_temp.kwame_add('10:00', 'Kofi Boadu', '+233244000001') $$,
  'the owner adds a phone booking with a new client');
select results_eq(
  $$ select status::text, source::text, customer_name, customer_phone_e164, created_by
     from public.appointments where id = (select id from t where key = 'phone_10') $$,
  $$ values ('confirmed', 'manual', 'Kofi Boadu', '+233244000001', 'a0000000-0000-4000-8000-000000000001'::uuid) $$,
  'phone bookings are confirmed and snapshot the client');
select lives_ok($$ insert into t select 'phone_11', pg_temp.kwame_add('11:00', 'Kofi B.', '+233244000001') $$,
  'a second booking for the same phone number');
select is((select count(*)::int from public.business_clients
           where business_id = 'b0000000-0000-4000-8000-000000000001' and phone_e164 = '+233244000001'), 1,
  'the same phone number reuses the client record');
select throws_ok($$ select pg_temp.kwame_add('10:15', 'Esi') $$, 'BZ409', null, 'overlaps are still refused');
select throws_ok($$ select pg_temp.kwame_add('21:00', 'Late Esi') $$, 'BZ409', null, 'outside hours needs an explicit override');
select lives_ok($$ select pg_temp.kwame_add('21:00', 'Late Esi', null, false, true) $$,
  'the provider may book outside hours on purpose');
select throws_ok($$ select pg_temp.kwame_add('12:00', '  ') $$, 'BZ422', null, 'a client name is required');
select throws_ok($$ select pg_temp.kwame_add('12:00', 'Bad phone', '0241234') $$, 'BZ422', null, 'phones must be E.164');

-- ── Walk-ins ────────────────────────────────────────────────────────────────
select lives_ok($$ insert into t select 'walk_in', pg_temp.kwame_add(null, 'Walk-in Yaw', null, true, true,
                                                                     now() - interval '40 minutes') $$,
  'a walk-in is recorded as it happens');
select results_eq(
  $$ select a.status::text, a.source::text, h.reason from public.appointments a
     join public.appointment_status_history h on h.appointment_id = a.id
     where a.id = (select id from t where key = 'walk_in') $$,
  $$ values ('arrived', 'walk_in', 'Walk-in') $$,
  'walk-ins start as arrived, and history says so');

select lives_ok($$ insert into t select 'anon_walk_in', pg_temp.kwame_add(null, null, null, true, true, now() + interval '2 hours') $$,
  'an anonymous walk-in needs no name');
select results_eq($$ select customer_name, client_id from public.appointments where id = (select id from t where key = 'anon_walk_in') $$,
  $$ values ('Walk-in', null::uuid) $$, '...and creates no client record');

-- ── Staff: only their own column ────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua, staff at Ama Braids
select lives_ok($$ insert into t select 'efua_own', public.create_manual_appointment('b0000000-0000-4000-8000-000000000002',
                     (select twists from ids), (select efua from ids), pg_temp.at(1, '10:00'), null, 'Adjoa') $$,
  'staff add bookings for themselves');
select throws_ok($$ select public.create_manual_appointment('b0000000-0000-4000-8000-000000000002',
                     (select twists from ids), (select ama from ids), pg_temp.at(1, '10:00'), null, 'Adjoa') $$,
  'BZ403', null, 'staff cannot add bookings for colleagues');
select isnt_empty($$ select id from public.appointment_status_history where appointment_id = (select id from t where key = 'efua_own') $$,
  'staff can read the history of their own appointments');
select throws_ok($$ select public.set_appointment_status((select id from t where key = 'phone_10'), 'cancelled') $$,
  'BZ404', null, 'staff cannot touch another business''s appointments');
select is_empty($$ select id from public.business_client_summaries $$, 'staff do not see the client list');

-- ── Status changes ──────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.set_appointment_status((select id from t where key = 'phone_10'), 'completed') $$,
  'BZ409', null, 'a future appointment cannot be completed');
select throws_ok($$ select public.set_appointment_status((select id from t where key = 'phone_10'), 'arrived') $$,
  'BZ409', null, 'arrived only from an hour before');
select throws_ok($$ select public.set_appointment_status((select id from t where key = 'phone_10'), 'confirmed', null, 5000) $$,
  'BZ422', null, 'a final price only comes with completing');
select lives_ok($$ select public.set_appointment_status((select id from t where key = 'phone_11'), 'cancelled', 'Client called to cancel') $$,
  'the owner cancels with a reason');
select results_eq(
  $$ select a.cancellation_reason, h.from_status::text, h.to_status::text, h.reason
     from public.appointments a join public.appointment_status_history h on h.appointment_id = a.id
     where a.id = (select id from t where key = 'phone_11') and h.to_status = 'cancelled' $$,
  $$ values ('Client called to cancel', 'confirmed', 'cancelled', 'Client called to cancel') $$,
  'cancellation is recorded with its reason');
select throws_ok($$ select public.set_appointment_status((select id from t where key = 'phone_11'), 'confirmed') $$,
  'BZ409', null, 'cancelled is final');
select lives_ok($$ select public.set_appointment_status((select id from t where key = 'walk_in'), 'completed', null, 6000) $$,
  'a walk-in is completed with the price paid');
select is((select final_price_minor from public.appointments where id = (select id from t where key = 'walk_in')), 6000,
  'the final price is stored');
select ok((select ends_at <= now() from public.appointments where id = (select id from t where key = 'walk_in')),
  'completing early records the real end, freeing the rest of the slot');
select lives_ok($$ select public.set_appointment_status((select id from t where key = 'walk_in'), 'arrived') $$,
  'completing can be undone for a week');
select is((select final_price_minor from public.appointments where id = (select id from t where key = 'walk_in')), null::int,
  '...and undoing clears the final price');
select lives_ok($$ insert into t select 'missed', pg_temp.kwame_add(null, 'Missed Ama', null, false, true, now() - interval '3 hours') $$,
  'a past phone booking');
select lives_ok($$ select public.set_appointment_status((select id from t where key = 'missed'), 'no_show') $$, 'marked as a no-show');
select lives_ok($$ select public.set_appointment_status((select id from t where key = 'missed'), 'confirmed') $$, 'a mistaken no-show can be undone');

-- ── Moving and reassigning ──────────────────────────────────────────────────
select lives_ok($$ select public.move_appointment((select id from t where key = 'phone_10'), (select kwame from ids), pg_temp.at(0, '14:00')) $$,
  'the owner moves a booking');
select results_eq(
  $$ select a.starts_at = pg_temp.at(0, '14:00'), h.reason like 'Moved from %'
     from public.appointments a join public.appointment_status_history h on h.appointment_id = a.id and h.from_status = h.to_status
     where a.id = (select id from t where key = 'phone_10') $$,
  $$ values (true, true) $$,
  'the move is applied and recorded in history');
select throws_ok($$ select public.move_appointment((select id from t where key = 'phone_10'), (select kwame from ids), pg_temp.at(0, '20:45'), true) $$,
  'BZ409', null, 'moves cannot overlap another booking (the 9 pm one)');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.move_appointment((select id from t where key = 'efua_own'), (select efua from ids), pg_temp.at(1, '11:00')) $$,
  'BZ404', null, 'staff cannot move bookings (managers only)');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select lives_ok($$ select public.move_appointment((select id from t where key = 'efua_own'), (select ama from ids), pg_temp.at(1, '10:00')) $$,
  'the owner reassigns a booking to another team member');

-- ── Clients ─────────────────────────────────────────────────────────────────
select throws_ok($$ select public.save_business_client('b0000000-0000-4000-8000-000000000001', null, 'Spy', null, null) $$,
  'BZ403', null, 'business B cannot add clients to business A');
select is_empty($$ select id from public.business_client_summaries where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'business B cannot see business A''s client list');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.save_business_client('b0000000-0000-4000-8000-000000000001', null, 'Kofi Again', '+233244000001', null) $$,
  'BZ409', null, 'two clients cannot share a phone number');
select results_eq(
  $$ select no_shows, upcoming from public.business_client_summaries
     where business_id = 'b0000000-0000-4000-8000-000000000001' and full_name = 'Missed Ama' $$,
  $$ values (0, 0) $$,
  'the client list counts visits, no-shows and upcoming bookings');

select * from finish();
rollback;
