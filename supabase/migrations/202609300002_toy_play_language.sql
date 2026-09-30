-- Preserve the language chosen when a family generates and saves a toy-play idea.

alter table public.family_toy_play_assets
  add column if not exists language text not null default 'en';

alter table public.family_toy_play_assets
  drop constraint if exists family_toy_play_assets_language_check;

alter table public.family_toy_play_assets
  add constraint family_toy_play_assets_language_check
  check (language in ('en', 'zh-CN'));
