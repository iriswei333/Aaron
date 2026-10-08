alter table public.profiles
  add column if not exists family_objects jsonb not null default '[]'::jsonb;
