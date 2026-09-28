-- Add a story page type while retaining the existing picture-book asset model.
alter table public.picture_book_template_pages
  drop constraint if exists picture_book_template_pages_page_type_check;
alter table public.picture_book_template_pages
  drop constraint if exists picture_book_template_pages_check;

alter table public.picture_book_template_pages
  add constraint picture_book_template_pages_page_type_check
  check (page_type in ('cover', 'career', 'story'));
alter table public.picture_book_template_pages
  add constraint picture_book_template_pages_role_check
  check (
    (page_type = 'cover' and career_key is null)
    or (page_type in ('career', 'story') and career_key is not null)
  );

insert into public.picture_book_templates (slug, name, version, description)
values (
  'kindergarten-transition-zh-v1',
  '我要上幼儿园啦！',
  1,
  'A warm Mandarin-English story that helps toddlers prepare for kindergarten.'
)
on conflict (slug) do update set
  name = excluded.name,
  version = excluded.version,
  description = excluded.description,
  is_active = true;

with template as (
  select id from public.picture_book_templates where slug = 'kindergarten-transition-zh-v1'
)
insert into public.picture_book_template_pages (
  template_id, page_key, page_order, page_type, career_key,
  title_zh, title_en, body_zh, body_en, generation_spec
)
select
  template.id, pages.page_key, pages.page_order, pages.page_type, pages.story_key,
  pages.title_zh, pages.title_en, pages.body_zh, pages.body_en, pages.generation_spec
from template
cross join (values
  ('cover', 0, 'cover', null, '我要上幼儿园啦！', 'Going to Kindergarten!', '和小象一起，开启新的一天。', 'A new day begins with a little elephant friend.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"at the warm Elephant Kindergarten gate, child with a light-blue backpack faces the school and turns back to invite the reader","expression":"bright, reassured smile","angle":"three-quarter back with face turned toward camera"}'::jsonb),
  ('morning-ready', 1, 'story', 'morning-ready', '今天有点不一样', 'A Different Morning', '今天，我要去幼儿园啦。', 'Today, I am going to kindergarten.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a warm morning bedroom, getting dressed beside a small backpack and shoes, a parent hand gently adjusts the child’s collar","expression":"curious and calm","angle":"three-quarter right"}'::jsonb),
  ('courage-sticker', 2, 'story', 'courage-sticker', '小象勇气贴纸', 'My Little Elephant Sticker', '紧张的时候，摸摸它，就像家人在身边。', 'When I feel wobbly, I can touch it and feel my family near.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a parent hand places a small elephant courage sticker on the backpack shoulder strap","expression":"watching with a hopeful small smile","angle":"looking down, three-quarter left"}'::jsonb),
  ('walk-to-school', 3, 'story', 'walk-to-school', '我们去幼儿园', 'Off We Go', '我背好小书包，出发啦。', 'My little backpack is on. Off I go.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"walking toward kindergarten in soft morning light, holding an adult hand shown only from the shoulder down","expression":"excited open-mouth smile","angle":"full face, walking toward camera"}'::jsonb),
  ('school-gate', 4, 'story', 'school-gate', '小象幼儿园', 'Elephant Kindergarten', '门口的小象在欢迎我。', 'The little elephant welcomes me.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"at a nature-inspired kindergarten entrance with wood, green hills, rainbow decoration and a friendly elephant mascot","expression":"wide-eyed wonder","angle":"looking slightly upward, three-quarter right"}'::jsonb),
  ('goodbye-hug', 5, 'story', 'goodbye-hug', '抱一抱，再见', 'A Hug, Then Goodbye', '妈妈爸爸会回来接我。', 'My family will come back for me.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a safe goodbye hug with an adult crouched from behind, no adult face visible","expression":"a tiny tearful but brave smile","angle":"profile, resting against the hug"}'::jsonb),
  ('new-classroom', 6, 'story', 'new-classroom', '新的教室', 'A New Classroom', '这里有书，有植物，还有好多玩具。', 'There are books, plants, and so many toys.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"exploring a sunny classroom with low wooden shelves, plants, books and an elephant cushion","expression":"quietly interested","angle":"three-quarter back, head turned left"}'::jsonb),
  ('meet-teacher', 7, 'story', 'meet-teacher', '老师你好', 'Hello, Teacher', '老师笑着和我打招呼。', 'My teacher smiles and says hello.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a teacher kneels nearby with open hands at child height; teacher is softly rendered and secondary","expression":"shy closed-lip smile","angle":"full face with lowered chin"}'::jsonb),
  ('elephant-friend', 8, 'story', 'elephant-friend', '小象朋友', 'My Elephant Friend', '小象说：我们一起玩吧！', 'My elephant friend says, Let’s play.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"meeting a round plush elephant toy in a cozy reading corner","expression":"delighted giggle","angle":"looking down at the toy, three-quarter right"}'::jsonb),
  ('morning-circle', 9, 'story', 'morning-circle', '早安圈圈时间', 'Morning Circle', '我们一起唱歌，听故事。', 'We sing and listen to a story together.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"sitting in a small story circle with classmates softly in the background","expression":"listening with an open, relaxed mouth","angle":"left profile"}'::jsonb),
  ('building-blocks', 10, 'story', 'building-blocks', '搭一座高高的塔', 'Building a Tall Tower', '我和朋友一起搭积木。', 'My friend and I build with blocks.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"building a colorful wooden block tower with one toddler friend","expression":"concentrating with tongue slightly out","angle":"looking down, full face"}'::jsonb),
  ('snack-time', 11, 'story', 'snack-time', '点心时间', 'Snack Time', '小手洗干净，点心真香。', 'Clean hands, and a yummy snack.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"having a simple fruit snack at a child-size table with an elephant placemat","expression":"pleased little chew","angle":"three-quarter left"}'::jsonb),
  ('wash-hands', 12, 'story', 'wash-hands', '泡泡洗小手', 'Bubbly Clean Hands', '搓一搓，冲一冲，小手干净啦。', 'Rub, rinse, and my hands are clean.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"washing hands at a low sink with gentle soap bubbles and elephant tile detail","expression":"surprised happy O mouth","angle":"looking down from three-quarter right"}'::jsonb),
  ('outdoor-play', 13, 'story', 'outdoor-play', '户外游戏', 'Outdoor Play', '风吹过来，我跑呀跑。', 'The breeze comes by, and I run and run.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"running in a safe kindergarten garden with soft grass, rainbow and elephant play sculpture","expression":"joyful laugh","angle":"three-quarter forward motion"}'::jsonb),
  ('missing-home', 14, 'story', 'missing-home', '想家了怎么办', 'When I Miss Home', '我摸摸小象贴纸，深呼吸。', 'I touch my elephant sticker and take a deep breath.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a quiet moment by a sunny classroom window, hand touching the elephant sticker on the backpack","expression":"thoughtful, settling after a small frown","angle":"side profile looking down"}'::jsonb),
  ('friend-shares', 15, 'story', 'friend-shares', '朋友一起玩', 'Friends Play Together', '朋友把玩具分给我。', 'A friend shares a toy with me.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a classmate offers a toy elephant; other child remains secondary and unidentifiable","expression":"surprised grateful smile","angle":"three-quarter left, reaching forward"}'::jsonb),
  ('art-time', 16, 'story', 'art-time', '画一只小象', 'Painting an Elephant', '我画了一只大耳朵小象。', 'I paint an elephant with big ears.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"making a watercolor elephant painting at an art table, sleeves gently rolled up","expression":"proud focused smile","angle":"looking down, three-quarter right"}'::jsonb),
  ('pickup-smile', 17, 'story', 'pickup-smile', '家人来接我啦', 'My Family Is Here', '我跑过去，给家人一个大大的拥抱。', 'I run over for a great big hug.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"at pick-up time near the gate, running toward an adult shown from behind only","expression":"beaming toothy smile","angle":"full face, running toward camera"}'::jsonb),
  ('blessing', 18, 'story', 'blessing', '明天也会很勇敢', 'Brave Again Tomorrow', '幼儿园里，有新的朋友和新的快乐。', 'At kindergarten, new friends and joys are waiting.', '{"templateKind":"kindergarten-transition","imageSize":"2048x1024","scene":"a peaceful warm sunset outside Elephant Kindergarten with backpack and elephant sticker visible","expression":"confident relaxed smile","angle":"three-quarter back, looking over shoulder"}'::jsonb)
) as pages(page_key, page_order, page_type, story_key, title_zh, title_en, body_zh, body_en, generation_spec)
on conflict (template_id, page_key) do update set
  page_order = excluded.page_order,
  page_type = excluded.page_type,
  career_key = excluded.career_key,
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  body_zh = excluded.body_zh,
  body_en = excluded.body_en,
  generation_spec = excluded.generation_spec;
