-- Phase 5: appointments and online booking. Double-booking prevention: ADR-0003.

create type public.appointment_status as enum ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('online', 'manual', 'walk_in');
create type public.payment_status     as enum ('pending', 'paid', 'partially_paid', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- A business's own record of a customer (covers walk-ins without accounts later).
-- ---------------------------------------------------------------------------
create table public.business_clients (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete set null,
  full_name    text not null check (char_length(full_name) between 1 and 120),
  phone_e164   text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, id)
);
create unique index business_clients_user on public.business_clients (business_id, user_id) where user_id is not null;
create unique index business_clients_phone on public.business_clients (business_id, phone_e164) where phone_e164 is not null;
create index business_clients_user_id on public.business_clients (user_id);
create trigger business_clients_set_updated_at before update on public.business_clients
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Appointments: one service × one staff member × one time range.
-- ---------------------------------------------------------------------------
create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses (id),
  service_id             uuid not null,
  staff_id               uuid not null,
  client_id              uuid,
  customer_user_id       uuid references public.profiles (id) on delete set null,
  status                 public.appointment_status not null default 'pending',
  source                 public.appointment_source not null,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  buffer_before_minutes  smallint not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes   smallint not null default 0 check (buffer_after_minutes between 0 and 240),
  occupied               tstzrange not null,   -- [starts - before, ends + after), set by trigger
  -- Snapshots: the record stays correct after price changes or account deletion.
  service_name           text not null,
  price_minor            int not null check (price_minor >= 0),
  price_type             public.price_type not null,
  currency_code          char(3) not null references public.currencies (code),
  deposit_minor          int check (deposit_minor > 0),
  customer_name          text not null check (char_length(customer_name) between 1 and 120),
  customer_phone_e164    text check (customer_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  customer_note          text check (char_length(customer_note) <= 500),
  payment_status         public.payment_status,   -- null = nothing to pay in advance
  idempotency_key        text check (char_length(idempotency_key) between 8 and 100),
  rescheduled_from_id    uuid references public.appointments (id),
  cancelled_at           timestamptz,
  cancelled_by           uuid references public.profiles (id) on delete set null,
  cancellation_reason    text check (char_length(cancellation_reason) <= 200),
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, staff_id) references public.staff (business_id, id),
  foreign key (business_id, service_id) references public.services (business_id, id),
  foreign key (business_id, client_id) references public.business_clients (business_id, id),

  -- ★ The double-booking guarantee (ADR-0003): no two live appointments of the same
  -- staff member may overlap, buffers included, whoever writes them.
  constraint appointments_no_overlap exclude using gist (staff_id with =, occupied with &&)
    where (status in ('pending', 'confirmed', 'arrived', 'completed'))
);
create index appointments_business_starts on public.appointments (business_id, starts_at);
create index appointments_staff_starts on public.appointments (staff_id, starts_at);
create index appointments_customer on public.appointments (customer_user_id, starts_at desc) where customer_user_id is not null;
create index appointments_service_id on public.appointments (service_id);
create index appointments_client_id on public.appointments (client_id);
create index appointments_business_staff on public.appointments (business_id, staff_id);
create index appointments_business_service on public.appointments (business_id, service_id);
create index appointments_business_client on public.appointments (business_id, client_id);
create index appointments_currency_code on public.appointments (currency_code);
create index appointments_rescheduled_from on public.appointments (rescheduled_from_id);
create index appointments_cancelled_by on public.appointments (cancelled_by);
create index appointments_created_by on public.appointments (created_by, created_at);
create unique index appointments_idempotency on public.appointments (created_by, idempotency_key) where idempotency_key is not null;

create or replace function private.appointments_set_occupied()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.occupied := tstzrange(
    new.starts_at - make_interval(mins => new.buffer_before_minutes),
    new.ends_at + make_interval(mins => new.buffer_after_minutes),
    '[)');
  return new;
end;
$$;
create trigger appointments_occupied before insert or update of starts_at, ends_at, buffer_before_minutes, buffer_after_minutes
  on public.appointments for each row execute function private.appointments_set_occupied();
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();

-- Every status change is recorded (SPEC §8).
create table public.appointment_status_history (
  id              bigint generated always as identity primary key,
  business_id     uuid not null references public.businesses (id),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  from_status     public.appointment_status,
  to_status       public.appointment_status not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  reason          text,
  created_at      timestamptz not null default now()
);
create index appointment_status_history_appt on public.appointment_status_history (appointment_id, created_at);
create index appointment_status_history_business on public.appointment_status_history (business_id);
create index appointment_status_history_changed_by on public.appointment_status_history (changed_by);

create or replace function private.appointments_log_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.appointment_status_history (business_id, appointment_id, from_status, to_status, changed_by, reason)
    values (new.business_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(),
            nullif(current_setting('app.status_reason', true), ''));
  end if;
  return new;
end;
$$;
create trigger appointments_status_history after insert or update of status on public.appointments
  for each row execute function private.appointments_log_status();

-- ---------------------------------------------------------------------------
-- RLS: three audiences, no direct writes (functions only).
-- ---------------------------------------------------------------------------
alter table public.business_clients           enable row level security;
alter table public.appointments               enable row level security;
alter table public.appointment_status_history enable row level security;

create policy "managers manage clients" on public.business_clients for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "managers update client notes" on public.business_clients for update to authenticated
  using ((select private.can_manage_business(business_id))) with check ((select private.can_manage_business(business_id)));
revoke update on public.business_clients from anon, authenticated;
grant update (full_name, notes) on public.business_clients to authenticated;

create policy "managers read" on public.appointments for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "staff read their own" on public.appointments for select to authenticated
  using (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid())));
create policy "customers read their own" on public.appointments for select to authenticated
  using (customer_user_id = (select auth.uid()));

create policy "managers read" on public.appointment_status_history for select to authenticated
  using ((select private.can_manage_business(business_id)));
create policy "customers read their own" on public.appointment_status_history for select to authenticated
  using (appointment_id in (select a.id from public.appointments a where a.customer_user_id = (select auth.uid())));
