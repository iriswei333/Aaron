import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { photoCheckSeverity } from '@sproutcue/shared/photo-check';
import { assertChildPhotos, checkChildPhoto, CHILD_PHOTO_SOURCE_KINDS } from './child-photo-check.js';

const LOCAL_ROOT = resolve('data/family-assets/photos');
const LOCAL_STATE = resolve('data/family-assets/photos.json');
const BUCKET = 'family-assets';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_LABEL_LENGTH = 100;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const SOURCE_KINDS = new Set(['upload', 'picture_book', 'toy_play', 'practice_story']);
const CHECK_STATUSES = new Set(['unchecked', 'passed', 'rejected', 'error']);
const PHOTO_COLUMNS = 'id, label, mime_type, byte_size, width, height, source_kind, child_check_status, child_check_code, created_at, updated_at';

function ownerId(current) { return current.mode === 'supabase' ? current.authUser.id : current.localUserId; }
function cleanLabel(value) { return String(value || '').trim().slice(0, MAX_LABEL_LENGTH) || 'Family photo'; }
function cleanSourceKind(value) { return SOURCE_KINDS.has(value) ? value : 'upload'; }
function missing(message) { const error = new Error(message); error.code = 'NOT_FOUND'; return error; }

function mimeTypeFor(photo) {
  const declared = String(photo?.type || '').toLowerCase();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (IMAGE_TYPES.has(declared)) return declared;
  const name = String(photo?.name || '').toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return declared;
}

export async function photoInputFromForm(formData) {
  const photo = formData.get('photo');
  if (!photo || typeof photo.arrayBuffer !== 'function') throw new Error('Choose a photo.');
  const mimeType = mimeTypeFor(photo);
  if (!IMAGE_TYPES.has(mimeType)) throw new Error('Photos must be JPEG, PNG, WebP, HEIC, or HEIF files.');
  if (photo.size > MAX_PHOTO_BYTES) throw new Error('The photo must be 20 MB or smaller.');
  return { buffer: Buffer.from(await photo.arrayBuffer()), mimeType, originalName: String(photo.name || '') };
}

async function normalizePhoto(input) {
  const buffer = Buffer.isBuffer(input?.buffer) ? input.buffer : Buffer.from(input?.buffer || []);
  if (!buffer.length) throw new Error('The photo is empty.');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('The photo must be 20 MB or smaller.');
  try {
    return await sharp(buffer, { failOn: 'none', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new Error('The photo could not be processed. Choose another JPEG, PNG, WebP, HEIC, or HEIF image.');
  }
}

async function readLocalState() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { photos: [] }; throw error; }
}

async function writeLocalState(state) {
  await mkdir(LOCAL_ROOT, { recursive: true });
  await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`);
}

function checkStatus(value) { return CHECK_STATUSES.has(value) ? value : 'unchecked'; }

function serialize(photo) {
  const status = checkStatus(photo.childCheckStatus);
  const code = photo.childCheckCode || null;
  return {
    id: photo.id,
    label: photo.label,
    mimeType: photo.mimeType || 'image/jpeg',
    byteSize: Number(photo.byteSize) || 0,
    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
    sourceKind: cleanSourceKind(photo.sourceKind),
    childCheck: { status, code, severity: code ? photoCheckSeverity(code) : null },
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    contentUrl: `/api/family-assets/photos/content?photoId=${encodeURIComponent(photo.id)}`,
  };
}

function fromRow(row) {
  return {
    id: row.id, label: row.label, mimeType: row.mime_type, byteSize: row.byte_size, width: row.width, height: row.height,
    sourceKind: row.source_kind, childCheckStatus: row.child_check_status, childCheckCode: row.child_check_code,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/** Database columns for a checkChildPhoto() result. Only coarse classification data is kept. */
function checkColumns(result) {
  const skipped = result.status === 'skipped';
  return {
    child_check_status: skipped ? 'unchecked' : result.status,
    child_check_code: result.code || null,
    child_check_result: skipped ? null : { classification: result.classification || null, reasons: result.reasons || [] },
    child_check_model: result.model || null,
    child_checked_at: skipped ? null : new Date().toISOString(),
  };
}

function localCheckFields(result) {
  const columns = checkColumns(result);
  return {
    childCheckStatus: columns.child_check_status, childCheckCode: columns.child_check_code, childCheckResult: columns.child_check_result,
    childCheckModel: columns.child_check_model, childCheckedAt: columns.child_checked_at,
  };
}

/** Best-effort audit row (ai_photo_checks); never blocks the upload. Supabase mode only. */
async function recordPhotoCheck(current, { photoId = null, sourceKind, result }) {
  if (current.mode !== 'supabase' || !result || result.status === 'skipped') return;
  try {
    await current.supabase.from('ai_photo_checks').insert({
      profile_id: current.authUser.id, photo_id: photoId, source_kind: sourceKind, status: result.status, code: result.code || null,
      result: { classification: result.classification || null, reasons: result.reasons || [] }, model: result.model || null,
    });
  } catch { /* audit only */ }
}

/**
 * Saves a photo to the family library. Photos uploaded for a child-photo feature (picture book,
 * practice story) are checked first; a rejected photo is never stored and a PhotoCheckError
 * (422, or 503 when the check is unavailable) is thrown.
 * Options: label, sourceKind, photoIndex (for error details), language, checkPhoto (test hook).
 */
export async function createFamilyPhoto(current, input, options = {}) {
  const jpeg = await normalizePhoto(input);
  const label = cleanLabel(options.label || input.originalName);
  const sourceKind = cleanSourceKind(options.sourceKind);
  const check = CHILD_PHOTO_SOURCE_KINDS.has(sourceKind) ? await (options.checkPhoto || checkChildPhoto)(jpeg) : null;
  if (check && (check.status === 'rejected' || check.status === 'error')) {
    await recordPhotoCheck(current, { sourceKind, result: check });
    assertChildPhotos([{ index: options.photoIndex ?? 0, result: check }], { language: options.language });
  }
  const metadata = await sharp(jpeg).metadata();
  const id = randomUUID();
  const now = new Date().toISOString();
  if (current.mode !== 'supabase') {
    await mkdir(LOCAL_ROOT, { recursive: true });
    const storagePath = join(LOCAL_ROOT, `${id}.jpg`);
    await writeFile(storagePath, jpeg);
    const state = await readLocalState();
    const photo = { id, ownerId: ownerId(current), label, mimeType: 'image/jpeg', byteSize: jpeg.length, width: metadata.width, height: metadata.height, sourceKind, storagePath, ...(check ? localCheckFields(check) : {}), createdAt: now, updatedAt: now };
    state.photos.unshift(photo);
    await writeLocalState(state);
    return serialize(photo);
  }
  const storagePath = `${current.authUser.id}/photos/${id}.jpg`;
  const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(storagePath, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await current.supabase.from('family_saved_photos').insert({
    id, profile_id: current.authUser.id, label, storage_path: storagePath, mime_type: 'image/jpeg', byte_size: jpeg.length,
    width: metadata.width || null, height: metadata.height || null, source_kind: sourceKind, ...(check ? checkColumns(check) : {}),
  }).select(PHOTO_COLUMNS).single();
  if (error) {
    await current.supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  if (check) await recordPhotoCheck(current, { photoId: id, sourceKind, result: check });
  return serialize(fromRow(data));
}

export async function createFamilyPhotoFromDirectUpload(current, upload = {}, options = {}) {
  if (current.mode !== 'supabase') throw new Error('Direct photo uploads require a signed-in account.');
  const storagePath = String(upload.storagePath || '');
  const incomingPrefix = `${current.authUser.id}/incoming/`;
  if (!storagePath.startsWith(incomingPrefix) || storagePath.includes('..')) throw new Error('The uploaded photo path is invalid.');
  const mimeType = mimeTypeFor({ type: upload.mimeType, name: upload.originalName });
  if (!IMAGE_TYPES.has(mimeType)) throw new Error('Photos must be JPEG, PNG, WebP, HEIC, or HEIF files.');
  try {
    const { data, error } = await current.supabase.storage.from(BUCKET).download(storagePath);
    if (error || !data) throw new Error(error?.message || 'The uploaded photo could not be read.');
    const buffer = Buffer.from(await data.arrayBuffer());
    if (!buffer.length) throw new Error('The photo is empty.');
    if (buffer.length > MAX_PHOTO_BYTES) throw new Error('The photo must be 20 MB or smaller.');
    return await createFamilyPhoto(current, {
      buffer,
      mimeType,
      originalName: String(upload.originalName || ''),
    }, options);
  } finally {
    // Always removed — including when the photo-check rejects it, so rejected photos are not kept.
    await current.supabase.storage.from(BUCKET).remove([storagePath]);
  }
}

async function photoCheckRecords(current, photoIds) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    return new Map(state.photos.filter((photo) => photo.ownerId === ownerId(current) && photoIds.includes(photo.id))
      .map((photo) => [photo.id, { status: checkStatus(photo.childCheckStatus), code: photo.childCheckCode || null, sourceKind: photo.sourceKind }]));
  }
  const { data, error } = await current.supabase.from('family_saved_photos').select('id, source_kind, child_check_status, child_check_code').in('id', photoIds);
  if (error) throw new Error(error.message);
  return new Map(data.map((row) => [row.id, { status: checkStatus(row.child_check_status), code: row.child_check_code || null, sourceKind: row.source_kind }]));
}

async function saveCheckResult(current, photoId, result) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const photo = state.photos.find((item) => item.id === photoId && item.ownerId === ownerId(current));
    if (!photo) return;
    Object.assign(photo, localCheckFields(result), { updatedAt: new Date().toISOString() });
    await writeLocalState(state);
    return;
  }
  const { error } = await current.supabase.from('family_saved_photos').update(checkColumns(result)).eq('id', photoId);
  if (error) throw new Error(error.message);
}

/**
 * Confirms saved photos are usable as child reference photos before an AI request is created.
 * Photos already checked reuse their stored result; photos saved without a check (general library
 * or toy photos) are checked now and the result is stored. Throws one PhotoCheckError listing every
 * failing photo. Options: startIndex (position of the first id in the request), language, checkPhoto.
 */
export async function requireChildPhotos(current, photoIds = [], options = {}) {
  const ids = [...new Set(photoIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const records = await photoCheckRecords(current, ids);
  const missingId = ids.find((id) => !records.has(id));
  if (missingId) throw missing('Photo not found.');
  const startIndex = Number(options.startIndex) || 0;
  const checks = await Promise.all(ids.map(async (photoId, offset) => {
    const record = records.get(photoId);
    const index = startIndex + offset;
    if (record.status === 'passed' || record.status === 'rejected') return { index, photoId, result: { status: record.status, code: record.code } };
    const { buffer } = await readFamilyPhoto(current, photoId);
    const result = await (options.checkPhoto || checkChildPhoto)(buffer);
    if (result.status !== 'skipped') {
      await saveCheckResult(current, photoId, result);
      await recordPhotoCheck(current, { photoId, sourceKind: record.sourceKind, result });
    }
    return { index, photoId, result };
  }));
  assertChildPhotos(checks, { language: options.language });
  return checks;
}

export async function listFamilyPhotos(current) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    return state.photos.filter((photo) => photo.ownerId === ownerId(current)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(serialize);
  }
  const { data, error } = await current.supabase.from('family_saved_photos').select(PHOTO_COLUMNS).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((photo) => serialize(fromRow(photo)));
}

export async function readFamilyPhoto(current, photoId) {
  if (!photoId) throw missing('Photo not found.');
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const photo = state.photos.find((item) => item.id === photoId && item.ownerId === ownerId(current));
    if (!photo) throw missing('Photo not found.');
    return { photo: serialize(photo), buffer: await readFile(photo.storagePath) };
  }
  const { data: photo, error } = await current.supabase.from('family_saved_photos').select(`${PHOTO_COLUMNS}, storage_path`).eq('id', photoId).single();
  if (error || !photo) throw missing('Photo not found.');
  const { data, error: downloadError } = await current.supabase.storage.from(BUCKET).download(photo.storage_path);
  if (downloadError) throw new Error(downloadError.message);
  return { photo: serialize(fromRow(photo)), buffer: Buffer.from(await data.arrayBuffer()) };
}

export async function updateFamilyPhoto(current, photoId, updates = {}) {
  const label = cleanLabel(updates.label);
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const photo = state.photos.find((item) => item.id === photoId && item.ownerId === ownerId(current));
    if (!photo) throw missing('Photo not found.');
    photo.label = label;
    photo.updatedAt = new Date().toISOString();
    await writeLocalState(state);
    return serialize(photo);
  }
  const { data, error } = await current.supabase.from('family_saved_photos').update({ label }).eq('id', photoId).select(PHOTO_COLUMNS).single();
  if (error || !data) throw missing('Photo not found.');
  return serialize(fromRow(data));
}

export async function deleteFamilyPhoto(current, photoId) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const index = state.photos.findIndex((item) => item.id === photoId && item.ownerId === ownerId(current));
    if (index < 0) throw missing('Photo not found.');
    const [photo] = state.photos.splice(index, 1);
    await writeLocalState(state);
    await rm(photo.storagePath, { force: true });
    return;
  }
  const { data: photo, error: findError } = await current.supabase.from('family_saved_photos').select('id, storage_path').eq('id', photoId).single();
  if (findError || !photo) throw missing('Photo not found.');
  const { error } = await current.supabase.from('family_saved_photos').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
  const { error: storageError } = await current.supabase.storage.from(BUCKET).remove([photo.storage_path]);
  if (storageError) throw new Error(storageError.message);
}

export { MAX_PHOTO_BYTES };
