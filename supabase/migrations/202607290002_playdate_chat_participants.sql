drop policy if exists play_date_participants_select_own on public.play_date_participants;
create policy play_date_participants_select_shared_public on public.play_date_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.play_dates play_date
    where play_date.id = play_date_id
      and play_date.visibility = 'public'
  )
);
