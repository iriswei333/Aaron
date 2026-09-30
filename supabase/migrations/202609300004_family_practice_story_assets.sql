-- Personalized social stories for practicing one family-selected routine or skill.
alter table public.family_assets drop constraint if exists family_assets_asset_type_check;
alter table public.family_assets
  add constraint family_assets_asset_type_check
  check (asset_type in ('picture_book', 'toy_play', 'practice_story'));

create table if not exists public.family_practice_story_assets (
  asset_id uuid primary key references public.family_assets(id) on delete cascade,
  child_name text not null default '',
  child_age_months integer not null check (child_age_months between 0 and 71),
  goal text not null,
  interests jsonb not null default '[]'::jsonb,
  language text not null default 'en',
  story jsonb not null,
  cover_storage_path text unique,
  model text not null,
  image_model text,
  response_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists family_practice_story_assets_set_updated_at on public.family_practice_story_assets;
create trigger family_practice_story_assets_set_updated_at before update on public.family_practice_story_assets
for each row execute function public.set_updated_at();

alter table public.family_practice_story_assets enable row level security;
create policy "family manages own practice story assets" on public.family_practice_story_assets for all to authenticated
using (exists (select 1 from public.family_assets a where a.id = asset_id and a.profile_id = (select auth.uid())))
with check (exists (select 1 from public.family_assets a where a.id = asset_id and a.profile_id = (select auth.uid())));

create index if not exists family_practice_story_assets_created_idx on public.family_practice_story_assets (created_at desc);
