create table if not exists public.picture_book_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  version integer not null default 1,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.picture_book_template_pages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.picture_book_templates(id) on delete cascade,
  page_key text not null,
  page_order integer not null,
  page_type text not null check (page_type in ('cover', 'career')),
  career_key text,
  title_zh text not null default '',
  title_en text not null default '',
  body_zh text not null default '',
  body_en text not null default '',
  generation_spec jsonb not null default '{}'::jsonb,
  asset_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, page_key),
  unique (template_id, page_order),
  check ((page_type = 'cover' and career_key is null) or (page_type = 'career' and career_key is not null))
);

create table if not exists public.family_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id text,
  asset_type text not null check (asset_type in ('picture_book')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_picture_books (
  asset_id uuid primary key references public.family_assets(id) on delete cascade,
  template_id uuid not null references public.picture_book_templates(id),
  child_name text not null default '',
  model text not null default 'gpt-image-2.5-sunburst',
  quality text not null default 'high',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_picture_book_source_photos (
  id uuid primary key default gen_random_uuid(),
  book_asset_id uuid not null references public.family_picture_books(asset_id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (book_asset_id, sort_order)
);

create table if not exists public.family_picture_book_pages (
  id uuid primary key default gen_random_uuid(),
  book_asset_id uuid not null references public.family_picture_books(asset_id) on delete cascade,
  template_page_id uuid not null references public.picture_book_template_pages(id),
  page_key text not null,
  page_order integer not null,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  storage_path text,
  generation_error text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_asset_id, page_key),
  unique (book_asset_id, page_order)
);

create index if not exists family_assets_profile_created_idx on public.family_assets (profile_id, created_at desc);
create index if not exists family_picture_book_pages_book_order_idx on public.family_picture_book_pages (book_asset_id, page_order);
create index if not exists picture_book_template_pages_template_order_idx on public.picture_book_template_pages (template_id, page_order);

drop trigger if exists picture_book_templates_set_updated_at on public.picture_book_templates;
create trigger picture_book_templates_set_updated_at before update on public.picture_book_templates for each row execute function public.set_updated_at();
drop trigger if exists picture_book_template_pages_set_updated_at on public.picture_book_template_pages;
create trigger picture_book_template_pages_set_updated_at before update on public.picture_book_template_pages for each row execute function public.set_updated_at();
drop trigger if exists family_assets_set_updated_at on public.family_assets;
create trigger family_assets_set_updated_at before update on public.family_assets for each row execute function public.set_updated_at();
drop trigger if exists family_picture_books_set_updated_at on public.family_picture_books;
create trigger family_picture_books_set_updated_at before update on public.family_picture_books for each row execute function public.set_updated_at();
drop trigger if exists family_picture_book_pages_set_updated_at on public.family_picture_book_pages;
create trigger family_picture_book_pages_set_updated_at before update on public.family_picture_book_pages for each row execute function public.set_updated_at();

alter table public.picture_book_templates enable row level security;
alter table public.picture_book_template_pages enable row level security;
alter table public.family_assets enable row level security;
alter table public.family_picture_books enable row level security;
alter table public.family_picture_book_source_photos enable row level security;
alter table public.family_picture_book_pages enable row level security;

create policy "read active picture book templates" on public.picture_book_templates for select to authenticated using (is_active);
create policy "read active picture book template pages" on public.picture_book_template_pages for select to authenticated using (exists (select 1 from public.picture_book_templates t where t.id = template_id and t.is_active));
create policy "family manages own assets" on public.family_assets for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "family manages own picture books" on public.family_picture_books for all to authenticated using (exists (select 1 from public.family_assets a where a.id = asset_id and a.profile_id = (select auth.uid()))) with check (exists (select 1 from public.family_assets a where a.id = asset_id and a.profile_id = (select auth.uid())));
create policy "family manages own book references" on public.family_picture_book_source_photos for all to authenticated using (exists (select 1 from public.family_assets a join public.family_picture_books b on b.asset_id = a.id where b.asset_id = book_asset_id and a.profile_id = (select auth.uid()))) with check (exists (select 1 from public.family_assets a join public.family_picture_books b on b.asset_id = a.id where b.asset_id = book_asset_id and a.profile_id = (select auth.uid())));
create policy "family manages own book pages" on public.family_picture_book_pages for all to authenticated using (exists (select 1 from public.family_assets a join public.family_picture_books b on b.asset_id = a.id where b.asset_id = book_asset_id and a.profile_id = (select auth.uid()))) with check (exists (select 1 from public.family_assets a join public.family_picture_books b on b.asset_id = a.id where b.asset_id = book_asset_id and a.profile_id = (select auth.uid())));

insert into storage.buckets (id, name, public)
values ('family-assets', 'family-assets', false)
on conflict (id) do nothing;

create policy "family reads own asset objects" on storage.objects for select to authenticated using (bucket_id = 'family-assets' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "family inserts own asset objects" on storage.objects for insert to authenticated with check (bucket_id = 'family-assets' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "family updates own asset objects" on storage.objects for update to authenticated using (bucket_id = 'family-assets' and split_part(name, '/', 1) = (select auth.uid())::text) with check (bucket_id = 'family-assets' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "family deletes own asset objects" on storage.objects for delete to authenticated using (bucket_id = 'family-assets' and split_part(name, '/', 1) = (select auth.uid())::text);

insert into public.picture_book_templates (slug, name, version, description)
values ('career-recognition-v1', 'My First Jobs', 1, 'Bilingual career-recognition book for toddlers ages 0–3.')
on conflict (slug) do update set name = excluded.name, version = excluded.version, description = excluded.description, is_active = true;

with template as (select id from public.picture_book_templates where slug = 'career-recognition-v1')
insert into public.picture_book_template_pages (template_id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec)
select template.id, pages.page_key, pages.page_order, pages.page_type, pages.career_key, pages.title_zh, pages.title_en, pages.body_zh, pages.body_en, pages.generation_spec
from template cross join (values
  ('cover', 0, 'cover', null, '我的第一本职业认知书', 'My First Jobs', '中英双语•0-3岁宝宝职业启蒙', 'A Bilingual Book of Jobs for Babies', '{"layout":"four-career cover","ageBadge":"0-3岁适用"}'::jsonb),
  ('doctor', 1, 'career', 'doctor', '医生', 'Doctor', '医生帮助我们保持健康。', 'Doctors help us stay healthy.', '{"angle":"full face","expression":"gentle closed-lip smile","scene":"white doctor coat, aqua clothing, toy stethoscope examining teddy bear, toy medical kit"}'::jsonb),
  ('firefighter', 2, 'career', 'firefighter', '消防员', 'Firefighter', '消防员灭火，保护我们。', 'Firefighters put out fires and keep us safe.', '{"angle":"three-quarter left","expression":"natural open-mouth laugh","scene":"coral firefighter costume, toy hose, toy fire truck"}'::jsonb),
  ('police-officer', 3, 'career', 'police-officer', '警察', 'Police Officer', '警察保护我们的安全。', 'Police officers keep us safe.', '{"angle":"looking down, slight right turn","expression":"focused neutral closed mouth","scene":"soft navy uniform, toy walkie-talkie, toy police car, no weapons"}'::jsonb),
  ('astronaut', 4, 'career', 'astronaut', '宇航员', 'Astronaut', '宇航员探索太空。', 'Astronauts explore space.', '{"angle":"three-quarter right, slightly up","expression":"quiet wonder, small relaxed O mouth","scene":"ivory astronaut suit, toy rocket, helmet beside child"}'::jsonb),
  ('chef', 5, 'career', 'chef', '厨师', 'Chef', '厨师制作美味的食物。', 'Chefs make delicious food.', '{"angle":"looking down, slight left turn","expression":"contented asymmetric closed-lip smile","scene":"cream chef coat, apricot apron, soft chef hat, mixing bowl"}'::jsonb),
  ('teacher', 6, 'career', 'teacher', '老师', 'Teacher', '老师帮助我们学习。', 'Teachers help us learn.', '{"angle":"full face with gentle tilt","expression":"encouraging mid-speech expression","scene":"sky-blue cardigan, animal picture book, small book stack"}'::jsonb),
  ('pilot', 7, 'career', 'pilot', '飞行员', 'Pilot', '飞行员驾驶飞机。', 'Pilots fly airplanes.', '{"angle":"three-quarter right","expression":"playful wink and closed-lip grin","scene":"navy pilot jacket, comfortable cap, toy airplane"}'::jsonb),
  ('scientist', 8, 'career', 'scientist', '科学家', 'Scientist', '科学家探索世界。', 'Scientists explore the world.', '{"angle":"looking down, three-quarter left","expression":"curious slight brow furrow","scene":"white lab coat, toy magnifying glass, leaf, no chemicals"}'::jsonb),
  ('race-car-driver', 9, 'career', 'race-car-driver', '赛车手', 'Race Car Driver', '赛车手驾驶赛车。', 'Race car drivers drive race cars.', '{"angle":"full face, chin slightly raised","expression":"proud tooth-showing grin","scene":"cream racing suit, toy trophy, toy race car"}'::jsonb)
) as pages(page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec)
on conflict (template_id, page_key) do update set page_order = excluded.page_order, title_zh = excluded.title_zh, title_en = excluded.title_en, body_zh = excluded.body_zh, body_en = excluded.body_en, generation_spec = excluded.generation_spec;
