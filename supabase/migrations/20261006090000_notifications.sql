-- Phase 8: notification outbox + in-app inbox (ADR-0006, ADR-0013, docs/plans/phase-8.md).
-- Messages are written by a trigger in the same transaction as the booking change and sent
-- later by the dispatcher (/api/internal/jobs/dispatch) through channel providers.

create type public.notification_channel as enum ('sms', 'whatsapp', 'email', 'in_app');
create type public.notification_status  as enum ('queued', 'sending', 'sent', 'failed', 'cancelled');

create table public.notifications (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid references public.businesses (id) on delete cascade,
  appointment_id       uuid references public.appointments (id) on delete cascade,
  recipient_user_id    uuid references public.profiles (id) on delete cascade,
  recipient_address    text check (char_length(recipient_address) <= 320),   -- phone (E.164) or email
  channel              public.notification_channel not null,
  template_key         text not null check (template_key ~ '^[a-z0-9_.]+$'),
  locale               text not null default 'en',
  payload              jsonb not null default '{}',
  status               public.notification_status not null default 'queued',
  scheduled_for        timestamptz not null default now(),
  attempts             smallint not null default 0,
  claimed_at           timestamptz,
  last_error           text check (char_length(last_error) <= 500),
  provider             text,
  provider_message_id  text,
  dedupe_key           text unique,
  sent_at              timestamptz,
  read_at              timestamptz,
  created_at           timestamptz not null default now(),
  check ((channel = 'in_app' and recipient_user_id is not null) or (channel <> 'in_app' and recipient_address is not null))
);
create index notifications_due on public.notifications (scheduled_for) where status = 'queued' and channel <> 'in_app';
create index notifications_inbox on public.notifications (recipient_user_id, scheduled_for desc) where channel = 'in_app';
create index notifications_appointment on public.notifications (appointment_id);
create index notifications_business on public.notifications (business_id);

alter table public.notifications enable row level security;
-- Your own in-app messages, once they're due (reminders appear at their time), unless withdrawn.
create policy "own in-app inbox" on public.notifications for select to authenticated
  using (recipient_user_id = (select auth.uid()) and channel = 'in_app' and status <> 'cancelled'
         and scheduled_for <= now());
create policy "admins read the outbox" on public.notifications for select to authenticated
  using ((select private.is_platform_admin()));
create policy "mark own read" on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()) and channel = 'in_app')
  with check (recipient_user_id = (select auth.uid()) and channel = 'in_app');
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Businesses choose whether new-booking alerts also go by SMS to the business phone.
alter table public.businesses add column notify_new_booking_sms boolean not null default true;
grant update (notify_new_booking_sms) on public.businesses to authenticated;

-- ---------------------------------------------------------------------------
-- Enqueueing (private; called by the appointments trigger)
-- ---------------------------------------------------------------------------

-- Everything a template needs, snapshotted at the time of the event.
create or replace function private.appointment_payload(a public.appointments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'appointment_id', a.id, 'business_id', b.id, 'business_name', b.name, 'business_slug', b.slug,
    'business_phone', b.phone_e164, 'timezone', b.timezone, 'service_name', a.service_name,
    'staff_name', st.display_name, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
    'customer_name', a.customer_name, 'price_minor', a.price_minor, 'price_type', a.price_type,
    'currency_code', a.currency_code, 'status', a.status, 'source', a.source)
  from public.businesses b
  left join public.staff st on st.id = a.staff_id
  where b.id = a.business_id;
$$;

create or replace function private.enqueue_notification(
  p_business_id uuid, p_appointment_id uuid, p_user uuid, p_address text,
  p_channel public.notification_channel, p_template text, p_payload jsonb, p_at timestamptz, p_dedupe text
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  -- In-app messages need no delivery: they are "sent" and simply appear at scheduled_for.
  insert into public.notifications (business_id, appointment_id, recipient_user_id, recipient_address, channel,
                                    template_key, payload, status, scheduled_for, sent_at, dedupe_key)
  values (p_business_id, p_appointment_id, p_user, p_address, p_channel, p_template, p_payload,
          case when p_channel = 'in_app' then 'sent' else 'queued' end::public.notification_status,
          p_at, case when p_channel = 'in_app' then p_at end, p_dedupe || ':' || p_channel::text)
  on conflict (dedupe_key) do nothing;
$$;

-- The customer: in-app if they have an account; one text (SMS by default, WhatsApp if chosen, or none);
-- email for the important ones when allowed. Guests and phone bookings: SMS to the number on the booking.
create or replace function private.notify_customer(a public.appointments, p_template text, p_at timestamptz,
                                                   p_key text, p_email boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := private.appointment_payload(a);
  v_prof    public.profiles;
  v_phone   text := a.customer_phone_e164;
  v_text    public.notification_channel;
begin
  if a.customer_user_id is not null then
    select * into v_prof from public.profiles p where p.id = a.customer_user_id;
    perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, null, 'in_app', p_template, v_payload, p_at, p_key);
    v_phone := coalesce(v_phone, v_prof.phone_e164);
    v_text := case when v_prof.notify_sms then 'sms' when v_prof.notify_whatsapp then 'whatsapp' end;
    if p_email and v_prof.notify_email and v_prof.email is not null then
      perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, v_prof.email, 'email', p_template, v_payload, p_at, p_key);
    end if;
  else
    v_text := 'sms';
  end if;
  if v_phone is not null and v_text is not null then
    perform private.enqueue_notification(a.business_id, a.id, a.customer_user_id, v_phone, v_text, p_template, v_payload, p_at, p_key);
  end if;
end;
$$;

-- The business: in-app to owners/managers and the person doing it (or only that person), never the
-- one who made the change; optionally an SMS to the business phone.
create or replace function private.notify_business(a public.appointments, p_template text, p_at timestamptz,
                                                   p_key text, p_sms boolean, p_staff_only boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := private.appointment_payload(a);
  v_user    uuid;
  v_staff   uuid := (select st.user_id from public.staff st where st.id = a.staff_id);
  v_biz     public.businesses;
begin
  for v_user in
    select distinct u from (
      select m.user_id as u from public.business_members m
       where m.business_id = a.business_id and m.role in ('owner', 'manager')
         and (not p_staff_only or v_staff is null)
      union all
      select v_staff where v_staff is not null
    ) x
    where u is not null and u is distinct from auth.uid()
  loop
    perform private.enqueue_notification(a.business_id, a.id, v_user, null, 'in_app', p_template, v_payload, p_at, p_key || ':' || v_user);
  end loop;
  if p_sms then
    select * into v_biz from public.businesses b where b.id = a.business_id;
    if v_biz.notify_new_booking_sms and v_biz.phone_e164 is not null then
      perform private.enqueue_notification(a.business_id, a.id, null, v_biz.phone_e164, 'sms', p_template, v_payload, p_at, p_key || ':biz');
    end if;
  end if;
end;
$$;

-- Withdraw everything not yet delivered for an appointment (queued texts, future in-app messages).
create or replace function private.cancel_pending_notifications(p_appointment_id uuid, p_template_like text default '%')
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications n
     set status = 'cancelled'
   where n.appointment_id = p_appointment_id
     and n.template_key like p_template_like
     and (n.status = 'queued' or (n.channel = 'in_app' and n.status = 'sent' and n.scheduled_for > now()));
$$;

-- Reminders 24 h and 2 h before (only if still meaningfully ahead), and a heads-up for the provider.
create or replace function private.schedule_reminders(a public.appointments)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_at text := extract(epoch from a.starts_at)::bigint::text;
begin
  if a.starts_at - interval '24 hours' > now() + interval '30 minutes' then
    perform private.notify_customer(a, 'reminder.day_before', a.starts_at - interval '24 hours', 'rem24:' || a.id || ':' || v_at, false);
  end if;
  if a.starts_at - interval '2 hours' > now() + interval '10 minutes' then
    perform private.notify_customer(a, 'reminder.soon', a.starts_at - interval '2 hours', 'rem2:' || a.id || ':' || v_at, false);
  end if;
  if a.starts_at - interval '30 minutes' > now() then
    perform private.notify_business(a, 'provider.upcoming', a.starts_at - interval '30 minutes', 'upc:' || a.id || ':' || v_at, false, true);
  end if;
end;
$$;

create or replace function private.appointments_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean;
begin
  if tg_op = 'INSERT' then
    if new.source = 'walk_in' then
      return null;
    end if;
    if new.rescheduled_from_id is not null then
      perform private.notify_customer(new, 'booking.moved', now(), 'moved:' || new.id, true);
      perform private.notify_business(new, 'provider.moved_by_customer', now(), 'moved:' || new.id, false, false);
    elsif new.status = 'confirmed' then
      perform private.notify_customer(new, 'booking.confirmed', now(), 'confirmed:' || new.id, true);
      if new.source = 'online' then
        perform private.notify_business(new, 'provider.new_booking', now(), 'new:' || new.id, true, false);
      end if;
    elsif new.status = 'pending' then
      perform private.notify_customer(new, 'booking.requested', now(), 'requested:' || new.id, false);
      perform private.notify_business(new, 'provider.needs_confirmation', now(), 'new:' || new.id, true, false);
    end if;
    if new.status = 'confirmed' then
      perform private.schedule_reminders(new);
    end if;
    return null;
  end if;

  -- UPDATE: status changes first.
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'confirmed' then
      perform private.notify_customer(new, 'booking.confirmed', now(), 'confirmed:' || new.id, true);
      perform private.schedule_reminders(new);
    elsif new.status = 'cancelled' then
      perform private.cancel_pending_notifications(new.id);
      if coalesce(new.cancellation_reason, '') <> 'Rescheduled' and old.status in ('pending', 'confirmed', 'arrived') then
        if new.cancelled_by is not null and new.cancelled_by = new.customer_user_id then
          perform private.notify_business(new, 'provider.cancelled_by_customer', now(), 'cancelled:' || new.id, true, false);
        elsif new.source <> 'walk_in' then
          perform private.notify_customer(new, 'booking.cancelled', now(), 'cancelled:' || new.id, true);
        end if;
      end if;
    elsif new.status = 'completed' then
      perform private.cancel_pending_notifications(new.id, 'reminder.%');
      perform private.cancel_pending_notifications(new.id, 'provider.upcoming');
      if new.customer_user_id is not null
         and not exists (select 1 from public.reviews r where r.appointment_id = new.id) then
        perform private.enqueue_notification(new.business_id, new.id, new.customer_user_id, null, 'in_app', 'review.request',
                                             private.appointment_payload(new), now() + interval '2 hours', 'review:' || new.id);
      end if;
    elsif new.status = 'no_show' then
      perform private.cancel_pending_notifications(new.id);
    elsif old.status = 'completed' then
      -- Completion undone: no rating prompt.
      perform private.cancel_pending_notifications(new.id, 'review.request');
    end if;
    return null;
  end if;

  -- Same status, new time or person (moved by the business).
  v_live := new.status in ('pending', 'confirmed');
  if v_live and (new.starts_at is distinct from old.starts_at or new.staff_id is distinct from old.staff_id) then
    perform private.cancel_pending_notifications(new.id);
    if new.source <> 'walk_in' then
      perform private.notify_customer(new, 'booking.moved', now(),
                                      'moved:' || new.id || ':' || extract(epoch from new.starts_at)::bigint || ':' || new.staff_id, true);
    end if;
    if new.status = 'confirmed' then
      perform private.schedule_reminders(new);
    end if;
  end if;
  return null;
end;
$$;

create trigger appointments_notify after insert or update of status, starts_at, staff_id on public.appointments
  for each row execute function private.appointments_notify();

-- ---------------------------------------------------------------------------
-- Dispatcher API (service role only: /api/internal/jobs/dispatch)
-- ---------------------------------------------------------------------------

-- Claim due texts/emails. Rows stuck in 'sending' for 10 minutes (a crashed run) are retried.
create or replace function public.claim_notifications(p_limit int default 50)
returns setof public.notifications
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.notifications set status = 'queued'
   where status = 'sending' and claimed_at < now() - interval '10 minutes';
  return query
  update public.notifications n
     set status = 'sending', attempts = n.attempts + 1, claimed_at = now()
   where n.id in (
     select q.id from public.notifications q
      where q.status = 'queued' and q.channel <> 'in_app' and q.scheduled_for <= now()
      order by q.scheduled_for
      limit greatest(1, least(p_limit, 200))
      for update skip locked)
  returning n.*;
end;
$$;

-- Record the outcome. Retries back off 1, 5, 15, 60 minutes; after 4 attempts it's failed.
create or replace function public.finish_notification(p_id uuid, p_ok boolean, p_provider text, p_message_id text,
                                                      p_error text, p_retryable boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications n
     set status = case when p_ok then 'sent'
                       when p_retryable and n.attempts < 4 then 'queued'
                       else 'failed' end::public.notification_status,
         sent_at = case when p_ok then now() else n.sent_at end,
         provider = p_provider,
         provider_message_id = p_message_id,
         last_error = case when p_ok then null else left(p_error, 500) end,
         scheduled_for = case when not p_ok and p_retryable and n.attempts < 4
                              then now() + (array[1, 5, 15, 60])[n.attempts] * interval '1 minute'
                              else n.scheduled_for end
   where n.id = p_id and n.status = 'sending';
$$;

revoke all on function public.claim_notifications(int) from public, anon, authenticated;
revoke all on function public.finish_notification(uuid, boolean, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.finish_notification(uuid, boolean, text, text, text, boolean) to service_role;
revoke all on function private.appointment_payload(public.appointments), private.enqueue_notification(uuid, uuid, uuid, text, public.notification_channel, text, jsonb, timestamptz, text),
  private.notify_customer(public.appointments, text, timestamptz, text, boolean),
  private.notify_business(public.appointments, text, timestamptz, text, boolean, boolean),
  private.cancel_pending_notifications(uuid, text), private.schedule_reminders(public.appointments)
  from public, anon, authenticated;
