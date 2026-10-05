import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const LOCAL_ROOT = resolve('data/family-assets/photos');
const LOCAL_STATE = resolve('data/family-assets/photos.json');
const BUCKET = 'family-assets';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_LABEL_LENGTH = 100;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const SOURCE_KINDS = new Set(['upload', 'picture_book', 'toy_play', 'practice_story']);

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

function serialize(photo) {
  return {
    id: photo.id,
    label: photo.label,
    mimeType: photo.mimeType || 'image/jpeg',
    byteSize: Number(photo.byteSize) || 0,
    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
    sourceKind: cleanSourceKind(photo.sourceKind),
    createdAt: photo.createdAt,
    updatedAt: photo.updatedAt,
    contentUrl: `/api/family-assets/photos/content?photoId=${encodeURIComponent(photo.id)}`,
  };
}

export async function createFamilyPhoto(current, input, options = {}) {
  const jpeg = await normalizePhoto(input);
  const metadata = await sharp(jpeg).metadata();
  const id = randomUUID();
  const now = new Date().toISOString();
  const label = cleanLabel(options.label || input.originalName);
  const sourceKind = cleanSourceKind(options.sourceKind);
  if (current.mode !== 'supabase') {
    await mkdir(LOCAL_ROOT, { recursive: true });
    const storagePath = join(LOCAL_ROOT, `${id}.jpg`);
    await writeFile(storagePath, jpeg);
    const state = await readLocalState();
    const photo = { id, ownerId: ownerId(current), label, mimeType: 'image/jpeg', byteSize: jpeg.length, width: metadata.width, height: metadata.height, sourceKind, storagePath, createdAt: now, updatedAt: now };
    state.photos.unshift(photo);
    await writeLocalState(state);
    return serialize(photo);
  }
  const storagePath = `${current.authUser.id}/photos/${id}.jpg`;
  const { error: uploadError } = await current.supabase.storage.from(BUCKET).upload(storagePath, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data, error } = await current.supabase.from('family_saved_photos').insert({
    id, profile_id: current.authUser.id, label, storage_path: storagePath, mime_type: 'image/jpeg', byte_size: jpeg.length,
    width: metadata.width || null, height: metadata.height || null, source_kind: sourceKind,
  }).select('id, label, mime_type, byte_size, width, height, source_kind, created_at, updated_at').single();
  if (error) {
    await current.supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  return serialize({ id: data.id, label: data.label, mimeType: data.mime_type, byteSize: data.byte_size, width: data.width, height: data.height, sourceKind: data.source_kind, createdAt: data.created_at, updatedAt: data.updated_at });
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
    await current.supabase.storage.from(BUCKET).remove([storagePath]);
  }
}

export async function listFamilyPhotos(current) {
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    return state.photos.filter((photo) => photo.ownerId === ownerId(current)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(serialize);
  }
  const { data, error } = await current.supabase.from('family_saved_photos').select('id, label, mime_type, byte_size, width, height, source_kind, created_at, updated_at').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((photo) => serialize({ id: photo.id, label: photo.label, mimeType: photo.mime_type, byteSize: photo.byte_size, width: photo.width, height: photo.height, sourceKind: photo.source_kind, createdAt: photo.created_at, updatedAt: photo.updated_at }));
}

export async function readFamilyPhoto(current, photoId) {
  if (!photoId) throw missing('Photo not found.');
  if (current.mode !== 'supabase') {
    const state = await readLocalState();
    const photo = state.photos.find((item) => item.id === photoId && item.ownerId === ownerId(current));
    if (!photo) throw missing('Photo not found.');
    return { photo: serialize(photo), buffer: await readFile(photo.storagePath) };
  }
  const { data: photo, error } = await current.supabase.from('family_saved_photos').select('id, label, storage_path, mime_type, byte_size, width, height, source_kind, created_at, updated_at').eq('id', photoId).single();
  if (error || !photo) throw missing('Photo not found.');
  const { data, error: downloadError } = await current.supabase.storage.from(BUCKET).download(photo.storage_path);
  if (downloadError) throw new Error(downloadError.message);
  return { photo: serialize({ id: photo.id, label: photo.label, mimeType: photo.mime_type, byteSize: photo.byte_size, width: photo.width, height: photo.height, sourceKind: photo.source_kind, createdAt: photo.created_at, updatedAt: photo.updated_at }), buffer: Buffer.from(await data.arrayBuffer()) };
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
  const { data, error } = await current.supabase.from('family_saved_photos').update({ label }).eq('id', photoId).select('id, label, mime_type, byte_size, width, height, source_kind, created_at, updated_at').single();
  if (error || !data) throw missing('Photo not found.');
  return serialize({ id: data.id, label: data.label, mimeType: data.mime_type, byteSize: data.byte_size, width: data.width, height: data.height, sourceKind: data.source_kind, createdAt: data.created_at, updatedAt: data.updated_at });
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
