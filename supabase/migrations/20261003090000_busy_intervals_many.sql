-- "Available today" on result cards and Explore (docs/research/booking-apps-patterns.md):
-- busy times for many published businesses in one round trip. Same privacy as
-- get_busy_intervals(): staff ids and times only; no names, no reasons, no drafts.
create or replace function public.get_busy_intervals_many(p_business_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (business_id uuid, staff_id uuid, starts_at timestamptz, ends_at timestamptz, kind text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_business_ids is null or cardinality(p_business_ids) > 60 then
    raise exception 'ask for at most 60 businesses' using errcode = 'BZ422';
  end if;
  if p_to <= p_from or p_to - p_from > interval '3 days' then
    raise exception 'range must be positive and at most 3 days' using errcode = 'BZ422';
  end if;
  return query
  with visible as (
    -- Drafts and suspended businesses are silently left out (never an error that reveals them).
    select b.id from public.businesses b
    where b.id = any (p_business_ids) and b.status = 'published' and b.deleted_at is null
  )
  select a.business_id, a.staff_id, lower(a.occupied), upper(a.occupied), 'appointment'::text
  from public.appointments a
  where a.business_id in (select id from visible)
    and a.status in ('pending', 'confirmed', 'arrived', 'completed')
    and a.occupied && tstzrange(p_from, p_to, '[)')
  union all
  select bt.business_id, s.id, lower(bt.during), upper(bt.during), 'block'::text
  from public.blocked_times bt
  join public.staff s on s.business_id = bt.business_id and (bt.staff_id = s.id or bt.staff_id is null)
  where bt.business_id in (select id from visible)
    and s.deleted_at is null
    and bt.during && tstzrange(p_from, p_to, '[)');
end;
$$;

grant execute on function public.get_busy_intervals_many(uuid[], timestamptz, timestamptz) to anon, authenticated;
