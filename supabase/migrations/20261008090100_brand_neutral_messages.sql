-- The app's name lives in src/lib/brand.ts ("Booker GH"); database messages don't repeat it.
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
      then 'You own a business here. Close it or hand it over before deleting your account.'
    when exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
      then 'Platform admin accounts are removed by another admin.'
    else null
  end;
$$;
