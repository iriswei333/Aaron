create index if not exists family_event_cache_source_location_dates_idx
  on public.family_event_cache (source, location_city, start_date, end_date, fetched_at desc);

comment on table public.family_event_cache is
  'Shared family-event discovery cache. Rows may be populated by the authenticated Discover API or the weekly social agent; filters.origin identifies the producer.';
