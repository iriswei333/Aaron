-- A separate, reusable female-main-character variation of the kindergarten story.
insert into public.picture_book_templates (slug, name, version, description)
values (
  'kindergarten-transition-zh-v2',
  '我要上幼儿园啦！·女孩版',
  2,
  'A warm Mandarin-English kindergarten story with a girl as the main character.'
)
on conflict (slug) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  is_active = true;

with target_template as (
  select id from public.picture_book_templates where slug = 'kindergarten-transition-zh-v2'
), source_pages as (
  select
    page_key,
    page_order,
    page_type,
    career_key,
    case when page_key = 'cover' then '我要上幼儿园啦！' else title_zh end as title_zh,
    case when page_key = 'cover' then 'Going to Kindergarten!' else title_en end as title_en,
    body_zh,
    body_en,
    generation_spec || jsonb_build_object(
      'templateVariant', 'female-main-character',
      'femaleMainCharacter', true,
      'palette', 'peach, lilac, butter yellow, sage and soft sky blue',
      'backpack', 'a light-lilac backpack with the elephant courage sticker'
    ) as generation_spec
  from public.picture_book_template_pages
  where template_id = (select id from public.picture_book_templates where slug = 'kindergarten-transition-zh-v1')
)
insert into public.picture_book_template_pages (
  template_id, page_key, page_order, page_type, career_key,
  title_zh, title_en, body_zh, body_en, generation_spec
)
select
  target_template.id,
  source_pages.page_key,
  source_pages.page_order,
  source_pages.page_type,
  source_pages.career_key,
  source_pages.title_zh,
  source_pages.title_en,
  source_pages.body_zh,
  source_pages.body_en,
  source_pages.generation_spec
from target_template
cross join source_pages
on conflict (template_id, page_key) do update set
  page_order = excluded.page_order,
  page_type = excluded.page_type,
  career_key = excluded.career_key,
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  body_zh = excluded.body_zh,
  body_en = excluded.body_en,
  generation_spec = excluded.generation_spec;
