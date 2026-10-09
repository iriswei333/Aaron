-- Shared map positions for family-event and story-time venues (Google Places look-ups),
-- so each venue is geocoded once for everyone. Public place data, like family_event_cache.

create table if not exists public.venue_geocodes (
  query_key text primary key,
  query text not null,
  latitude double precision,
  longitude double precision,
  formatted_address text,
  found boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.venue_geocodes enable row level security;

drop policy if exists venue_geocodes_select_authenticated on public.venue_geocodes;
create policy venue_geocodes_select_authenticated on public.venue_geocodes
for select to authenticated using (true);

drop policy if exists venue_geocodes_insert_authenticated on public.venue_geocodes;
create policy venue_geocodes_insert_authenticated on public.venue_geocodes
for insert to authenticated with check (true);

drop policy if exists venue_geocodes_update_authenticated on public.venue_geocodes;
create policy venue_geocodes_update_authenticated on public.venue_geocodes
for update to authenticated using (true) with check (true);
