-- Chat safety: let a family block another family (Apple Guideline 1.2, Play UGC policy).
--
-- A block is one-directional data (blocker -> blocked) with these effects, all
-- enforced here rather than trusted to the apps:
--   * the blocker stops seeing the blocked family's chat messages (select policy);
--   * neither family can send into their shared direct chat (insert policy);
--   * neither can open a new direct chat with the other (create_direct_chat_thread);
--   * playdate group chats stay shared: only the blocker's view is filtered.
-- The API also drops blocked families' direct threads from the blocker's list.
-- The blocked family is never told. Both FKs cascade with account deletion.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;
create policy user_blocks_select_own on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

grant select, insert, delete on table public.user_blocks to authenticated;
grant select, insert, update, delete on table public.user_blocks to service_role;

-- Did the signed-in family block this one?
create or replace function public.has_blocked(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = auth.uid() and blocked_id = target_user_id
  )
$$;

-- Is this a direct chat where either family has blocked the other?
create or replace function public.is_direct_chat_blocked(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads t
    join public.chat_thread_members other on other.thread_id = t.id and other.user_id <> auth.uid()
    join public.user_blocks b
      on (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      or (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
    where t.id = target_thread_id and t.thread_type = 'direct'
  )
$$;

-- Blocked families with a display name, for the Blocked families list. The
-- blocker may no longer share a chat with them, so read the name as definer.
create or replace function public.list_my_blocks()
returns table (blocked_id uuid, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, coalesce(nullif(p.display_name, ''), 'A family'), b.created_at
  from public.user_blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke all on function public.has_blocked(uuid) from public, anon;
revoke all on function public.is_direct_chat_blocked(uuid) from public, anon;
revoke all on function public.list_my_blocks() from public, anon;
grant execute on function public.has_blocked(uuid) to authenticated;
grant execute on function public.is_direct_chat_blocked(uuid) to authenticated;
grant execute on function public.list_my_blocks() to authenticated;

-- Hide blocked senders' messages from the blocker.
drop policy if exists chat_messages_select_thread_member on public.chat_messages;
create policy chat_messages_select_thread_member on public.chat_messages for select to authenticated
using (
  public.is_chat_thread_member(chat_messages.thread_id)
  and not public.has_blocked(chat_messages.sender_id)
);

-- No sending into a direct chat once either side has blocked the other.
drop policy if exists chat_messages_insert_thread_member on public.chat_messages;
create policy chat_messages_insert_thread_member on public.chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_chat_thread_member(chat_messages.thread_id)
  and not public.is_direct_chat_blocked(chat_messages.thread_id)
);

-- Same as 202608210002_chat_threads.sql, plus the block check.
create or replace function public.create_direct_chat_thread(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare target_thread_id uuid;
begin
  if target_user_id is null or target_user_id = auth.uid() then raise exception 'Choose another parent for a direct chat.'; end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = auth.uid())
  ) then
    raise exception 'You can’t message this family.';
  end if;
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
