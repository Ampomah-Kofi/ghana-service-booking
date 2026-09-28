-- ADR-0017: no money moves through the app. Businesses list the ways they accept payment,
-- customers say how they'll pay, the business's own Mobile Money / bank details are shown only to
-- its booked customers, and the business records what it received. Tenant isolation throughout.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

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

-- People (seed): Kwame (…001) owns Kwame Cuts (b1) and is its only staff member; Ama (…002) owns
-- Ama Braids (b2); Yaw (…006) books; Kojo (…007) is another customer.
create temp table ids (k text primary key, id uuid);
grant all on ids to anon, authenticated;
delete from public.reviews;
delete from public.notifications;
delete from public.payments;
delete from public.appointments;

create function pg_temp.low_cut() returns uuid language sql stable as $$
  select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut';
$$;
create function pg_temp.kwame_staff() returns uuid language sql stable as $$
  select id from public.staff where business_id = 'b0000000-0000-4000-8000-000000000001'
     and user_id = 'a0000000-0000-4000-8000-000000000001';
$$;
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
create function pg_temp.id(p_key text) returns uuid language sql as $$ select id from ids where k = p_key; $$;
create function pg_temp.a(p_key text) returns public.appointments language sql as $$
  select * from public.appointments where id = pg_temp.id(p_key);
$$;

-- ── Nothing online is left ───────────────────────────────────────────────────
select hasnt_table('public', 'payment_events', 'no webhook inbox');
select hasnt_column('public', 'services', 'deposit_minor', 'services have no deposit');
select hasnt_column('public', 'appointments', 'hold_expires_at', 'bookings are never held for payment');
select hasnt_function('public', 'start_payment', 'nobody can start an online payment');

-- ── Accepted methods: public, set by the business ────────────────────────────
select is((select accepted_payment_methods::text from public.booking_rules
            where business_id = 'b0000000-0000-4000-8000-000000000001'), '{cash}', 'cash only until the business says more');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ update public.booking_rules set accepted_payment_methods = '{cash,mobile_money,bank_transfer}'
                    where business_id = 'b0000000-0000-4000-8000-000000000001' $$, 'the owner adds MoMo and bank transfer');
select throws_ok($$ update public.booking_rules set accepted_payment_methods = '{}'
                    where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'at least one way to pay');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
update public.booking_rules set accepted_payment_methods = '{card}' where business_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.act_as(null);
select is((select accepted_payment_methods::text from public.booking_rules
            where business_id = 'b0000000-0000-4000-8000-000000000001'), '{cash,mobile_money,bank_transfer}',
          'anyone can see how a published business takes payment; Business B could not change it');

-- ── Payment details: owner writes, managers read, customers only on their booking ──
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.set_payment_details('b0000000-0000-4000-8000-000000000001', 'mtn', '+233240000999', 'Thief') $$,
                 'BZ403', null, 'Business B cannot set Business A''s payment details');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.set_payment_details('b0000000-0000-4000-8000-000000000001', 'mtn', '0240000001', 'Kwame Asante') $$,
                 'BZ422', null, 'numbers are stored in E.164');
select lives_ok($$ select public.set_payment_details('b0000000-0000-4000-8000-000000000001', 'mtn', '+233200000001', 'Kwame Asante',
                                                     'GCB Bank', 'Kwame Cuts', '1234 5678 9012') $$,
                'the owner adds Mobile Money and bank details');
select is((select bank_account_number from public.business_payment_details
            where business_id = 'b0000000-0000-4000-8000-000000000001'), '123456789012', 'spaces are removed from the account number');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.business_payment_details), 0, 'Business B cannot read them');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.business_payment_details), 0, 'customers cannot read the table');
select pg_temp.act_as(null);
select throws_ok($$ select count(*) from public.business_payment_details $$, '42501', null, 'anonymous visitors cannot at all');

-- ── Booking: no deposit, no hold; the customer says how they'll pay ──────────
select pg_temp.book('b1', 'a0000000-0000-4000-8000-000000000006', 1, 10);
select is((pg_temp.a('b1')).status::text, 'confirmed', 'a booking confirms straight away (auto-confirm)');
select is((pg_temp.a('b1')).payment_status, null, 'nothing is due in advance');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok(format($$ select public.choose_payment_method(%L, 'card') $$, pg_temp.id('b1')),
                 'BZ422', null, 'only a way the business accepts');
select lives_ok(format($$ select public.choose_payment_method(%L, 'mobile_money') $$, pg_temp.id('b1')),
                'Yaw will pay with Mobile Money');
select results_eq(format($$ select momo_number_e164, momo_account_name, bank_account_number
                            from public.get_booking_payment_details(%L) $$, pg_temp.id('b1')),
                  $$ values ('+233200000001', 'Kwame Asante', null::text) $$,
                  'Yaw sees the business''s MoMo details, not its bank details');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select throws_ok(format($$ select public.choose_payment_method(%L, 'cash') $$, pg_temp.id('b1')),
                 'BZ404', null, 'another customer cannot choose for Yaw''s booking');
select throws_ok(format($$ select * from public.get_booking_payment_details(%L) $$, pg_temp.id('b1')),
                 'BZ404', null, 'nor see the business''s details through it');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok(format($$ select * from public.get_booking_payment_details(%L) $$, pg_temp.id('b1')),
                 'BZ404', null, 'Business B cannot either');

-- ── The business marks it paid ─────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok(format($$ select public.record_payment(%L, 5000, 'cash') $$, pg_temp.id('b1')),
                 'BZ404', null, 'a customer cannot mark their own booking paid');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok(format($$ select public.record_payment(%L, 5000, 'cash') $$, pg_temp.id('b1')),
                 'BZ404', null, 'Business B cannot record payments on A''s booking');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(format($$ select public.record_payment(%L, 2000, 'mobile_money', 'MoMo ref 551') $$, pg_temp.id('b1')),
                'Kwame records GH₵ 20 received by MoMo');
select is((pg_temp.a('b1')).payment_status::text, 'partially_paid', 'part paid');
select throws_ok(format($$ select public.record_payment(%L, 4000, 'cash') $$, pg_temp.id('b1')),
                 'BZ422', null, 'not more than the price');
select lives_ok(format($$ select public.record_payment(%L, 3000, 'cash') $$, pg_temp.id('b1')), 'the rest in cash');
select is((pg_temp.a('b1')).payment_status::text, 'paid', 'paid in full');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where appointment_id = pg_temp.id('b1')
            and template_key = 'payment.received' and channel = 'in_app'), 2, 'Yaw gets an in-app receipt each time');
select is((select count(*)::int from public.notifications where appointment_id = pg_temp.id('b1')
            and template_key = 'payment.received' and channel <> 'in_app'), 0, 'and no text message about money');

-- Who sees the amounts.
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.payments where appointment_id = pg_temp.id('b1')), 2, 'Yaw sees his payments');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.payments), 0, 'Business B sees none of A''s payments');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000007');
select is((select count(*)::int from public.payments), 0, 'other customers see none');

-- ── Refunds are recorded by owners and managers ──────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok(format($$ select public.mark_payment_refunded(%L, 'Sorry') $$,
                        (select id from public.payments where amount_minor = 3000 limit 1)),
                 'BZ404', null, 'Business B cannot refund A''s payment');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(format($$ select public.mark_payment_refunded(%L, 'Handed back, left early') $$,
                       (select id from public.payments where amount_minor = 3000)), 'Kwame records a refund');
select is((pg_temp.a('b1')).payment_status::text, 'partially_paid', 'the refunded part no longer counts');

-- ── A cancelled booking can't be marked paid ─────────────────────────────
select pg_temp.book('b2', 'a0000000-0000-4000-8000-000000000006', 2, 11);
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select public.cancel_my_appointment(pg_temp.id('b2'), 'Travelling');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok(format($$ select public.record_payment(%L, 1000, 'cash') $$, pg_temp.id('b2')),
                 'BZ409', null, 'a cancelled booking was not kept');

select * from finish();
rollback;
