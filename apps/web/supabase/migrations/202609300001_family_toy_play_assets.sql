-- Family-owned AI play ideas generated from a parent-supplied toy photo.
-- Generation previews are not stored; a row is created only after the parent clicks Save.

alter table public.family_assets drop constraint if exists family_assets_asset_type_check;
alter table public.family_assets
  add constraint family_assets_asset_type_check
  check (asset_type in ('picture_book', 'toy_play'));

create table if not exists public.family_toy_play_assets (
  asset_id uuid primary key references public.family_assets(id) on delete cascade,
  photo_storage_path text not null unique,
  photo_mime_type text not null default 'image/jpeg',
  child_age_months integer not null check (child_age_months between 0 and 216),
  toy_name text not null,
  toy_category text not null default '',
  toy_description text not null default '',
  identification_confidence text not null check (identification_confidence in ('high', 'medium', 'low')),
  play_plan jsonb not null,
  model text not null,
  response_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists family_toy_play_assets_set_updated_at on public.family_toy_play_assets;
create trigger family_toy_play_assets_set_updated_at
before update on public.family_toy_play_assets
for each row execute function public.set_updated_at();

alter table public.family_toy_play_assets enable row level security;

create policy "family manages own toy play assets"
on public.family_toy_play_assets for all to authenticated
using (
  exists (
    select 1 from public.family_assets a
    where a.id = asset_id and a.profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.family_assets a
    where a.id = asset_id and a.profile_id = (select auth.uid())
  )
);

create index if not exists family_toy_play_assets_created_idx
on public.family_toy_play_assets (created_at desc);
