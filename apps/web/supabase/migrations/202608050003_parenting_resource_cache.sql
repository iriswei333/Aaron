create table if not exists public.parenting_resource_cache (
  age_filter text primary key,
  source_url text not null default '',
  resources jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > fetched_at)
);

create index if not exists parenting_resource_cache_expires_at_idx
  on public.parenting_resource_cache (expires_at);

alter table public.parenting_resource_cache enable row level security;

drop policy if exists parenting_resource_cache_select_authenticated on public.parenting_resource_cache;
create policy parenting_resource_cache_select_authenticated on public.parenting_resource_cache
for select to authenticated using (true);

drop policy if exists parenting_resource_cache_insert_authenticated on public.parenting_resource_cache;
create policy parenting_resource_cache_insert_authenticated on public.parenting_resource_cache
for insert to authenticated with check (true);

drop policy if exists parenting_resource_cache_update_authenticated on public.parenting_resource_cache;
create policy parenting_resource_cache_update_authenticated on public.parenting_resource_cache
for update to authenticated using (true) with check (true);
