import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { generateFamilyPictureBookPage, getFamilyPictureBook } from './family-picture-books.js';
import { generateAndSavePracticeStory } from './family-practice-stories.js';
import { generateToyPlay, saveToyPlay } from './family-toy-plays.js';

const LOCAL_STATE = resolve('data/ai-jobs.json');
const DAILY_LIMIT = 10;
const ADMIN_EMAILS = new Set(['iris333wei@gmail.com', '1111iris.iris@gmail.com']);
const JOB_TYPES = new Set(['toy_play', 'practice_story', 'picture_book_page', 'picture_book_whole']);

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
export function isUnlimitedAiEmail(value) { return ADMIN_EMAILS.has(String(value || '').trim().toLowerCase()); }
function isAdmin(current) { return isUnlimitedAiEmail(current.user?.email || current.authUser?.email); }
function dayFor(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function today() { return dayFor(); }
function serializeJob(job) {
  return {
    id: job.id, jobType: job.jobType, status: job.status, progress: Number(job.progress) || 0,
    estimatedSeconds: Number(job.estimatedSeconds) || 60, result: job.result || null,
    error: job.errorMessage || null, createdAt: job.createdAt, startedAt: job.startedAt || null, completedAt: job.completedAt || null,
  };
}
function serializeNotification(item) {
  return { id: item.id, type: item.notificationType, title: item.title, message: item.message, href: item.href, assetId: item.assetId || null, jobId: item.jobId || null, readAt: item.readAt || null, createdAt: item.createdAt };
}
async function readLocalState() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { jobs: [], notifications: [] }; throw error; }
}
async function writeLocalState(state) { await mkdir(resolve('data'), { recursive: true }); await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`); }

export async function enqueueAiJob(current, { jobType, payload = {}, estimatedSeconds = 60 }) {
  if (!JOB_TYPES.has(jobType)) throw new Error('Unsupported AI job type.');
  if (current.mode === 'supabase') {
    const { data, error } = await current.supabase.rpc('enqueue_ai_generation_job', { requested_job_type: jobType, requested_payload: payload, requested_estimated_seconds: Math.max(1, Number(estimatedSeconds) || 60) });
    if (error) {
      if (error.message?.includes('DAILY_AI_LIMIT_REACHED')) { const limit = new Error('You have used today’s 10 AI creations. Your limit resets tomorrow.'); limit.code = 'DAILY_AI_LIMIT_REACHED'; throw limit; }
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    const job = await getAiJob(current, row.job_id);
    return { job, usage: { used: row.used_count, limit: row.daily_limit, unlimited: row.unlimited } };
  }
  const state = await readLocalState();
  const unlimited = isAdmin(current);
  const used = state.jobs.filter((job) => job.ownerId === ownerId(current) && dayFor(job.createdAt) === today()).length;
  if (!unlimited && used >= DAILY_LIMIT) { const error = new Error('You have used today’s 10 AI creations. Your limit resets tomorrow.'); error.code = 'DAILY_AI_LIMIT_REACHED'; throw error; }
  const job = { id: randomUUID(), ownerId: ownerId(current), jobType, status: 'queued', payload, result: null, progress: 0, estimatedSeconds: Math.max(1, Number(estimatedSeconds) || 60), errorMessage: null, createdAt: new Date().toISOString(), startedAt: null, completedAt: null };
  state.jobs.unshift(job); await writeLocalState(state);
  return { job: serializeJob(job), usage: { used: used + 1, limit: DAILY_LIMIT, unlimited } };
}

export async function getAiJob(current, jobId) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState(); const job = state.jobs.find((item) => item.id === jobId && item.ownerId === ownerId(current));
    if (!job) { const error = new Error('AI job not found.'); error.code = 'NOT_FOUND'; throw error; }
    return serializeJob(job);
  }
  const { data, error } = await current.supabase.from('ai_generation_jobs').select('id, job_type, status, progress, estimated_seconds, result, error_message, created_at, started_at, completed_at').eq('id', jobId).single();
  if (error || !data) { const missing = new Error('AI job not found.'); missing.code = 'NOT_FOUND'; throw missing; }
  return serializeJob({ id: data.id, jobType: data.job_type, status: data.status, progress: data.progress, estimatedSeconds: data.estimated_seconds, result: data.result, errorMessage: data.error_message, createdAt: data.created_at, startedAt: data.started_at, completedAt: data.completed_at });
}

async function jobRecord(current, jobId) {
  if (current.mode !== 'supabase') { const state = await readLocalState(); return { state, job: state.jobs.find((item) => item.id === jobId && item.ownerId === ownerId(current)) }; }
  const { data, error } = await current.supabase.from('ai_generation_jobs').select('*').eq('id', jobId).single();
  if (error) throw new Error(error.message); return { job: data ? { id: data.id, jobType: data.job_type, status: data.status, payload: data.payload, progress: data.progress, estimatedSeconds: data.estimated_seconds } : null };
}
async function updateJob(current, jobId, patch) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState(); const job = state.jobs.find((item) => item.id === jobId && item.ownerId === ownerId(current)); if (!job) return;
    Object.assign(job, patch); await writeLocalState(state); return;
  }
  const row = {};
  if ('status' in patch) row.status = patch.status;
  if ('progress' in patch) row.progress = patch.progress;
  if ('result' in patch) row.result = patch.result;
  if ('errorMessage' in patch) row.error_message = patch.errorMessage;
  if ('startedAt' in patch) row.started_at = patch.startedAt;
  if ('completedAt' in patch) row.completed_at = patch.completedAt;
  if (patch.result?.assetId) row.asset_id = patch.result.assetId;
  const { error } = await current.supabase.from('ai_generation_jobs').update(row).eq('id', jobId); if (error) throw new Error(error.message);
}
async function addNotification(current, job, result, errorMessage = '') {
  const failed = Boolean(errorMessage);
  const item = { id: randomUUID(), ownerId: ownerId(current), notificationType: failed ? 'ai_asset_failed' : 'ai_asset_ready', title: failed ? 'AI creation needs attention' : `${result.title || 'Your AI creation'} is ready`, message: failed ? errorMessage : 'Tap to open your new family asset.', href: failed ? '/play-studio' : result.href, assetId: result.assetId || null, jobId: job.id, readAt: null, createdAt: new Date().toISOString() };
  if (current.mode !== 'supabase') { const state = await readLocalState(); state.notifications.unshift(item); await writeLocalState(state); return; }
  const { error } = await current.supabase.from('family_notifications').insert({ profile_id: current.authUser.id, notification_type: item.notificationType, title: item.title, message: item.message, href: item.href, asset_id: item.assetId, job_id: job.id }); if (error) throw new Error(error.message);
}

async function executeJob(current, job) {
  const payload = job.payload || {};
  if (current.mode === 'supabase' && ['toy_play', 'practice_story'].includes(job.jobType)) {
    const assetType = job.jobType === 'toy_play' ? 'toy_play' : 'practice_story';
    const { data: existing } = await current.supabase.from('family_assets').select('id, title').eq('asset_type', assetType).contains('metadata', { aiJobId: job.id }).maybeSingle();
    if (existing) return { assetId: existing.id, title: existing.title, assetType, href: assetType === 'toy_play' ? `/family?toyPlay=${encodeURIComponent(existing.id)}` : `/family?practiceStory=${encodeURIComponent(existing.id)}` };
  }
  if (job.jobType === 'toy_play') {
    const generateForm = new FormData(); generateForm.set('savedPhotoId', payload.savedPhotoId); generateForm.set('language', payload.language || 'en');
    const generated = await generateToyPlay(current, generateForm);
    if (generated.analysis.status !== 'ready') throw new Error(generated.analysis.message || 'The toy could not be identified.');
    const saveForm = new FormData(); saveForm.set('savedPhotoId', payload.savedPhotoId); saveForm.set('language', generated.language); saveForm.set('analysis', JSON.stringify(generated.analysis)); saveForm.set('model', generated.model); saveForm.set('responseId', generated.responseId || ''); saveForm.set('jobId', job.id);
    const asset = await saveToyPlay(current, saveForm);
    return { assetId: asset.id, title: asset.title, assetType: 'toy_play', href: `/family?toyPlay=${encodeURIComponent(asset.id)}` };
  }
  if (job.jobType === 'practice_story') {
    const form = new FormData(); form.set('goal', payload.goal || ''); form.set('challenge', payload.challenge || ''); form.set('interests', payload.interests); form.set('parentGoals', (payload.parentGoals || []).join(',')); form.set('storyTheme', payload.storyTheme || ''); form.set('adventureLength', payload.adventureLength || ''); form.set('language', payload.language || 'en'); form.set('jobId', job.id);
    const photoIds = Array.isArray(payload.savedPhotoIds) ? payload.savedPhotoIds : (payload.savedPhotoId ? [payload.savedPhotoId] : []);
    photoIds.slice(0, 5).forEach((photoId) => form.append('savedPhotoIds', photoId));
    const asset = await generateAndSavePracticeStory(current, form);
    return { assetId: asset.id, title: asset.title, assetType: 'practice_story', href: `/family?practiceStory=${encodeURIComponent(asset.id)}` };
  }
  if (job.jobType === 'picture_book_page') {
    const existingBook = await getFamilyPictureBook(current, payload.bookAssetId);
    const existingPage = existingBook.pages.find((page) => page.pageKey === payload.pageKey);
    if (existingPage?.status === 'ready') return { assetId: existingBook.id, title: existingBook.title, assetType: 'picture_book', pageKey: payload.pageKey, href: `/picture-books?bookAssetId=${encodeURIComponent(existingBook.id)}&pageKey=${encodeURIComponent(payload.pageKey)}` };
    const book = await generateFamilyPictureBookPage(current, payload.bookAssetId, payload.pageKey);
    return { assetId: book.id, title: book.title, assetType: 'picture_book', pageKey: payload.pageKey, href: `/picture-books?bookAssetId=${encodeURIComponent(book.id)}&pageKey=${encodeURIComponent(payload.pageKey)}` };
  }
  if (job.jobType === 'picture_book_whole') {
    let book = await getFamilyPictureBook(current, payload.bookAssetId);
    const pending = book.pages.filter((page) => page.status !== 'ready').sort((a, b) => a.pageOrder - b.pageOrder);
    for (let index = 0; index < pending.length; index += 1) { book = await generateFamilyPictureBookPage(current, book.id, pending[index].pageKey); await updateJob(current, job.id, { progress: Math.max(5, Math.round(((index + 1) / pending.length) * 95)) }); }
    return { assetId: book.id, title: book.title, assetType: 'picture_book', href: `/picture-books?bookAssetId=${encodeURIComponent(book.id)}` };
  }
  throw new Error('Unsupported AI job type.');
}

export async function processAiJob(current, jobId) {
  const record = await jobRecord(current, jobId); const job = record.job;
  if (!job || job.status !== 'queued') return job ? serializeJob(job) : null;
  const startedAt = new Date().toISOString(); await updateJob(current, jobId, { status: 'running', progress: 5, startedAt }); job.status = 'running';
  try {
    const result = await executeJob(current, job); const completedAt = new Date().toISOString();
    await updateJob(current, jobId, { status: 'succeeded', progress: 100, result, completedAt });
    try { await addNotification(current, job, result); } catch {}
    return getAiJob(current, jobId);
  } catch (error) {
    const message = String(error.message || 'AI generation failed.').slice(0, 1000); const completedAt = new Date().toISOString();
    await updateJob(current, jobId, { status: 'failed', progress: 100, errorMessage: message, completedAt });
    try { await addNotification(current, job, {}, message); } catch {}
    return getAiJob(current, jobId);
  }
}

export async function processPendingAiJobs(supabase, { limit = 2 } = {}) {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabase.from('ai_generation_jobs').update({ status: 'queued', progress: 0, started_at: null, error_message: null }).eq('status', 'running').lt('started_at', staleBefore);
  const { data: jobs, error } = await supabase.from('ai_generation_jobs').select('id, profile_id').eq('status', 'queued').order('created_at').limit(Math.max(1, Math.min(10, limit)));
  if (error) throw new Error(error.message);
  const results = [];
  for (const row of jobs || []) {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, display_name, child_profile, location, play_preferences').eq('id', row.profile_id).single();
    if (profileError || !profile) continue;
    const current = { mode: 'supabase', supabase, authUser: { id: profile.id, email: profile.email || '' }, user: { id: profile.id, email: profile.email || '', displayName: profile.display_name || 'Family Profile', childProfile: profile.child_profile || {}, location: profile.location || null, playPreferences: profile.play_preferences || {} } };
    results.push(await processAiJob(current, row.id));
  }
  return results;
}

export async function listNotifications(current) {
  if (current.mode !== 'supabase') { const state = await readLocalState(); return state.notifications.filter((item) => item.ownerId === ownerId(current)).slice(0, 30).map(serializeNotification); }
  const { data, error } = await current.supabase.from('family_notifications').select('id, notification_type, title, message, href, asset_id, job_id, read_at, created_at').order('created_at', { ascending: false }).limit(30); if (error) throw new Error(error.message);
  return data.map((item) => serializeNotification({ id: item.id, notificationType: item.notification_type, title: item.title, message: item.message, href: item.href, assetId: item.asset_id, jobId: item.job_id, readAt: item.read_at, createdAt: item.created_at }));
}
export async function markNotificationRead(current, notificationId) {
  const readAt = new Date().toISOString();
  if (current.mode !== 'supabase') { const state = await readLocalState(); const item = state.notifications.find((entry) => entry.id === notificationId && entry.ownerId === ownerId(current)); if (item) item.readAt = readAt; await writeLocalState(state); return; }
  const { error } = await current.supabase.from('family_notifications').update({ read_at: readAt }).eq('id', notificationId); if (error) throw new Error(error.message);
}

export { ADMIN_EMAILS, DAILY_LIMIT };
