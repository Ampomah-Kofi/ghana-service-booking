-- Tenant isolation for businesses + business_members (ADR-0002).
-- Uses seed.sql fixtures:
--   Kwame  a…01 owner   kwame-cuts   b…01 (published)
--   Ama    a…02 owner   ama-braids   b…02 (published)
--   Efua   a…03 staff   ama-braids
--   Kojo   a…04 owner   osu-glow-spa b…03 (draft)
--   Akosua a…05 manager osu-glow-spa
--   Yaw    a…06 customer, no business
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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

-- ---------------------------------------------------------------- read: businesses
select pg_temp.act_as(null);
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts', 'ama-braids'],
  'anon sees only published businesses');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw (customer)
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts', 'ama-braids'],
  'customer sees only published businesses');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame (owner A)
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts', 'ama-braids'],
  'owner of A cannot see another tenant''s draft business');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');  -- Akosua (manager of draft osu)
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts', 'ama-braids', 'osu-glow-spa'],
  'manager sees their own draft business');

-- Suspending hides a business from the public but not from its members.
select pg_temp.act_as(null);
reset role;
update public.businesses set status = 'suspended' where slug = 'ama-braids';
select pg_temp.act_as(null);
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts'], 'suspended business hidden from anon');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts'], 'suspended business hidden from other owners');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua (staff of ama-braids)
select set_eq($$ select slug from public.businesses $$, array['kwame-cuts', 'ama-braids'],
  'staff still see their suspended business');
reset role;
update public.businesses set status = 'published' where slug = 'ama-braids';

-- ---------------------------------------------------------------- write: businesses
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select isnt_empty($$ update public.businesses set description = 'Updated by owner' where slug = 'kwame-cuts' returning id $$,
  'owner can update their own business content');
select is_empty($$ update public.businesses set description = 'hacked' where slug = 'ama-braids' returning id $$,
  'owner of A cannot update business B');
select throws_ok($$ update public.businesses set status = 'suspended' where slug = 'kwame-cuts' $$, '42501', null,
  'owner cannot change status directly');
select throws_ok($$ update public.businesses set slug = 'stolen-slug' where slug = 'kwame-cuts' $$, '42501', null,
  'owner cannot change slug directly');
select throws_ok($$ update public.businesses set created_by = 'a0000000-0000-4000-8000-000000000002' where slug = 'kwame-cuts' $$,
  '42501', null, 'owner cannot change created_by');
select throws_ok(
  $$ insert into public.businesses (slug, name, country_code, currency_code, created_by)
     values ('sneaky-shop', 'Sneaky', 'GH', 'GHS', 'a0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'businesses cannot be inserted directly (create_business() only)');
select is_empty($$ delete from public.businesses where slug = 'kwame-cuts' returning id $$,
  'businesses cannot be deleted directly');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua (staff)
select is_empty($$ update public.businesses set description = 'staff edit' where slug = 'ama-braids' returning id $$,
  'staff cannot update their business profile');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');  -- Akosua (manager)
select isnt_empty($$ update public.businesses set description = 'manager edit' where slug = 'osu-glow-spa' returning id $$,
  'manager can update their business profile');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw
select is_empty($$ update public.businesses set description = 'customer edit' returning id $$,
  'customers cannot update any business');

select pg_temp.act_as(null);
select results_eq($$ select description from public.businesses where slug = 'ama-braids' $$,
  $$ values ('Knotless braids, twists and locs by a team of three in Kumasi.'::text) $$,
  'business B unchanged after all cross-tenant attempts');

-- ---------------------------------------------------------------- business_members
select pg_temp.act_as(null);
select is_empty($$ select user_id from public.business_members $$, 'anon sees no memberships');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select is_empty($$ select user_id from public.business_members $$, 'customers see no memberships');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select set_eq($$ select business_id from public.business_members $$, array['b0000000-0000-4000-8000-000000000001'::uuid],
  'owner of A sees only A''s team');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select set_eq($$ select user_id from public.business_members $$,
  array['a0000000-0000-4000-8000-000000000002'::uuid, 'a0000000-0000-4000-8000-000000000003'::uuid],
  'staff see their own team');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.business_members (business_id, user_id, role)
     values ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'owner') $$,
  '42501', null, 'a user cannot add themselves to another business');
select is_empty($$ update public.business_members set role = 'staff' returning user_id $$,
  'members cannot change roles directly');
select is_empty($$ delete from public.business_members where business_id = 'b0000000-0000-4000-8000-000000000002' returning user_id $$,
  'owner of A cannot remove B''s members');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select is_empty($$ update public.business_members set role = 'owner' where user_id = 'a0000000-0000-4000-8000-000000000003' returning user_id $$,
  'staff cannot promote themselves');

-- ---------------------------------------------------------------- helper functions
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select ok(not private.can_manage_business('b0000000-0000-4000-8000-000000000002'), 'Kwame cannot manage ama-braids');
select ok(private.is_business_owner('b0000000-0000-4000-8000-000000000001'), 'Kwame owns kwame-cuts');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');
select ok(private.is_business_member('b0000000-0000-4000-8000-000000000002')
          and not private.can_manage_business('b0000000-0000-4000-8000-000000000002'),
  'staff are members but not managers');

-- ---------------------------------------------------------------- constraints
reset role;
select throws_ok(
  $$ insert into public.businesses (slug, name, country_code, currency_code, created_by, timezone)
     values ('bad-tz', 'Bad TZ', 'GH', 'GHS', 'a0000000-0000-4000-8000-000000000001', 'Mars/Olympus_Mons') $$,
  '22023', null, 'unknown IANA timezones are rejected');
select throws_ok(
  $$ insert into public.businesses (slug, name, country_code, currency_code, created_by)
     values ('Bad Slug!', 'Bad', 'GH', 'GHS', 'a0000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'slugs must be lowercase-hyphenated');

select * from finish();
rollback;
