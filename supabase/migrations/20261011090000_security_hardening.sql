-- Phase 11 security hardening (docs/security.md).

-- 1. Least privilege on tables. Supabase's default grants give anon and authenticated every table
--    privilege; RLS blocks row writes, but TRUNCATE, REFERENCES and TRIGGER are not row-level and
--    nothing in the app needs them. Visitors who aren't signed in never write anything.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- And for tables created later by migrations (run as postgres).
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- 2. Every foreign key is indexed (deletes and joins on the referencing side stay fast).
create index if not exists payments_recorded_by on public.payments (recorded_by) where recorded_by is not null;
create index if not exists payments_refunded_by on public.payments (refunded_by) where refunded_by is not null;
create index if not exists business_payment_details_updated_by on public.business_payment_details (updated_by)
  where updated_by is not null;

-- 3. Rate limit: one person can report at most 20 reviews a day (the moderation queue stays usable).
create or replace function private.limit_review_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reporter_id is not null
     and (select count(*) from public.review_reports r
           where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports today; please try again tomorrow' using errcode = 'BZ429';
  end if;
  return new;
end;
$$;
create trigger review_reports_rate_limit before insert on public.review_reports
  for each row execute function private.limit_review_reports();
