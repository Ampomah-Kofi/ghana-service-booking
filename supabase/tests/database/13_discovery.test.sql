-- "Available today": busy times for many businesses at once, without leaking drafts or details.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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

-- Deterministic on any local database (demo data, E2E leftovers); rolled back at the end.
delete from public.payment_events;
delete from public.payments;
delete from public.appointments;

-- One booking at the published Kwame Cuts and one at the draft Osu Glow Spa, tomorrow at 10:00.
insert into public.appointments (business_id, service_id, staff_id, source, starts_at, ends_at,
                                 service_name, price_minor, price_type, currency_code, customer_name)
select s.business_id, sv.id, s.id, 'manual',
       (current_date + 1 + time '10:00') at time zone 'Africa/Accra',
       (current_date + 1 + time '10:30') at time zone 'Africa/Accra',
       sv.name, sv.price_minor, sv.price_type, sv.currency_code, 'Private Name'
from public.staff s
join public.staff_services ss on ss.staff_id = s.id
join public.services sv on sv.id = ss.service_id
where s.business_id in ('b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003')
  and s.display_name in ('Kwame', 'Kojo')
  and sv.name in ('Low cut', 'Deep tissue massage');

select pg_temp.act_as(null);
select results_eq(
  $$ select business_id, kind from public.get_busy_intervals_many(
       array['b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003']::uuid[],
       now(), now() + interval '2 days') $$,
  $$ values ('b0000000-0000-4000-8000-000000000001'::uuid, 'appointment') $$,
  'anyone gets busy times for published businesses; drafts are silently left out');
select is(
  (select count(*)::int from information_schema.routines r
   join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_name = 'get_busy_intervals_many' and p.parameter_mode = 'OUT'
     and p.parameter_name not in ('business_id', 'staff_id', 'starts_at', 'ends_at', 'kind')),
  0, 'only ids and times come back: no customer names, services or reasons');
select throws_ok(
  $$ select * from public.get_busy_intervals_many(array_fill(gen_random_uuid(), array[61]), now(), now() + interval '1 day') $$,
  'BZ422', null, 'at most 60 businesses per call');
select throws_ok(
  $$ select * from public.get_busy_intervals_many(array['b0000000-0000-4000-8000-000000000001']::uuid[], now(), now() + interval '4 days') $$,
  'BZ422', null, 'the range is capped at 3 days');
select is_empty(
  $$ select * from public.get_busy_intervals_many('{}'::uuid[], now(), now() + interval '1 day') $$,
  'an empty list returns nothing');

select * from finish();
rollback;
