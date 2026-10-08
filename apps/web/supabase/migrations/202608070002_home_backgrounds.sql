-- social_posts no longer backs a social-post composer. It now stores the
-- single private custom Home background for each family profile.
alter table public.social_posts
  add column if not exists purpose text not null default 'home-background',
  add column if not exists media_url text,
  add column if not exists updated_at timestamptz not null default now();

-- Do not reinterpret any rows left by the removed social-post feature.
update public.social_posts
set purpose = 'legacy-social-post'
where purpose = 'home-background' and media_url is null;

create unique index if not exists social_posts_one_home_background_per_user_idx
  on public.social_posts (user_id)
  where purpose = 'home-background';

create index if not exists social_posts_home_background_updated_idx
  on public.social_posts (user_id, updated_at desc)
  where purpose = 'home-background';

drop policy if exists social_posts_update_own on public.social_posts;
create policy social_posts_update_own on public.social_posts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and purpose = 'home-background');

drop policy if exists social_posts_delete_own on public.social_posts;
create policy social_posts_delete_own on public.social_posts
for delete
to authenticated
using (user_id = (select auth.uid()) and purpose = 'home-background');

drop policy if exists social_posts_insert_own on public.social_posts;
create policy social_posts_insert_own on public.social_posts
for insert
to authenticated
with check (user_id = (select auth.uid()) and purpose = 'home-background');
