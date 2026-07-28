create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  text text not null default '',
  media_type text not null default '' check (media_type in ('', 'photo', 'video')),
  media_url text not null default '',
  created_at timestamptz not null default now(),
  check (text <> '' or media_url <> '')
);
create index if not exists chat_messages_participants_created_at_idx on public.chat_messages (sender_id, recipient_id, created_at);
alter table public.chat_messages enable row level security;
create policy chat_messages_select_participants on public.chat_messages for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy chat_messages_insert_sender on public.chat_messages for insert to authenticated with check (sender_id = (select auth.uid()));
