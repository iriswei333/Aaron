alter table public.play_dates
  add column if not exists status text not null default 'upcoming'
    check (status in ('upcoming', 'cancelled'));

alter table public.play_dates
  add column if not exists last_change_summary text not null default '';

alter table public.play_date_participants
  drop constraint if exists play_date_participants_status_check;
alter table public.play_date_participants
  add constraint play_date_participants_status_check check (status in ('joined', 'declined'));

create index if not exists play_dates_status_starts_at_idx
  on public.play_dates (status, starts_at);

drop policy if exists play_dates_select_public_share on public.play_dates;
create policy play_dates_select_public_share on public.play_dates
for select
to anon
using (visibility = 'public' and status = 'upcoming' and ends_at >= now());

drop policy if exists play_date_participants_update_self on public.play_date_participants;
create policy play_date_participants_update_self on public.play_date_participants
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
