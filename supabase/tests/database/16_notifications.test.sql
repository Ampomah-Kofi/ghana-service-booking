-- Phase 8: the outbox follows the booking (who hears what, on which channel, when), reminders are
-- withdrawn when plans change, inboxes are private, and only the dispatcher (service role) can send.
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

delete from public.payment_events;
delete from public.payments;
delete from public.appointments;
delete from public.notifications;
create temp table ids (k text primary key, id uuid);
grant select on ids to anon, authenticated, service_role;

-- Back to the system (no signed-in user), like a trigger fired by a background job.
create function pg_temp.as_system() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- n(appointment key, template, channel, status) as postgres.
create function pg_temp.n(p_key text, p_template text, p_channel text default null, p_status text default null)
returns int language sql as $$
  select count(*)::int from public.notifications n
   where n.appointment_id = (select id from ids where k = p_key)
     and n.template_key = p_template
     and (p_channel is null or n.channel::text = p_channel)
     and (p_status is null or n.status::text = p_status);
$$;

-- People (seed): Kwame owns Kwame Cuts (b1, also its only staff member); Ama owns Ama Braids (b2);
-- Yaw is a customer with phone +233200000006 and no email.

create function pg_temp.book(p_key text, p_source text, p_status text, p_days int, p_hour int, p_customer uuid,
                             p_phone text default null) returns void language plpgsql as $$
declare v_id uuid;
begin
  insert into public.appointments (business_id, service_id, staff_id, source, status, starts_at, ends_at, service_name,
                                   price_minor, price_type, currency_code, customer_name, customer_phone_e164, customer_user_id)
  select sv.business_id, sv.id, st.id, p_source::public.appointment_source, p_status::public.appointment_status,
         (current_date + p_days + make_time(p_hour, 0, 0)) at time zone 'Africa/Accra',
         (current_date + p_days + make_time(p_hour, 30, 0)) at time zone 'Africa/Accra',
         sv.name, sv.price_minor, sv.price_type, sv.currency_code, 'Yaw Adjei', p_phone, p_customer
    from public.services sv join public.staff st on st.business_id = sv.business_id and st.display_name = 'Kwame'
   where sv.business_id = 'b0000000-0000-4000-8000-000000000001' and sv.name = 'Low cut'
  returning id into v_id;
  insert into ids values (p_key, v_id);
end $$;

-- ── A confirmed online booking two days ahead ───────────────────────────────
select pg_temp.book('online', 'online', 'confirmed', 2, 10, 'a0000000-0000-4000-8000-000000000006');
select is(pg_temp.n('online', 'booking.confirmed', 'in_app'), 1, 'customer: in-app "you''re booked"');
select is(pg_temp.n('online', 'booking.confirmed', 'sms', 'queued'), 1, 'customer: one SMS, queued for the dispatcher');
select is(pg_temp.n('online', 'booking.confirmed', 'whatsapp'), 0, 'never SMS and WhatsApp for the same event');
select is(pg_temp.n('online', 'booking.confirmed', 'email'), 0, 'no email without an address');
select is(pg_temp.n('online', 'provider.new_booking', 'in_app'), 1, 'business: in-app alert to the owner');
select is(pg_temp.n('online', 'provider.new_booking', 'sms'), 1, 'business: SMS to the business phone (default on)');
select is(pg_temp.n('online', 'reminder.day_before') + pg_temp.n('online', 'reminder.soon'), 4,
          'reminders 24 h and 2 h before, in-app and SMS');
select is(pg_temp.n('online', 'provider.upcoming', 'in_app'), 1, 'provider heads-up 30 minutes before');
select ok((select bool_and(scheduled_for > now()) from public.notifications
            where appointment_id = (select id from ids where k = 'online') and template_key like 'reminder.%'),
          'reminders wait for their time');

-- ── Inboxes are private ─────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select results_eq($$ select template_key from public.notifications $$, $$ values ('booking.confirmed'::text) $$,
                  'the customer sees only their own in-app messages that are due (not future reminders, not texts)');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select results_eq($$ select template_key from public.notifications $$, $$ values ('provider.new_booking'::text) $$,
                  'the owner sees their alert, not the customer''s messages');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.notifications), 0, 'Business B sees nothing of Business A''s messages');
select pg_temp.act_as(null);
select is((select count(*)::int from public.notifications), 0, 'anonymous visitors see nothing');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ insert into public.notifications (recipient_user_id, channel, template_key)
                    values ('a0000000-0000-4000-8000-000000000006', 'in_app', 'x') $$,
                 '42501', null, 'nobody inserts messages directly');
select throws_ok($$ update public.notifications set payload = '{}' $$, '42501', null, 'only read_at can be changed');
select lives_ok($$ update public.notifications set read_at = now() $$, 'marking your messages read works');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications where read_at is not null), 1, '…and touches only your own');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select * from public.claim_notifications(10) $$, '42501', null, 'users cannot run the dispatcher');

-- ── The customer cancels: reminders withdrawn, the business is told ──────────
select lives_ok($$ select public.cancel_my_appointment((select id from ids where k = 'online'), 'Changed plans') $$,
                'the customer cancels');
select pg_temp.as_system();
select is((select count(*)::int from public.notifications
            where appointment_id = (select id from ids where k = 'online')
              and (template_key like 'reminder.%' or template_key = 'provider.upcoming') and status <> 'cancelled'), 0,
          'all reminders and heads-ups are withdrawn');
select is(pg_temp.n('online', 'provider.cancelled_by_customer', 'in_app'), 1, 'the owner hears about the cancellation');
select is(pg_temp.n('online', 'booking.cancelled'), 0, 'the customer isn''t told what they just did');

-- ── The business cancels: the customer is told ──────────────────────────────
select pg_temp.book('bizcancel', 'online', 'confirmed', 3, 11, 'a0000000-0000-4000-8000-000000000006');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.set_appointment_status((select id from ids where k = 'bizcancel'), 'cancelled', 'Barber is ill') $$,
                'the owner cancels');
select pg_temp.as_system();
select is(pg_temp.n('bizcancel', 'booking.cancelled', 'sms'), 1, 'the customer gets a cancellation text');

-- ── Walk-ins, phone bookings for guests, pending requests ───────────────────
select pg_temp.book('walkin', 'walk_in', 'arrived', 0, 12, null, '+233244000123');
select is((select count(*)::int from public.notifications where appointment_id = (select id from ids where k = 'walkin')), 0,
          'walk-ins get no messages');
select pg_temp.book('phone', 'manual', 'confirmed', 4, 9, null, '+233244000456');
select results_eq($$ select channel::text, recipient_address from public.notifications
                      where appointment_id = (select id from ids where k = 'phone') and template_key = 'booking.confirmed' $$,
                  $$ values ('sms'::text, '+233244000456'::text) $$, 'a phone booking texts the number given (no in-app, no account)');
select pg_temp.book('pending', 'online', 'pending', 5, 9, 'a0000000-0000-4000-8000-000000000006');
select is(pg_temp.n('pending', 'booking.requested', 'in_app'), 1, 'a request: the customer knows it''s waiting');
select is(pg_temp.n('pending', 'provider.needs_confirmation', 'in_app'), 1, 'the owner is asked to confirm');
select is(pg_temp.n('pending', 'reminder.day_before'), 0, 'no reminders until confirmed');
update public.appointments set status = 'confirmed' where id = (select id from ids where k = 'pending');
select is(pg_temp.n('pending', 'booking.confirmed', 'sms'), 1, 'confirming texts the customer');
select is(pg_temp.n('pending', 'reminder.day_before', 'sms'), 1, '…and schedules the reminders');

-- ── Moved by the business: new time, new reminders ──────────────────────────
update public.appointments set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'
 where id = (select id from ids where k = 'pending');
select is(pg_temp.n('pending', 'booking.moved', 'sms'), 1, 'moving the booking tells the customer');
select is(pg_temp.n('pending', 'reminder.day_before', 'sms', 'queued'), 1, 'one live reminder, for the new time');
select is(pg_temp.n('pending', 'reminder.day_before', 'sms', 'cancelled'), 1, 'the old one is withdrawn');

-- ── Preferences: WhatsApp instead of SMS ────────────────────────────────────
update public.profiles set notify_sms = false, notify_whatsapp = true where id = 'a0000000-0000-4000-8000-000000000006';
select pg_temp.book('wa', 'online', 'confirmed', 6, 14, 'a0000000-0000-4000-8000-000000000006');
select is(pg_temp.n('wa', 'booking.confirmed', 'whatsapp') * 10 + pg_temp.n('wa', 'booking.confirmed', 'sms'), 10,
          'a customer who chose WhatsApp gets WhatsApp, not SMS');

-- ── Dispatcher: claim, deliver, retry with back-off, give up ────────────────
set local role service_role;
select ok((select count(*) from public.claim_notifications(200)) >= 3, 'the dispatcher claims due texts');
select is((select count(*)::int from public.notifications where status = 'queued' and scheduled_for <= now() and channel <> 'in_app'), 0,
          'nothing due is left unclaimed');
select public.finish_notification(n.id, false, 'mock-sms', null, 'timeout', true)
  from public.notifications n where n.appointment_id = (select id from ids where k = 'phone') and n.status = 'sending';
select ok((select status = 'queued' and scheduled_for > now() from public.notifications
            where appointment_id = (select id from ids where k = 'phone') and template_key = 'booking.confirmed'),
          'a temporary failure is retried later');
update public.notifications set attempts = 4, status = 'sending'
 where appointment_id = (select id from ids where k = 'phone') and template_key = 'booking.confirmed';
select public.finish_notification(n.id, false, 'mock-sms', null, 'timeout again', true)
  from public.notifications n where n.appointment_id = (select id from ids where k = 'phone') and n.template_key = 'booking.confirmed';
select is((select status::text from public.notifications
            where appointment_id = (select id from ids where k = 'phone') and template_key = 'booking.confirmed'), 'failed',
          'after four attempts it stops');

select * from finish();
rollback;
