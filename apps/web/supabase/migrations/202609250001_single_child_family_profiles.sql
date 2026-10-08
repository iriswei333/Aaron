begin;

with child_candidates as (
  select
    profile.id,
    profile.child_profile,
    coalesce(
      (
        select child.value
        from jsonb_array_elements(coalesce(profile.child_profile->'children', '[]'::jsonb)) as child(value)
        where child.value->>'id' = profile.child_profile->>'activeChildId'
        limit 1
      ),
      profile.child_profile->'children'->0
    ) as selected_child
  from public.profiles profile
), normalized as (
  select
    id,
    selected_child,
    case
      when (selected_child->>'ageMonths') ~ '^\d{1,3}$'
        then least(120, greatest(0, (selected_child->>'ageMonths')::int))
      when lower(coalesce(selected_child->>'ageLabel', '')) ~ '^\d{1,3}m$'
        then least(120, regexp_replace(lower(selected_child->>'ageLabel'), '[^0-9]', '', 'g')::int)
      when lower(coalesce(selected_child->>'ageLabel', '')) ~ '^\d{1,2}y( \d{1,2}m)?$'
        then least(120,
          split_part(lower(selected_child->>'ageLabel'), 'y', 1)::int * 12
          + coalesce(nullif(regexp_replace(split_part(lower(selected_child->>'ageLabel'), 'y', 2), '[^0-9]', '', 'g'), '')::int, 0)
        )
      else null
    end as age_months
  from child_candidates
)
update public.profiles profile
set child_profile = case
  when normalized.selected_child is null then
    '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb
  else jsonb_build_object(
    'activeChildId', coalesce(normalized.selected_child->>'id', ''),
    'children', jsonb_build_array(
      normalized.selected_child || jsonb_build_object(
        'ageMonths', normalized.age_months,
        'ageLabel', case when normalized.age_months is null then coalesce(normalized.selected_child->>'ageLabel', '') else normalized.age_months::text || 'm' end,
        'storyLanguage', coalesce(
          nullif(normalized.selected_child->>'storyLanguage', ''),
          case normalized.selected_child->>'captionLanguage'
            when 'zh-CN' then 'zh-CN'
            when 'bilingual' then 'bilingual'
            else 'en'
          end
        ),
        'favoriteActivities', coalesce(normalized.selected_child->'favoriteActivities', normalized.selected_child->'favorites', '[]'::jsonb),
        'practicingSteps', coalesce(normalized.selected_child->'practicingSteps', '[]'::jsonb)
      )
    ),
    'onboardingComplete', coalesce(nullif(normalized.selected_child->>'name', '') is not null and normalized.age_months is not null, false)
  )
end,
updated_at = now()
from normalized
where profile.id = normalized.id;

alter table public.profiles
  drop constraint if exists profiles_single_child_profile_check;

alter table public.profiles
  add constraint profiles_single_child_profile_check
  check (
    jsonb_typeof(child_profile->'children') = 'array'
    and jsonb_array_length(child_profile->'children') <= 1
  );

alter table public.profiles
  alter column child_profile set default '{"activeChildId":"","children":[],"onboardingComplete":false}'::jsonb;

comment on column public.profiles.child_profile is
  'One-child family profile containing ageMonths, storyLanguage, favoriteActivities, and practicingSteps.';

commit;
