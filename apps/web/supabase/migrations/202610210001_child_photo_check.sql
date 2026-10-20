-- Child-photo check for AI features that need a photo of the child (picture books, practice stories).
-- Stores only the coarse classification (counts, age band, confidence) — never image bytes or face data.
-- Idempotent: safe to re-run on a database where an earlier draft of this script was applied.

-- 1. Check result on each saved family photo.
alter table public.family_saved_photos
  add column if not exists child_check_status text not null default 'unchecked',
  add column if not exists child_check_code   text,
  add column if not exists child_check_result jsonb,
  add column if not exists child_check_model  text,
  add column if not exists child_checked_at   timestamptz;

alter table public.family_saved_photos drop constraint if exists family_saved_photos_child_check_status_check;
alter table public.family_saved_photos add constraint family_saved_photos_child_check_status_check
  check (child_check_status in ('unchecked', 'passed', 'rejected', 'error'));

-- 2. Audit log of every check, including rejected uploads that are never saved. No image data.
create table if not exists public.ai_photo_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  photo_id uuid references public.family_saved_photos(id) on delete set null,
  source_kind text not null,
  status text not null check (status in ('passed', 'rejected', 'error')),
  code text,
  result jsonb,
  model text,
  created_at timestamptz not null default now()
);

alter table public.ai_photo_checks add column if not exists photo_id uuid references public.family_saved_photos(id) on delete set null;
alter table public.ai_photo_checks drop constraint if exists ai_photo_checks_status_check;
alter table public.ai_photo_checks add constraint ai_photo_checks_status_check check (status in ('passed', 'rejected', 'error'));

create index if not exists ai_photo_checks_profile_created_idx
on public.ai_photo_checks (profile_id, created_at desc);

alter table public.ai_photo_checks enable row level security;

drop policy if exists "family reads own photo checks" on public.ai_photo_checks;
create policy "family reads own photo checks"
on public.ai_photo_checks for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "family records own photo checks" on public.ai_photo_checks;
create policy "family records own photo checks"
on public.ai_photo_checks for insert to authenticated
with check (profile_id = (select auth.uid()));

-- 3. Machine-readable failure code on AI jobs, so clients can localize photo failures.
alter table public.ai_generation_jobs add column if not exists error_code text;

-- 4. Explicit Data API grants (see 202610200001_explicit_public_table_grants.sql).
grant select, insert on table public.ai_photo_checks to authenticated;
grant select, insert, update, delete on table public.ai_photo_checks to service_role;
