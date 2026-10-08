-- Four original toddler-recognition templates derived from the public category briefs.
with templates(slug, name, description) as (values
  ('emotion-recognition-zh-v1', '我的情绪小书', 'A bilingual toddler book for recognizing feelings and beginning family conversations.'),
  ('color-recognition-zh-v1', '我的颜色小书', 'A bilingual toddler book for discovering colors through everyday objects.'),
  ('body-recognition-zh-v1', '我的身体小书', 'A bilingual toddler book for learning body-part words through safe everyday actions.'),
  ('transport-recognition-zh-v1', '我的交通工具小书', 'A bilingual toddler book for recognizing familiar vehicles.')
)
insert into public.picture_book_templates (slug, name, version, description)
select slug, name, 1, description from templates
on conflict (slug) do update set name = excluded.name, version = excluded.version, description = excluded.description, is_active = true;

with template_pages(slug, page_key, page_order, page_type, recognition_key, title_zh, title_en, body_zh, body_en, theme) as (values
  ('emotion-recognition-zh-v1','cover',0,'cover',null,'我的情绪小书','My Little Feelings Book','认识每一种心情。','Every feeling is welcome.','emotions'),
  ('emotion-recognition-zh-v1','happy',1,'story','happy','开心','Happy','这是开心。','This is happy.','emotions'),
  ('emotion-recognition-zh-v1','sad',2,'story','sad','伤心','Sad','这是伤心。','This is sad.','emotions'),
  ('emotion-recognition-zh-v1','angry',3,'story','angry','生气','Angry','这是生气。','This is angry.','emotions'),
  ('emotion-recognition-zh-v1','scared',4,'story','scared','害怕','Scared','这是害怕。','This is scared.','emotions'),
  ('emotion-recognition-zh-v1','surprised',5,'story','surprised','惊讶','Surprised','这是惊讶。','This is surprised.','emotions'),
  ('emotion-recognition-zh-v1','shy',6,'story','shy','害羞','Shy','这是害羞。','This is shy.','emotions'),
  ('emotion-recognition-zh-v1','proud',7,'story','proud','自豪','Proud','这是自豪。','This is proud.','emotions'),
  ('emotion-recognition-zh-v1','worried',8,'story','worried','担心','Worried','这是担心。','This is worried.','emotions'),
  ('emotion-recognition-zh-v1','calm',9,'story','calm','平静','Calm','这是平静。','This is calm.','emotions'),
  ('emotion-recognition-zh-v1','excited',10,'story','excited','兴奋','Excited','这是兴奋。','This is excited.','emotions'),
  ('color-recognition-zh-v1','cover',0,'cover',null,'我的颜色小书','My Little Colors Book','一起发现缤纷的颜色。','Let’s discover colorful things.','colors'),
  ('color-recognition-zh-v1','red',1,'story','red','红色','Red','这是红色。','This is red.','colors'),
  ('color-recognition-zh-v1','orange',2,'story','orange','橙色','Orange','这是橙色。','This is orange.','colors'),
  ('color-recognition-zh-v1','yellow',3,'story','yellow','黄色','Yellow','这是黄色。','This is yellow.','colors'),
  ('color-recognition-zh-v1','green',4,'story','green','绿色','Green','这是绿色。','This is green.','colors'),
  ('color-recognition-zh-v1','blue',5,'story','blue','蓝色','Blue','这是蓝色。','This is blue.','colors'),
  ('color-recognition-zh-v1','purple',6,'story','purple','紫色','Purple','这是紫色。','This is purple.','colors'),
  ('color-recognition-zh-v1','pink',7,'story','pink','粉色','Pink','这是粉色。','This is pink.','colors'),
  ('color-recognition-zh-v1','brown',8,'story','brown','棕色','Brown','这是棕色。','This is brown.','colors'),
  ('color-recognition-zh-v1','black',9,'story','black','黑色','Black','这是黑色。','This is black.','colors'),
  ('color-recognition-zh-v1','white',10,'story','white','白色','White','这是白色。','This is white.','colors'),
  ('body-recognition-zh-v1','cover',0,'cover',null,'我的身体小书','My Little Body Book','认识我可爱的身体。','Let’s learn about my wonderful body.','body-parts'),
  ('body-recognition-zh-v1','eyes',1,'story','eyes','眼睛','Eyes','这是眼睛。','These are eyes.','body-parts'),
  ('body-recognition-zh-v1','ears',2,'story','ears','耳朵','Ears','这是耳朵。','These are ears.','body-parts'),
  ('body-recognition-zh-v1','nose',3,'story','nose','鼻子','Nose','这是鼻子。','This is a nose.','body-parts'),
  ('body-recognition-zh-v1','mouth',4,'story','mouth','嘴巴','Mouth','这是嘴巴。','This is a mouth.','body-parts'),
  ('body-recognition-zh-v1','hands',5,'story','hands','小手','Hands','这是小手。','These are hands.','body-parts'),
  ('body-recognition-zh-v1','feet',6,'story','feet','小脚','Feet','这是小脚。','These are feet.','body-parts'),
  ('body-recognition-zh-v1','tummy',7,'story','tummy','肚子','Tummy','这是肚子。','This is a tummy.','body-parts'),
  ('body-recognition-zh-v1','hair',8,'story','hair','头发','Hair','这是头发。','This is hair.','body-parts'),
  ('body-recognition-zh-v1','knees',9,'story','knees','膝盖','Knees','这是膝盖。','These are knees.','body-parts'),
  ('body-recognition-zh-v1','teeth',10,'story','teeth','牙齿','Teeth','这是牙齿。','These are teeth.','body-parts'),
  ('transport-recognition-zh-v1','cover',0,'cover',null,'我的交通工具小书','My Little Vehicles Book','一起认识会移动的朋友。','Let’s meet things that move.','transportation'),
  ('transport-recognition-zh-v1','car',1,'story','car','汽车','Car','这是汽车。','This is a car.','transportation'),
  ('transport-recognition-zh-v1','bus',2,'story','bus','公交车','Bus','这是公交车。','This is a bus.','transportation'),
  ('transport-recognition-zh-v1','train',3,'story','train','火车','Train','这是火车。','This is a train.','transportation'),
  ('transport-recognition-zh-v1','airplane',4,'story','airplane','飞机','Airplane','这是飞机。','This is an airplane.','transportation'),
  ('transport-recognition-zh-v1','ship',5,'story','ship','轮船','Ship','这是轮船。','This is a ship.','transportation'),
  ('transport-recognition-zh-v1','bicycle',6,'story','bicycle','自行车','Bicycle','这是自行车。','This is a bicycle.','transportation'),
  ('transport-recognition-zh-v1','fire-truck',7,'story','fire-truck','消防车','Fire Truck','这是消防车。','This is a fire truck.','transportation'),
  ('transport-recognition-zh-v1','excavator',8,'story','excavator','挖掘机','Excavator','这是挖掘机。','This is an excavator.','transportation'),
  ('transport-recognition-zh-v1','ambulance',9,'story','ambulance','救护车','Ambulance','这是救护车。','This is an ambulance.','transportation'),
  ('transport-recognition-zh-v1','rocket',10,'story','rocket','火箭','Rocket','这是火箭。','This is a rocket.','transportation')
)
insert into public.picture_book_template_pages (
  template_id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec
)
select
  templates.id, pages.page_key, pages.page_order, pages.page_type, pages.recognition_key,
  pages.title_zh, pages.title_en, pages.body_zh, pages.body_en,
  jsonb_build_object('templateKind','recognition','recognitionTheme',pages.theme,'imageSize','1024x1024','cover',pages.page_type = 'cover')
from template_pages pages
join public.picture_book_templates templates on templates.slug = pages.slug
on conflict (template_id, page_key) do update set
  page_order = excluded.page_order,
  page_type = excluded.page_type,
  career_key = excluded.career_key,
  title_zh = excluded.title_zh,
  title_en = excluded.title_en,
  body_zh = excluded.body_zh,
  body_en = excluded.body_en,
  generation_spec = excluded.generation_spec;
