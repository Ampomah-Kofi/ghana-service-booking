begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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

-- Profile bootstrap trigger
insert into auth.users (id, phone, raw_user_meta_data)
values ('c0000000-0000-4000-8000-000000000001', '233249999999', '{"full_name":"  Test Person "}');
select results_eq(
  $$ select phone_e164, full_name from public.profiles where id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values ('+233249999999'::text, 'Test Person'::text) $$,
  'auth user insert creates a profile with E.164 phone and trimmed name'
);
update auth.users set phone = '233248888888' where id = 'c0000000-0000-4000-8000-000000000001';
select is((select phone_e164 from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'), '+233248888888',
  'phone change in auth syncs to profile');

-- Profiles: self only
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');  -- Kwame
select results_eq($$ select id from public.profiles $$, $$ values ('a0000000-0000-4000-8000-000000000001'::uuid) $$,
  'a user sees only their own profile');
select is_empty($$ update public.profiles set full_name = 'Hacked' where id = 'a0000000-0000-4000-8000-000000000002' returning id $$,
  'a user cannot update someone else''s profile');
select isnt_empty($$ update public.profiles set full_name = 'Kwame M.' where id = 'a0000000-0000-4000-8000-000000000001' returning id $$,
  'a user can update their own name');
select throws_ok($$ update public.profiles set phone_e164 = '+233200000099' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'a user cannot change their phone directly (Auth owns it)');
select throws_ok($$ update public.profiles set deleted_at = now() where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'a user cannot set deleted_at directly');

select pg_temp.act_as(null);
select is_empty($$ select id from public.profiles $$, 'anon sees no profiles');

-- Consents: own only, append-only
select pg_temp.act_as('a0000000-0000-4000-8000-000000000006');  -- Yaw
select lives_ok($$ insert into public.consents (user_id, kind, granted, version, source)
                   values ('a0000000-0000-4000-8000-000000000006', 'marketing_sms', true, '2026-09', 'settings') $$,
  'a user records their own consent');
select throws_ok($$ insert into public.consents (user_id, kind, granted, version, source)
                    values ('a0000000-0000-4000-8000-000000000001', 'marketing_sms', true, '2026-09', 'settings') $$,
  '42501', null, 'a user cannot record consent for someone else');
select throws_ok($$ update public.consents set granted = false $$, '42501', null, 'consents cannot be updated');
select throws_ok($$ delete from public.consents $$, '42501', null, 'consents cannot be deleted');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select is_empty($$ select id from public.consents $$, 'a user cannot read others'' consents');

-- Platform admins
select is_empty($$ select user_id from public.platform_admins $$, 'non-admins cannot see the admin list');
select pg_temp.act_as('a0000000-0000-4000-8000-000000000009');
select isnt_empty($$ select user_id from public.platform_admins $$, 'admins can see the admin list');

select * from finish();
rollback;
