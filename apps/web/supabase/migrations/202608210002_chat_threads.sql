-- Replace contact-based chat with explicit direct and playdate threads.
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  thread_type text not null check (thread_type in ('direct', 'playdate')),
  play_date_id uuid references public.play_dates(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((thread_type = 'playdate' and play_date_id is not null) or (thread_type = 'direct' and play_date_id is null))
);

create unique index if not exists chat_threads_play_date_unique_idx
  on public.chat_threads(play_date_id) where thread_type = 'playdate';

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists chat_thread_members_user_idx on public.chat_thread_members(user_id, joined_at desc);

alter table public.chat_messages add column if not exists thread_id uuid references public.chat_threads(id) on delete cascade;
create index if not exists chat_messages_thread_created_at_idx on public.chat_messages(thread_id, created_at);

-- Preserve existing 1:1 conversations by creating one direct thread per pair.
do $$
declare pair record; target_thread_id uuid;
begin
  for pair in
    select distinct least(sender_id::text, recipient_id::text)::uuid as first_user,
      greatest(sender_id::text, recipient_id::text)::uuid as second_user
    from public.chat_messages where sender_id <> recipient_id
  loop
    select a.thread_id into target_thread_id
    from public.chat_thread_members a
    join public.chat_thread_members b on b.thread_id = a.thread_id and b.user_id = pair.second_user
    join public.chat_threads t on t.id = a.thread_id and t.thread_type = 'direct'
    where a.user_id = pair.first_user
    limit 1;
    if target_thread_id is null then
      insert into public.chat_threads(thread_type) values ('direct') returning id into target_thread_id;
    end if;
    insert into public.chat_thread_members(thread_id, user_id) values (target_thread_id, pair.first_user), (target_thread_id, pair.second_user) on conflict do nothing;
    update public.chat_messages set thread_id = target_thread_id
    where thread_id is null and sender_id in (pair.first_user, pair.second_user) and recipient_id in (pair.first_user, pair.second_user);
  end loop;
end;
$$;

create or replace function public.ensure_playdate_chat_thread(target_play_date_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_thread_id uuid;
begin
  insert into public.chat_threads(thread_type, play_date_id)
  values ('playdate', target_play_date_id)
  on conflict (play_date_id) where thread_type = 'playdate' do update set play_date_id = excluded.play_date_id
  returning id into target_thread_id;

  insert into public.chat_thread_members(thread_id, user_id)
  select target_thread_id, user_id
  from public.play_date_participants
  where play_date_id = target_play_date_id and status = 'joined'
  on conflict do nothing;
  return target_thread_id;
end;
$$;

create or replace function public.sync_playdate_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'joined' then
    perform public.ensure_playdate_chat_thread(new.play_date_id);
  end if;
  return new;
end;
$$;

drop trigger if exists play_date_participants_chat_thread on public.play_date_participants;
create trigger play_date_participants_chat_thread
after insert or update of status on public.play_date_participants
for each row execute function public.sync_playdate_chat_membership();

-- Backfill one thread and all current joined families for every existing playdate.
do $$
declare target record;
begin
  for target in select id from public.play_dates loop
    perform public.ensure_playdate_chat_thread(target.id);
  end loop;
end;
$$;

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;

create or replace function public.is_chat_thread_member(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.chat_thread_members where thread_id = target_thread_id and user_id = auth.uid()) $$;

create policy chat_threads_select_member on public.chat_threads for select to authenticated
using (public.is_chat_thread_member(id));
create policy chat_thread_members_select_member on public.chat_thread_members for select to authenticated
using (public.is_chat_thread_member(thread_id));

create or replace function public.create_direct_chat_thread(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_thread_id uuid;
begin
  if target_user_id is null or target_user_id = auth.uid() then raise exception 'Choose another parent for a direct chat.'; end if;
  select a.thread_id into target_thread_id
  from public.chat_thread_members a
  join public.chat_thread_members b on b.thread_id = a.thread_id and b.user_id = target_user_id
  join public.chat_threads t on t.id = a.thread_id and t.thread_type = 'direct'
  where a.user_id = auth.uid()
  limit 1;
  if target_thread_id is null then
    insert into public.chat_threads(thread_type) values ('direct') returning id into target_thread_id;
    insert into public.chat_thread_members(thread_id, user_id) values (target_thread_id, auth.uid()), (target_thread_id, target_user_id);
  end if;
  return target_thread_id;
end;
$$;

create policy profiles_select_chat_thread_members on public.profiles for select to authenticated
using (exists (select 1 from public.chat_thread_members member where member.user_id = profiles.id and public.is_chat_thread_member(member.thread_id)));

drop policy if exists chat_messages_select_participants on public.chat_messages;
create policy chat_messages_select_thread_member on public.chat_messages for select to authenticated
using (public.is_chat_thread_member(chat_messages.thread_id));
drop policy if exists chat_messages_insert_sender on public.chat_messages;
create policy chat_messages_insert_thread_member on public.chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_chat_thread_member(chat_messages.thread_id)
);
