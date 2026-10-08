create table if not exists public.story_time_cache (
  cache_key text primary key,
  location_city text not null,
  start_date date not null,
  end_date date not null,
  source text not null default '',
  source_label text not null default '',
  source_urls jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  fallback boolean not null default false,
  provider_status text not null default '',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (end_date >= start_date),
  check (expires_at > fetched_at)
);
create index if not exists story_time_cache_expires_at_idx on public.story_time_cache (expires_at);
alter table public.story_time_cache enable row level security;
drop policy if exists story_time_cache_select_authenticated on public.story_time_cache;
create policy story_time_cache_select_authenticated on public.story_time_cache for select to authenticated using (true);
drop policy if exists story_time_cache_insert_authenticated on public.story_time_cache;
create policy story_time_cache_insert_authenticated on public.story_time_cache for insert to authenticated with check (true);
drop policy if exists story_time_cache_update_authenticated on public.story_time_cache;
create policy story_time_cache_update_authenticated on public.story_time_cache for update to authenticated using (true) with check (true);
