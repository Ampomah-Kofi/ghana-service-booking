-- Phase 7: favourites are private; reviews only from the customer of a completed visit; one each;
-- 14-day edits; replies only by that business's owners/managers; reports; audited moderation;
-- rating totals; service photos stay within the business; account deletion anonymises.
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

-- People (seed): Kwame owns Kwame Cuts (b1); Ama owns Ama Braids (b2), Efua is staff there;
-- Akosua manages Osu Glow Spa (b3, a draft); Yaw is a customer; 09 is a super admin.
-- Deterministic on any local database; rolled back at the end.
delete from public.payments;
delete from public.appointments;

create temp table ids (k text primary key, id uuid);
grant select on ids to anon, authenticated;

with svc as (
  select sv.business_id, sv.id as service_id, s.id as staff_id, sv.name, sv.price_minor, sv.price_type, sv.currency_code
    from public.services sv
    join public.staff_services ss on ss.service_id = sv.id
    join public.staff s on s.id = ss.staff_id
   where (sv.business_id = 'b0000000-0000-4000-8000-000000000001' and sv.name = 'Low cut' and s.display_name = 'Kwame')
      or (sv.business_id = 'b0000000-0000-4000-8000-000000000002' and sv.name = 'Twists' and s.display_name = 'Ama')
), rows as (
  select * from (values
    ('yaw_b1_done',   'b0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000006'::uuid, 'completed'::public.appointment_status, -2),
    ('yaw_b1_later',  'b0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000006'::uuid, 'confirmed'::public.appointment_status, 2),
    ('ako_b1_done',   'b0000000-0000-4000-8000-000000000001'::uuid, 'a0000000-0000-4000-8000-000000000005'::uuid, 'completed'::public.appointment_status, -3),
    ('yaw_b2_done',   'b0000000-0000-4000-8000-000000000002'::uuid, 'a0000000-0000-4000-8000-000000000006'::uuid, 'completed'::public.appointment_status, -4)
  ) v(k, business_id, customer, status, day_offset)
), ins as (
  insert into public.appointments (business_id, service_id, staff_id, source, starts_at, ends_at, service_name, price_minor,
                                   price_type, currency_code, customer_name, customer_user_id, status)
  select r.business_id, s.service_id, s.staff_id, 'online',
         (current_date + r.day_offset + time '10:00') at time zone 'Africa/Accra',
         (current_date + r.day_offset + time '10:30') at time zone 'Africa/Accra',
         s.name, s.price_minor, s.price_type, s.currency_code, 'Booked Name', r.customer, r.status
    from rows r join svc s on s.business_id = r.business_id
  returning id, business_id, customer_user_id, status, starts_at
)
insert into ids
select r.k, i.id from ins i
  join rows r on r.business_id = i.business_id and r.customer = i.customer_user_id and r.status = i.status
             and i.starts_at = (current_date + r.day_offset + time '10:00') at time zone 'Africa/Accra';

select is((select count(*)::int from ids), 4, 'setup: four appointments');

-- ── Favourites ───────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ insert into public.favorites (user_id, business_id)
                   values ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001') $$,
                'a customer saves a published business');
select throws_ok($$ insert into public.favorites (user_id, business_id)
                    values ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002') $$,
                 '42501', null, 'cannot save a favourite for someone else');
select throws_ok($$ insert into public.favorites (user_id, business_id)
                    values ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003') $$,
                 '42501', null, 'cannot save a draft business');
select is((select count(*)::int from public.favorites), 1, 'the customer sees their own favourite');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.favorites), 0, 'the business owner cannot see who saved them');
select is((select count(*)::int from public.my_favorite_businesses()), 0, 'favourite cards are per user');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select results_eq($$ select slug from public.my_favorite_businesses() $$, $$ values ('kwame-cuts'::text) $$,
                  'the customer gets their saved businesses as cards');

-- ── Submitting reviews ───────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ insert into public.reviews (business_id, appointment_id, user_id, author_name, service_name, visited_on, rating)
                    select 'b0000000-0000-4000-8000-000000000001', id, 'a0000000-0000-4000-8000-000000000006', 'x', 'x', current_date, 5
                      from ids where k = 'yaw_b1_done' $$,
                 '42501', null, 'reviews cannot be inserted directly');
select throws_ok($$ select public.submit_review((select id from ids where k = 'yaw_b1_later'), 5, 'Great') $$,
                 'BZ422', null, 'an upcoming visit cannot be reviewed');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.submit_review((select id from ids where k = 'yaw_b1_done'), 1, 'Bad') $$,
                 'BZ404', null, 'someone else''s visit cannot be reviewed');
select pg_temp.act_as(null);
select throws_ok($$ select public.submit_review((select id from ids where k = 'yaw_b1_done'), 5, null) $$,
                 '42501', null, 'anonymous visitors cannot call submit_review');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.submit_review((select id from ids where k = 'yaw_b1_done'), 5, '  Sharp fade, on time.  ') $$,
                'the customer reviews their completed visit');
select throws_ok($$ select public.submit_review((select id from ids where k = 'yaw_b1_done'), 4, 'Again') $$,
                 'BZ409', null, 'one review per visit');
select results_eq($$ select author_name, service_name, staff_name, body from public.reviews
                      where appointment_id = (select id from ids where k = 'yaw_b1_done') $$,
                  $$ values ('Yaw A.'::text, 'Low cut'::text, 'Kwame'::text, 'Sharp fade, on time.'::text) $$,
                  'snapshots the author as first name + initial, the service and the staff; trims the text');
select lives_ok($$ select public.submit_review((select id from ids where k = 'yaw_b2_done'), 4, null) $$,
                'a review without text is fine');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');
select lives_ok($$ select public.submit_review((select id from ids where k = 'ako_b1_done'), 2, 'Waited a while') $$,
                'another customer reviews the same business');

reset role;
select results_eq($$ select rating_count, rating_avg from public.businesses where id = 'b0000000-0000-4000-8000-000000000001' $$,
                  $$ values (2, 3.50::numeric(3,2)) $$, 'rating totals follow new reviews');

select pg_temp.act_as(null);
select is((select count(*)::int from public.reviews where business_id = 'b0000000-0000-4000-8000-000000000001'), 2,
          'anyone can read published reviews');

-- ── Editing ──────────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.update_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 4, 'Sharp fade.') $$,
                'the author edits within 14 days');
reset role;
select is((select rating_avg from public.businesses where id = 'b0000000-0000-4000-8000-000000000001'), 3.00::numeric(3,2),
          'rating totals follow edits');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.update_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 1, 'hacked') $$,
                 'BZ404', null, 'nobody else can edit a review');
reset role;
update public.reviews set created_at = now() - interval '15 days' where appointment_id = (select id from ids where k = 'yaw_b2_done');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.update_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b2_done')), 5, 'late edit') $$,
                 'BZ422', null, 'no edits after 14 days');

-- ── Business replies ─────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.reply_to_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'Hi from Ama') $$,
                 'BZ404', null, 'Business B cannot reply to Business A''s review');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.reply_to_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b2_done')), 'Staff reply') $$,
                 'BZ403', null, 'staff cannot reply for the business');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ select public.reply_to_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'Thanks Yaw, see you soon!') $$,
                'the owner replies');
select lives_ok($$ select public.reply_to_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'Thanks Yaw!') $$,
                'the one reply can be edited');
select throws_ok($$ update public.reviews set rating = 5 where business_id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '42501', null, 'owners cannot change reviews directly');
select pg_temp.act_as(null);
select is((select reply_body from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'Thanks Yaw!',
          'the reply is public with the review');

-- ── Reports ──────────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.report_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'spam', null) $$,
                 'BZ422', null, 'you cannot report your own review');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select lives_ok($$ select public.report_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'not_genuine', 'Never saw him') $$,
                'anyone signed in can report');
select throws_ok($$ select public.report_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'spam', null) $$,
                 'BZ409', null, 'one report per person per review');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.review_reports), 0, 'reports are private to the reporter and admins');

-- ── Moderation ───────────────────────────────────────────────────────────────
select throws_ok($$ select public.admin_moderate_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'hidden', 'I dislike it') $$,
                 'BZ403', null, 'business owners cannot hide reviews');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');
select lives_ok($$ select public.admin_moderate_review((select id from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'hidden', 'Reported as not genuine; checking') $$,
                'a platform admin hides a reported review');
reset role;
select results_eq($$ select count(*)::int from public.admin_actions where action = 'review.moderate' $$, $$ values (1) $$,
                  'moderation is audit-logged');
select is((select count(*)::int from public.review_reports where resolved_at is null), 0, 'hiding resolves the open reports');
select results_eq($$ select rating_count, rating_avg from public.businesses where id = 'b0000000-0000-4000-8000-000000000001' $$,
                  $$ values (1, 2.00::numeric(3,2)) $$, 'hidden reviews leave the rating');
select pg_temp.act_as(null);
select is((select count(*)::int from public.reviews where business_id = 'b0000000-0000-4000-8000-000000000001'), 1,
          'hidden reviews disappear from the public page');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select status::text from public.reviews where appointment_id = (select id from ids where k = 'yaw_b1_done')), 'hidden',
          'the author still sees their hidden review');

-- ── Service photos stay within the business ─────────────────────────────────
reset role;
insert into public.business_photos (id, business_id, path_small, path_large)
values ('c0000000-0000-4000-8000-00000000f070', 'b0000000-0000-4000-8000-000000000001',
        'businesses/b0000000-0000-4000-8000-000000000001/photos/t-s.webp',
        'businesses/b0000000-0000-4000-8000-000000000001/photos/t-l.webp');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ update public.business_photos
                      set service_id = (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000002' limit 1)
                    where id = 'c0000000-0000-4000-8000-00000000f070' $$,
                 '23503', null, 'a photo cannot point at another business''s service');
select lives_ok($$ update public.business_photos
                     set service_id = (select id from public.services where business_id = 'b0000000-0000-4000-8000-000000000001' and name = 'Low cut')
                   where id = 'c0000000-0000-4000-8000-00000000f070' $$,
                'the owner tags a photo with one of their services');

-- ── Account deletion ─────────────────────────────────────────────────────────
select alike((select public.account_deletion_blocker()), '%own a business%', 'business owners must hand over first');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is((select public.account_deletion_blocker()), null, 'a customer can delete their account');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.delete_my_account() $$, 'BZ422', null, 'an owner''s deletion is refused');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select lives_ok($$ select public.delete_my_account() $$, 'a customer deletes their own account');
reset role;
select is((select count(*)::int from auth.users where id = 'a0000000-0000-4000-8000-000000000006'), 0, 'the sign-in is gone');
select is((select count(*)::int from public.favorites where user_id = 'a0000000-0000-4000-8000-000000000006'), 0, 'favourites are deleted');
select results_eq($$ select user_id, author_name from public.reviews where appointment_id = (select id from ids where k = 'yaw_b2_done') $$,
                  $$ values (null::uuid, 'Former customer'::text) $$, 'the review stays, anonymised');
select results_eq($$ select count(*)::int from public.appointments
                     where id in (select id from ids where k like 'yaw%')
                       and customer_user_id is null and customer_name = 'Deleted customer' and customer_phone_e164 is null $$,
                  $$ values (3) $$, 'the business keeps its booking records without the customer''s name or phone');

select * from finish();
rollback;
