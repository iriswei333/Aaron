alter table public.profiles
add column if not exists child_profile jsonb not null default '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb;

alter table public.profiles
alter column display_name set default 'Family Profile';
