import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { getChildProfile } from './profile-defaults.js';
import { createFamilyPhoto, readFamilyPhoto } from './family-photos.js';

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'practice-stories.json');
const BUCKET = 'family-assets';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const STORY_MODEL = process.env.PRACTICE_STORY_MODEL || 'gpt-5';
const IMAGE_MODEL = process.env.PRACTICE_STORY_IMAGE_MODEL || process.env.PICTURE_BOOK_IMAGE_MODEL || 'gpt-image-2.5-sunburst';

export const PRACTICE_STORY_TOPICS = [
  { id: 'calm-with-caregiver', label: 'Settle with a caregiver', minMonths: 0, maxMonths: 18 },
  { id: 'sleep-routine', label: 'Follow the bedtime routine', minMonths: 0, maxMonths: 71 },
  { id: 'try-new-food', label: 'Explore a new food', minMonths: 6, maxMonths: 71 },
  { id: 'car-seat', label: 'Get into the car seat', minMonths: 6, maxMonths: 71 },
  { id: 'wash-hands', label: 'Wash hands', minMonths: 12, maxMonths: 71 },
  { id: 'bath-shower', label: 'Take a bath or shower', minMonths: 12, maxMonths: 71 },
  { id: 'brush-teeth', label: 'Brush teeth with a grown-up', minMonths: 12, maxMonths: 71 },
  { id: 'get-dressed', label: 'Get dressed', minMonths: 18, maxMonths: 71 },
  { id: 'clean-up', label: 'Put toys away', minMonths: 18, maxMonths: 71 },
  { id: 'ask-for-help', label: 'Ask for help', minMonths: 18, maxMonths: 71 },
  { id: 'potty-routine', label: 'Practice the potty routine', minMonths: 24, maxMonths: 71 },
  { id: 'sleep-own-space', label: 'Sleep in my own bed or space', minMonths: 24, maxMonths: 71 },
  { id: 'separation', label: 'Say goodbye at childcare or preschool', minMonths: 24, maxMonths: 71 },
  { id: 'take-turns', label: 'Wait and take turns', minMonths: 24, maxMonths: 71 },
  { id: 'transition', label: 'Move calmly to the next activity', minMonths: 24, maxMonths: 71 },
  { id: 'doctor-dentist', label: 'Prepare for a doctor or dentist visit', minMonths: 24, maxMonths: 71 },
  { id: 'feelings', label: 'Use words for big feelings', minMonths: 24, maxMonths: 71 },
  { id: 'follow-routine', label: 'Follow a simple family routine', minMonths: 24, maxMonths: 71 },
];

export const PLAYGROUND_PRACTICE_GOALS = [
  {
    id: 'making-friends',
    label: 'Making friends',
    goal: 'Practice a friendly way to join play and make a new friend at the playground',
  },
  {
    id: 'washing-hands',
    label: 'Washing hands',
    goal: 'Practice washing hands with a grown-up after playground play',
  },
  {
    id: 'leaving-playground',
    label: 'Leaving the playground',
    goal: 'Practice leaving the playground calmly when it is time to go',
  },
];

export const PRACTICE_STORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'goal', 'ageRange', 'theme', 'readAloudMinutes', 'scenes', 'celebration', 'caregiverTips'],
  properties: {
    title: { type: 'string' }, summary: { type: 'string' }, goal: { type: 'string' }, ageRange: { type: 'string' }, theme: { type: 'string' },
    readAloudMinutes: { type: 'integer', minimum: 1, maximum: 8 },
    scenes: {
      type: 'array', minItems: 4, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false, required: ['heading', 'storyText', 'practiceCue'],
        properties: { heading: { type: 'string' }, storyText: { type: 'string' }, practiceCue: { type: 'string' } },
      },
    },
    celebration: { type: 'string' },
    caregiverTips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
  },
};

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
function text(value, max = 600) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max); }
function list(value, max = 5) { return (Array.isArray(value) ? value : String(value || '').split(/[,;\n]/)).map((item) => text(item, 60)).filter(Boolean).slice(0, max); }
function responseText(payload) { for (const item of payload?.output || []) if (item.type === 'message') for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text; return ''; }
function languageInstruction(language) {
  if (language === 'zh-CN') return 'Write all story content in natural Simplified Chinese for a family that speaks Mandarin.';
  if (language === 'es') return 'Write all story content in natural, family-friendly Spanish.';
  if (language === 'bilingual') return 'Write each story field in concise English followed by natural Simplified Chinese, separated by “ / ”.';
  return 'Write all story content in warm, plain English.';
}
function normalizeLanguage(value) { return ['en', 'zh-CN', 'es', 'bilingual'].includes(value) ? value : 'en'; }

export function normalizePracticeStory(value) {
  const story = value && typeof value === 'object' ? value : {};
  return {
    title: text(story.title, 120), summary: text(story.summary), goal: text(story.goal, 120), ageRange: text(story.ageRange, 80), theme: text(story.theme, 160),
    readAloudMinutes: Math.min(8, Math.max(1, Number(story.readAloudMinutes) || 3)),
    scenes: (Array.isArray(story.scenes) ? story.scenes : []).slice(0, 6).map((scene) => ({ heading: text(scene?.heading, 100), storyText: text(scene?.storyText, 800), practiceCue: text(scene?.practiceCue, 240) })).filter((scene) => scene.heading && scene.storyText),
    celebration: text(story.celebration, 300), caregiverTips: list(story.caregiverTips, 4),
  };
}

async function normalizedPhoto(input) {
  return sharp(input.buffer).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

async function optionalPhoto(current, formData) {
  const savedPhotoId = text(formData.get('savedPhotoId'), 100);
  if (savedPhotoId) {
    const { photo, buffer } = await readFamilyPhoto(current, savedPhotoId);
    return { buffer, mimeType: photo.mimeType, originalName: photo.label, savedPhotoId };
  }
  const photo = formData.get('photo');
  if (!photo || typeof photo.arrayBuffer !== 'function' || !photo.size) return null;
  if (!IMAGE_TYPES.has(photo.type)) throw new Error('Photos must be JPEG, PNG, WebP, HEIC, or HEIF files.');
  if (photo.size > MAX_PHOTO_BYTES) throw new Error('The photo must be 20 MB or smaller.');
  return { buffer: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type, originalName: photo.name || 'Story reference' };
}

async function moderatePhoto(jpeg) {
  const response = await fetch('https://api.openai.com/v1/moderations', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` } }] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Photo safety check failed (${response.status}).`);
  if (payload.results?.[0]?.flagged) throw new Error('This photo cannot be used. Choose a clear, everyday photo of your child.');
}

async function generateStoryText({ childName, ageMonths, goal, interests, language, readAloudMinutes = 3, setting = '' }) {
  const settingInstruction = setting ? `Set the whole story in or immediately around ${setting}.` : '';
  const prompt = `Create a personalized social story for ${childName}, age ${ageMonths} months (within the birth-to-five audience). It should take about ${readAloudMinutes} minutes to read aloud. The one practice goal is: “${goal}”. ${settingInstruction} Weave in these interests as playful motifs: ${interests.join(', ') || 'gentle everyday play'}. Use a calm, respectful tone and concrete, repeatable steps. Let the child notice a feeling, see what happens next, practice the goal with a trusted grown-up, and succeed without shame, threats, bribes, diagnosis, or promises of perfect behavior. Match sentence length, concepts, and agency to the child’s age; for babies, address the caregiver and use sensory repetition. For toileting, eating, sleep, separation, or other sensitive routines, avoid coercion and emphasize readiness, comfort, and caregiver support. This is educational practice, not medical or behavioral treatment. Provide 4–6 story scenes, each with one short caregiver practice cue. Set readAloudMinutes to ${readAloudMinutes}. End with specific encouragement for trying. ${languageInstruction(language)}`;
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: STORY_MODEL, store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }], text: { format: { type: 'json_schema', name: 'practice_story', strict: true, schema: PRACTICE_STORY_SCHEMA } } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Story generation failed (${response.status}).`);
  const output = responseText(payload);
  if (!output) throw new Error('Story generation returned no usable result.');
  const story = normalizePracticeStory(JSON.parse(output));
  if (story.scenes.length < 4) throw new Error('Story generation returned an incomplete story.');
  return { story, responseId: payload.id || null };
}

function playgroundGoal(goalId) {
  return PLAYGROUND_PRACTICE_GOALS.find((item) => item.id === text(goalId, 80)) || null;
}

function playgroundStoryData(current, goalId, story, responseId = null) {
  const selectedGoal = playgroundGoal(goalId);
  if (!selectedGoal) throw new Error('Choose making friends, washing hands, or leaving the playground.');
  const child = getChildProfile(current.user);
  const childName = text(child?.name, 60) || 'your child';
  const ageMonths = Math.max(0, Math.min(71, Number(child?.ageMonths) || 0));
  const interests = list(child?.favoriteActivities, 4);
  const language = normalizeLanguage(child?.storyLanguage);
  const normalizedStory = normalizePracticeStory(story);
  normalizedStory.goal = selectedGoal.goal;
  normalizedStory.readAloudMinutes = 2;
  if (!normalizedStory.title || normalizedStory.scenes.length < 4) throw new Error('The story is incomplete. Please generate it again.');
  return { childName, ageMonths, goal: selectedGoal.goal, goalId: selectedGoal.id, interests: interests.length ? interests : ['playground'], language, story: normalizedStory, responseId: text(responseId, 160) || null };
}

export async function generatePlaygroundPracticeStory(current, goalId) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const selectedGoal = playgroundGoal(goalId);
  if (!selectedGoal) throw new Error('Choose making friends, washing hands, or leaving the playground.');
  const child = getChildProfile(current.user);
  const childName = text(child?.name, 60) || 'your child';
  const ageMonths = Math.max(0, Math.min(71, Number(child?.ageMonths) || 0));
  const interests = list(child?.favoriteActivities, 4);
  const language = normalizeLanguage(child?.storyLanguage);
  const generated = await generateStoryText({
    childName,
    ageMonths,
    goal: selectedGoal.goal,
    interests,
    language,
    readAloudMinutes: 2,
    setting: 'a familiar neighborhood playground',
  });
  return playgroundStoryData(current, selectedGoal.id, generated.story, generated.responseId);
}

export async function savePlaygroundPracticeStory(current, draft = {}) {
  const data = playgroundStoryData(current, draft.goalId, draft.story, draft.responseId);
  return serialize(current.mode === 'supabase'
    ? await saveSupabase(current, data, null)
    : await saveLocal(current, data, null));
}

async function generateCover(photo, story, childName, interests) {
  const jpeg = await normalizedPhoto(photo);
  await moderatePhoto(jpeg);
  const form = new FormData();
  form.set('model', IMAGE_MODEL);
  form.set('size', '1024x1024');
  form.set('quality', process.env.PRACTICE_STORY_IMAGE_QUALITY || 'high');
  form.set('output_format', 'png');
  form.set('prompt', `Create a warm square children’s-book illustration showing the same young child from the reference photo proudly completing this everyday goal: ${story.goal}. Story theme: ${story.theme}. Include subtle, child-safe motifs inspired by ${interests.join(', ') || 'cozy play'}. Preserve the child’s recognizable facial proportions, natural skin tone, hair, and age. Use gentle watercolor and colored-pencil texture, a calm home or preschool setting, natural anatomy, and a joyful but realistic expression. No text, logos, medical claims, scary imagery, adult-like styling, or other recognizable faces.`);
  form.append('image[]', new Blob([jpeg], { type: 'image/jpeg' }), 'child-reference.jpg');
  const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.data?.[0]?.b64_json) throw new Error(payload.error?.message || `Story illustration failed (${response.status}).`);
  return Buffer.from(payload.data[0].b64_json, 'base64');
}

async function readLocalState() { try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return { assets: [] }; throw error; } }
async function saveLocalState(state) { await mkdir(LOCAL_ROOT, { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }
function serialize(asset) { return { id: asset.id, assetType: 'practice_story', title: asset.title, status: asset.status || 'ready', childName: asset.childName, childAgeMonths: asset.childAgeMonths, goal: asset.goal, interests: asset.interests || [], language: normalizeLanguage(asset.language), story: asset.story, hasCoverImage: Boolean(asset.coverStoragePath), coverUrl: asset.coverStoragePath ? `/api/family-assets/practice-stories/content?storyId=${encodeURIComponent(asset.id)}` : null, createdAt: asset.createdAt, updatedAt: asset.updatedAt }; }

async function saveLocal(current, data, cover) {
  const id = randomUUID(); const now = new Date().toISOString(); const directory = join(LOCAL_ROOT, 'practice-stories', id);
  await mkdir(directory, { recursive: true });
  if (cover) await writeFile(join(directory, 'cover.png'), cover);
  const asset = { id, ownerId: ownerId(current), title: data.story.title, status: 'ready', childName: data.childName, childAgeMonths: data.ageMonths, goal: data.goal, interests: data.interests, language: data.language, story: data.story, coverStoragePath: cover ? 'cover.png' : null, model: STORY_MODEL, imageModel: cover ? IMAGE_MODEL : null, responseId: data.responseId, aiJobId: data.jobId || null, createdAt: now, updatedAt: now };
  const state = await readLocalState(); state.assets.unshift(asset); await saveLocalState(state); return asset;
}

async function saveSupabase(current, data, cover) {
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').insert({ profile_id: current.authUser.id, asset_type: 'practice_story', title: data.story.title, status: 'ready', metadata: { source: 'practice-story-ai', language: data.language, hasCoverImage: Boolean(cover), ...(data.jobId ? { aiJobId: data.jobId } : {}) } }).select('id, title, status, created_at, updated_at').single();
  if (assetError) throw new Error(assetError.message);
  const coverPath = cover ? `${current.authUser.id}/practice-stories/${asset.id}/cover.png` : null;
  let uploaded = false;
  try {
    if (cover) { const { error } = await current.supabase.storage.from(BUCKET).upload(coverPath, cover, { contentType: 'image/png', upsert: false }); if (error) throw new Error(error.message); uploaded = true; }
    const { error } = await current.supabase.from('family_practice_story_assets').insert({ asset_id: asset.id, child_name: data.childName, child_age_months: data.ageMonths, goal: data.goal, interests: data.interests, language: data.language, story: data.story, cover_storage_path: coverPath, model: STORY_MODEL, image_model: cover ? IMAGE_MODEL : null, response_id: data.responseId });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded) await current.supabase.storage.from(BUCKET).remove([coverPath]);
    await current.supabase.from('family_assets').delete().eq('id', asset.id).eq('profile_id', current.authUser.id);
    throw error;
  }
  return { id: asset.id, title: asset.title, status: asset.status, ...data, childAgeMonths: data.ageMonths, coverStoragePath: coverPath, createdAt: asset.created_at, updatedAt: asset.updated_at };
}

export async function generateAndSavePracticeStory(current, formData) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const child = getChildProfile(current.user);
  const ageMonths = Math.max(0, Math.min(71, Number(child?.ageMonths) || 0));
  const childName = text(child?.name, 60) || 'your child';
  const goal = text(formData.get('goal'), 120);
  const interests = list(formData.get('interests'), 5);
  const language = normalizeLanguage(formData.get('language') || child?.storyLanguage);
  if (!goal) throw new Error('Choose or enter one goal to practice.');
  if (!interests.length) throw new Error('Add at least one interest to shape the story.');
  const photo = await optionalPhoto(current, formData);
  const { story, responseId } = await generateStoryText({ childName, ageMonths, goal, interests, language });
  const cover = photo ? await generateCover(photo, story, childName, interests) : null;
  if (photo && !photo.savedPhotoId) await createFamilyPhoto(current, photo, { label: `${childName} story reference`, sourceKind: 'practice_story' });
  const data = { childName, ageMonths, goal, interests, language, story, responseId, jobId: text(formData.get('jobId'), 100) || null };
  return serialize(current.mode === 'supabase' ? await saveSupabase(current, data, cover) : await saveLocal(current, data, cover));
}

export async function listPracticeStories(current) {
  if (current.mode !== 'supabase') { const state = await readLocalState(); return state.assets.filter((asset) => asset.ownerId === ownerId(current)).map(serialize); }
  const { data: assets, error } = await current.supabase.from('family_assets').select('id, title, status, created_at, updated_at').eq('asset_type', 'practice_story').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const results = [];
  for (const asset of assets) {
    const { data: detail, error: detailError } = await current.supabase.from('family_practice_story_assets').select('child_name, child_age_months, goal, interests, language, story, cover_storage_path').eq('asset_id', asset.id).single();
    if (detailError) throw new Error(detailError.message);
    results.push(serialize({ id: asset.id, title: asset.title, status: asset.status, childName: detail.child_name, childAgeMonths: detail.child_age_months, goal: detail.goal, interests: detail.interests, language: detail.language, story: detail.story, coverStoragePath: detail.cover_storage_path, createdAt: asset.created_at, updatedAt: asset.updated_at }));
  }
  return results;
}

export async function deletePracticeStory(current, assetId) {
  const id = text(assetId, 100);
  if (!id) throw new Error('Practice story asset id is required.');
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const index = state.assets.findIndex((asset) => asset.id === id && asset.ownerId === ownerId(current));
    if (index < 0) { const error = new Error('Practice story not found.'); error.code = 'NOT_FOUND'; throw error; }
    state.assets.splice(index, 1);
    await saveLocalState(state);
    await rm(join(LOCAL_ROOT, 'practice-stories', id), { recursive: true, force: true });
    return;
  }
  const { data: detail, error: detailError } = await current.supabase.from('family_practice_story_assets').select('cover_storage_path').eq('asset_id', id).single();
  if (detailError || !detail) { const error = new Error('Practice story not found.'); error.code = 'NOT_FOUND'; throw error; }
  if (detail.cover_storage_path) {
    const { error } = await current.supabase.storage.from(BUCKET).remove([detail.cover_storage_path]);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await current.supabase.from('family_assets').delete().eq('id', id).eq('profile_id', current.authUser.id).select('id').single();
  if (error || !data) { const missing = new Error('Practice story not found.'); missing.code = 'NOT_FOUND'; throw missing; }
}

export async function readPracticeStoryCover(current, storyId) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState(); const asset = state.assets.find((item) => item.id === storyId && item.ownerId === ownerId(current));
    if (!asset?.coverStoragePath) { const error = new Error('Story illustration not found.'); error.code = 'NOT_FOUND'; throw error; }
    return readFile(join(LOCAL_ROOT, 'practice-stories', asset.id, asset.coverStoragePath));
  }
  const { data, error } = await current.supabase.from('family_practice_story_assets').select('cover_storage_path').eq('asset_id', storyId).single();
  if (error || !data?.cover_storage_path) { const missing = new Error('Story illustration not found.'); missing.code = 'NOT_FOUND'; throw missing; }
  const { data: blob, error: downloadError } = await current.supabase.storage.from(BUCKET).download(data.cover_storage_path);
  if (downloadError) throw new Error(downloadError.message);
  return Buffer.from(await blob.arrayBuffer());
}
