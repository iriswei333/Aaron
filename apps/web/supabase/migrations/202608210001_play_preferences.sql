alter table public.profiles
  add column if not exists play_preferences jsonb not null default '{"searchRadiusMiles":3}'::jsonb;
