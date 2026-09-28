-- Three original templates based on the public brief themes: family affection, moon imagination, and squares.
with templates(slug, name, description) as (values
  ('family-love-zh-v1', '我们的爱抱抱', 'A warm Mandarin-English family-affection story with a girl as the main character.'),
  ('moon-imagination-zh-v1', '月亮的小秘密', 'An original Mandarin-English moon-imagination bedtime story with a girl as the main character.'),
  ('square-recognition-zh-v1', '世界有很多正方形', 'A bilingual girl-led toddler book for finding squares in everyday life.')
)
insert into public.picture_book_templates (slug, name, version, description)
select slug, name, 1, description from templates
on conflict (slug) do update set name = excluded.name, version = excluded.version, description = excluded.description, is_active = true;

with pages(slug, page_key, page_order, page_type, page_role, title_zh, title_en, body_zh, body_en, template_kind, theme) as (values
  ('family-love-zh-v1','cover',0,'cover',null,'我们的爱抱抱','Our Love Hugs','爱在每一天的小动作里。','Love lives in little everyday moments.','gentle-story','family-love'),
  ('family-love-zh-v1','morning-hug',1,'story','morning-hug','早安抱抱','Morning Hug','早上醒来，我先抱抱妈妈。','When I wake up, we share a hug.','gentle-story','family-love'),
  ('family-love-zh-v1','hold-hands',2,'story','hold-hands','牵牵手','Holding Hands','小手牵着大手，走呀走。','My small hand holds a big hand as we walk.','gentle-story','family-love'),
  ('family-love-zh-v1','little-kiss',3,'story','little-kiss','亲亲脸颊','A Little Kiss','轻轻亲一下，爱就飞出来。','A little kiss sends love flying.','gentle-story','family-love'),
  ('family-love-zh-v1','share-snack',4,'story','share-snack','一起分享','Sharing Together','我把好吃的分给妈妈。','I share something yummy with my mom.','gentle-story','family-love'),
  ('family-love-zh-v1','read-together',5,'story','read-together','一起读书','Reading Together','故事书里，也有我们的爱。','Our love is in every story we read.','gentle-story','family-love'),
  ('family-love-zh-v1','dance',6,'story','dance','跳个小舞','A Little Dance','音乐响起来，我们转圈圈。','Music plays, and we twirl around.','gentle-story','family-love'),
  ('family-love-zh-v1','helping',7,'story','helping','我来帮忙','I Can Help','我也会帮忙收好玩具。','I can help put toys away.','gentle-story','family-love'),
  ('family-love-zh-v1','rainy-day',8,'story','rainy-day','雨天也温暖','Warm on a Rainy Day','下雨了，伞下还是暖暖的。','Even on rainy days, we feel warm together.','gentle-story','family-love'),
  ('family-love-zh-v1','goodnight',9,'story','goodnight','晚安亲亲','Goodnight Kiss','晚安，妈妈，我爱你。','Goodnight, Mom. I love you.','gentle-story','family-love'),
  ('family-love-zh-v1','love-always',10,'story','love-always','爱一直都在','Love Is Always Here','不管在哪里，爱一直都在。','Wherever we are, love is always here.','gentle-story','family-love'),
  ('moon-imagination-zh-v1','cover',0,'cover',null,'月亮的小秘密','The Moon’s Little Secret','和月亮朋友一起想象。','Let’s imagine with our moon friend.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','moon-hello',1,'story','moon-hello','月亮你好','Hello, Moon','月亮圆圆的，在天上眨眼睛。','The round moon twinkles in the sky.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','what-taste',2,'story','what-taste','月亮是什么味道','What Could the Moon Taste Like?','月亮会不会甜甜的？','Could the moon taste sweet?','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','reach-high',3,'story','reach-high','伸得高高','Reach Up High','我踮起脚尖，想碰一碰月亮。','I stand on tiptoe and reach for the moon.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','animal-friends',4,'story','animal-friends','朋友来帮忙','Friends Come Along','小动物们也想一起看看。','Animal friends want to look too.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','moonlight-path',5,'story','moonlight-path','月光小路','A Moonlit Path','月光变成一条亮亮的小路。','Moonlight becomes a shining little path.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','cloud-boat',6,'story','cloud-boat','云朵小船','Cloud Boat','我们坐上软软的云朵小船。','We ride a soft cloud boat in our imaginations.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','share-wish',7,'story','share-wish','分享愿望','Sharing Wishes','我把一个愿望送给月亮。','I send one wish to the moon.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','moon-glow',8,'story','moon-glow','月亮的光','Moon Glow','月亮把温柔的光送给大家。','The moon shares gentle light with everyone.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','home-again',9,'story','home-again','回到家里','Back Home','月亮陪我走回温暖的家。','The moon walks me home in its gentle light.','gentle-story','moon-imagination'),
  ('moon-imagination-zh-v1','goodnight-moon',10,'story','goodnight-moon','晚安，月亮','Goodnight, Moon','我闭上眼睛，月亮还在窗外。','I close my eyes, and the moon is still outside.','gentle-story','moon-imagination'),
  ('square-recognition-zh-v1','cover',0,'cover',null,'世界有很多正方形','So Many Squares Around Us','一起在生活里找正方形。','Let’s find squares in everyday life.','recognition','squares'),
  ('square-recognition-zh-v1','square-window',1,'story','square-window','正方形窗户','Square Window','窗户是正方形的。','The window is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-block',2,'story','square-block','正方形积木','Square Block','积木是正方形的。','The block is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-cracker',3,'story','square-cracker','正方形饼干','Square Cracker','饼干是正方形的。','The cracker is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-photo',4,'story','square-photo','正方形照片','Square Photo','照片是正方形的。','The photo is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-puzzle',5,'story','square-puzzle','正方形拼图','Square Puzzle','拼图是正方形的。','The puzzle is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-gift',6,'story','square-gift','正方形礼物','Square Gift','礼物盒是正方形的。','The gift box is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-tile',7,'story','square-tile','正方形地砖','Square Tile','地砖是正方形的。','The tile is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-book',8,'story','square-book','正方形书本','Square Book','书本是正方形的。','The book is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-cushion',9,'story','square-cushion','正方形靠垫','Square Cushion','靠垫是正方形的。','The cushion is a square.','recognition','squares'),
  ('square-recognition-zh-v1','square-found',10,'story','square-found','我找到正方形啦','I Found a Square','生活里有好多正方形。','There are squares all around us.','recognition','squares')
)
insert into public.picture_book_template_pages (template_id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec)
select templates.id, pages.page_key, pages.page_order, pages.page_type, pages.page_role, pages.title_zh, pages.title_en, pages.body_zh, pages.body_en,
  jsonb_build_object('templateKind', pages.template_kind, 'storyTheme', pages.theme, 'recognitionTheme', pages.theme, 'imageSize', case when pages.template_kind = 'gentle-story' then '2048x1024' else '1024x1024' end, 'cover', pages.page_type = 'cover', 'femaleMainCharacter', true)
from pages join public.picture_book_templates templates on templates.slug = pages.slug
on conflict (template_id, page_key) do update set page_order = excluded.page_order, page_type = excluded.page_type, career_key = excluded.career_key, title_zh = excluded.title_zh, title_en = excluded.title_en, body_zh = excluded.body_zh, body_en = excluded.body_en, generation_spec = excluded.generation_spec;
