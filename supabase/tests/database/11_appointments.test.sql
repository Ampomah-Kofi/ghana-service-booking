-- Phase 5: appointments. Double booking is impossible (ADR-0003), tenants are isolated,
-- and every rule the booking screens show is also enforced here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

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

-- Seed people: Kwame (a…01) owns kwame-cuts; Ama (a…02) owns ama-braids where Efua (a…03) works;
-- Kojo (a…04) owns the draft osu-glow-spa; Yaw (a…06) is a customer.
create temp table ids as
select
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001' and display_name = 'Kwame') as kwame,
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000002' and display_name = 'Ama') as ama,
  (select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000002' and display_name = 'Efua') as efua,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut') as low_cut,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000002' and name = 'Twists') as twists,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000002' and name = 'Loc retwist') as retwist,
  (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000003' and name = 'Facial') as facial,
  -- Next week's Monday (1–7 days away): inside the default 60-day window and the 2-hour
  -- cancellation window, and its Tuesday (≤ 8 days = 192 h) is inside a 336-hour window on any weekday.
  (current_date + (8 - extract(isodow from current_date)::int)) as mon;
-- Deterministic on any local database: demo data (pnpm db:demo) or E2E leftovers are removed
-- inside this transaction, which is rolled back at the end.
delete from public.payments;
delete from public.appointments;
create temp table t (key text primary key, id uuid);
grant select on ids to anon, authenticated;
grant all on t to anon, authenticated;

-- Local wall-clock time at the businesses (Africa/Accra) → instant. Day 0 = Monday, 1 = Tuesday.
create function pg_temp.at(p_day int, p_time text) returns timestamptz language sql stable as $$
  select ((select mon from ids) + p_day + p_time::time) at time zone 'Africa/Accra'
$$;

create function pg_temp.book_kwame(p_time text, p_day int default 0) returns uuid language sql as $$
  select public.book_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids),
                                 array[(select kwame from ids)], pg_temp.at(p_day, p_time), 'Test customer')
$$;

create function pg_temp.book_twists(p_time text, p_staff uuid[]) returns uuid language sql as $$
  select public.book_appointment('b0000000-0000-4000-8000-000000000002', (select twists from ids),
                                 p_staff, pg_temp.at(1, p_time), 'Test customer')
$$;

-- ── Who may book ────────────────────────────────────────────────────────────
select pg_temp.act_as(null);
select throws_ok($$ select pg_temp.book_kwame('10:00') $$, '42501', null, 'anonymous visitors cannot book (sign in first)');

-- ── A booking ───────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw
select lives_ok($$ insert into t select 'yaw_10', public.book_appointment('b0000000-0000-4000-8000-000000000001',
                     (select low_cut from ids), array[(select kwame from ids)], pg_temp.at(0, '10:00'), 'Yaw Adjei',
                     null, 'Short on top please', 'idem-key-0001') $$,
  'a customer books a low cut with Kwame');
select results_eq(
  $$ select status::text, source::text, payment_status::text, occupied = tstzrange(pg_temp.at(0, '10:00'), pg_temp.at(0, '10:30')),
            customer_phone_e164, service_name, price_minor
     from public.appointments where id = (select id from t where key = 'yaw_10') $$,
  $$ values ('confirmed', 'online', null::text, true, '+233200000006', 'Low cut', 5000) $$,
  'auto-confirmed, with a snapshot of the service and the phone from the profile');
select results_eq(
  $$ select from_status::text, to_status::text, changed_by from public.appointment_status_history
     where appointment_id = (select id from t where key = 'yaw_10') $$,
  $$ values (null::text, 'confirmed', 'a0000000-0000-4000-8000-000000000006'::uuid) $$,
  'the new status is recorded in history');
select is(public.book_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids),
            array[(select kwame from ids)], pg_temp.at(0, '10:00'), 'Yaw Adjei', null, null, 'idem-key-0001'),
          (select id from t where key = 'yaw_10'),
  'a retried request with the same idempotency key returns the same booking');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');  -- Kojo, as a customer elsewhere
select throws_ok($$ select pg_temp.book_kwame('10:15') $$, 'BZ409', null, 'an overlapping time is refused');
select lives_ok($$ insert into t select 'kojo_1030', pg_temp.book_kwame('10:30') $$, 'a time touching the previous booking is fine');
select throws_ok($$ select pg_temp.book_kwame('19:45') $$, 'BZ409', null, 'a service running past closing is refused');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids),
                     array[(select kwame from ids)], now() + interval '30 minutes', 'Kojo') $$,
  'BZ422', null, 'minimum notice is enforced');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids),
                     array[(select kwame from ids)], now() + interval '61 days', 'Kojo') $$,
  'BZ422', null, 'the maximum advance window is enforced');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000001', (select twists from ids),
                     array[(select kwame from ids)], pg_temp.at(0, '11:00'), 'Kojo') $$,
  'BZ422', null, 'another business''s service cannot be booked here');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000003', (select facial from ids),
                     array[(select kwame from ids)], pg_temp.at(0, '11:00'), 'Kojo') $$,
  'BZ422', null, 'unpublished businesses cannot be booked');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000001', (select low_cut from ids),
                     array[(select kwame from ids)], pg_temp.at(0, '11:00'), '   ') $$,
  'BZ422', null, 'a name is required');

-- ── Teams: eligibility and "any available" fallback (Tuesday) ─────────────
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000002', (select retwist from ids),
                     array[(select efua from ids)], pg_temp.at(1, '10:00'), 'Kojo') $$,
  'BZ409', null, 'staff who don''t do a service cannot be booked for it');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
insert into t select 'yaw_twists', pg_temp.book_twists('10:00', array[(select ama from ids), (select efua from ids)]);
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');
insert into t select 'kojo_twists', pg_temp.book_twists('10:00', array[(select ama from ids), (select efua from ids)]);
reset role;
select results_eq(
  $$ select s.display_name from public.appointments a join public.staff s on s.id = a.staff_id
     where a.id in (select id from t where key in ('yaw_twists', 'kojo_twists')) order by a.created_at, s.display_name $$,
  $$ values ('Ama'), ('Efua') $$,
  'the second customer falls through to the next free person');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua, as a customer
select throws_ok($$ select pg_temp.book_twists('10:00', array[(select ama from ids), (select efua from ids)]) $$,
  'BZ409', null, 'when everyone is taken, the booking is refused');

-- ── Time off ────────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select lives_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000001', (select kwame from ids),
                     (select mon from ids) + '15:00'::time, (select mon from ids) + '16:00'::time, 'Dentist') $$,
  'Kwame blocks 15:00-16:00');
select throws_ok($$ select public.create_blocked_time('b0000000-0000-4000-8000-000000000001', (select kwame from ids),
                     (select mon from ids) + '10:00'::time, (select mon from ids) + '11:00'::time, 'Errand') $$,
  'BZ409', null, 'time off cannot cover existing bookings');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select pg_temp.book_kwame('15:00') $$, 'BZ409', null, 'blocked time cannot be booked');

-- ── Buffers ─────────────────────────────────────────────────────────────────
reset role;
update public.booking_rules set buffer_after_minutes = 15 where business_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');
insert into t select 'kojo_16', pg_temp.book_kwame('16:00');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select pg_temp.book_kwame('16:30') $$, 'BZ409', null, 'the clean-up buffer after a booking is protected');
select lives_ok($$ insert into t select 'efua_1645', pg_temp.book_kwame('16:45') $$, 'the next booking may start when the buffer ends');
reset role;
update public.booking_rules set buffer_after_minutes = 0 where business_id = 'b0000000-0000-4000-8000-000000000001';

-- ── Isolation (RLS) ─────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.appointments), 2, 'a customer sees only their own bookings');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');
select is_empty($$ select id from public.appointments where id = (select id from t where key = 'yaw_10') $$,
  'another customer cannot read the booking');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');  -- Ama, owner of another business
select is_empty($$ select id from public.appointments where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'business B cannot read business A''s bookings');
select is_empty($$ select id from public.business_clients where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'business B cannot read business A''s clients');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.appointments where business_id = 'b0000000-0000-4000-8000-000000000001'), 4,
  'the owner sees every booking of their business');
select isnt_empty($$ select id from public.business_clients where user_id = 'a0000000-0000-4000-8000-000000000006' $$,
  'the owner sees the customer in their client list');
select is_empty($$ update public.appointments set status = 'cancelled' where id = (select id from t where key = 'yaw_10') returning id $$,
  'even the owner cannot write appointments directly');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.appointments where business_id = 'b0000000-0000-4000-8000-000000000002'), 1,
  'staff see their own bookings, not their colleagues''');
select pg_temp.act_as(null);
select is_empty($$ select id from public.appointments $$, 'anonymous visitors see no bookings');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ insert into public.appointments (business_id, service_id, staff_id, source, starts_at, ends_at,
                       service_name, price_minor, price_type, currency_code, customer_name)
                     values ('b0000000-0000-4000-8000-000000000001', (select low_cut from ids), (select kwame from ids), 'online',
                             pg_temp.at(0, '12:00'), pg_temp.at(0, '12:30'), 'Free cut', 0, 'fixed', 'GHS', 'Yaw') $$,
  '42501', null, 'customers cannot insert appointments directly (no price tampering)');

-- ── Cancelling ──────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');
select throws_ok($$ select public.cancel_my_appointment((select id from t where key = 'yaw_10')) $$,
  'BZ404', null, 'nobody can cancel someone else''s booking');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.cancel_my_appointment((select id from t where key = 'yaw_10'), 'Travelling') $$,
  'the customer cancels within the window');
select results_eq(
  $$ select from_status::text, to_status::text, reason from public.appointment_status_history
     where appointment_id = (select id from t where key = 'yaw_10') order by id $$,
  $$ values (null::text, 'confirmed', null::text), ('confirmed', 'cancelled', 'Travelling') $$,
  'the cancellation and its reason are in the history');
select throws_ok($$ select public.cancel_my_appointment((select id from t where key = 'yaw_10')) $$,
  'BZ409', null, 'a cancelled booking cannot be cancelled again');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000004');
select lives_ok($$ select pg_temp.book_kwame('10:00') $$, 'a cancelled booking frees its time');
reset role;
update public.booking_rules set cancellation_window_hours = 336 where business_id = 'b0000000-0000-4000-8000-000000000002';
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.cancel_my_appointment((select id from t where key = 'yaw_twists')) $$,
  'BZ409', null, 'inside the business''s cancellation window, online changes are refused');
reset role;
update public.booking_rules set cancellation_window_hours = 2 where business_id = 'b0000000-0000-4000-8000-000000000002';

-- ── Rescheduling is atomic ──────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.reschedule_my_appointment((select id from t where key = 'yaw_twists'),
                     array[(select efua from ids)], pg_temp.at(1, '10:00')) $$,
  'BZ409', null, 'moving to a taken time is refused');
select is((select status::text from public.appointments where id = (select id from t where key = 'yaw_twists')), 'confirmed',
  '...and the original booking is untouched');
select lives_ok($$ insert into t select 'yaw_moved', public.reschedule_my_appointment((select id from t where key = 'yaw_twists'),
                     array[(select ama from ids)], pg_temp.at(1, '14:00')) $$,
  'the customer moves the booking to a free time');
select results_eq(
  $$ select (select status::text from public.appointments where id = (select id from t where key = 'yaw_twists')),
            (select rescheduled_from_id from public.appointments where id = (select id from t where key = 'yaw_moved')) $$,
  $$ values ('cancelled', (select id from t where key = 'yaw_twists')) $$,
  'the old booking is cancelled and the new one points to it');

-- ── Team changes can't strand bookings ──────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.remove_staff_member((select efua from ids)) $$,
  'BZ409', null, 'a team member with upcoming bookings cannot be removed');

-- ── Public busy times ───────────────────────────────────────────────────────
select pg_temp.act_as(null);
select isnt_empty($$ select * from public.get_busy_intervals('b0000000-0000-4000-8000-000000000001',
                     pg_temp.at(0, '00:00'), pg_temp.at(1, '00:00')) $$,
  'anyone can see when a published business is busy (times only, no names)');
select throws_ok($$ select * from public.get_busy_intervals('b0000000-0000-4000-8000-000000000003', now(), now() + interval '1 day') $$,
  'BZ404', null, 'draft businesses are hidden');
select throws_ok($$ select * from public.get_busy_intervals('b0000000-0000-4000-8000-000000000001', now(), now() + interval '90 days') $$,
  'BZ422', null, 'busy-time ranges are capped');

-- ── The constraint itself, whoever writes ───────────────────────────────────
reset role;
select throws_ok($$ insert into public.appointments (business_id, service_id, staff_id, source, starts_at, ends_at,
                       service_name, price_minor, price_type, currency_code, customer_name)
                     values ('b0000000-0000-4000-8000-000000000001', (select low_cut from ids), (select kwame from ids), 'manual',
                             pg_temp.at(0, '10:40'), pg_temp.at(0, '11:10'), 'Low cut', 5000, 'fixed', 'GHS', 'Walk-in') $$,
  '23P01', null, 'the exclusion constraint blocks overlaps even for privileged writers');
select lives_ok($$ insert into public.appointments (business_id, service_id, staff_id, status, source, starts_at, ends_at,
                       service_name, price_minor, price_type, currency_code, customer_name)
                     values ('b0000000-0000-4000-8000-000000000001', (select low_cut from ids), (select kwame from ids), 'no_show', 'manual',
                             pg_temp.at(0, '10:40'), pg_temp.at(0, '11:10'), 'Low cut', 5000, 'fixed', 'GHS', 'History') $$,
  'cancelled and no-show bookings do not block time');

-- ── Abuse guard ─────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
do $$
begin
  for i in 0..6 loop  -- Yaw has made 3 bookings this hour; 7 more reach the limit of 10
    perform pg_temp.book_kwame(to_char(time '08:00' + make_interval(mins => 30 * i), 'HH24:MI'), 2);
  end loop;
end $$;
select throws_ok($$ select pg_temp.book_kwame('12:00', 2) $$, 'BZ429', null, 'more than 10 bookings an hour are refused');

select * from finish();
rollback;
