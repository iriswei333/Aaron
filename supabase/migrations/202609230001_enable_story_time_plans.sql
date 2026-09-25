begin;

alter table public.family_events
  drop constraint if exists family_events_kind_check;

alter table public.family_events
  add constraint family_events_kind_check
  check (kind in ('external_event', 'story_time'));

comment on column public.family_events.kind is
  'Saved Discover plan type: external_event or story_time.';

comment on table public.family_events is
  'Saved weekend-event and story-time decisions belonging to a family.';

commit;
