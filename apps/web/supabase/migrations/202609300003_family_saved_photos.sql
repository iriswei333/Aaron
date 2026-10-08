-- Private, reusable family photo library. Project workflows copy a selected
-- library photo into their own storage so either side can be deleted safely.

create table if not exists public.family_saved_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Family photo' check (char_length(label) between 1 and 100),
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg',
  byte_size bigint not null default 0 check (byte_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  source_kind text not null default 'upload' check (source_kind in ('upload', 'picture_book', 'toy_play')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_saved_photos_profile_created_idx
on public.family_saved_photos (profile_id, created_at desc);

drop trigger if exists family_saved_photos_set_updated_at on public.family_saved_photos;
create trigger family_saved_photos_set_updated_at
before update on public.family_saved_photos
for each row execute function public.set_updated_at();

alter table public.family_saved_photos enable row level security;

create policy "family manages own saved photos"
on public.family_saved_photos for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
