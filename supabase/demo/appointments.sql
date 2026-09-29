-- Optional demo data for screenshots and previews: pnpm db:demo (after db:reset).
-- Not part of seed.sql, so database tests keep their empty calendars.
begin;
-- Demo appointments (Phase 6), relative to today so the calendar always has something to show.
-- Inserted directly as the seed runs with full privileges; the no-overlap constraint still applies.
insert into public.business_clients (business_id, user_id, full_name, phone_e164, notes)
values
  ('b0000000-0000-4000-8000-000000000001', null, 'Kojo Asare', '+233244111001', 'Low fade, keeps the top long'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'Yaw Adjei', '+233200000006', null),
  ('b0000000-0000-4000-8000-000000000001', null, 'Kwesi Appiah', '+233244111003', null),
  ('b0000000-0000-4000-8000-000000000001', null, 'Nana Ama Boateng', '+233244111004', 'Books for her son'),
  ('b0000000-0000-4000-8000-000000000002', null, 'Adwoa Mensah', '+233244222001', 'Sensitive scalp'),
  ('b0000000-0000-4000-8000-000000000002', null, 'Esi Owusu', '+233244222002', null);

with days as (
  select d::date as day from generate_series(current_date - 1, current_date + 6, interval '1 day') d
  where extract(isodow from d) <= 6
),
plan (at_time, service, customer, phone, source, pending) as (
  values ('09:00'::time, 'Low cut', 'Kojo Asare', '+233244111001', 'online', false),
         ('10:00', 'Skin fade', 'Yaw Adjei', '+233200000006', 'online', false),
         ('11:30', 'Beard trim', 'Walk-in', null, 'walk_in', false),
         ('13:00', 'Skin fade', 'Kwesi Appiah', '+233244111003', 'manual', false),
         ('15:30', 'Low cut', 'Nana Ama Boateng', '+233244111004', 'online', true)
)
insert into public.appointments (business_id, service_id, staff_id, client_id, customer_user_id, status, source,
  starts_at, ends_at, service_name, price_minor, price_type, currency_code, customer_name, customer_phone_e164, created_by)
select 'b0000000-0000-4000-8000-000000000001', sv.id, st.id, c.id, c.user_id,
  (case
     when (d.day + p.at_time) at time zone 'Africa/Accra' < now() then
       case when p.at_time = '13:00' and d.day < current_date then 'no_show' else 'completed' end
     when p.pending then 'pending'
     else 'confirmed'
   end)::public.appointment_status,
  p.source::public.appointment_source,
  (d.day + p.at_time) at time zone 'Africa/Accra',
  (d.day + p.at_time) at time zone 'Africa/Accra' + make_interval(mins => sv.duration_minutes),
  sv.name, sv.price_minor, sv.price_type, sv.currency_code, p.customer, p.phone,
  'a0000000-0000-4000-8000-000000000001'
from days d cross join plan p
join public.services sv on sv.business_id = 'b0000000-0000-4000-8000-000000000001' and sv.name = p.service
join public.staff st on st.business_id = 'b0000000-0000-4000-8000-000000000001'
left join public.business_clients c on c.business_id = 'b0000000-0000-4000-8000-000000000001' and c.phone_e164 = p.phone
where p.source <> 'walk_in' or d.day <= current_date;

-- Ama Braids (team): Ama and Efua in parallel on open days (Tue–Sun).
with days as (
  select d::date as day from generate_series(current_date, current_date + 6, interval '1 day') d
  where extract(isodow from d) between 2 and 7
),
plan (staff_name, at_time, service, customer, phone) as (
  values ('Ama', '09:00'::time, 'Twists', 'Adwoa Mensah', '+233244222001'),
         ('Efua', '10:00', 'Knotless braids (medium)', 'Esi Owusu', '+233244222002'),
         ('Ama', '14:30', 'Loc retwist', 'Adwoa Mensah', '+233244222001')
)
insert into public.appointments (business_id, service_id, staff_id, client_id, status, source,
  starts_at, ends_at, service_name, price_minor, price_type, currency_code, customer_name, customer_phone_e164, created_by)
select 'b0000000-0000-4000-8000-000000000002', sv.id, st.id, c.id,
  (case when (d.day + p.at_time) at time zone 'Africa/Accra' < now() then 'completed' else 'confirmed' end)::public.appointment_status,
  'online',
  (d.day + p.at_time) at time zone 'Africa/Accra',
  (d.day + p.at_time) at time zone 'Africa/Accra' + make_interval(mins => sv.duration_minutes),
  sv.name, sv.price_minor, sv.price_type, sv.currency_code, p.customer, p.phone,
  'a0000000-0000-4000-8000-000000000002'
from days d cross join plan p
join public.services sv on sv.business_id = 'b0000000-0000-4000-8000-000000000002' and sv.name = p.service
join public.staff st on st.business_id = 'b0000000-0000-4000-8000-000000000002' and st.display_name = p.staff_name
left join public.business_clients c on c.business_id = 'b0000000-0000-4000-8000-000000000002' and c.phone_e164 = p.phone
where p.staff_name <> 'Efua' or extract(isodow from d.day) <= 6;  -- Efua works Tue–Sat
commit;
