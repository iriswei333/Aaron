-- Account deletion: make every foreign key that points at a user cascade.
--
-- Deleting a user (supabase.auth.admin.deleteUser) removes auth.users, which
-- cascades to public.profiles, which must cascade to every table holding that
-- family's data. The migrations already declare `on delete cascade` for all of
-- them; this enforces it on the live database too, in case it has drifted, and
-- covers any later table that forgets it. Safe to run more than once.
--
-- Tables reached this way today:
--   auth.users -> profiles
--   profiles -> social_posts, play_dates (host), play_date_participants,
--     chat_messages (sender, recipient), chat_thread_members, family_events,
--     family_assets, family_saved_photos, ai_daily_usage, ai_generation_jobs,
--     family_notifications, push_tokens, ai_photo_checks
--   and on from those: play_dates -> participants, chat_threads -> messages,
--     members; family_assets -> picture books (+ pages, source photos),
--     toy plays, practice stories; ai_generation_jobs -> notifications.
-- Storage files (bucket family-assets, `<userId>/...`) are not rows here and are
-- removed by lib/account-deletion.js before the user is deleted.

do $$
declare fk record;
begin
  for fk in
    select c.conname, c.conrelid::regclass as table_name,
           pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and c.confdeltype <> 'c'
  loop
    raise notice 'Making %.% cascade (was: %)', fk.table_name, fk.conname, fk.definition;
    -- Drop any existing ON DELETE action, then put CASCADE right after the
    -- REFERENCES clause so ON UPDATE / DEFERRABLE / NOT VALID stay valid.
    execute format(
      'alter table %s drop constraint %I, add constraint %I %s',
      fk.table_name, fk.conname, fk.conname,
      regexp_replace(
        regexp_replace(fk.definition, '\s+ON DELETE (NO ACTION|RESTRICT|SET NULL|SET DEFAULT)(\s*\([^)]*\))?', '', 'i'),
        '(REFERENCES\s+\S+?\([^)]*\))', '\1 ON DELETE CASCADE', 'i'
      )
    );
  end loop;
end;
$$;

-- Fail loudly if anything still blocks or orphans data on account deletion.
do $$
declare remaining text;
begin
  select string_agg(format('%s.%s', c.conrelid::regclass, c.conname), ', ') into remaining
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f'
    and n.nspname = 'public'
    and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
    and c.confdeltype <> 'c';
  if remaining is not null then
    raise exception 'Foreign keys to users that do not cascade: %', remaining;
  end if;
end;
$$;
