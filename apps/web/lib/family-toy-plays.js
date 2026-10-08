import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { getChildProfile } from '@sproutcue/shared/profile-defaults';
import { createFamilyPhoto, readFamilyPhoto } from './family-photos.js';

const LOCAL_ROOT = resolve('data/family-assets');
const LOCAL_STATE = join(LOCAL_ROOT, 'toy-plays.json');
const BUCKET = 'family-assets';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MODEL = process.env.TOY_PLAY_MODEL || 'gpt-5';
const TOY_PLAY_LANGUAGES = {
  en: { label: 'English', instruction: 'Write every user-facing string in natural, plain English.' },
  'zh-CN': { label: '中文（普通话）', instruction: 'Write every user-facing string in natural Simplified Chinese suitable for a Mandarin-speaking family. Do not mix in English except when a proper noun has no natural Chinese equivalent.' },
};

const TOY_PLAY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'message', 'toy', 'play'],
  properties: {
    status: { type: 'string', enum: ['ready', 'not_a_toy', 'uncertain'] },
    message: { type: 'string' },
    toy: {
      type: 'object', additionalProperties: false,
      required: ['name', 'category', 'description', 'confidence'],
      properties: {
        name: { type: 'string' }, category: { type: 'string' }, description: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    play: {
      type: 'object', additionalProperties: false,
      required: ['title', 'summary', 'ageRange', 'durationMinutes', 'developmentalGoals', 'materials', 'steps', 'parentPrompts', 'easierVariation', 'harderVariation', 'safetyNotes', 'supervision'],
      properties: {
        title: { type: 'string' }, summary: { type: 'string' }, ageRange: { type: 'string' },
        durationMinutes: { type: 'integer', minimum: 1, maximum: 45 },
        developmentalGoals: { type: 'array', items: { type: 'string' }, maxItems: 3 },
        materials: { type: 'array', items: { type: 'string' }, maxItems: 6 },
        steps: { type: 'array', items: { type: 'string' }, maxItems: 6 },
        parentPrompts: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        easierVariation: { type: 'string' }, harderVariation: { type: 'string' },
        safetyNotes: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        supervision: { type: 'string' },
      },
    },
  },
};

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
function text(value, max = 500) { return String(value || '').trim().slice(0, max); }
function list(value, max = 6) { return Array.isArray(value) ? value.slice(0, max).map((item) => text(item, 300)).filter(Boolean) : []; }
export function normalizeToyPlayLanguage(value) { return Object.hasOwn(TOY_PLAY_LANGUAGES, value) ? value : 'en'; }

export function normalizeToyPlayAnalysis(value) {
  const analysis = value && typeof value === 'object' ? value : {};
  const toy = analysis.toy && typeof analysis.toy === 'object' ? analysis.toy : {};
  const play = analysis.play && typeof analysis.play === 'object' ? analysis.play : {};
  const status = ['ready', 'not_a_toy', 'uncertain'].includes(analysis.status) ? analysis.status : 'uncertain';
  return {
    status,
    message: text(analysis.message),
    toy: {
      name: text(toy.name, 120), category: text(toy.category, 80), description: text(toy.description),
      confidence: ['high', 'medium', 'low'].includes(toy.confidence) ? toy.confidence : 'low',
    },
    play: {
      title: text(play.title, 120), summary: text(play.summary), ageRange: text(play.ageRange, 80),
      durationMinutes: Math.min(45, Math.max(1, Number(play.durationMinutes) || 5)),
      developmentalGoals: list(play.developmentalGoals, 3), materials: list(play.materials, 6),
      steps: list(play.steps, 6), parentPrompts: list(play.parentPrompts, 4),
      easierVariation: text(play.easierVariation), harderVariation: text(play.harderVariation),
      safetyNotes: list(play.safetyNotes, 5), supervision: text(play.supervision),
    },
  };
}

async function resolvePhoto(current, formData) {
  const savedPhotoId = String(formData.get('savedPhotoId') || '').trim();
  if (savedPhotoId) {
    const { photo, buffer } = await readFamilyPhoto(current, savedPhotoId);
    return { buffer, mimeType: photo.mimeType, originalName: photo.label, savedPhotoId };
  }
  const photo = formData.get('photo');
  if (!photo || typeof photo.arrayBuffer !== 'function') throw new Error('Choose a toy photo.');
  if (!IMAGE_TYPES.has(photo.type)) throw new Error('Toy photos must be JPEG, PNG, WebP, or HEIC.');
  if (photo.size > MAX_PHOTO_BYTES) throw new Error('The toy photo must be 20 MB or smaller.');
  return { buffer: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type, originalName: photo.name || '' };
}

async function normalizedPhoto(photo) {
  const input = Buffer.isBuffer(photo?.buffer) ? photo.buffer : Buffer.from(await photo.arrayBuffer());
  return sharp(input).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
}

function childAgeMonths(current) {
  const age = Number(getChildProfile(current.user)?.ageMonths);
  return Number.isFinite(age) && age > 0 ? Math.round(age) : 30;
}

function responseText(payload) {
  for (const item of payload?.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text;
  }
  return '';
}

async function moderatePhoto(dataUrl) {
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: dataUrl } }] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Photo safety check failed (${response.status}).`);
  if (payload.results?.[0]?.flagged) throw new Error('This photo cannot be analyzed. Choose a clear photo showing only the toy.');
}

export async function generateToyPlay(current, formData) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const photo = await resolvePhoto(current, formData);
  const jpeg = await normalizedPhoto(photo);
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  await moderatePhoto(dataUrl);
  const ageMonths = childAgeMonths(current);
  const language = normalizeToyPlayLanguage(formData.get('language'));
  const prompt = `Analyze the photo for a parent of a ${ageMonths}-month-old child. Identify the main toy only; do not identify people, faces, brands, locations, or personal details. If there is no clear toy, set status to not_a_toy. If identification is unreliable, set status to uncertain. When status is ready, create one simple way to play using the pictured toy and ordinary household items only. Match the child's developmental stage, avoid choking hazards and unsafe climbing, require active adult supervision, and never present the activity as medical or developmental treatment. Keep every step short and practical. For non-ready results, leave play strings and arrays empty but still satisfy the schema. Output language: ${TOY_PLAY_LANGUAGES[language].instruction}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }],
      text: { format: { type: 'json_schema', name: 'toy_play_plan', strict: true, schema: TOY_PLAY_SCHEMA } },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Toy analysis failed (${response.status}).`);
  const output = responseText(payload);
  if (!output) throw new Error('Toy analysis returned no usable result.');
  const analysis = normalizeToyPlayAnalysis(JSON.parse(output));
  return { analysis, childAgeMonths: ageMonths, language, model: MODEL, responseId: payload.id || null };
}

async function readLocalState() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { assets: [] }; throw error; }
}
async function saveLocalState(state) { await mkdir(LOCAL_ROOT, { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }

function serialize(asset) {
  return {
    id: asset.id, assetType: 'toy_play', title: asset.title, status: asset.status || 'ready', childAgeMonths: asset.childAgeMonths,
    language: normalizeToyPlayLanguage(asset.language), toy: asset.toy, play: asset.play, createdAt: asset.createdAt, updatedAt: asset.updatedAt,
  };
}

async function saveLocalToyPlay(current, photo, analysis, metadata) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const directory = join(LOCAL_ROOT, 'toy-plays', id);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'toy.jpg'), await normalizedPhoto(photo));
  const asset = { id, ownerId: ownerId(current), title: analysis.play.title || `Play with ${analysis.toy.name}`, status: 'ready', childAgeMonths: childAgeMonths(current), language: metadata.language, toy: analysis.toy, play: analysis.play, photoStoragePath: 'toy.jpg', model: metadata.model || MODEL, responseId: metadata.responseId || null, aiJobId: metadata.jobId || null, createdAt: now, updatedAt: now };
  const state = await readLocalState();
  state.assets.unshift(asset);
  await saveLocalState(state);
  return asset;
}

async function saveSupabaseToyPlay(current, photo, analysis, metadata) {
  const { data: asset, error: assetError } = await current.supabase.from('family_assets').insert({ profile_id: current.authUser.id, asset_type: 'toy_play', title: analysis.play.title || `Play with ${analysis.toy.name}`, status: 'ready', metadata: { source: 'toy-photo-ai', language: metadata.language, ...(metadata.jobId ? { aiJobId: metadata.jobId } : {}) } }).select('id, title, status, created_at, updated_at').single();
  if (assetError) throw new Error(assetError.message);
  const path = `${current.authUser.id}/toy-plays/${asset.id}/toy.jpg`;
  let uploaded = false;
  try {
    const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(path, await normalizedPhoto(photo), { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    uploaded = true;
    const { error } = await current.supabase.from('family_toy_play_assets').insert({ asset_id: asset.id, photo_storage_path: path, photo_mime_type: 'image/jpeg', child_age_months: childAgeMonths(current), language: metadata.language, toy_name: analysis.toy.name, toy_category: analysis.toy.category, toy_description: analysis.toy.description, identification_confidence: analysis.toy.confidence, play_plan: analysis.play, model: metadata.model || MODEL, response_id: metadata.responseId || null });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded) await current.supabase.storage.from(BUCKET).remove([path]);
    await current.supabase.from('family_assets').delete().eq('id', asset.id).eq('profile_id', current.authUser.id);
    throw error;
  }
  return { id: asset.id, title: asset.title, status: asset.status, childAgeMonths: childAgeMonths(current), language: metadata.language, toy: analysis.toy, play: analysis.play, createdAt: asset.created_at, updatedAt: asset.updated_at };
}

export async function saveToyPlay(current, formData) {
  const photo = await resolvePhoto(current, formData);
  let parsed;
  try { parsed = JSON.parse(String(formData.get('analysis') || '')); } catch { throw new Error('The generated play plan is invalid.'); }
  const analysis = normalizeToyPlayAnalysis(parsed);
  if (analysis.status !== 'ready' || !analysis.toy.name || !analysis.play.title || analysis.play.steps.length < 2) throw new Error('Generate a complete toy play plan before saving.');
  if (!photo.savedPhotoId) await createFamilyPhoto(current, photo, { label: analysis.toy.name || photo.originalName, sourceKind: 'toy_play' });
  const metadata = { language: normalizeToyPlayLanguage(formData.get('language')), model: text(formData.get('model'), 100), responseId: text(formData.get('responseId'), 160), jobId: text(formData.get('jobId'), 100) };
  const asset = current.mode === 'supabase' ? await saveSupabaseToyPlay(current, photo, analysis, metadata) : await saveLocalToyPlay(current, photo, analysis, metadata);
  return serialize(asset);
}

export async function listToyPlays(current) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    return state.assets.filter((asset) => asset.ownerId === ownerId(current)).map(serialize);
  }
  const { data: assets, error } = await current.supabase.from('family_assets').select('id, title, status, created_at, updated_at').eq('asset_type', 'toy_play').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const results = [];
  for (const asset of assets) {
    const { data: detail, error: detailError } = await current.supabase.from('family_toy_play_assets').select('child_age_months, language, toy_name, toy_category, toy_description, identification_confidence, play_plan').eq('asset_id', asset.id).single();
    if (detailError) throw new Error(detailError.message);
    results.push(serialize({ id: asset.id, title: asset.title, status: asset.status, childAgeMonths: detail.child_age_months, language: detail.language, toy: { name: detail.toy_name, category: detail.toy_category, description: detail.toy_description, confidence: detail.identification_confidence }, play: detail.play_plan, createdAt: asset.created_at, updatedAt: asset.updated_at }));
  }
  return results;
}

export async function deleteToyPlay(current, assetId) {
  const id = text(assetId, 100);
  if (!id) throw new Error('Toy play asset id is required.');
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const index = state.assets.findIndex((asset) => asset.id === id && asset.ownerId === ownerId(current));
    if (index < 0) { const error = new Error('Toy play asset not found.'); error.code = 'NOT_FOUND'; throw error; }
    state.assets.splice(index, 1);
    await saveLocalState(state);
    await rm(join(LOCAL_ROOT, 'toy-plays', id), { recursive: true, force: true });
    return;
  }
  const { data: detail, error: detailError } = await current.supabase.from('family_toy_play_assets').select('photo_storage_path').eq('asset_id', id).single();
  if (detailError || !detail) { const error = new Error('Toy play asset not found.'); error.code = 'NOT_FOUND'; throw error; }
  if (detail.photo_storage_path) {
    const { error } = await current.supabase.storage.from(BUCKET).remove([detail.photo_storage_path]);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await current.supabase.from('family_assets').delete().eq('id', id).eq('profile_id', current.authUser.id).select('id').single();
  if (error || !data) { const missing = new Error('Toy play asset not found.'); missing.code = 'NOT_FOUND'; throw missing; }
}

export { TOY_PLAY_LANGUAGES, TOY_PLAY_SCHEMA };
