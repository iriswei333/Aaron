-- Normalized family-owned planning data.
-- Public discovery data remains in family_event_cache; these tables contain
-- decisions and recurring rules belonging to a signed-in family.

create table if not exists public.family_recurring_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id text,
  kind text not null check (kind in ('grocery', 'logistics')),
  title text not null,
  recurrence_rule jsonb not null default '{}'::jsonb,
  next_due_date date,
  last_completed_at timestamptz,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_recurring_items_profile_active_idx
  on public.family_recurring_items(profile_id, active, next_due_date);

create index if not exists family_recurring_items_profile_child_idx
  on public.family_recurring_items(profile_id, child_id);

create table if not exists public.family_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id text,
  kind text not null check (kind in ('grocery', 'logistics', 'external_event', 'playdate')),
  title text not null,
  summary text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  due_date date,
  status text not null default 'planned' check (status in ('planned', 'attending', 'completed', 'cancelled')),
  source text not null default 'user',
  external_id text,
  venue text not null default '',
  url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_events_profile_schedule_idx
  on public.family_events(profile_id, status, starts_at, due_date);

create index if not exists family_events_profile_kind_idx
  on public.family_events(profile_id, kind, status);

create unique index if not exists family_events_external_source_idx
  on public.family_events(profile_id, source, external_id)
  where external_id is not null;

alter table public.family_recurring_items enable row level security;
alter table public.family_events enable row level security;

drop policy if exists "family recurring items owner access" on public.family_recurring_items;
create policy "family recurring items owner access"
  on public.family_recurring_items
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "family events owner access" on public.family_events;
create policy "family events owner access"
  on public.family_events
  for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

comment on table public.family_recurring_items is
  'Durable recurring grocery and family-logistics definitions.';
comment on table public.family_events is
  'Durable family-owned event decisions and one-time planned occurrences.';
