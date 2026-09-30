-- Allow newly uploaded practice-story reference photos in the reusable family library.
alter table public.family_saved_photos
drop constraint if exists family_saved_photos_source_kind_check;

alter table public.family_saved_photos
add constraint family_saved_photos_source_kind_check
check (source_kind in ('upload', 'picture_book', 'toy_play', 'practice_story'));
