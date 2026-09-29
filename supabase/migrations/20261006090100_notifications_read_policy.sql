-- Marking as read applies only to messages you can see (due, not withdrawn).
drop policy "mark own read" on public.notifications;
create policy "mark own read" on public.notifications for update to authenticated
  using (recipient_user_id = (select auth.uid()) and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now())
  with check (recipient_user_id = (select auth.uid()) and channel = 'in_app');
