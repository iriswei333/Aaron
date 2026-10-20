-- Supabase no longer grants Data API access automatically to tables created in
-- public. Keep these privileges explicit so new projects, preview branches, and
-- `supabase db reset` recreate the API surface expected by the RLS policies.
--
-- RLS remains the authorization boundary. The grants below only allow each
-- role to attempt the operations for which this project defines policies.
-- Add matching grants in the same migration whenever a new public table is
-- introduced after this migration.

-- The public playdate share page is the only anonymous table-backed surface.
grant select
on table public.play_dates
to anon;

-- Parent-owned records with full CRUD policies.
grant select, insert, update, delete
on table
  public.profiles,
  public.social_posts,
  public.play_dates,
  public.play_date_participants,
  public.family_recurring_items,
  public.family_events,
  public.family_assets,
  public.family_picture_books,
  public.family_picture_book_source_photos,
  public.family_picture_book_pages,
  public.family_toy_play_assets,
  public.family_saved_photos,
  public.family_practice_story_assets
to authenticated;

-- Shared caches can be read and refreshed by signed-in clients, but not deleted.
grant select, insert, update
on table
  public.family_event_cache,
  public.playground_cache,
  public.parenting_resource_cache,
  public.story_time_cache,
  public.venue_geocodes
to authenticated;

-- Chat thread and template creation is handled by trusted migrations/functions.
grant select
on table
  public.chat_threads,
  public.chat_thread_members,
  public.picture_book_templates,
  public.picture_book_template_pages,
  public.ai_daily_usage
to authenticated;

grant select, insert
on table public.chat_messages
to authenticated;

grant select, update
on table public.ai_generation_jobs
to authenticated;

grant select, insert, update
on table public.family_notifications
to authenticated;

-- Push-token writes go through register_push_token(); families may list and
-- unregister only their own tokens directly.
grant select, delete
on table public.push_tokens
to authenticated;

-- Backend jobs use the service role, which bypasses RLS by design.
grant select, insert, update, delete
on table
  public.profiles,
  public.social_posts,
  public.play_dates,
  public.play_date_participants,
  public.family_event_cache,
  public.chat_messages,
  public.playground_cache,
  public.parenting_resource_cache,
  public.family_recurring_items,
  public.family_events,
  public.chat_threads,
  public.chat_thread_members,
  public.story_time_cache,
  public.picture_book_templates,
  public.picture_book_template_pages,
  public.family_assets,
  public.family_picture_books,
  public.family_picture_book_source_photos,
  public.family_picture_book_pages,
  public.family_toy_play_assets,
  public.family_saved_photos,
  public.family_practice_story_assets,
  public.ai_daily_usage,
  public.ai_generation_jobs,
  public.family_notifications,
  public.push_tokens,
  public.venue_geocodes
to service_role;

