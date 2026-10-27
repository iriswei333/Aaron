-- Chat safety: let families report a chat message (Apple Guideline 1.2, Play UGC policy).
--
-- Reports are filed only through report_chat_message(), which checks that the
-- reporter is a member of the message's thread and isn't reporting their own
-- message, then snapshots the message so the report still makes sense if the
-- message, thread or sender's account is deleted later. Clients get no direct
-- table access; reports are reviewed with the service role.
--
-- reporter_id cascades with the reporter's account (see
-- 202610240001_account_deletion_cascade.sql). reported_user_id and thread_id are
-- plain uuids on purpose: a report about someone must survive that person
-- deleting their account, so moderators can still act on it.

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  thread_id uuid,
  reported_user_id uuid,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'child_safety', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  message_text text not null default '',
  message_media_type text not null default '',
  message_media_url text not null default '',
  message_created_at timestamptz,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One report per family per message; a second tap returns the first report.
create unique index if not exists chat_reports_reporter_message_unique_idx
  on public.chat_reports(reporter_id, message_id) where message_id is not null;
create index if not exists chat_reports_status_created_at_idx on public.chat_reports(status, created_at desc);
create index if not exists chat_reports_reported_user_idx on public.chat_reports(reported_user_id, created_at desc);

alter table public.chat_reports enable row level security;
-- No policies for anon/authenticated: the RPC below is the only client write path.

create or replace function public.report_chat_message(
  target_message_id uuid,
  report_reason text,
  report_details text default ''
)
returns table (report_id uuid, reported_at timestamptz, already_reported boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  msg public.chat_messages%rowtype;
  clean_details text := left(btrim(coalesce(report_details, '')), 500);
  new_id uuid;
  new_at timestamptz;
begin
  if reporter is null then
    raise exception 'Sign in to report a message.';
  end if;
  if report_reason is null or report_reason not in ('spam', 'harassment', 'inappropriate', 'child_safety', 'other') then
    raise exception 'Choose a reason for the report.';
  end if;

  select * into msg from public.chat_messages m where m.id = target_message_id;
  if not found or msg.thread_id is null or not public.is_chat_thread_member(msg.thread_id) then
    raise exception 'That message is no longer available.';
  end if;
  if msg.sender_id = reporter then
    raise exception 'You can''t report your own message.';
  end if;

  insert into public.chat_reports (
    reporter_id, message_id, thread_id, reported_user_id, reason, details,
    message_text, message_media_type, message_media_url, message_created_at
  ) values (
    reporter, msg.id, msg.thread_id, msg.sender_id, report_reason, clean_details,
    msg.text, msg.media_type, msg.media_url, msg.created_at
  )
  on conflict (reporter_id, message_id) where message_id is not null do nothing
  returning chat_reports.id, chat_reports.created_at into new_id, new_at;

  if new_id is not null then
    return query select new_id, new_at, false;
    return;
  end if;

  return query
    select r.id, r.created_at, true
    from public.chat_reports r
    where r.reporter_id = reporter and r.message_id = msg.id;
end;
$$;

revoke all on function public.report_chat_message(uuid, text, text) from public, anon;
grant execute on function public.report_chat_message(uuid, text, text) to authenticated;

-- Explicit Data API grants (see 202610200001_explicit_public_table_grants.sql).
grant select, insert, update, delete on table public.chat_reports to service_role;
