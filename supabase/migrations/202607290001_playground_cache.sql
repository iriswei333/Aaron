create table if not exists public.playground_cache (
  cache_key text primary key,
  latitude double precision not null,
  longitude double precision not null,
  playgrounds jsonb not null default '[]'::jsonb,
  source text not null default 'openstreetmap-overpass',
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > fetched_at)
);

create index if not exists playground_cache_expires_at_idx on public.playground_cache (expires_at);

alter table public.playground_cache enable row level security;

drop policy if exists playground_cache_select_authenticated on public.playground_cache;
create policy playground_cache_select_authenticated on public.playground_cache for select to authenticated using (true);

drop policy if exists playground_cache_insert_authenticated on public.playground_cache;
create policy playground_cache_insert_authenticated on public.playground_cache for insert to authenticated with check (true);

drop policy if exists playground_cache_update_authenticated on public.playground_cache;
create policy playground_cache_update_authenticated on public.playground_cache for update to authenticated using (true) with check (true);
