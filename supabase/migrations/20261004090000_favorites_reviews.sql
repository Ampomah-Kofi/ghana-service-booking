-- Phase 7: favourites, verified reviews (with business replies, reports, moderation),
-- rating totals, photos per service, and the account-deletion check.
-- docs/data-model.md §3, SPEC §15, §22.

-- ---------------------------------------------------------------------------
-- Favourites: private to the customer (a business can't see who saved it).
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index favorites_business on public.favorites (business_id);
create index favorites_user_recent on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;
create policy "users read own favourites" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
-- Only published businesses can be saved.
create policy "users add own favourites" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_published_business(business_id)));
create policy "users remove own favourites" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.favorites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reviews: one per completed appointment, written only by its customer through
-- submit_review(). Snapshots (author, service, staff, visit date) so the review
-- still reads right after renames or account deletion.
-- ---------------------------------------------------------------------------
create type public.review_status as enum ('published', 'hidden', 'removed');

create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  appointment_id  uuid not null unique references public.appointments (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  author_name     text not null check (char_length(author_name) between 1 and 60),
  service_name    text not null,
  staff_name      text,
  visited_on      date not null,
  rating          smallint not null check (rating between 1 and 5),
  body            text check (char_length(body) <= 1000),
  status          public.review_status not null default 'published',
  moderation_note text check (char_length(moderation_note) <= 500),
  reply_body      text check (char_length(reply_body) between 1 and 1000),
  reply_by        uuid references public.profiles (id) on delete set null,
  replied_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((reply_body is null) = (replied_at is null))
);
create index reviews_business_published on public.reviews (business_id, created_at desc) where status = 'published';
create index reviews_user on public.reviews (user_id, created_at desc) where user_id is not null;
create index reviews_reply_by on public.reviews (reply_by);
create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

-- When the author deletes their account (user_id → null by the FK), the review stays, anonymised.
create or replace function private.reviews_anonymise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.author_name := 'Former customer';
  end if;
  return new;
end;
$$;
create trigger reviews_anonymise before update of user_id on public.reviews
  for each row execute function private.reviews_anonymise();

-- Rating totals on businesses: published reviews only. Read model, never used for authorization.
create or replace function private.refresh_business_rating(p_business_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.businesses b
     set rating_count = s.n,
         rating_avg   = case when s.n = 0 then null else round(s.avg, 2) end
    from (select count(*)::int as n, avg(r.rating)::numeric as avg
            from public.reviews r
           where r.business_id = p_business_id and r.status = 'published') s
   where b.id = p_business_id;
$$;
revoke all on function private.refresh_business_rating(uuid) from public, anon, authenticated;

create or replace function private.reviews_refresh_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_business_rating(coalesce(new.business_id, old.business_id));
  return null;
end;
$$;
revoke all on function private.reviews_refresh_rating() from public, anon, authenticated;
create trigger reviews_refresh_rating after insert or delete or update of rating, status on public.reviews
  for each row execute function private.reviews_refresh_rating();

alter table public.reviews enable row level security;
-- Public: published reviews of published businesses. Author: their own, whatever the status.
-- Members: every review of their business (they may need to see why one was hidden). Admins: all.
create policy "public reads published; author, members and admins read more" on public.reviews
  for select to anon, authenticated
  using ((status = 'published' and (select private.is_published_business(business_id)))
         or user_id = (select auth.uid())
         or (select private.is_business_member(business_id))
         or (select private.is_platform_admin()));
-- No insert/update/delete policies: every write goes through the functions below.
revoke insert, update, delete on public.reviews from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports: anyone signed in can flag a review once. Moderators resolve them.
-- ---------------------------------------------------------------------------
create table public.review_reports (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.reviews (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  reporter_id  uuid references public.profiles (id) on delete set null,
  reason       text not null check (reason in ('spam', 'offensive', 'not_genuine', 'private_info', 'other')),
  details      text check (char_length(details) <= 500),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (review_id, reporter_id)
);
create index review_reports_open on public.review_reports (created_at) where resolved_at is null;
create index review_reports_business on public.review_reports (business_id);
create index review_reports_reporter on public.review_reports (reporter_id);
create index review_reports_resolved_by on public.review_reports (resolved_by);

alter table public.review_reports enable row level security;
create policy "reporters read own; admins read all" on public.review_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_platform_admin()));
revoke insert, update, delete on public.review_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photos per service: a portfolio photo can point at one of the business's services.
-- Deleting (soft) a service keeps the photo; hard delete clears the link.
-- ---------------------------------------------------------------------------
alter table public.business_photos add column service_id uuid;
alter table public.business_photos
  add constraint business_photos_service_fk foreign key (business_id, service_id)
  references public.services (business_id, id) on delete set null (service_id);
create index business_photos_service on public.business_photos (service_id) where service_id is not null;
grant update (service_id) on public.business_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- "Kofi A." from "Kofi Asante"; falls back to the booking name.
create or replace function private.review_author_name(p_full_name text, p_fallback text)
returns text
language sql
immutable
set search_path = ''
as $$
  with n as (select regexp_split_to_array(trim(coalesce(nullif(trim(p_full_name), ''), p_fallback, 'Customer')), '\s+') as parts)
  select left(case when array_length(parts, 1) > 1
                   then parts[1] || ' ' || left(parts[array_length(parts, 1)], 1) || '.'
                   else parts[1] end, 60)
    from n;
$$;

-- Customer reviews their own completed appointment. One per appointment.
create or replace function public.submit_review(p_appointment_id uuid, p_rating int, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_a    record;
  v_name text;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'sign in to leave a review' using errcode = 'BZ401';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'choose 1 to 5 stars' using errcode = 'BZ422';
  end if;
  if char_length(coalesce(p_body, '')) > 1000 then
    raise exception 'keep your review under 1000 characters' using errcode = 'BZ422';
  end if;

  select a.id, a.business_id, a.customer_user_id, a.status, a.service_name, a.customer_name, a.starts_at,
         st.display_name as staff_name, b.timezone
    into v_a
    from public.appointments a
    join public.businesses b on b.id = a.business_id
    left join public.staff st on st.id = a.staff_id
   where a.id = p_appointment_id
   for update of a;
  -- Someone else's booking looks the same as a missing one.
  if v_a.id is null or v_a.customer_user_id is distinct from v_uid then
    raise exception 'booking not found' using errcode = 'BZ404';
  end if;
  if v_a.status <> 'completed' then
    raise exception 'you can review a visit once it has been completed' using errcode = 'BZ422';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = v_uid;
  begin
    insert into public.reviews (business_id, appointment_id, user_id, author_name, service_name, staff_name,
                                visited_on, rating, body)
    values (v_a.business_id, v_a.id, v_uid, private.review_author_name(v_name, v_a.customer_name), v_a.service_name,
            v_a.staff_name, (v_a.starts_at at time zone v_a.timezone)::date, p_rating, nullif(trim(p_body), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'you have already reviewed this visit' using errcode = 'BZ409';
  end;
  return v_id;
end;
$$;

-- The author can change stars and text for 14 days after posting (not once hidden or removed).
create or replace function public.update_review(p_review_id uuid, p_rating int, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_r   record;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'choose 1 to 5 stars' using errcode = 'BZ422';
  end if;
  if char_length(coalesce(p_body, '')) > 1000 then
    raise exception 'keep your review under 1000 characters' using errcode = 'BZ422';
  end if;
  select r.id, r.user_id, r.status, r.created_at into v_r from public.reviews r where r.id = p_review_id for update;
  if v_r.id is null or v_r.user_id is distinct from v_uid then
    raise exception 'review not found' using errcode = 'BZ404';
  end if;
  if v_r.status <> 'published' then
    raise exception 'this review can no longer be changed' using errcode = 'BZ422';
  end if;
  if v_r.created_at < now() - interval '14 days' then
    raise exception 'reviews can be changed for 14 days after posting' using errcode = 'BZ422';
  end if;
  update public.reviews set rating = p_rating, body = nullif(trim(p_body), '') where id = p_review_id;
end;
$$;

-- Owners and managers post (or edit) the business's one public reply.
create or replace function public.reply_to_review(p_review_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_r   record;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  select r.id, r.business_id, r.status into v_r from public.reviews r where r.id = p_review_id for update;
  if v_r.id is null or not private.is_business_member(v_r.business_id) then
    raise exception 'review not found' using errcode = 'BZ404';
  end if;
  if not private.can_manage_business(v_r.business_id) then
    raise exception 'only owners and managers can reply to reviews' using errcode = 'BZ403';
  end if;
  if v_r.status = 'removed' then
    raise exception 'this review was removed' using errcode = 'BZ422';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'write a reply of up to 1000 characters' using errcode = 'BZ422';
  end if;
  update public.reviews
     set reply_body = trim(p_body), reply_by = v_uid, replied_at = now()
   where id = p_review_id;
end;
$$;

-- Anyone signed in can report a published review once (not their own).
create or replace function public.report_review(p_review_id uuid, p_reason text, p_details text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_r   record;
begin
  if v_uid is null then
    raise exception 'sign in to report a review' using errcode = 'BZ401';
  end if;
  select r.id, r.business_id, r.user_id, r.status into v_r from public.reviews r where r.id = p_review_id;
  if v_r.id is null or (v_r.status <> 'published' and not private.is_business_member(v_r.business_id)) then
    raise exception 'review not found' using errcode = 'BZ404';
  end if;
  if v_r.user_id = v_uid then
    raise exception 'you can edit your own review instead' using errcode = 'BZ422';
  end if;
  if p_reason is null or p_reason not in ('spam', 'offensive', 'not_genuine', 'private_info', 'other') then
    raise exception 'choose a reason' using errcode = 'BZ422';
  end if;
  begin
    insert into public.review_reports (review_id, business_id, reporter_id, reason, details)
    values (v_r.id, v_r.business_id, v_uid, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), ''));
  exception when unique_violation then
    raise exception 'you have already reported this review' using errcode = 'BZ409';
  end;
end;
$$;

-- Platform moderators hide, restore or remove a review; closes its open reports. Audited.
create or replace function public.admin_moderate_review(p_review_id uuid, p_status public.review_status, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := private.require_admin(array['super_admin', 'moderator']::public.admin_role[]);
  v_before jsonb;
  v_after  jsonb;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason for the audit log' using errcode = 'BZ422';
  end if;
  select to_jsonb(r) - 'body' - 'reply_body' into v_before from public.reviews r where r.id = p_review_id;
  if v_before is null then
    raise exception 'review not found' using errcode = 'BZ404';
  end if;
  update public.reviews set status = p_status, moderation_note = left(trim(p_reason), 500) where id = p_review_id;
  update public.review_reports set resolved_at = now(), resolved_by = v_admin
   where review_id = p_review_id and resolved_at is null;
  select to_jsonb(r) - 'body' - 'reply_body' into v_after from public.reviews r where r.id = p_review_id;
  insert into public.admin_actions (admin_user_id, action, target_table, target_id, reason, before, after)
  values (v_admin, 'review.moderate', 'reviews', p_review_id::text, trim(p_reason), v_before, v_after);
end;
$$;

-- Why the signed-in user can't delete their account yet (null = they can). The deletion itself
-- runs server-side with the service key after this check (src/server/account). Businesses and the
-- admin audit log keep their creator, so those accounts must hand over first.
create or replace function public.account_deletion_blocker()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'sign in first'
    when exists (select 1 from public.businesses b where b.created_by = auth.uid() and b.deleted_at is null)
      then 'You own a business on Hyia. Close it or hand it over before deleting your account.'
    when exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
      then 'Platform admin accounts are removed by another admin.'
    else null
  end;
$$;

revoke all on function public.submit_review(uuid, int, text) from public, anon;
revoke all on function public.update_review(uuid, int, text) from public, anon;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
revoke all on function public.report_review(uuid, text, text) from public, anon;
revoke all on function public.admin_moderate_review(uuid, public.review_status, text) from public, anon;
revoke all on function public.account_deletion_blocker() from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;
grant execute on function public.update_review(uuid, int, text) to authenticated;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
grant execute on function public.report_review(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_review(uuid, public.review_status, text) to authenticated;
grant execute on function public.account_deletion_blocker() to authenticated;
