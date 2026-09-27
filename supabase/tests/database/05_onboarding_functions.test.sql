-- Onboarding functions: create_business, set_primary_category, set_business_slug,
-- business_publish_readiness, publish_business, unpublish_business.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

create temp table t (key text primary key, id uuid, slug text);
grant all on t to authenticated, anon;

-- ---------------------------------------------------------------- create_business
select pg_temp.act_as(null);
select throws_ok($$ select * from public.create_business('Anon Shop', 'solo', (select id from public.categories where slug = 'nails'), 'GH') $$,
  '42501', null, 'anon cannot call create_business');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw, a customer
insert into t select 'yaw1', id, slug from public.create_business('  Yaw''s Nails & Spa  ', 'solo',
  (select id from public.categories where slug = 'nails'), 'GH');
select is((select slug from t where key = 'yaw1'), 'yaw-s-nails-spa', 'slug is derived from the name');
select is((select name from public.businesses where id = (select id from t where key = 'yaw1')), 'Yaw''s Nails & Spa', 'name is trimmed');
select results_eq($$ select status::text, currency_code::text, timezone, kind::text from public.businesses where id = (select id from t where key = 'yaw1') $$,
  $$ values ('draft', 'GHS', 'Africa/Accra', 'solo') $$, 'new business is a draft with the country''s currency and timezone');
select results_eq($$ select role::text from public.business_members where business_id = (select id from t where key = 'yaw1') $$,
  $$ values ('owner') $$, 'creator becomes the owner');
select results_eq($$ select user_id, display_name from public.staff where business_id = (select id from t where key = 'yaw1') $$,
  $$ values ('a0000000-0000-4000-8000-000000000006'::uuid, 'Yaw Adjei') $$, 'owner gets a staff row named after their profile');
select isnt_empty($$ select 1 from public.booking_rules where business_id = (select id from t where key = 'yaw1') $$, 'default booking rules created');
select results_eq($$ select c.slug from public.business_categories bc join public.categories c on c.id = bc.category_id
                     where bc.business_id = (select id from t where key = 'yaw1') and bc.is_primary $$,
  $$ values ('nails') $$, 'primary category set');

insert into t select 'yaw2', id, slug from public.create_business('Yaw''s Nails & Spa', 'team',
  (select id from public.categories where slug = 'nails'), 'GH');
select is((select slug from t where key = 'yaw2'), 'yaw-s-nails-spa-2', 'duplicate names get a numbered slug');
insert into t select 'reserved', id, slug from public.create_business('Admin', 'solo', (select id from public.categories where slug = 'nails'), 'GH');
select is((select slug from t where key = 'reserved'), 'admin-2', 'reserved words are never used as slugs');
insert into t select 'twi', id, slug from public.create_business('Ɛkɔm Café', 'solo', (select id from public.categories where slug = 'nails'), 'GH');
select matches((select slug from t where key = 'twi'), '^[a-z0-9]+(-[a-z0-9]+)*$', 'non-ASCII names still produce a valid slug');

select throws_ok($$ select * from public.create_business('X', 'solo', (select id from public.categories where slug = 'nails'), 'GH') $$,
  'BZ422', null, 'names shorter than 2 characters are rejected');
select throws_ok($$ select * from public.create_business('Somewhere', 'solo', (select id from public.categories where slug = 'nails'), 'ZZ') $$,
  'BZ422', null, 'unsupported countries are rejected');
select throws_ok($$ select * from public.create_business('Somewhere', 'solo', gen_random_uuid(), 'GH') $$,
  'BZ422', null, 'unknown categories are rejected');
insert into t select 'yaw5', id, slug from public.create_business('Fifth', 'solo', (select id from public.categories where slug = 'nails'), 'GH');
select throws_ok($$ select * from public.create_business('Sixth', 'solo', (select id from public.categories where slug = 'nails'), 'GH') $$,
  'BZ429', null, 'at most 5 businesses per account');

-- ---------------------------------------------------------------- readiness + publish
select is(public.business_publish_readiness((select id from t where key = 'yaw1')), array['location', 'contact'],
  'readiness lists what is missing');
select throws_ok($$ select public.publish_business((select id from t where key = 'yaw1')) $$,
  'BZ422', null, 'cannot publish before ready');

update public.businesses set phone_e164 = '+233241234567' where id = (select id from t where key = 'yaw1');
insert into public.business_locations (business_id, country_code, locality_text) values ((select id from t where key = 'yaw1'), 'GH', 'Nkawkaw');
select is(public.business_publish_readiness((select id from t where key = 'yaw1')), '{}'::text[], 'ready once location and contact exist');

select lives_ok($$ select public.set_business_slug((select id from t where key = 'yaw1'), 'yaw-nails') $$, 'slug editable before first publish');
select throws_ok($$ select public.set_business_slug((select id from t where key = 'yaw1'), 'kwame-cuts') $$,
  'BZ409', null, 'taken slugs are rejected');
select throws_ok($$ select public.set_business_slug((select id from t where key = 'yaw1'), 'dashboard') $$,
  'BZ409', null, 'reserved slugs are rejected');
select throws_ok($$ select public.set_business_slug((select id from t where key = 'yaw1'), 'Bad Slug') $$,
  'BZ422', null, 'badly formed slugs are rejected');

select lives_ok($$ select public.publish_business((select id from t where key = 'yaw1')) $$, 'owner publishes when ready');
select results_eq($$ select status::text, published_at is not null from public.businesses where id = (select id from t where key = 'yaw1') $$,
  $$ values ('published', true) $$, 'business is published with a timestamp');
select throws_ok($$ select public.set_business_slug((select id from t where key = 'yaw1'), 'yaw-nails-accra') $$,
  'BZ409', null, 'slug is locked after first publish');
select lives_ok($$ select public.unpublish_business((select id from t where key = 'yaw1')) $$, 'owner can unpublish');
select is((select status::text from public.businesses where id = (select id from t where key = 'yaw1')), 'draft', 'unpublished business is a draft again');

-- ---------------------------------------------------------------- authorization
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame: not a member of Yaw's business
select throws_ok($$ select public.publish_business((select id from t where key = 'yaw1')) $$, 'BZ403', null, 'non-members cannot publish');
select throws_ok($$ select public.set_business_slug((select id from t where key = 'yaw2'), 'stolen') $$, 'BZ403', null, 'non-members cannot change the slug');
select throws_ok($$ select public.set_primary_category((select id from t where key = 'yaw2'), (select id from public.categories where slug = 'barbers')) $$,
  'BZ403', null, 'non-members cannot change the category');
select throws_ok($$ select public.business_publish_readiness((select id from t where key = 'yaw2')) $$, 'BZ403', null, 'non-members cannot read readiness');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua, staff of ama-braids
select throws_ok($$ select public.unpublish_business('b0000000-0000-4000-8000-000000000002') $$, 'BZ403', null, 'staff cannot unpublish');

reset role;
update public.businesses set status = 'suspended' where id = (select id from t where key = 'yaw1');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.publish_business((select id from t where key = 'yaw1')) $$, 'BZ403', null, 'a suspended business cannot be re-published by its team');

select * from finish();
rollback;
