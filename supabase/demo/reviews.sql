-- Local demo only (not a migration, not the seed): past visits with reviews and a reply, so the
-- business pages and the provider's Reviews screen have something to show. Rerunnable.
-- Load after appointments: pnpm db:demo (runs both files).
begin;
delete from public.appointments where cancellation_reason = 'demo-review';

with v (business_id, staff_name, service, days_ago, author, rating, body, reply) as (
  values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'Kwame', 'Skin fade', 9, 'Kofi B.', 5,
   'Cleanest fade in East Legon. On time and the shop is tidy.', 'Thanks Kofi! See you in two weeks.'),
  ('b0000000-0000-4000-8000-000000000001', 'Kwame', 'Low cut', 16, 'Nana A.', 5, 'Quick, sharp line-up. Booking online is so easy.', null),
  ('b0000000-0000-4000-8000-000000000001', 'Kwame', 'Beard trim', 23, 'Selasi K.', 4, 'Good trim, had to wait about 10 minutes.', 'Sorry about the wait, Selasi. We have added more time between bookings.'),
  ('b0000000-0000-4000-8000-000000000002', 'Ama', 'Knotless braids (medium)', 12, 'Adwoa M.', 5, 'Neat parts and they lasted six weeks. Ama is gentle.', 'Medaase Adwoa!'),
  ('b0000000-0000-4000-8000-000000000002', 'Efua', 'Twists', 20, 'Esi O.', 4, 'Lovely twists. Bring a snack, it takes a while!', null)
),
ins as (
  insert into public.appointments (business_id, service_id, staff_id, status, source, starts_at, ends_at, service_name,
    price_minor, price_type, currency_code, customer_name, cancellation_reason)
  select v.business_id, sv.id, st.id, 'completed', 'online',
    (current_date - v.days_ago + time '10:00') at time zone 'Africa/Accra',
    (current_date - v.days_ago + time '10:00') at time zone 'Africa/Accra' + make_interval(mins => sv.duration_minutes),
    sv.name, sv.price_minor, sv.price_type, sv.currency_code, v.author, 'demo-review'
  from v
  join public.services sv on sv.business_id = v.business_id and sv.name = v.service
  join public.staff st on st.business_id = v.business_id and st.display_name = v.staff_name
  returning id, business_id, customer_name, starts_at, service_name, staff_id
)
insert into public.reviews (business_id, appointment_id, author_name, service_name, staff_name, visited_on, rating, body,
                            reply_body, replied_at, created_at)
select i.business_id, i.id, v.author, i.service_name, v.staff_name, (i.starts_at at time zone 'Africa/Accra')::date,
       v.rating, v.body, v.reply, case when v.reply is not null then now() - make_interval(days => v.days_ago - 1) end,
       now() - make_interval(days => v.days_ago - 1)
from ins i join v on v.business_id = i.business_id and v.author = i.customer_name;

-- Yaw (0200000006) had a cut three days ago and hasn't rated it yet: shows the "Rate" prompt.
insert into public.appointments (business_id, service_id, staff_id, status, source, starts_at, ends_at, service_name,
  price_minor, price_type, currency_code, customer_name, customer_phone_e164, customer_user_id, cancellation_reason)
select sv.business_id, sv.id, st.id, 'completed', 'online',
  (current_date - 3 + time '16:00') at time zone 'Africa/Accra',
  (current_date - 3 + time '16:00') at time zone 'Africa/Accra' + make_interval(mins => sv.duration_minutes),
  sv.name, sv.price_minor, sv.price_type, sv.currency_code, 'Yaw Adjei', '+233200000006',
  'a0000000-0000-4000-8000-000000000006', 'demo-review'
from public.services sv
join public.staff st on st.business_id = sv.business_id and st.display_name = 'Kwame'
where sv.business_id = 'b0000000-0000-4000-8000-000000000001' and sv.name = 'Skin fade';
commit;
