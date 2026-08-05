-- Family logistics replaces the old Amazon task list. Keep the shared JSON field
-- for reminders and logistics settings, but clear legacy task entries.
update public.profiles
set amazon_errands = jsonb_set(
  coalesce(amazon_errands, '{}'::jsonb),
  '{tasks}',
  '[]'::jsonb,
  true
), updated_at = now();
