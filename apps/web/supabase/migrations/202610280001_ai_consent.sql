-- AI consent (Apple Guideline 5.1.2(i): disclose sharing personal data with third-party AI and
-- get explicit permission first).
--
-- AI features send the photos and child details a parent picks to OpenAI. A parent must agree
-- before any AI request: the API checks profiles.ai_consent_at / ai_consent_version against
-- AI_CONSENT_VERSION (packages/shared/src/ai-consent.js), and enqueue_ai_generation_job below
-- refuses to queue a job without consent, so a client can't skip the check.
--
-- NULL ai_consent_at = never agreed, or turned off. Existing profiles start with NULL.
-- Parents grant and revoke through the API (PUT/DELETE /api/ai-consent), which updates their
-- own profile row under the existing profiles_update_own policy.

alter table public.profiles add column if not exists ai_consent_at timestamptz;
alter table public.profiles add column if not exists ai_consent_version text;

create or replace function public.enqueue_ai_generation_job(
  requested_job_type text,
  requested_payload jsonb,
  requested_estimated_seconds integer
)
returns table(job_id uuid, used_count integer, daily_limit integer, unlimited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  caller_consent timestamptz;
  next_count integer;
  created_job_id uuid;
  is_unlimited boolean;
  usage_day date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if requested_job_type not in ('toy_play', 'practice_story', 'picture_book_page', 'picture_book_whole') then raise exception 'Unsupported AI job type'; end if;
  select lower(coalesce(email, '')), ai_consent_at into caller_email, caller_consent from public.profiles where id = caller_id;
  if caller_consent is null then raise exception using message = 'AI_CONSENT_REQUIRED'; end if;
  is_unlimited := caller_email in ('iris333wei@gmail.com', '1111iris.iris@gmail.com');

  if is_unlimited then
    select count(*)::integer into next_count from public.ai_generation_jobs
    where profile_id = caller_id and (created_at at time zone 'America/Los_Angeles')::date = usage_day;
    next_count := next_count + 1;
  else
    insert into public.ai_daily_usage (profile_id, usage_date, generation_count)
    values (caller_id, usage_day, 1)
    on conflict (profile_id, usage_date) do update
      set generation_count = public.ai_daily_usage.generation_count + 1, updated_at = now()
      where public.ai_daily_usage.generation_count < 10
    returning generation_count into next_count;
    if next_count is null then raise exception using message = 'DAILY_AI_LIMIT_REACHED'; end if;
  end if;

  insert into public.ai_generation_jobs (profile_id, job_type, payload, estimated_seconds)
  values (caller_id, requested_job_type, coalesce(requested_payload, '{}'::jsonb), greatest(1, requested_estimated_seconds))
  returning id into created_job_id;

  return query select created_job_id, next_count, 10, is_unlimited;
end;
$$;

revoke all on function public.enqueue_ai_generation_job(text, jsonb, integer) from public;
grant execute on function public.enqueue_ai_generation_job(text, jsonb, integer) to authenticated;
