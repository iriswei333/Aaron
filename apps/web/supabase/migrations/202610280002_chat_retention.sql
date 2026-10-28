-- Chat retention: chat messages and safety reports are kept for one year, then deleted
-- (Privacy Policy, "How long we keep information").
--
-- What this covers:
--   chat_messages  — text and media. Photos/videos are stored inline in media_url (data URLs),
--                    so deleting the row deletes the media too; nothing is left in Storage.
--   chat_reports   — the report plus its snapshot of the reported message (message_text,
--                    message_media_url). Kept one year from when the report was filed, even
--                    if the reported family deletes their account (reported_user_id is a
--                    plain uuid). A report is deleted with the account of the family who filed
--                    it (reporter_id cascades, like every profile reference).
-- Threads and memberships are not content and stay until a member's account is deleted.
--
-- purge_expired_chat_data() runs daily through pg_cron. Run it by hand with
--   select * from public.purge_expired_chat_data();

create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at);
create index if not exists chat_reports_created_at_idx on public.chat_reports (created_at);

create or replace function public.purge_expired_chat_data(retention interval default interval '1 year')
returns table(messages_deleted bigint, reports_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - retention;
  deleted_messages bigint;
  deleted_reports bigint;
begin
  if retention < interval '1 day' then raise exception 'Retention must be at least one day'; end if;
  -- Reports first: their message_id is "on delete set null", so order only matters for clarity.
  delete from public.chat_reports where created_at < cutoff;
  get diagnostics deleted_reports = row_count;
  delete from public.chat_messages where created_at < cutoff;
  get diagnostics deleted_messages = row_count;
  return query select deleted_messages, deleted_reports;
end;
$$;

revoke all on function public.purge_expired_chat_data(interval) from public, anon, authenticated;
grant execute on function public.purge_expired_chat_data(interval) to service_role;

-- Daily at 03:23 Pacific (10:23 UTC). cron.schedule with an existing job name updates it,
-- so re-running this migration is safe. If pg_cron isn't available (some local setups),
-- the migration still succeeds; enable pg_cron under Database → Extensions and re-run.
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron is not available (%); schedule purge_expired_chat_data() another way.', sqlerrm;
  end;
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('purge-expired-chat-data', '23 10 * * *', 'select public.purge_expired_chat_data()');
  end if;
end;
$$;
