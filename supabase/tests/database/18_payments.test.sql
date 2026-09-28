-- Phase 9: deposits hold the slot, payments are applied exactly once from provider events, only the
-- right people see money, holds expire and free the slot, refunds follow the policy, and a
-- reschedule keeps what was paid.
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

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
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

-- People (seed): Kwame owns Kwame Cuts (b1, and is its only staff member); Ama owns Ama Braids (b2);
-- Yaw (…006) and Kojo-the-customer (…007 has no business at b1) book as customers.
create temp table ids (k text primary key, id uuid);
-- Seed ids are generated, so look Kwame's service and staff row up by name.
create function pg_temp.low_cut() returns uuid language sql stable as $$
  select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut';
$$;
create function pg_temp.kwame_staff() returns uuid language sql stable as $$
  select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001'
     and user_id = 'a0000000-0000-4000-8000-000000000001';
$$;
grant all on ids to anon, authenticated, service_role;
delete from public.reviews;
delete from public.notifications;
delete from public.payment_events;
delete from public.payments;
delete from public.appointments;

-- The n-th opening day (Mon–Sat) from 2 days ahead, at an hour, Accra time.
create function pg_temp.slot(p_n int, p_hour int) returns timestamptz language sql as $$
  select (d::date + make_time(p_hour, 0, 0)) at time zone 'Africa/Accra'
    from generate_series(current_date + 2, current_date + 30, interval '1 day') d
   where extract(isodow from d) between 1 and 6
   order by d offset p_n - 1 limit 1;
$$;
create function pg_temp.book(p_key text, p_user uuid, p_n int, p_hour int) returns void language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.act_as(p_user);
  v := public.book_appointment('b0000000-0000-4000-8000-000000000001', pg_temp.low_cut(),
         array[pg_temp.kwame_staff()], pg_temp.slot(p_n, p_hour), 'Yaw Adjei', '+233200000006');
  perform pg_temp.as_system();
  insert into ids values (p_key, v);
end $$;
create function pg_temp.a(p_key text) returns public.appointments language sql as $$
  select * from public.appointments where id = (select id from ids where k = p_key);
$$;

-- Online payments need a payout account first (the owner's Mobile Money wallet).
update public.booking_rules set collect_deposits_online = false, allow_full_payment_online = false
 where business_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.business_payout_accounts where business_id = 'b0000000-0000-4000-8000-000000000001';
select throws_ok($$ update public.booking_rules set collect_deposits_online = true
                    where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
                 'BZ409', null, 'no deposits online until the business says where it gets paid');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.set_payout_account('b0000000-0000-4000-8000-000000000001', 'mobile_money', 'Kwame Asante', 'mtn', '+233200000001') $$,
                 'BZ403', null, 'Business B cannot set Business A''s payout account');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.set_payout_account('b0000000-0000-4000-8000-000000000001', 'mobile_money', 'Kwame Asante', 'mtn', '+233200000001') $$,
                'the owner adds a Mobile Money payout account');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.business_payout_accounts), 0, 'Business B cannot read it');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.business_payout_accounts), 0, 'customers cannot read it');
select pg_temp.as_system();

-- Low cut: GH₵ 50, deposit GH₵ 20 collected online; auto-confirm on.
update public.services set deposit_minor = 2000 where id = pg_temp.low_cut();
update public.booking_rules set collect_deposits_online = true, allow_full_payment_online = true
 where business_id = 'b0000000-0000-4000-8000-000000000001';

-- ── Booking with a deposit holds the slot, quietly ──────────────────────────
select pg_temp.book('dep', 'a0000000-0000-4000-8000-000000000006', 1, 10);
select is((pg_temp.a('dep')).status::text, 'pending', 'a deposit booking waits as pending');
select ok((pg_temp.a('dep')).hold_expires_at between now() + interval '14 minutes' and now() + interval '16 minutes',
          'the slot is held for the business''s hold time (15 min)');
select is((pg_temp.a('dep')).payment_status::text, 'pending', 'payment is due');
select is((select count(*)::int from public.notifications where appointment_id = (select id from ids where k = 'dep')), 0,
          'nobody is told until the deposit is paid');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select throws_ok($$ select public.book_appointment('b0000000-0000-4000-8000-000000000001', pg_temp.low_cut(),
                      array[pg_temp.kwame_staff()], pg_temp.slot(1, 10), 'Other', '+233200000007') $$,
                 'BZ409', null, 'someone else can''t take a held slot');

-- ── Starting a payment ─────────────────────────────────────────────────────
select throws_ok($$ select * from public.start_payment((select id from ids where k = 'dep'), 'deposit', 'mobile_money', 'mock',
                                                       '+233200000007', 'mtn') $$,
                 'BZ404', null, 'only the person who booked can pay');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select * from public.start_payment((select id from ids where k = 'dep'), 'deposit', 'mobile_money', 'mock') $$,
                 'BZ422', null, 'Mobile Money needs a number and network');
select throws_ok($$ select * from public.start_payment((select id from ids where k = 'dep'), 'deposit', 'cash', 'cash') $$,
                 'BZ422', null, 'customers can''t mark cash as paid');
select results_eq($$ select amount_minor, currency_code::text from public.start_payment((select id from ids where k = 'dep'),
                       'deposit', 'mobile_money', 'mock', '+233200000006', 'mtn') $$,
                  $$ values (2000, 'GHS') $$, 'the deposit is charged: GH₵ 20');
select throws_ok($$ insert into public.payments (business_id, appointment_id, kind, method, provider, amount_minor, currency_code, idempotency_key)
                    values ('b0000000-0000-4000-8000-000000000001', (select id from ids where k = 'dep'), 'deposit', 'card', 'mock', 1, 'GHS', 'forged-key-1') $$,
                 '42501', null, 'nobody inserts payments directly');
select throws_ok($$ select public.apply_payment_event('mock', 'e1', 'x', 'paid', 2000, 'GHS') $$,
                 '42501', null, 'customers can''t send provider events');

-- ── The provider says paid (once) ──────────────────────────────────────────
select pg_temp.as_service();
update public.payments p set provider_reference = 'ref-dep' where p.appointment_id = (select id from ids where k = 'dep');
select is(public.apply_payment_event('mock', 'evt-0', 'ref-dep', 'paid', 1999, 'GHS'), 'mismatch',
          'a different amount is never marked paid');
select is(public.apply_payment_event('mock', 'evt-1', 'ref-dep', 'paid', 2000, 'GHS'), 'applied', 'the payment is applied');
select is(public.apply_payment_event('mock', 'evt-1', 'ref-dep', 'paid', 2000, 'GHS'), 'duplicate', 'a redelivered webhook changes nothing');
select is(public.apply_payment_event('mock', 'evt-9', 'nobody', 'paid', 2000, 'GHS'), 'unknown_payment', 'unknown references are recorded, not applied');
select pg_temp.as_system();
select is((pg_temp.a('dep')).status::text, 'confirmed', 'paid: the booking confirms itself (auto-confirm)');
select ok((pg_temp.a('dep')).hold_expires_at is null, '…and the hold is released');
select is((pg_temp.a('dep')).payment_status::text, 'partially_paid', 'deposit paid, balance at the visit');
select is((select count(*)::int from public.notifications where appointment_id = (select id from ids where k = 'dep')
             and template_key in ('booking.confirmed', 'provider.new_booking') and channel = 'in_app'), 2,
          'now the customer and the business are told');

-- ── Who sees money ─────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.payments), 1, 'the customer sees their payment');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.payments), 1, 'the owner sees their business''s payments');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.payments), 0, 'Business B sees nothing of Business A''s payments');
select is((select count(*)::int from public.payment_events), 0, 'webhook payloads are admin-only');
select pg_temp.act_as(null);
select throws_ok($$ select * from public.payments $$, '42501', null, 'anonymous visitors see no payments');

-- ── At the visit: cash for the rest ────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.record_manual_payment((select id from ids where k = 'dep'), 3000, 'cash') $$,
                 'BZ404', null, 'another business can''t record payments here');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.record_manual_payment((select id from ids where k = 'dep'), 3100, 'cash') $$,
                 'BZ422', null, 'not more than the price');
select lives_ok($$ select public.record_manual_payment((select id from ids where k = 'dep'), 3000, 'cash', 'Paid at the chair') $$,
                'the owner records the cash balance');
select pg_temp.as_system();
select is((pg_temp.a('dep')).payment_status::text, 'paid', 'fully paid');

-- ── A hold that runs out frees the slot; money that arrives late goes back ─
select pg_temp.book('late', 'a0000000-0000-4000-8000-000000000006', 2, 11);
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select * from public.start_payment((select id from ids where k = 'late'), 'deposit', 'card', 'mock');
select pg_temp.as_service();
update public.payments p set provider_reference = 'ref-late' where p.appointment_id = (select id from ids where k = 'late');
select pg_temp.as_system();
update public.appointments set hold_expires_at = now() - interval '1 minute' where id = (select id from ids where k = 'late');
select pg_temp.as_service();
select ok(public.expire_payment_holds() >= 1, 'the job releases expired holds');
select pg_temp.as_system();
select is((pg_temp.a('late')).status::text || ' / ' || (pg_temp.a('late')).cancellation_reason,
          'cancelled / Payment not completed in time', 'the unpaid booking is cancelled');
select is((select count(*)::int from public.notifications where appointment_id = (select id from ids where k = 'late')), 0,
          'no "cancelled" messages for a hold that ran out');
select lives_ok($$ select pg_temp.book('retake', 'a0000000-0000-4000-8000-000000000006', 2, 11) $$, 'the slot can be booked again');
select pg_temp.as_service();
select is(public.apply_payment_event('mock', 'evt-late', 'ref-late', 'paid', 2000, 'GHS'), 'applied', 'late money is accepted…');
select pg_temp.as_system();
select is((select status::text from public.payments where provider_reference = 'ref-late'), 'refund_pending', '…and queued for a refund');

-- ── Cancel after paying: refunds follow the policy ─────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select public.cancel_my_appointment((select id from ids where k = 'dep'), 'Travelling');
select pg_temp.as_system();
select results_eq($$ select provider, status::text from public.payments
                      where appointment_id = (select id from ids where k = 'dep') order by provider $$,
                  $$ values ('cash'::text, 'refunded'::text), ('mock', 'refund_pending') $$,
                  'cancelling refunds everything: cash in person, the deposit through the provider');
select pg_temp.as_service();
select is((select count(*)::int from public.claim_refunds(10)), 2, 'the job picks up both provider refunds');
select is((select count(*)::int from public.claim_refunds(10)), 0, '…and never claims them twice');
select public.finish_refund(p.id, true, 'rf-1') from public.payments p where p.provider_reference = 'ref-dep';
select pg_temp.as_system();
select is((select status::text from public.payments where provider_reference = 'ref-dep'), 'refunded', 'refund done');
select is((pg_temp.a('dep')).payment_status::text, 'refunded', 'the booking shows refunded');
select is((select count(*)::int from public.notifications where appointment_id = (select id from ids where k = 'dep')
             and template_key = 'payment.refunded' and channel = 'in_app'), 1, 'the customer is told the money is back');

-- ── A reschedule keeps the deposit ─────────────────────────────────────────
select pg_temp.book('move', 'a0000000-0000-4000-8000-000000000006', 3, 9);
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select * from public.start_payment((select id from ids where k = 'move'), 'deposit', 'card', 'mock');
select pg_temp.as_service();
update public.payments p set provider_reference = 'ref-move' where p.appointment_id = (select id from ids where k = 'move');
select public.apply_payment_event('mock', 'evt-move', 'ref-move', 'paid', 2000, 'GHS');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
insert into ids select 'moved', public.reschedule_my_appointment((select id from ids where k = 'move'),
                                                                  array[pg_temp.kwame_staff()], pg_temp.slot(3, 14));
select pg_temp.as_system();
select is((select appointment_id from public.payments where provider_reference = 'ref-move'), (select id from ids where k = 'moved'),
          'the paid deposit moves to the new time');
select ok((pg_temp.a('moved')).hold_expires_at is null and (pg_temp.a('moved')).status = 'confirmed',
          'no new hold: it''s already paid');

-- ── The attempt's own key is its merchant reference ────────────────────────
select pg_temp.book('key', 'a0000000-0000-4000-8000-000000000006', 4, 9);
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select * from public.start_payment((select id from ids where k = 'key'), 'deposit', 'card', 'mock');
select pg_temp.as_system();
select ok((select provider_reference = idempotency_key from public.payments
            where appointment_id = (select id from ids where k = 'key')), 'the reference sent to the provider is our key');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.abandon_payment(p.id) from public.payments p where p.appointment_id = (select id from ids where k = 'key') $$,
                 'BZ404', null, 'only the payer can close their attempt');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select public.abandon_payment(p.id, 'Provider down') from public.payments p where p.appointment_id = (select id from ids where k = 'key');
select pg_temp.as_system();
select is((select status::text from public.payments where appointment_id = (select id from ids where k = 'key')), 'failed',
          'a start the provider refused is closed');

select * from finish();
rollback;
