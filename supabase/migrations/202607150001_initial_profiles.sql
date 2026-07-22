create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default 'Family Profile',
  child_profile jsonb not null default '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb,
  social_links jsonb not null default '{"icloudPhotosUrl":"","instagramUrl":"","tiktokUrl":""}'::jsonb,
  location jsonb,
  food_plan jsonb not null default '{"favorites":["peas","broccoli","banana"],"weeklyMenu":[]}'::jsonb,
  amazon_errands jsonb not null default '{"tasks":[{"title":"Diapers and wipes","cadence":"Monthly","status":"planned"},{"title":"Toddler outfit deals","cadence":"Weekly","status":"watching"}],"outfitIdeas":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null default 'media',
  media_type text not null default 'video' check (media_type in ('photo', 'video')),
  tone text not null default '温柔可爱',
  caption text not null,
  source text not null default 'local-fallback',
  created_at timestamptz not null default now()
);

create index if not exists social_posts_user_id_created_at_idx
  on public.social_posts (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.social_posts enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists social_posts_select_own on public.social_posts;
create policy social_posts_select_own on public.social_posts
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists social_posts_insert_own on public.social_posts;
create policy social_posts_insert_own on public.social_posts
for insert
to authenticated
with check (user_id = (select auth.uid()));
