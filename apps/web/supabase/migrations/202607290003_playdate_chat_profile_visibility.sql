drop policy if exists play_date_participants_select_own on public.play_date_participants;
drop policy if exists play_date_participants_select_shared_public on public.play_date_participants;
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

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_chat_participants on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.play_date_participants participant
    join public.play_dates play_date on play_date.id = participant.play_date_id
    where participant.user_id = profiles.id
      and participant.status = 'joined'
      and play_date.visibility = 'public'
      and exists (
        select 1
        from public.play_date_participants viewer
        where viewer.play_date_id = participant.play_date_id
          and viewer.user_id = (select auth.uid())
          and viewer.status = 'joined'
      )
  )
);
