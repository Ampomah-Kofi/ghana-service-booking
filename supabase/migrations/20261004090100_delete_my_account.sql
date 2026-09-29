-- Self-service account deletion (SPEC §22, docs/architecture.md "Account deletion").
-- Runs as the signed-in user; no secret key involved (ADR-0002 unchanged).
--   - Booking records stay with the business (they're its business records) but the customer's
--     name, phone and note on them are replaced ("Deleted customer").
--   - Deleting the auth user cascades: profile, favourites, consents, memberships;
--     other links become null; reviews stay as "Former customer" (trigger in the previous migration).
create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_blocker text;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = 'BZ401';
  end if;
  v_blocker := public.account_deletion_blocker();
  if v_blocker is not null then
    raise exception '%', v_blocker using errcode = 'BZ422';
  end if;
  update public.appointments
     set customer_name = 'Deleted customer', customer_phone_e164 = null, customer_note = null
   where customer_user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
