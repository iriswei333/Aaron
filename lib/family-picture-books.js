import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'picture-books.json');
const BUCKET = 'family-assets';
const DEFAULT_TEMPLATE_SLUG = 'career-recognition-v1';
const KINDERGARTEN_TEMPLATE_SLUG = 'kindergarten-transition-zh-v1';
const KINDERGARTEN_GIRL_TEMPLATE_SLUG = 'kindergarten-transition-zh-v2';
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CAREER_FALLBACK_PAGES = [
  ['cover', 0, 'cover', null, '我的第一本职业认知书', 'My First Jobs', '中英双语•0-3岁宝宝职业启蒙', 'A Bilingual Book of Jobs for Babies', { layout: 'four-career cover', ageBadge: '0-3岁适用' }],
  ['doctor', 1, 'career', 'doctor', '医生', 'Doctor', '医生帮助我们保持健康。', 'Doctors help us stay healthy.', { angle: 'full face', expression: 'gentle closed-lip smile', scene: 'white doctor coat, aqua clothing, toy stethoscope examining teddy bear, toy medical kit' }],
  ['firefighter', 2, 'career', 'firefighter', '消防员', 'Firefighter', '消防员灭火，保护我们。', 'Firefighters put out fires and keep us safe.', { angle: 'three-quarter left', expression: 'natural open-mouth laugh', scene: 'coral firefighter costume, toy hose, toy fire truck' }],
  ['police-officer', 3, 'career', 'police-officer', '警察', 'Police Officer', '警察保护我们的安全。', 'Police officers keep us safe.', { angle: 'looking down, slight right turn', expression: 'focused neutral closed mouth', scene: 'soft navy uniform, toy walkie-talkie, toy police car, no weapons' }],
  ['astronaut', 4, 'career', 'astronaut', '宇航员', 'Astronaut', '宇航员探索太空。', 'Astronauts explore space.', { angle: 'three-quarter right, slightly up', expression: 'quiet wonder, small relaxed O mouth', scene: 'ivory astronaut suit, toy rocket, helmet beside child' }],
  ['chef', 5, 'career', 'chef', '厨师', 'Chef', '厨师制作美味的食物。', 'Chefs make delicious food.', { angle: 'looking down, slight left turn', expression: 'contented asymmetric closed-lip smile', scene: 'cream chef coat, apricot apron, soft chef hat, mixing bowl' }],
  ['teacher', 6, 'career', 'teacher', '老师', 'Teacher', '老师帮助我们学习。', 'Teachers help us learn.', { angle: 'full face with gentle tilt', expression: 'encouraging mid-speech expression', scene: 'sky-blue cardigan, animal picture book, small book stack' }],
  ['pilot', 7, 'career', 'pilot', '飞行员', 'Pilot', '飞行员驾驶飞机。', 'Pilots fly airplanes.', { angle: 'three-quarter right', expression: 'playful wink and closed-lip grin', scene: 'navy pilot jacket, comfortable cap, toy airplane' }],
  ['scientist', 8, 'career', 'scientist', '科学家', 'Scientist', '科学家探索世界。', 'Scientists explore the world.', { angle: 'looking down, three-quarter left', expression: 'curious slight brow furrow', scene: 'white lab coat, toy magnifying glass, leaf, no chemicals' }],
  ['race-car-driver', 9, 'career', 'race-car-driver', '赛车手', 'Race Car Driver', '赛车手驾驶赛车。', 'Race car drivers drive race cars.', { angle: 'full face, chin slightly raised', expression: 'proud tooth-showing grin', scene: 'cream racing suit, toy trophy, toy race car' }],
].map(([pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec]) => ({
  id: `fallback-${pageKey}`, pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec,
}));

const KINDERGARTEN_FALLBACK_PAGES = [
  ['cover', 0, 'cover', null, '我要上幼儿园啦！', 'Going to Kindergarten!', '和小象一起，开启新的一天。', 'A new day begins with a little elephant friend.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'at the warm Elephant Kindergarten gate, child with a light-blue backpack faces the school and turns back to invite the reader', expression: 'bright, reassured smile', angle: 'three-quarter back with face turned toward camera' }],
  ['morning-ready', 1, 'story', 'morning-ready', '今天有点不一样', 'A Different Morning', '今天，我要去幼儿园啦。', 'Today, I am going to kindergarten.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a warm morning bedroom, getting dressed beside a small backpack and shoes, a parent hand gently adjusts the child’s collar', expression: 'curious and calm', angle: 'three-quarter right' }],
  ['courage-sticker', 2, 'story', 'courage-sticker', '小象勇气贴纸', 'My Little Elephant Sticker', '紧张的时候，摸摸它，就像家人在身边。', 'When I feel wobbly, I can touch it and feel my family near.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a parent hand places a small elephant courage sticker on the backpack shoulder strap', expression: 'watching with a hopeful small smile', angle: 'looking down, three-quarter left' }],
  ['walk-to-school', 3, 'story', 'walk-to-school', '我们去幼儿园', 'Off We Go', '我背好小书包，出发啦。', 'My little backpack is on. Off I go.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'walking toward kindergarten in soft morning light, holding an adult hand shown only from the shoulder down', expression: 'excited open-mouth smile', angle: 'full face, walking toward camera' }],
  ['school-gate', 4, 'story', 'school-gate', '小象幼儿园', 'Elephant Kindergarten', '门口的小象在欢迎我。', 'The little elephant welcomes me.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'at a nature-inspired kindergarten entrance with wood, green hills, rainbow decoration and a friendly elephant mascot', expression: 'wide-eyed wonder', angle: 'looking slightly upward, three-quarter right' }],
  ['goodbye-hug', 5, 'story', 'goodbye-hug', '抱一抱，再见', 'A Hug, Then Goodbye', '妈妈爸爸会回来接我。', 'My family will come back for me.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a safe goodbye hug with an adult crouched from behind, no adult face visible', expression: 'a tiny tearful but brave smile', angle: 'profile, resting against the hug' }],
  ['new-classroom', 6, 'story', 'new-classroom', '新的教室', 'A New Classroom', '这里有书，有植物，还有好多玩具。', 'There are books, plants, and so many toys.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'exploring a sunny classroom with low wooden shelves, plants, books and an elephant cushion', expression: 'quietly interested', angle: 'three-quarter back, head turned left' }],
  ['meet-teacher', 7, 'story', 'meet-teacher', '老师你好', 'Hello, Teacher', '老师笑着和我打招呼。', 'My teacher smiles and says hello.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a teacher kneels nearby with open hands at child height; teacher is softly rendered and secondary', expression: 'shy closed-lip smile', angle: 'full face with lowered chin' }],
  ['elephant-friend', 8, 'story', 'elephant-friend', '小象朋友', 'My Elephant Friend', '小象说：我们一起玩吧！', 'My elephant friend says, Let’s play.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'meeting a round plush elephant toy in a cozy reading corner', expression: 'delighted giggle', angle: 'looking down at the toy, three-quarter right' }],
  ['morning-circle', 9, 'story', 'morning-circle', '早安圈圈时间', 'Morning Circle', '我们一起唱歌，听故事。', 'We sing and listen to a story together.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'sitting in a small story circle with classmates softly in the background', expression: 'listening with an open, relaxed mouth', angle: 'left profile' }],
  ['building-blocks', 10, 'story', 'building-blocks', '搭一座高高的塔', 'Building a Tall Tower', '我和朋友一起搭积木。', 'My friend and I build with blocks.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'building a colorful wooden block tower with one toddler friend', expression: 'concentrating with tongue slightly out', angle: 'looking down, full face' }],
  ['snack-time', 11, 'story', 'snack-time', '点心时间', 'Snack Time', '小手洗干净，点心真香。', 'Clean hands, and a yummy snack.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'having a simple fruit snack at a child-size table with an elephant placemat', expression: 'pleased little chew', angle: 'three-quarter left' }],
  ['wash-hands', 12, 'story', 'wash-hands', '泡泡洗小手', 'Bubbly Clean Hands', '搓一搓，冲一冲，小手干净啦。', 'Rub, rinse, and my hands are clean.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'washing hands at a low sink with gentle soap bubbles and elephant tile detail', expression: 'surprised happy O mouth', angle: 'looking down from three-quarter right' }],
  ['outdoor-play', 13, 'story', 'outdoor-play', '户外游戏', 'Outdoor Play', '风吹过来，我跑呀跑。', 'The breeze comes by, and I run and run.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'running in a safe kindergarten garden with soft grass, rainbow and elephant play sculpture', expression: 'joyful laugh', angle: 'three-quarter forward motion' }],
  ['missing-home', 14, 'story', 'missing-home', '想家了怎么办', 'When I Miss Home', '我摸摸小象贴纸，深呼吸。', 'I touch my elephant sticker and take a deep breath.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a quiet moment by a sunny classroom window, hand touching the elephant sticker on the backpack', expression: 'thoughtful, settling after a small frown', angle: 'side profile looking down' }],
  ['friend-shares', 15, 'story', 'friend-shares', '朋友一起玩', 'Friends Play Together', '朋友把玩具分给我。', 'A friend shares a toy with me.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a classmate offers a toy elephant; other child remains secondary and unidentifiable', expression: 'surprised grateful smile', angle: 'three-quarter left, reaching forward' }],
  ['art-time', 16, 'story', 'art-time', '画一只小象', 'Painting an Elephant', '我画了一只大耳朵小象。', 'I paint an elephant with big ears.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'making a watercolor elephant painting at an art table, sleeves gently rolled up', expression: 'proud focused smile', angle: 'looking down, three-quarter right' }],
  ['pickup-smile', 17, 'story', 'pickup-smile', '家人来接我啦', 'My Family Is Here', '我跑过去，给家人一个大大的拥抱。', 'I run over for a great big hug.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'at pick-up time near the gate, running toward an adult shown from behind only', expression: 'beaming toothy smile', angle: 'full face, running toward camera' }],
  ['blessing', 18, 'story', 'blessing', '明天也会很勇敢', 'Brave Again Tomorrow', '幼儿园里，有新的朋友和新的快乐。', 'At kindergarten, new friends and joys are waiting.', { templateKind: 'kindergarten-transition', imageSize: '2048x1024', scene: 'a peaceful warm sunset outside Elephant Kindergarten with backpack and elephant sticker visible', expression: 'confident relaxed smile', angle: 'three-quarter back, looking over shoulder' }],
].map(([pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec]) => ({
  id: `fallback-kindergarten-${pageKey}`, pageKey, pageOrder, pageType, careerKey, titleZh, titleEn, bodyZh, bodyEn, generationSpec,
}));

const KINDERGARTEN_GIRL_FALLBACK_PAGES = KINDERGARTEN_FALLBACK_PAGES.map((page) => ({
  ...page,
  id: `fallback-kindergarten-girl-${page.pageKey}`,
  titleZh: page.pageKey === 'cover' ? '我要上幼儿园啦！' : page.titleZh,
  titleEn: page.pageKey === 'cover' ? 'Going to Kindergarten!' : page.titleEn,
  generationSpec: {
    ...page.generationSpec,
    templateVariant: 'female-main-character',
    femaleMainCharacter: true,
    palette: 'peach, lilac, butter yellow, sage and soft sky blue',
    backpack: 'a light-lilac backpack with the elephant courage sticker',
  },
}));

const FALLBACK_TEMPLATES = {
  [DEFAULT_TEMPLATE_SLUG]: { id: 'fallback-career-recognition-v1', slug: DEFAULT_TEMPLATE_SLUG, version: 1, name: 'My First Jobs', description: 'Bilingual career-recognition book for toddlers ages 0–3.', pages: CAREER_FALLBACK_PAGES },
  [KINDERGARTEN_TEMPLATE_SLUG]: { id: 'fallback-kindergarten-transition-zh-v1', slug: KINDERGARTEN_TEMPLATE_SLUG, version: 1, name: '我要上幼儿园啦！', description: 'A warm Mandarin-English story for a child’s kindergarten transition.', pages: KINDERGARTEN_FALLBACK_PAGES },
  [KINDERGARTEN_GIRL_TEMPLATE_SLUG]: { id: 'fallback-kindergarten-transition-zh-v2', slug: KINDERGARTEN_GIRL_TEMPLATE_SLUG, version: 2, name: '我要上幼儿园啦！·女孩版', description: 'A warm Mandarin-English kindergarten story with a girl as the main character.', pages: KINDERGARTEN_GIRL_FALLBACK_PAGES },
};

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
function extensionFor(mimeType) { return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'; }
function localBookDir(bookId) { return join(LOCAL_ROOT, bookId); }
function missing(message) { const error = new Error(message); error.code = 'NOT_FOUND'; return error; }

async function readLocalState() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { books: [] }; throw error; }
}
async function saveLocalState(state) { await mkdir(LOCAL_ROOT, { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }

function validatePhotos(formData) {
  const photos = formData.getAll('photos').filter((item) => item && typeof item.arrayBuffer === 'function');
  if (photos.length < 2 || photos.length > MAX_PHOTOS) throw new Error('Upload 2 to 5 child reference photos.');
  for (const photo of photos) {
    if (!IMAGE_TYPES.has(photo.type)) throw new Error('Photos must be JPEG, PNG, or WebP files.');
    if (photo.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 10 MB or smaller.');
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
    throw new Error('The combined reference photos must be 50 MB or smaller.');
  }
  return photos;
}

function serialize(book) {
  return {
    id: book.id, title: book.title || 'My First Jobs', childId: book.childId || null, childName: book.childName || '',
    template: { slug: book.templateSlug, version: book.templateVersion || 1, name: book.templateName || book.title || '' }, status: book.status,
    generation: { model: book.model || null, quality: book.quality || null },
    createdAt: book.createdAt, updatedAt: book.updatedAt, sourcePhotoCount: book.sourcePhotos.length,
    pages: Object.fromEntries(book.pages.map((page) => [page.pageKey, {
      pageOrder: page.pageOrder, pageType: page.pageType, titleZh: page.titleZh || '', titleEn: page.titleEn || '', status: page.status, error: page.error || null,
      url: page.storagePath ? `/api/family-assets/picture-book-assets?bookAssetId=${encodeURIComponent(book.id)}&pageKey=${encodeURIComponent(page.pageKey)}` : null,
    }])),
  };
}

function identityRules() {
  return 'Use the uploaded photos only to preserve this same child’s stable identity: facial proportions, natural eye shape, nose width, cheeks, ears, lip shape at rest, warm skin tone, dark hairline and toddler age. Do not copy a source photo’s expression, gaze or camera angle. Generate the requested expression and pose with natural anatomy. Preserve skin texture, asymmetry, hair strands and toddler proportions. Avoid enlarged eyes, doll proportions, pasted-on faces, waxy skin, smoothing, watermarks and logos.';
}

function kindergartenPrompt(page) {
  const spec = page.generationSpec || {};
  const pageText = `Render exactly in the clean lower text area, Chinese above English: ${page.titleZh} / ${page.titleEn} / ${page.bodyZh} / ${page.bodyEn}.`;
  const variant = spec.femaleMainCharacter ? `The main child is a little girl. Preserve her actual hair texture, facial features and any age-appropriate styling from the uploaded photos; never add makeup or adult-like features. Use this gentle palette: ${spec.palette}. Show ${spec.backpack} when a backpack appears.` : '';
  return `Create one finished 2:1 horizontal bilingual toddler picture-book spread for a child starting kindergarten. ${identityRules()} ${variant} Use an original, high-end hand-painted children’s-book illustration: warm opaque brushwork layered with transparent watercolor washes, subtle colored-pencil texture and natural watercolor-paper grain. It should feel soft, safe, imaginative, real and comforting for a three-year-old, while retaining the child's natural photographic identity and toddler proportions. Do not imitate or reproduce any existing book artwork. The left half holds a warm setting and narrative space; the right half centers the child’s action and emotion. Keep the bottom 22% calm and uncluttered for the bilingual text. Scene: ${spec.scene}. Required head angle: ${spec.angle}. Required expression: ${spec.expression}. Use a warm natural kindergarten with wood furniture, low shelves, plants, books, green hill decorations and soft daylight. Repeat a friendly round elephant motif as a gentle companion in an appropriate prop, sticker, toy or decoration. Adults, when needed, may only be shown from behind, as hands, shoulders, a blurred distant profile, or a crouching partial silhouette; never render a recognizable adult face. ${pageText} Use friendly hand-lettered typography, Chinese larger than English. No watermark, brand logo, extra copy or age sticker.`;
}

function pagePrompt(page) {
  if (page.generationSpec?.templateKind === 'kindergarten-transition') return kindergartenPrompt(page);
  if (page.pageType === 'cover') return `Create one finished 1:1 square front cover for My First Jobs. ${identityRules()} Pure white background, premium international children’s publishing photo-collage style, soft studio lighting and faint pastel outlined career illustrations. Show four full-body portraits of the same child: doctor, firefighter, police officer and astronaut. Each expression and angle must be different: doctor full-face gentle closed-lip smile; firefighter three-quarter left natural open-mouth laugh; police officer looking down at a toy radio with focused neutral mouth; astronaut three-quarter right looking slightly up with quiet wonder and a relaxed small O mouth. Toys by their feet: medical kit, fire truck, police car and rocket. Exact upper text: My First Jobs; 我的第一本职业认知书; A Bilingual Book of Jobs for Babies; 中英双语•0-3岁宝宝职业启蒙. Use rounded rainbow lettering for My First Jobs. Pink upper-right circular sticker: 0-3岁适用. Crisp Chinese and English typography; no other text.`;
  const spec = page.generationSpec || {};
  return `Create one finished 1:1 square bilingual toddler career picture-book page. ${identityRules()} Pure white background, ample negative space, soft studio lighting, realistic dress-up costume fabric, delicate contact shadows and sparse faint pastel career-themed line art. Required head angle: ${spec.angle}. Required expression and gaze: ${spec.expression}. Scene: ${spec.scene}. Keep head, neck, gaze and body pose anatomically consistent. Place child and props in the upper 68% of the page. In the lower third, place four centered, clean black rounded-sans-serif lines with no overlaps. Render exactly:\n${page.titleZh}\n${page.titleEn}\n${page.bodyZh}\n${page.bodyEn}\nNo cover title, age sticker, watermark, logo or extra writing.`;
}

async function getSupabaseTemplate(supabase, { slug = DEFAULT_TEMPLATE_SLUG, id } = {}) {
  let query = supabase.from('picture_book_templates').select('id, slug, name, version, description').eq('is_active', true);
  query = id ? query.eq('id', id) : query.eq('slug', slug);
  const { data: template, error: templateError } = await query.single();
  if (templateError || !template) throw new Error('The requested picture-book template is unavailable. Apply the picture-book database migration.');
  const { data: pages, error: pageError } = await supabase.from('picture_book_template_pages').select('id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec, asset_path').eq('template_id', template.id).order('page_order');
  if (pageError) throw new Error(pageError.message);
  return { id: template.id, slug: template.slug, version: template.version, name: template.name, description: template.description || '', pages: pages.map(normalizeTemplatePage) };
}

function normalizeTemplatePage(page) {
  return { id: page.id, pageKey: page.page_key, pageOrder: page.page_order, pageType: page.page_type, careerKey: page.career_key, titleZh: page.title_zh, titleEn: page.title_en, bodyZh: page.body_zh, bodyEn: page.body_en, generationSpec: page.generation_spec || {}, assetPath: page.asset_path || null };
}

async function createLocalBook(current, formData, photos) {
  const id = randomUUID(); const now = new Date().toISOString(); const directory = localBookDir(id);
  await mkdir(directory, { recursive: true });
  const sourcePhotos = await Promise.all(photos.map(async (photo, index) => {
    const fileName = `reference-${index + 1}.${extensionFor(photo.type)}`;
    await writeFile(join(directory, fileName), Buffer.from(await photo.arrayBuffer()));
    return { storagePath: fileName, mimeType: photo.type, byteSize: photo.size };
  }));
  const templateSlug = String(formData.get('templateSlug') || DEFAULT_TEMPLATE_SLUG);
  const template = FALLBACK_TEMPLATES[templateSlug];
  if (!template) throw new Error('The requested picture-book template is unavailable.');
  const book = { id, ownerId: ownerId(current), title: template.name, childId: String(formData.get('childId') || '').trim() || null, childName: String(formData.get('childName') || '').trim().slice(0, 80), model: process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst', quality: process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high', templateSlug: template.slug, templateVersion: template.version, templateName: template.name, status: 'draft', sourcePhotos, pages: template.pages.map((page) => ({ ...page, generationSpec: { ...page.generationSpec }, status: 'pending', storagePath: null })), createdAt: now, updatedAt: now };
  const state = await readLocalState(); state.books.unshift(book); await saveLocalState(state); return book;
}

async function createSupabaseBook(current, formData, photos) {
  const template = await getSupabaseTemplate(current.supabase, { slug: String(formData.get('templateSlug') || DEFAULT_TEMPLATE_SLUG) });
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').insert({ profile_id: current.authUser.id, child_id: String(formData.get('childId') || '').trim() || null, asset_type: 'picture_book', title: template.name, metadata: { templateSlug: template.slug } }).select('id, title, status, child_id, created_at, updated_at').single();
  if (assetError) throw new Error(assetError.message);
  const { error: bookError } = await current.supabase.from('family_picture_books').insert({ asset_id: asset.id, template_id: template.id, child_name: String(formData.get('childName') || '').trim().slice(0, 80), model: process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst', quality: process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high' });
  if (bookError) throw new Error(bookError.message);
  const pageRows = template.pages.map((page) => ({ book_asset_id: asset.id, template_page_id: page.id, page_key: page.pageKey, page_order: page.pageOrder }));
  const { error: pagesError } = await current.supabase.from('family_picture_book_pages').insert(pageRows);
  if (pagesError) throw new Error(pagesError.message);
  const sourcePhotos = [];
  for (const [index, photo] of photos.entries()) {
    const path = `${current.authUser.id}/picture-books/${asset.id}/references/${index + 1}.${extensionFor(photo.type)}`;
    const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    sourcePhotos.push({ book_asset_id: asset.id, storage_path: path, mime_type: photo.type, byte_size: photo.size, sort_order: index });
  }
  const { error: refsError } = await current.supabase.from('family_picture_book_source_photos').insert(sourcePhotos);
  if (refsError) throw new Error(refsError.message);
  return getSupabaseBook(current, asset.id);
}

function normalizeLocalBook(book) { return book; }

async function getSupabaseBook(current, id) {
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').select('id, title, child_id, status, created_at, updated_at, family_picture_books(template_id, child_name, model, quality)').eq('id', id).eq('asset_type', 'picture_book').single();
  if (assetError || !asset) throw missing('Picture book not found.');
  const bookRecord = Array.isArray(asset.family_picture_books) ? asset.family_picture_books[0] : asset.family_picture_books;
  if (!bookRecord?.template_id) throw new Error('Picture book is missing its template.');
  const template = await getSupabaseTemplate(current.supabase, { id: bookRecord.template_id });
  const { data: sourcePhotos, error: refsError } = await current.supabase.from('family_picture_book_source_photos').select('storage_path, mime_type, byte_size').eq('book_asset_id', id).order('sort_order');
  if (refsError) throw new Error(refsError.message);
  const { data: pageRows, error: pagesError } = await current.supabase.from('family_picture_book_pages').select('page_key, page_order, status, storage_path, generation_error, picture_book_template_pages(page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec, asset_path)').eq('book_asset_id', id).order('page_order');
  if (pagesError) throw new Error(pagesError.message);
  return { id: asset.id, title: asset.title, childId: asset.child_id, childName: bookRecord.child_name || '', model: bookRecord.model, quality: bookRecord.quality, templateSlug: template.slug, templateVersion: template.version, templateName: template.name, status: asset.status, createdAt: asset.created_at, updatedAt: asset.updated_at, sourcePhotos: sourcePhotos.map((photo) => ({ storagePath: photo.storage_path, mimeType: photo.mime_type, byteSize: photo.byte_size })), pages: pageRows.map((row) => ({ ...normalizeTemplatePage(Array.isArray(row.picture_book_template_pages) ? row.picture_book_template_pages[0] : row.picture_book_template_pages), pageKey: row.page_key, pageOrder: row.page_order, status: row.status, storagePath: row.storage_path, error: row.generation_error })) };
}

async function getLocalBook(current, id) { const state = await readLocalState(); const book = state.books.find((item) => item.id === id && item.ownerId === ownerId(current)); if (!book) throw missing('Picture book not found.'); return normalizeLocalBook(book); }

export async function createFamilyPictureBook(current, formData) { const photos = validatePhotos(formData); return current.mode === 'supabase' ? createSupabaseBook(current, formData, photos) : createLocalBook(current, formData, photos); }
export async function getFamilyPictureBook(current, id) { return current.mode === 'supabase' ? getSupabaseBook(current, id) : getLocalBook(current, id); }
export async function listFamilyPictureBooks(current) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.from('family_assets').select('id').eq('asset_type', 'picture_book').order('created_at', { ascending: false }); if (error) throw new Error(error.message); return Promise.all(data.map(({ id }) => getSupabaseBook(current, id))); } const state = await readLocalState(); return state.books.filter((book) => book.ownerId === ownerId(current)); }
export async function deleteFamilyPictureBook(current, id) {
  const book = await getFamilyPictureBook(current, id);
  if (current.mode === 'supabase') {
    const storagePaths = [
      ...book.sourcePhotos.map((photo) => photo.storagePath),
      ...book.pages.map((page) => page.storagePath).filter(Boolean),
    ];
    if (storagePaths.length) {
      const { error: storageError } = await current.supabase.storage.from(BUCKET).remove(storagePaths);
      if (storageError) throw new Error(storageError.message);
    }
    const { error } = await current.supabase.from('family_assets').delete().eq('id', book.id).eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return;
  }
  await rm(localBookDir(book.id), { recursive: true, force: true });
  const state = await readLocalState();
  state.books = state.books.filter((item) => item.id !== book.id || item.ownerId !== ownerId(current));
  await saveLocalState(state);
}
export async function getPictureBookTemplate(current, slug = DEFAULT_TEMPLATE_SLUG) {
  if (current.mode === 'supabase') return getSupabaseTemplate(current.supabase, { slug });
  const template = FALLBACK_TEMPLATES[slug];
  if (!template) throw missing('Picture-book template not found.');
  return template;
}

export async function listPictureBookTemplates(current) {
  if (current.mode === 'supabase') {
    const { data, error } = await current.supabase.from('picture_book_templates').select('id, slug, name, version, description').eq('is_active', true).order('created_at');
    if (error) throw new Error(error.message);
    return data.map((template) => ({ ...template, pageCount: null }));
  }
  return Object.values(FALLBACK_TEMPLATES).map(({ id, slug, name, version, description, pages }) => ({ id, slug, name, version, description, pageCount: pages.length }));
}

async function referenceBuffer(current, book, reference) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.storage.from(BUCKET).download(reference.storagePath); if (error) throw new Error(error.message); return Buffer.from(await data.arrayBuffer()); } return readFile(join(localBookDir(book.id), reference.storagePath)); }
async function generateImage(current, book, page) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const form = new FormData(); form.set('model', book.model || process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst'); form.set('prompt', pagePrompt(page)); form.set('size', page.generationSpec?.imageSize || '1024x1024'); form.set('quality', book.quality || process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high'); form.set('output_format', 'png');
  for (const reference of book.sourcePhotos) form.append('image[]', new Blob([await referenceBuffer(current, book, reference)], { type: reference.mimeType }), `reference.${extensionFor(reference.mimeType)}`);
  const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form }); const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.[0]?.b64_json) throw new Error(payload?.error?.message || `Image generation failed (${response.status}).`);
  return Buffer.from(payload.data[0].b64_json, 'base64');
}

async function saveSupabaseGeneratedPage(current, book, page, png) { const path = `${current.authUser.id}/picture-books/${book.id}/pages/${page.pageKey}.png`; const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true }); if (uploadError) throw new Error(uploadError.message); const now = new Date().toISOString(); const { error: pageError } = await current.supabase.from('family_picture_book_pages').update({ status: 'ready', storage_path: path, generation_error: null, generated_at: now }).eq('book_asset_id', book.id).eq('page_key', page.pageKey); if (pageError) throw new Error(pageError.message); const ready = book.pages.every((item) => item.pageKey === page.pageKey || item.status === 'ready'); const { error: assetError } = await current.supabase.from('family_assets').update({ status: ready ? 'ready' : 'draft' }).eq('id', book.id); if (assetError) throw new Error(assetError.message); }

export async function generateFamilyPictureBookPage(current, bookId, pageKey) {
  const book = await getFamilyPictureBook(current, bookId); const page = book.pages.find((item) => item.pageKey === pageKey); if (!page) throw new Error('Unknown picture-book page.');
  if (current.mode === 'supabase') { await current.supabase.from('family_picture_book_pages').update({ status: 'generating', generation_error: null }).eq('book_asset_id', book.id).eq('page_key', pageKey); await current.supabase.from('family_assets').update({ status: 'generating' }).eq('id', book.id); }
  else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); local.status = 'generating'; local.pages.find((item) => item.pageKey === pageKey).status = 'generating'; await saveLocalState(state); }
  try { const png = await generateImage(current, book, page); if (current.mode === 'supabase') await saveSupabaseGeneratedPage(current, book, page, png); else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); const localPage = local.pages.find((item) => item.pageKey === pageKey); localPage.status = 'ready'; localPage.storagePath = `${pageKey}.png`; local.status = local.pages.every((item) => item.status === 'ready') ? 'ready' : 'draft'; local.updatedAt = new Date().toISOString(); await writeFile(join(localBookDir(book.id), localPage.storagePath), png); await saveLocalState(state); } return getFamilyPictureBook(current, bookId); }
  catch (error) { if (current.mode === 'supabase') { await current.supabase.from('family_picture_book_pages').update({ status: 'failed', generation_error: error.message }).eq('book_asset_id', book.id).eq('page_key', pageKey); await current.supabase.from('family_assets').update({ status: 'failed' }).eq('id', book.id); } else { const state = await readLocalState(); const local = state.books.find((item) => item.id === book.id); const localPage = local.pages.find((item) => item.pageKey === pageKey); localPage.status = 'failed'; localPage.error = error.message; local.status = 'failed'; await saveLocalState(state); } throw error; }
}

export async function readFamilyPictureBookPage(current, bookId, pageKey) { const book = await getFamilyPictureBook(current, bookId); const page = book.pages.find((item) => item.pageKey === pageKey); if (!page?.storagePath) throw missing('Picture-book page not found.'); if (current.mode === 'supabase') { const { data, error } = await current.supabase.storage.from(BUCKET).download(page.storagePath); if (error) throw new Error(error.message); return Buffer.from(await data.arrayBuffer()); } return readFile(join(localBookDir(book.id), page.storagePath)); }
export function serializeFamilyPictureBook(book) { return serialize(book); }
