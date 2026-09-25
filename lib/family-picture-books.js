import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'picture-books.json');
const BUCKET = 'family-assets';
const TEMPLATE_SLUG = 'career-recognition-v1';
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const FALLBACK_PAGES = [
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
    template: { slug: book.templateSlug, version: book.templateVersion || 1 }, status: book.status,
    generation: { model: book.model || null, quality: book.quality || null },
    createdAt: book.createdAt, updatedAt: book.updatedAt, sourcePhotoCount: book.sourcePhotos.length,
    pages: Object.fromEntries(book.pages.map((page) => [page.pageKey, {
      pageOrder: page.pageOrder, pageType: page.pageType, status: page.status, error: page.error || null,
      url: page.storagePath ? `/api/family-assets/picture-books/${book.id}/assets/${encodeURIComponent(page.pageKey)}` : null,
    }])),
  };
}

function identityRules() {
  return 'Use the uploaded photos only to preserve this same child’s stable identity: facial proportions, natural eye shape, nose width, cheeks, ears, lip shape at rest, warm skin tone, dark hairline and toddler age. Do not copy a source photo’s expression, gaze or camera angle. Generate the requested expression and pose with natural anatomy. Preserve skin texture, asymmetry, hair strands and toddler proportions. Avoid enlarged eyes, doll proportions, pasted-on faces, waxy skin, smoothing, watermarks and logos.';
}

function pagePrompt(page) {
  if (page.pageType === 'cover') return `Create one finished 1:1 square front cover for My First Jobs. ${identityRules()} Pure white background, premium international children’s publishing photo-collage style, soft studio lighting and faint pastel outlined career illustrations. Show four full-body portraits of the same child: doctor, firefighter, police officer and astronaut. Each expression and angle must be different: doctor full-face gentle closed-lip smile; firefighter three-quarter left natural open-mouth laugh; police officer looking down at a toy radio with focused neutral mouth; astronaut three-quarter right looking slightly up with quiet wonder and a relaxed small O mouth. Toys by their feet: medical kit, fire truck, police car and rocket. Exact upper text: My First Jobs; 我的第一本职业认知书; A Bilingual Book of Jobs for Babies; 中英双语•0-3岁宝宝职业启蒙. Use rounded rainbow lettering for My First Jobs. Pink upper-right circular sticker: 0-3岁适用. Crisp Chinese and English typography; no other text.`;
  const spec = page.generationSpec || {};
  return `Create one finished 1:1 square bilingual toddler career picture-book page. ${identityRules()} Pure white background, ample negative space, soft studio lighting, realistic dress-up costume fabric, delicate contact shadows and sparse faint pastel career-themed line art. Required head angle: ${spec.angle}. Required expression and gaze: ${spec.expression}. Scene: ${spec.scene}. Keep head, neck, gaze and body pose anatomically consistent. Place child and props in the upper 68% of the page. In the lower third, place four centered, clean black rounded-sans-serif lines with no overlaps. Render exactly:\n${page.titleZh}\n${page.titleEn}\n${page.bodyZh}\n${page.bodyEn}\nNo cover title, age sticker, watermark, logo or extra writing.`;
}

async function getSupabaseTemplate(supabase, { slug = TEMPLATE_SLUG, id } = {}) {
  let query = supabase.from('picture_book_templates').select('id, slug, name, version').eq('is_active', true);
  query = id ? query.eq('id', id) : query.eq('slug', slug);
  const { data: template, error: templateError } = await query.single();
  if (templateError || !template) throw new Error('The requested picture-book template is unavailable. Apply the picture-book database migration.');
  const { data: pages, error: pageError } = await supabase.from('picture_book_template_pages').select('id, page_key, page_order, page_type, career_key, title_zh, title_en, body_zh, body_en, generation_spec, asset_path').eq('template_id', template.id).order('page_order');
  if (pageError) throw new Error(pageError.message);
  return { id: template.id, slug: template.slug, version: template.version, name: template.name, pages: pages.map(normalizeTemplatePage) };
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
  const book = { id, ownerId: ownerId(current), title: 'My First Jobs', childId: String(formData.get('childId') || '').trim() || null, childName: String(formData.get('childName') || '').trim().slice(0, 80), model: process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst', quality: process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high', templateSlug: TEMPLATE_SLUG, templateVersion: 1, status: 'draft', sourcePhotos, pages: FALLBACK_PAGES.map((page) => ({ ...page, status: 'pending', storagePath: null })), createdAt: now, updatedAt: now };
  const state = await readLocalState(); state.books.unshift(book); await saveLocalState(state); return book;
}

async function createSupabaseBook(current, formData, photos) {
  const template = await getSupabaseTemplate(current.supabase, { slug: String(formData.get('templateSlug') || TEMPLATE_SLUG) });
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
  return { id: asset.id, title: asset.title, childId: asset.child_id, childName: bookRecord.child_name || '', model: bookRecord.model, quality: bookRecord.quality, templateSlug: template.slug, templateVersion: template.version, status: asset.status, createdAt: asset.created_at, updatedAt: asset.updated_at, sourcePhotos: sourcePhotos.map((photo) => ({ storagePath: photo.storage_path, mimeType: photo.mime_type, byteSize: photo.byte_size })), pages: pageRows.map((row) => ({ ...normalizeTemplatePage(Array.isArray(row.picture_book_template_pages) ? row.picture_book_template_pages[0] : row.picture_book_template_pages), pageKey: row.page_key, pageOrder: row.page_order, status: row.status, storagePath: row.storage_path, error: row.generation_error })) };
}

async function getLocalBook(current, id) { const state = await readLocalState(); const book = state.books.find((item) => item.id === id && item.ownerId === ownerId(current)); if (!book) throw missing('Picture book not found.'); return normalizeLocalBook(book); }

export async function createFamilyPictureBook(current, formData) { const photos = validatePhotos(formData); return current.mode === 'supabase' ? createSupabaseBook(current, formData, photos) : createLocalBook(current, formData, photos); }
export async function getFamilyPictureBook(current, id) { return current.mode === 'supabase' ? getSupabaseBook(current, id) : getLocalBook(current, id); }
export async function listFamilyPictureBooks(current) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.from('family_assets').select('id').eq('asset_type', 'picture_book').order('created_at', { ascending: false }); if (error) throw new Error(error.message); return Promise.all(data.map(({ id }) => getSupabaseBook(current, id))); } const state = await readLocalState(); return state.books.filter((book) => book.ownerId === ownerId(current)); }
export async function getPictureBookTemplate(current, slug = TEMPLATE_SLUG) { return current.mode === 'supabase' ? getSupabaseTemplate(current.supabase, { slug }) : { id: 'fallback-career-recognition-v1', slug: TEMPLATE_SLUG, version: 1, name: 'My First Jobs', pages: FALLBACK_PAGES }; }

async function referenceBuffer(current, book, reference) { if (current.mode === 'supabase') { const { data, error } = await current.supabase.storage.from(BUCKET).download(reference.storagePath); if (error) throw new Error(error.message); return Buffer.from(await data.arrayBuffer()); } return readFile(join(localBookDir(book.id), reference.storagePath)); }
async function generateImage(current, book, page) {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const form = new FormData(); form.set('model', book.model || process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst'); form.set('prompt', pagePrompt(page)); form.set('size', '1024x1024'); form.set('quality', book.quality || process.env.PICTURE_BOOK_IMAGE_QUALITY || 'high'); form.set('output_format', 'png');
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
