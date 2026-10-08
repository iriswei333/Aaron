-- Durable asynchronous AI generation jobs, daily quotas, and in-app notifications.

create table if not exists public.ai_daily_usage (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  generation_count integer not null default 0 check (generation_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, usage_date)
);

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_type text not null check (job_type in ('toy_play', 'practice_story', 'picture_book_page', 'picture_book_whole')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  asset_id uuid references public.family_assets(id) on delete set null,
  progress integer not null default 0 check (progress between 0 and 100),
  estimated_seconds integer not null default 60 check (estimated_seconds > 0),
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.family_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null default 'ai_asset_ready',
  title text not null,
  message text not null default '',
  href text not null,
  asset_id uuid references public.family_assets(id) on delete set null,
  job_id uuid references public.ai_generation_jobs(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_jobs_profile_created_idx on public.ai_generation_jobs (profile_id, created_at desc);
create index if not exists ai_generation_jobs_queued_idx on public.ai_generation_jobs (status, created_at) where status = 'queued';
create index if not exists family_notifications_profile_created_idx on public.family_notifications (profile_id, created_at desc);

drop trigger if exists ai_generation_jobs_set_updated_at on public.ai_generation_jobs;
create trigger ai_generation_jobs_set_updated_at before update on public.ai_generation_jobs
for each row execute function public.set_updated_at();

alter table public.ai_daily_usage enable row level security;
alter table public.ai_generation_jobs enable row level security;
alter table public.family_notifications enable row level security;

create policy "family reads own AI usage" on public.ai_daily_usage for select to authenticated
using (profile_id = (select auth.uid()));
create policy "family reads own AI jobs" on public.ai_generation_jobs for select to authenticated
using (profile_id = (select auth.uid()));
create policy "family updates own AI jobs" on public.ai_generation_jobs for update to authenticated
using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "family reads own notifications" on public.family_notifications for select to authenticated
using (profile_id = (select auth.uid()));
create policy "family creates own notifications" on public.family_notifications for insert to authenticated
with check (profile_id = (select auth.uid()));
create policy "family updates own notifications" on public.family_notifications for update to authenticated
using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

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
  next_count integer;
  created_job_id uuid;
  is_unlimited boolean;
  usage_day date := (now() at time zone 'America/Los_Angeles')::date;
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  if requested_job_type not in ('toy_play', 'practice_story', 'picture_book_page', 'picture_book_whole') then raise exception 'Unsupported AI job type'; end if;
  select lower(coalesce(email, '')) into caller_email from public.profiles where id = caller_id;
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
