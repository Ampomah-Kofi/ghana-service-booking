-- Where a business gets paid (ADR-0017). Online payments go from the customer, through the provider,
-- to this account; the platform never holds the money. Sensitive: only the owner and platform admins
-- can read it, and it's written only through set_payout_account (owner).
create type public.payout_method as enum ('mobile_money', 'bank');

create table public.business_payout_accounts (
  business_id          uuid primary key references public.businesses (id) on delete cascade,
  method               public.payout_method not null,
  account_name         text not null check (char_length(account_name) between 2 and 120),
  momo_network         text check (momo_network in ('mtn', 'telecel', 'airteltigo')),
  momo_number_e164     text check (momo_number_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  bank_name            text check (char_length(bank_name) between 2 and 80),
  bank_account_number  text check (bank_account_number ~ '^[0-9]{6,20}$'),
  -- Set when the chosen provider has registered the account (e.g. a subaccount); service role only.
  provider_account_ref text check (char_length(provider_account_ref) <= 200),
  status               text not null default 'unverified' check (status in ('unverified', 'verified')),
  updated_by           uuid references public.profiles (id) on delete set null,
  updated_at           timestamptz not null default now(),
  check (method <> 'mobile_money' or (momo_network is not null and momo_number_e164 is not null
                                      and bank_name is null and bank_account_number is null)),
  check (method <> 'bank' or (bank_name is not null and bank_account_number is not null
                              and momo_network is null and momo_number_e164 is null))
);
alter table public.business_payout_accounts enable row level security;
create policy "owner or admin reads" on public.business_payout_accounts for select to authenticated
  using ((select private.is_business_owner(business_id)) or (select private.is_platform_admin()));
revoke all on public.business_payout_accounts from anon;
grant select on public.business_payout_accounts to authenticated;

create or replace function public.set_payout_account(
  p_business_id uuid, p_method public.payout_method, p_account_name text,
  p_momo_network text default null, p_momo_number text default null,
  p_bank_name text default null, p_bank_account_number text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_business_owner(p_business_id) then
    raise exception 'only the owner can set where the business gets paid' using errcode = 'BZ403';
  end if;
  insert into public.business_payout_accounts as a (business_id, method, account_name, momo_network, momo_number_e164,
                                                    bank_name, bank_account_number, updated_by, status, provider_account_ref)
  values (p_business_id, p_method, trim(p_account_name),
          case when p_method = 'mobile_money' then p_momo_network end,
          case when p_method = 'mobile_money' then p_momo_number end,
          case when p_method = 'bank' then nullif(trim(p_bank_name), '') end,
          case when p_method = 'bank' then regexp_replace(coalesce(p_bank_account_number, ''), '\s', '', 'g') end,
          auth.uid(), 'unverified', null)
  on conflict (business_id) do update
    set method = excluded.method, account_name = excluded.account_name, momo_network = excluded.momo_network,
        momo_number_e164 = excluded.momo_number_e164, bank_name = excluded.bank_name,
        bank_account_number = excluded.bank_account_number, updated_by = excluded.updated_by, updated_at = now(),
        -- New details must be registered with the provider again.
        status = 'unverified', provider_account_ref = null;
exception when check_violation then
  raise exception 'check the payout details' using errcode = 'BZ422';
end;
$$;
revoke all on function public.set_payout_account(uuid, public.payout_method, text, text, text, text, text) from public, anon;
grant execute on function public.set_payout_account(uuid, public.payout_method, text, text, text, text, text) to authenticated;

-- Online payments need somewhere for the money to go.
create or replace function private.booking_rules_need_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.collect_deposits_online or new.allow_full_payment_online)
     and not (coalesce(old.collect_deposits_online, false) or coalesce(old.allow_full_payment_online, false))
     and not exists (select 1 from public.business_payout_accounts p where p.business_id = new.business_id) then
    raise exception 'add where you get paid first' using errcode = 'BZ409';
  end if;
  return new;
end;
$$;
create trigger booking_rules_need_payout before update of collect_deposits_online, allow_full_payment_online
  on public.booking_rules for each row execute function private.booking_rules_need_payout();
