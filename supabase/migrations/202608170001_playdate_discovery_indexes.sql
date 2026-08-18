-- Keep map and nearby-playdate discovery fast as the public directory grows.
create index if not exists play_dates_public_status_starts_at_idx
  on public.play_dates (status, starts_at desc)
  where visibility = 'public' and status = 'upcoming';

create index if not exists play_dates_public_playground_coords_idx
  on public.play_dates (playground_latitude, playground_longitude)
  where visibility = 'public' and status = 'upcoming';

-- The map only needs future public plans; remove stale cancelled records from
-- the discovery path without affecting a family's private history.
create index if not exists play_dates_public_updated_at_idx
  on public.play_dates (updated_at desc)
  where visibility = 'public';
