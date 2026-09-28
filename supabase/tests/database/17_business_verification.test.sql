-- Verified check mark (ADR-0015): owners apply, only platform admins decide (audited), nobody sets it
-- directly, a rename takes it away, and search/favourite cards carry it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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
create function pg_temp.status(p_business uuid) returns text language sql as $$
  select verification_status::text from public.businesses where id = p_business;
$$;

-- People (seed): Kwame owns Kwame Cuts (b1); Ama owns Ama Braids (b2), Efua is staff there;
-- Yaw is a customer; the platform admin is a…009. Both businesses are published.
select pg_temp.as_system();
-- Start clean even when demo data (supabase/demo/verification.sql) is loaded.
update public.businesses set verification_status = 'none', verified_at = null, verification_requested_at = null
 where id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002');
select is((select verification_status::text from public.businesses b
            where b.id = 'b0000000-0000-4000-8000-000000000003'), 'none', 'new businesses start unverified');

-- ── Nobody writes the columns directly ─────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ update public.businesses set verification_status = 'verified'
                    where id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '42501', null, 'an owner cannot mark their own business verified');
select throws_ok($$ update public.businesses set verified_at = now()
                    where id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '42501', null, '…or set the verified date');

-- ── Applying ───────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.request_business_verification('b0000000-0000-4000-8000-000000000002') $$,
                 'BZ403', null, 'staff cannot apply for their business');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.request_business_verification('b0000000-0000-4000-8000-000000000001') $$,
                 'BZ403', null, 'Business B cannot apply for Business A');
select pg_temp.act_as(null);
select throws_ok($$ select public.request_business_verification('b0000000-0000-4000-8000-000000000001') $$,
                 '42501', null, 'anonymous visitors cannot apply');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is(public.request_business_verification('b0000000-0000-4000-8000-000000000001')::text, 'pending',
          'the owner applies');
select is(public.request_business_verification('b0000000-0000-4000-8000-000000000001')::text, 'pending',
          'applying twice is harmless');
select pg_temp.as_system();
select ok((select verification_requested_at is not null from public.businesses
            where id = 'b0000000-0000-4000-8000-000000000001'), 'the request time is recorded');

-- ── Deciding ───────────────────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.admin_set_business_verification('b0000000-0000-4000-8000-000000000001', 'verified', 'self') $$,
                 'BZ403', null, 'owners cannot approve themselves');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');
select throws_ok($$ select public.admin_set_business_verification('b0000000-0000-4000-8000-000000000001', 'verified', '') $$,
                 'BZ422', null, 'admins must give a reason');
select throws_ok($$ select public.admin_set_business_verification('b0000000-0000-4000-8000-000000000001', 'pending', 'why') $$,
                 'BZ422', null, 'an admin decision is verified, declined or none');
select lives_ok($$ select public.admin_set_business_verification('b0000000-0000-4000-8000-000000000001', 'verified',
                                                                  'Called the owner; Ghana Card matches') $$,
                'a platform admin verifies');
select pg_temp.as_system();
select is(pg_temp.status('b0000000-0000-4000-8000-000000000001'), 'verified', 'the business is verified');
select is((select count(*)::int from public.admin_actions
            where action = 'business.verification' and target_id = 'b0000000-0000-4000-8000-000000000001'
              and after ->> 'verification_status' = 'verified' and before ->> 'verification_status' = 'pending'
              and reason = 'Called the owner; Ghana Card matches'),
          1, 'the decision is in the audit log with before and after');

-- ── Everyone sees the check on cards ───────────────────────────────────────
select pg_temp.act_as(null);
select is((select is_verified from public.search_businesses(p_text => 'Kwame Cuts') where slug = 'kwame-cuts'), true,
          'search cards carry the check');
select is((select is_verified from public.search_businesses(p_text => 'Ama Braids') where slug = 'ama-braids'), false,
          '…and unverified businesses show none');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
insert into public.favorites (user_id, business_id) values ('a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001');
select is((select is_verified from public.my_favorite_businesses() where slug = 'kwame-cuts'), true,
          'favourite cards carry it too');

-- ── A rename takes it away ─────────────────────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
update public.businesses set description = 'Fresh cuts daily' where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.as_system();
select is(pg_temp.status('b0000000-0000-4000-8000-000000000001'), 'verified', 'other edits keep the check');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
update public.businesses set name = 'Kwame Cuts & Co' where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.as_system();
select is(pg_temp.status('b0000000-0000-4000-8000-000000000001'), 'none', 'renaming removes the check (the name was verified)');

-- ── Declining keeps a note for the owner ───────────────────────────────────
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select public.request_business_verification('b0000000-0000-4000-8000-000000000002');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');
select public.admin_set_business_verification('b0000000-0000-4000-8000-000000000002', 'declined',
                                              'Phone unreachable', 'We could not reach you on 020 000 0002. Apply again when free.');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is((select b.verification_status::text || ' / ' || n.note
             from public.businesses b join public.business_verification_notes n on n.business_id = b.id
            where b.id = 'b0000000-0000-4000-8000-000000000002'),
          'declined / We could not reach you on 020 000 0002. Apply again when free.', 'the owner sees why');
select throws_ok($$ insert into public.business_verification_notes (business_id, note)
                    values ('b0000000-0000-4000-8000-000000000002', 'x') $$,
                 '42501', null, 'owners cannot write notes');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.business_verification_notes), 0, 'Business A cannot read Business B''s note');
select pg_temp.act_as(null);
select throws_ok($$ select * from public.business_verification_notes $$, '42501', null, 'anonymous visitors cannot read notes');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
select is(public.request_business_verification('b0000000-0000-4000-8000-000000000002')::text, 'pending',
          'and can apply again');

select * from finish();
rollback;
