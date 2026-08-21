-- Clean cutoff for the retired meal, shopping, and family-logistics features.
--
-- Release sequencing:
--   1. Deploy the application version that no longer reads or writes these
--      fields/kinds (this migration is the database enforcement point).
--   2. Apply this migration once in each environment.
--   3. Do not reintroduce the dropped columns or recurring table in a later
--      migration; new planning data belongs to the active playdate/event
--      surfaces instead.
--
-- This is intentionally one-way. The retired data is not copied to an
-- archive because it is no longer an app-supported user object.

begin;

-- Remove deprecated one-time grocery/logistics rows before narrowing the
-- family_events contract to saved external weekend events.
delete from public.family_events
where kind <> 'external_event';

alter table public.family_events
  drop constraint if exists family_events_kind_check;

alter table public.family_events
  add constraint family_events_kind_check
  check (kind = 'external_event');

comment on table public.family_events is
  'Saved external weekend-event decisions only. Meal, shopping, logistics, and recurring planning are retired.';

-- Recurring grocery and logistics definitions have no active consumer.
drop table if exists public.family_recurring_items;

-- Retire the denormalized profile stores after the application has stopped
-- reading them. IF EXISTS keeps this safe across environments that already
-- applied an earlier partial cleanup.
alter table public.profiles drop column if exists food_plan;
alter table public.profiles drop column if exists amazon_errands;

-- Remove meal-only child profile fields from the JSON profile document while
-- retaining identity, location, activity, and caption preferences.
update public.profiles
set child_profile = case
  when jsonb_typeof(child_profile->'children') = 'array' then jsonb_set(
    child_profile,
    '{children}',
    coalesce((
      select jsonb_agg(child - 'foodPreferences' - 'allergies' - 'feedingStage')
      from jsonb_array_elements(child_profile->'children') as child
    ), '[]'::jsonb),
    true
  )
  else child_profile - 'foodPreferences' - 'allergies' - 'feedingStage'
end,
updated_at = now()
where child_profile is not null;

commit;
