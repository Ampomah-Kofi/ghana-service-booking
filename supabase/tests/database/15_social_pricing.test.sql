-- After Phase 7: social links on profiles (format rules, owners only, tenant isolation) and
-- "price on request" services (no amount, never a starting price in search).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

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

-- Kwame owns Kwame Cuts (b1); Ama owns Ama Braids (b2).
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ update public.businesses set instagram_handle = 'kwame.cuts', tiktok_handle = 'kwamecuts',
                   facebook_url = 'https://facebook.com/kwamecuts', website_url = 'https://kwamecuts.com'
                   where id = 'b0000000-0000-4000-8000-000000000001' $$, 'the owner adds social links');
select throws_ok($$ update public.businesses set instagram_handle = 'not a handle!' where id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'handles must look like handles');
select throws_ok($$ update public.businesses set facebook_url = 'https://evil.example/facebook.com' where id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'a Facebook link must be on facebook.com');
select throws_ok($$ update public.businesses set website_url = 'javascript:alert(1)' where id = 'b0000000-0000-4000-8000-000000000001' $$,
                 '23514', null, 'websites must be https');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000002');
update public.businesses set instagram_handle = 'hijacked' where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.act_as(null);
select is((select instagram_handle from public.businesses where id = 'b0000000-0000-4000-8000-000000000001'), 'kwame.cuts',
          'Business B cannot change Business A''s links; the public can read them');

-- Price on request.
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ insert into public.services (business_id, name, price_minor, price_type, duration_minutes, currency_code)
                    values ('b0000000-0000-4000-8000-000000000001', 'House call', 5000, 'on_request', 60, 'GHS') $$,
                 '23514', null, '"on request" carries no amount');
select lives_ok($$ insert into public.services (business_id, name, price_minor, price_type, duration_minutes, currency_code)
                   values ('b0000000-0000-4000-8000-000000000001', 'House call', 0, 'on_request', 60, 'GHS') $$,
                'an owner adds an on-request service');
select pg_temp.act_as(null);
select is((select min_price_minor from public.search_businesses('Kwame Cuts') where slug = 'kwame-cuts'), 3000,
          'on-request services never become the starting price');

-- A business whose only services are on request shows no starting price at all.
reset role;
update public.services set price_type = 'on_request', price_minor = 0
 where business_id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.act_as(null);
select is((select min_price_minor from public.search_businesses('Kwame Cuts') where slug = 'kwame-cuts'), null,
          'all on request: no "From GH₵ 0"');
select ok((select count(*) from public.categories where slug in ('electricians', 'djs-mcs', 'influencers-creators', 'tailors-fashion')) = 4,
          'trades and creator categories are seeded');

select * from finish();
rollback;
