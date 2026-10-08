import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { getChildProfile } from '@sproutcue/shared/profile-defaults';
import { createFamilyPhoto, readFamilyPhoto } from './family-photos.js';
import {
  PRACTICE_STORY_CHALLENGES, PRACTICE_STORY_LENGTHS, PRACTICE_STORY_PARENT_GOALS, PRACTICE_STORY_THEMES,
  plainTagLabel, practiceStoryChallenge, practiceStoryLength, practiceStoryParentGoals, practiceStoryTheme,
} from '@sproutcue/shared/practice-story-options';

export { PRACTICE_STORY_CHALLENGES, PRACTICE_STORY_LENGTHS, PRACTICE_STORY_PARENT_GOALS, PRACTICE_STORY_THEMES };

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'practice-stories.json');
const BUCKET = 'family-assets';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;
const MAX_PHOTOS = 5;
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
  required: ['title', 'summary', 'goal', 'ageRange', 'theme', 'mission', 'readAloudMinutes', 'scenes', 'celebration', 'caregiverTips', 'reflectionQuestions'],
  properties: {
    title: { type: 'string' }, summary: { type: 'string' }, goal: { type: 'string' }, ageRange: { type: 'string' }, theme: { type: 'string' },
    mission: { type: 'string' },
    readAloudMinutes: { type: 'integer', minimum: 1, maximum: 10 },
    scenes: {
      type: 'array', minItems: 3, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false, required: ['heading', 'storyText', 'practiceCue', 'sayTogether'],
        properties: { heading: { type: 'string' }, storyText: { type: 'string' }, practiceCue: { type: 'string' }, sayTogether: { type: 'string' } },
      },
    },
    celebration: { type: 'string' },
    caregiverTips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    reflectionQuestions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
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

export function normalizePracticeStoryBrief(value) {
  const brief = value && typeof value === 'object' ? value : {};
  const challenge = practiceStoryChallenge(brief.challenge);
  const theme = practiceStoryTheme(brief.storyTheme);
  return {
    challenge: challenge?.id || null,
    parentGoals: practiceStoryParentGoals(brief.parentGoals).map((goal) => goal.id),
    storyTheme: theme?.id || null,
    adventureLength: practiceStoryLength(brief.adventureLength).id,
  };
}

export function normalizePracticeStory(value) {
  const story = value && typeof value === 'object' ? value : {};
  const normalized = {
    title: text(story.title, 120), summary: text(story.summary), goal: text(story.goal, 120), ageRange: text(story.ageRange, 80), theme: text(story.theme, 160),
    mission: text(story.mission, 240),
    readAloudMinutes: Math.min(10, Math.max(1, Number(story.readAloudMinutes) || 3)),
    scenes: (Array.isArray(story.scenes) ? story.scenes : []).slice(0, 10).map((scene) => ({ heading: text(scene?.heading, 100), storyText: text(scene?.storyText, 800), practiceCue: text(scene?.practiceCue, 240), sayTogether: text(scene?.sayTogether, 120) })).filter((scene) => scene.heading && scene.storyText),
    celebration: text(story.celebration, 300), caregiverTips: list(story.caregiverTips, 4),
    reflectionQuestions: (Array.isArray(story.reflectionQuestions) ? story.reflectionQuestions : []).map((item) => text(item, 160)).filter(Boolean).slice(0, 3),
  };
  if (story.brief) normalized.brief = normalizePracticeStoryBrief(story.brief);
  return normalized;
}

async function normalizedPhoto(input) {
  return sharp(input.buffer).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

async function optionalPhotos(current, formData) {
  const idValues = [...formData.getAll('savedPhotoIds'), ...formData.getAll('savedPhotoId')].flatMap((value) => {
    try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : [value]; }
    catch { return [value]; }
  });
  const ids = [...new Set(idValues.map((value) => text(value, 100)).filter(Boolean))];
  const uploads = [...formData.getAll('photos'), ...formData.getAll('photo')].filter((photo) => photo && typeof photo.arrayBuffer === 'function' && photo.size);
  if (ids.length + uploads.length > MAX_PHOTOS) throw new Error('Choose no more than 5 uploaded or saved reference photos.');
  const photos = [];
  for (const id of ids) {
    const { photo, buffer } = await readFamilyPhoto(current, id);
    photos.push({ buffer, mimeType: photo.mimeType, originalName: photo.label, savedPhotoId: id });
  }
  for (const photo of uploads) {
    if (!IMAGE_TYPES.has(photo.type)) throw new Error('Photos must be JPEG, PNG, WebP, HEIC, or HEIF files.');
    if (photo.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 20 MB or smaller.');
    photos.push({ buffer: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type, originalName: photo.name || 'Story reference' });
  }
  if (photos.reduce((total, photo) => total + photo.buffer.length, 0) > MAX_TOTAL_PHOTO_BYTES) throw new Error('The combined reference photos must be 90 MB or smaller.');
  return photos;
}

async function moderatePhoto(jpeg) {
  const response = await fetch('https://api.openai.com/v1/moderations', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` } }] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Photo safety check failed (${response.status}).`);
  if (payload.results?.[0]?.flagged) throw new Error('This photo cannot be used. Choose a clear, everyday photo of your child.');
}

function ageGuidance(ageMonths) {
  if (ageMonths < 24) return 'The listener is a baby or young toddler: address the caregiver, keep each storyText to 1–2 very short sentences, and lean on sensory words, sounds, and repetition.';
  if (ageMonths < 48) return 'The listener is a toddler or young preschooler: keep each storyText to 2–3 short, concrete sentences with familiar words and one idea per sentence.';
  return 'The listener is a preschooler: keep each storyText to 3–4 sentences, let the child make small choices, and use simple cause-and-effect.';
}

export function buildPracticeStoryPrompt({ childName, ageMonths, goal, challenge = null, interests = [], parentGoals = [], theme = null, length, language = 'en', setting = '', sceneRange = null, readAloudMinutes = null }) {
  const steps = sceneRange || { min: length.minSteps, max: length.maxSteps };
  const minutes = readAloudMinutes || length.readAloudMinutes;
  const stepCount = steps.min === steps.max ? `exactly ${steps.min}` : `${steps.min}–${steps.max}`;
  const challengeLine = challenge
    ? `${plainTagLabel(challenge.label)} — practice goal: “${goal}”.`
    : `Practice goal: “${goal}”.`;
  const parentGoalLines = parentGoals.length
    ? parentGoals.map((item) => `- ${item.guidance}`).join('\n')
    : '- Build gentle confidence: name the child’s effort in specific words.';
  const worldLine = theme
    ? `Frame the story as ${theme.guidance}. Keep it cozy, never scary.`
    : 'Choose a cozy story world that fits the child’s favorite things.';
  return [
    `Write a personalized practice adventure (a social story) that helps ${childName}, age ${ageMonths} months, with an everyday challenge. Audience: birth to five.`,
    '',
    `CURRENT CHALLENGE: ${challengeLine}`,
    setting ? `SETTING: Set the whole story in or immediately around ${setting}.` : '',
    `PARENT GOALS (shape the story, cues, and tips around these):\n${parentGoalLines}`,
    `STORY WORLD: ${worldLine}`,
    `FAVORITE THINGS: ${interests.length ? `${interests.join(', ')}. Make one or two of them a companion character, vehicle, or place, and sprinkle the rest in as playful details.` : 'gentle everyday play.'}`,
    '',
    `ADVENTURE LENGTH: ${stepCount} scenes. Each scene is one step of the adventure AND one real, concrete action of the routine, in the order a family would actually do it.`,
    'STRUCTURE:',
    '- Scene 1: set up the mission, name how the child might feel about the challenge, and meet the trusted grown-up.',
    '- Middle scenes: each completes one real step, framed inside the story world. Around the middle, include one small wobble (a big feeling, a mistake, or wanting to stop) that the child handles with grown-up support and a calming or problem-solving tool.',
    '- Final scene: the routine is finished; the child feels proud and the mission is complete.',
    'FIELDS:',
    '- mission: one sentence that frames the quest in the story world.',
    '- heading: short, story-world flavored (for example “Stop 2: The Bubble Bridge”).',
    `- storyText: ${ageGuidance(ageMonths)}`,
    '- practiceCue: what the grown-up and child physically do together right now, in plain words.',
    '- sayTogether: a short line (8 words or fewer) the child can repeat aloud; a refrain may recur across scenes.',
    '- reflectionQuestions: 2–3 simple after-story questions linked to the parent goals.',
    '- caregiverTips: 2–4 practical tips linked to the challenge and parent goals.',
    `- readAloudMinutes: ${minutes}.`,
    '',
    'SAFETY AND TONE: calm, warm, respectful, concrete, and repeatable. The child succeeds without shame, threats, bribes, diagnosis, or promises of perfect behavior. For toileting, eating, sleep, separation, or other sensitive routines, avoid coercion and emphasize readiness, comfort, and caregiver support. This is educational practice, not medical or behavioral treatment. End with specific encouragement for trying.',
    languageInstruction(language),
  ].filter((line) => line !== '').join('\n');
}

async function generateStoryText(options) {
  const length = options.length || practiceStoryLength();
  const range = options.sceneRange || { min: length.minSteps, max: length.maxSteps };
  const prompt = buildPracticeStoryPrompt({ ...options, length });
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: STORY_MODEL, store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }], text: { format: { type: 'json_schema', name: 'practice_story', strict: true, schema: PRACTICE_STORY_SCHEMA } } }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Story generation failed (${response.status}).`);
    const output = responseText(payload);
    if (!output) { lastError = new Error('Story generation returned no usable result.'); continue; }
    const story = normalizePracticeStory(JSON.parse(output));
    if (story.scenes.length < range.min) { lastError = new Error('Story generation returned an incomplete story.'); continue; }
    story.scenes = story.scenes.slice(0, range.max);
    return { story, responseId: payload.id || null };
  }
  throw lastError;
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
    sceneRange: { min: 4, max: 6 },
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

async function generateCover(photos, story, childName, interests, theme = null) {
  const jpegs = await Promise.all(photos.map((photo) => normalizedPhoto(photo)));
  await Promise.all(jpegs.map((jpeg) => moderatePhoto(jpeg)));
  const form = new FormData();
  form.set('model', IMAGE_MODEL);
  form.set('size', '1024x1024');
  form.set('quality', process.env.PRACTICE_STORY_IMAGE_QUALITY || 'high');
  form.set('output_format', 'png');
  form.set('prompt', `Create a warm square children’s-book illustration showing the same young child from the reference photos proudly completing this everyday goal: ${story.goal}. Story theme: ${story.theme}. Treat every reference as the same child and use the clearest details across angles to preserve the child’s recognizable facial proportions, natural skin tone, hair, and age. Include subtle, child-safe motifs inspired by ${interests.join(', ') || 'cozy play'}${theme ? `, framed as ${theme.guidance}` : ''}. Use gentle watercolor and colored-pencil texture, a calm home or preschool setting, natural anatomy, and a joyful but realistic expression. No text, logos, medical claims, scary imagery, adult-like styling, or other recognizable faces.`);
  jpegs.forEach((jpeg, index) => form.append('image[]', new Blob([jpeg], { type: 'image/jpeg' }), `child-reference-${index + 1}.jpg`));
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
  const challenge = practiceStoryChallenge(formData.get('challenge'));
  const goal = text(formData.get('goal'), 120) || challenge?.goal || '';
  const interests = list(formData.get('interests'), 5);
  const parentGoals = practiceStoryParentGoals(formData.get('parentGoals'));
  const theme = practiceStoryTheme(formData.get('storyTheme'));
  const length = practiceStoryLength(formData.get('adventureLength'));
  const language = normalizeLanguage(formData.get('language') || child?.storyLanguage);
  if (!goal) throw new Error('Choose a current challenge or describe one goal to practice.');
  if (!interests.length) throw new Error('Add at least one favorite thing to shape the story.');
  const photos = await optionalPhotos(current, formData);
  const { story, responseId } = await generateStoryText({ childName, ageMonths, goal, challenge, interests, parentGoals, theme, length, language });
  story.brief = normalizePracticeStoryBrief({ challenge: challenge?.id, parentGoals: parentGoals.map((item) => item.id), storyTheme: theme?.id, adventureLength: length.id });
  const cover = photos.length ? await generateCover(photos, story, childName, interests, theme) : null;
  for (const photo of photos.filter((item) => !item.savedPhotoId)) await createFamilyPhoto(current, photo, { label: `${childName} story reference`, sourceKind: 'practice_story' });
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
