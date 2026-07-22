alter table public.profiles
alter column child_profile set default '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb;

with legacy_profiles as (
  select
    id,
    child_profile,
    concat('child-', replace(gen_random_uuid()::text, '-', '')) as child_id
  from public.profiles
  where child_profile is not null
    and not (child_profile ? 'children')
)
update public.profiles profile
set child_profile = jsonb_build_object(
  'activeChildId', legacy.child_id,
  'children', jsonb_build_array(jsonb_build_object(
    'id', legacy.child_id,
    'name', coalesce(legacy.child_profile->>'name', ''),
    'birthday', coalesce(legacy.child_profile->>'birthday', ''),
    'ageLabel', coalesce(legacy.child_profile->>'ageLabel', ''),
    'homeCity', coalesce(legacy.child_profile->>'homeCity', ''),
    'foodPreferences', coalesce(legacy.child_profile->>'foodPreferences', ''),
    'allergies', coalesce(legacy.child_profile->>'allergies', ''),
    'favoriteActivities', coalesce(legacy.child_profile->'favoriteActivities', '[]'::jsonb),
    'captionLanguage', coalesce(legacy.child_profile->>'captionLanguage', 'zh-CN'),
    'captionTone', coalesce(legacy.child_profile->>'captionTone', '温柔可爱'),
    'useRealNameInCaptions', coalesce((legacy.child_profile->>'useRealNameInCaptions')::boolean, false)
  )),
  'onboardingComplete', coalesce((legacy.child_profile->>'onboardingComplete')::boolean, false)
)
from legacy_profiles legacy
where profile.id = legacy.id;

update public.profiles
set child_profile = '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb
where child_profile is null;
