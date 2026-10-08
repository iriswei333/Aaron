-- Male-main-character companions for the three girl-led Mandarin templates.

-- The original kindergarten v1 is the male edition; make that intent explicit.
update public.picture_book_template_pages
set generation_spec = (generation_spec - 'femaleMainCharacter') || jsonb_build_object(
  'templateVariant', 'male-main-character',
  'maleMainCharacter', true
)
where template_id = (select id from public.picture_book_templates where slug = 'kindergarten-transition-zh-v1');

with templates(slug, name, description) as (values
  ('family-love-zh-v2', '我们的爱抱抱·男孩版', 'A warm Mandarin-English family-affection story with a boy as the main character.'),
  ('moon-imagination-zh-v2', '月亮的小秘密·男孩版', 'An original Mandarin-English moon-imagination bedtime story with a boy as the main character.'),
  ('square-recognition-zh-v2', '世界有很多正方形·男孩版', 'A bilingual boy-led toddler book for finding squares in everyday life.')
)
insert into public.picture_book_templates (slug, name, version, description)
select slug, name, 2, description from templates
on conflict (slug) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  is_active = true;

with template_map(source_slug, target_slug) as (values
  ('family-love-zh-v1', 'family-love-zh-v2'),
  ('moon-imagination-zh-v1', 'moon-imagination-zh-v2'),
  ('square-recognition-zh-v1', 'square-recognition-zh-v2')
), source_pages as (
  select
    target.id as template_id,
    source.page_key,
    source.page_order,
    source.page_type,
    source.career_key,
    source.title_zh,
    source.title_en,
    source.body_zh,
    source.body_en,
    (source.generation_spec - 'femaleMainCharacter') || jsonb_build_object(
      'templateVariant', 'male-main-character',
      'maleMainCharacter', true
    ) as generation_spec
  from template_map
  join public.picture_book_templates source_template on source_template.slug = template_map.source_slug
  join public.picture_book_templates target on target.slug = template_map.target_slug
  join public.picture_book_template_pages source on source.template_id = source_template.id
)
insert into public.picture_book_template_pages (
  template_id, page_key, page_order, page_type, career_key,
  title_zh, title_en, body_zh, body_en, generation_spec
)
select
  template_id, page_key, page_order, page_type, career_key,
  title_zh, title_en, body_zh, body_en, generation_spec
from source_pages
on conflict (template_id, page_key) do update set
  page_order = excluded.page_order,
  page_type = excluded.page_type,
  career_key = excluded.career_key,
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  body_zh = excluded.body_zh,
  body_en = excluded.body_en,
  generation_spec = excluded.generation_spec;
