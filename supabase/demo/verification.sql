-- Demo data (local only, `pnpm db:demo`): Kwame Cuts is verified, Glow Nails has applied and waits.
-- Recorded in the audit log like a real decision (ADR-0015).
update public.businesses
   set verification_status = 'verified', verification_requested_at = now() - interval '3 days', verified_at = now() - interval '2 days'
 where slug = 'kwame-cuts' and verification_status <> 'verified';
insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
select 'a0000000-0000-4000-8000-000000000009', 'business.verification', 'businesses', b.id::text,
       'demo: called the owner, Ghana Card matches', '{"verification_status":"pending"}', '{"verification_status":"verified"}'
  from public.businesses b
 where b.slug = 'kwame-cuts'
   and not exists (select 1 from public.admin_actions a where a.target_id = b.id::text and a.action = 'business.verification');
update public.businesses
   set verification_status = 'pending', verification_requested_at = now() - interval '5 hours'
 where slug = 'glow-nails-east-legon' and verification_status = 'none';
