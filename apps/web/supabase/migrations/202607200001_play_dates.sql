create extension if not exists pgcrypto;

create table if not exists public.play_dates (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  playground_key text not null,
  playground_name text not null,
  playground_type text not null default '',
  playground_address text not null default '',
  playground_latitude double precision,
  playground_longitude double precision,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  notes text not null default '',
  age_range text not null default '',
  max_families integer check (max_families between 2 and 20),
  participant_count integer not null default 0 check (participant_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.play_date_participants (
  play_date_id uuid not null references public.play_dates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'guest' check (role in ('host', 'guest')),
  status text not null default 'joined' check (status in ('joined')),
  joined_at timestamptz not null default now(),
  primary key (play_date_id, user_id)
);

create index if not exists play_dates_public_playground_starts_at_idx
  on public.play_dates (playground_key, starts_at)
  where visibility = 'public';

create index if not exists play_dates_host_starts_at_idx
  on public.play_dates (host_user_id, starts_at desc);

create index if not exists play_date_participants_user_id_idx
  on public.play_date_participants (user_id, joined_at desc);

drop trigger if exists play_dates_set_updated_at on public.play_dates;
create trigger play_dates_set_updated_at
before update on public.play_dates
for each row
execute function public.set_updated_at();

create or replace function public.enforce_play_date_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  family_limit integer;
  family_count integer;
begin
  if new.status <> 'joined' then
    return new;
  end if;

  select max_families, participant_count
  into family_limit, family_count
  from public.play_dates
  where id = new.play_date_id
  for update;

  if family_limit is not null and family_count >= family_limit then
    raise exception 'This play date is already full.';
  end if;

  return new;
end;
$$;

drop trigger if exists play_date_participants_capacity on public.play_date_participants;
create trigger play_date_participants_capacity
before insert on public.play_date_participants
for each row
execute function public.enforce_play_date_capacity();

create or replace function public.refresh_play_date_participant_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_play_date_id uuid;
begin
  if tg_op = 'DELETE' then
    target_play_date_id := old.play_date_id;
  else
    target_play_date_id := new.play_date_id;
  end if;

  update public.play_dates
  set participant_count = (
    select count(*)::integer
    from public.play_date_participants
    where play_date_id = target_play_date_id
      and status = 'joined'
  )
  where id = target_play_date_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists play_date_participants_refresh_count on public.play_date_participants;
create trigger play_date_participants_refresh_count
after insert or update or delete on public.play_date_participants
for each row
execute function public.refresh_play_date_participant_count();

alter table public.play_dates enable row level security;
alter table public.play_date_participants enable row level security;

drop policy if exists play_dates_select_visible on public.play_dates;
create policy play_dates_select_visible on public.play_dates
for select
to authenticated
using (
  visibility = 'public'
  or host_user_id = (select auth.uid())
  or exists (
    select 1
    from public.play_date_participants participant
    where participant.play_date_id = play_dates.id
      and participant.user_id = (select auth.uid())
  )
);

drop policy if exists play_dates_insert_host on public.play_dates;
create policy play_dates_insert_host on public.play_dates
for insert
to authenticated
with check (host_user_id = (select auth.uid()));

drop policy if exists play_dates_update_host on public.play_dates;
create policy play_dates_update_host on public.play_dates
for update
to authenticated
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

drop policy if exists play_dates_delete_host on public.play_dates;
create policy play_dates_delete_host on public.play_dates
for delete
to authenticated
using (host_user_id = (select auth.uid()));

drop policy if exists play_date_participants_select_own on public.play_date_participants;
create policy play_date_participants_select_own on public.play_date_participants
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists play_date_participants_insert_self on public.play_date_participants;
create policy play_date_participants_insert_self on public.play_date_participants
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (
      role = 'host'
      and exists (
        select 1
        from public.play_dates play_date
        where play_date.id = play_date_id
          and play_date.host_user_id = (select auth.uid())
      )
    )
    or (
      role = 'guest'
      and exists (
        select 1
        from public.play_dates play_date
        where play_date.id = play_date_id
          and play_date.visibility = 'public'
      )
    )
  )
);

drop policy if exists play_date_participants_delete_self on public.play_date_participants;
create policy play_date_participants_delete_self on public.play_date_participants
for delete
to authenticated
using (user_id = (select auth.uid()));
