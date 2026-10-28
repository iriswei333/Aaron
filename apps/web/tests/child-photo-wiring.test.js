import { AI_CONSENT_VERSION } from '@sproutcue/shared/ai-consent';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoCheckError } from '../lib/child-photo-check.js';
import { createFamilyPhoto, createFamilyPhotoFromDirectUpload, listFamilyPhotos, requireChildPhotos } from '../lib/family-photos.js';

const PASSED = { status: 'passed', code: null, severity: null, reasons: [], classification: { childCount: 1 }, model: 'test-model' };
const WARNED = { status: 'passed', code: 'PHOTO_FACE_UNCLEAR', severity: 'warning', reasons: ['too_dark'], classification: { childCount: 1 }, model: 'test-model' };
const REJECTED = { status: 'rejected', code: 'PHOTO_NOT_A_CHILD', severity: 'block', reasons: ['PHOTO_NOT_A_CHILD'], classification: { childCount: 0 }, model: 'test-model' };
const UNAVAILABLE = { status: 'error', code: 'PHOTO_CHECK_UNAVAILABLE', severity: 'retry', reasons: ['timeout'], classification: null, model: null };

/** Minimal in-memory Supabase stand-in covering the calls family-photos.js makes. */
function fakeSupabase({ photos = [], objects = new Map() } = {}) {
  const tables = { family_saved_photos: photos, ai_photo_checks: [] };
  const stamp = { created_at: '2026-10-20T00:00:00.000Z', updated_at: '2026-10-20T00:00:00.000Z' };
  const query = (table) => {
    let rows = tables[table];
    let patch = null;
    const api = {
      insert(value) { const row = { ...stamp, ...value }; tables[table].push(row); rows = [row]; return api; },
      update(value) { patch = value; return api; },
      select() { return api; },
      eq(column, value) { rows = rows.filter((row) => row[column] === value); if (patch) rows.forEach((row) => Object.assign(row, patch)); return api; },
      in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return api; },
      order() { return api; },
      single: async () => ({ data: rows[0] || null, error: rows[0] ? null : { message: 'not found' } }),
      then: (resolve) => resolve({ data: rows, error: null }),
    };
    return api;
  };
  const storage = {
    upload: async (path, buffer) => { objects.set(path, buffer); return { error: null }; },
    download: async (path) => (objects.has(path) ? { data: new Blob([objects.get(path)]), error: null } : { data: null, error: { message: 'missing' } }),
    remove: async (paths) => { paths.forEach((path) => objects.delete(path)); return { error: null }; },
  };
  return { tables, objects, from: (table) => query(table), storage: { from: () => storage } };
}

const family = (supabase) => ({ mode: 'supabase', authUser: { id: 'family-1' }, user: { id: 'family-1', aiConsent: { grantedAt: '2026-10-28T00:00:00.000Z', version: AI_CONSENT_VERSION } }, supabase });
let jpeg;
beforeEach(async () => { jpeg = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#e0b080' } }).jpeg().toBuffer(); });

describe('checking photos at upload', () => {
  it('stores the check result on a passing child photo and audits it', async () => {
    const supabase = fakeSupabase();
    const photo = await createFamilyPhoto(family(supabase), { buffer: jpeg, mimeType: 'image/jpeg', originalName: 'kid.jpg' }, { sourceKind: 'picture_book', checkPhoto: async () => WARNED });
    const [row] = supabase.tables.family_saved_photos;
    expect(row).toMatchObject({ child_check_status: 'passed', child_check_code: 'PHOTO_FACE_UNCLEAR', child_check_model: 'test-model' });
    expect(row.child_check_result).toEqual({ classification: { childCount: 1 }, reasons: ['too_dark'] });
    expect(photo.childCheck).toEqual({ status: 'passed', code: 'PHOTO_FACE_UNCLEAR', severity: 'warning' });
    expect(supabase.tables.ai_photo_checks).toEqual([expect.objectContaining({ photo_id: row.id, status: 'passed', source_kind: 'picture_book' })]);
  });

  it('never stores a rejected photo and reports which photo failed', async () => {
    const supabase = fakeSupabase();
    const error = await createFamilyPhoto(family(supabase), { buffer: jpeg, mimeType: 'image/jpeg' }, { sourceKind: 'practice_story', photoIndex: 2, checkPhoto: async () => REJECTED }).catch((caught) => caught);
    expect(error).toBeInstanceOf(PhotoCheckError);
    expect(error.status).toBe(422);
    expect(error.photoErrors).toEqual([{ index: 2, photoId: null, code: 'PHOTO_NOT_A_CHILD', severity: 'block' }]);
    expect(supabase.tables.family_saved_photos).toHaveLength(0);
    expect(supabase.objects.size).toBe(0);
    expect(supabase.tables.ai_photo_checks).toEqual([expect.objectContaining({ photo_id: null, status: 'rejected', code: 'PHOTO_NOT_A_CHILD' })]);
  });

  it('returns 503 and stores nothing when the check is unavailable', async () => {
    const supabase = fakeSupabase();
    await expect(createFamilyPhoto(family(supabase), { buffer: jpeg, mimeType: 'image/jpeg' }, { sourceKind: 'picture_book', checkPhoto: async () => UNAVAILABLE }))
      .rejects.toMatchObject({ status: 503, code: 'PHOTO_CHECK_UNAVAILABLE' });
    expect(supabase.tables.family_saved_photos).toHaveLength(0);
  });

  it('deletes the incoming direct upload when the photo is rejected', async () => {
    const supabase = fakeSupabase({ objects: new Map([['family-1/incoming/u.jpg', jpeg]]) });
    await expect(createFamilyPhotoFromDirectUpload(family(supabase), { storagePath: 'family-1/incoming/u.jpg', mimeType: 'image/jpeg', originalName: 'dog.jpg' }, { sourceKind: 'picture_book', checkPhoto: async () => REJECTED }))
      .rejects.toBeInstanceOf(PhotoCheckError);
    expect(supabase.objects.size).toBe(0);
    expect(supabase.tables.family_saved_photos).toHaveLength(0);
  });

  it('does not check general library or toy photos', async () => {
    const supabase = fakeSupabase();
    const checkPhoto = vi.fn(async () => REJECTED);
    for (const sourceKind of ['upload', 'toy_play']) {
      const photo = await createFamilyPhoto(family(supabase), { buffer: jpeg, mimeType: 'image/jpeg' }, { sourceKind, checkPhoto });
      expect(photo.childCheck.status).toBe('unchecked');
    }
    expect(checkPhoto).not.toHaveBeenCalled();
  });

  it('lists photos with their check status', async () => {
    const supabase = fakeSupabase({ photos: [{ id: 'p1', label: 'Kai', mime_type: 'image/jpeg', byte_size: 1, source_kind: 'picture_book', child_check_status: 'rejected', child_check_code: 'PHOTO_ADULT_ONLY' }] });
    const [photo] = await listFamilyPhotos(family(supabase));
    expect(photo.childCheck).toEqual({ status: 'rejected', code: 'PHOTO_ADULT_ONLY', severity: 'block' });
  });
});

describe('requireChildPhotos (saved photos chosen for a book or story)', () => {
  const row = (id, status, code = null, sourceKind = 'picture_book') => ({ id, label: id, mime_type: 'image/jpeg', byte_size: 1, source_kind: sourceKind, storage_path: `family-1/photos/${id}.jpg`, child_check_status: status, child_check_code: code });

  it('reuses stored results without calling the checker', async () => {
    const supabase = fakeSupabase({ photos: [row('a', 'passed'), row('b', 'passed', 'PHOTO_FACE_UNCLEAR')] });
    const checkPhoto = vi.fn();
    await expect(requireChildPhotos(family(supabase), ['a', 'b'], { checkPhoto })).resolves.toHaveLength(2);
    expect(checkPhoto).not.toHaveBeenCalled();
  });

  it('rejects a previously rejected photo with its position in the request', async () => {
    const supabase = fakeSupabase({ photos: [row('a', 'passed'), row('b', 'rejected', 'PHOTO_NOT_REAL')] });
    const error = await requireChildPhotos(family(supabase), ['a', 'b'], { startIndex: 1 }).catch((caught) => caught);
    expect(error.status).toBe(422);
    expect(error.photoErrors).toEqual([{ index: 2, photoId: 'b', code: 'PHOTO_NOT_REAL', severity: 'block' }]);
  });

  it('checks never-checked library photos now and saves the result', async () => {
    const photo = row('toy', 'unchecked', null, 'upload');
    const supabase = fakeSupabase({ photos: [photo], objects: new Map([[photo.storage_path, jpeg]]) });
    const checkPhoto = vi.fn(async () => REJECTED);
    await expect(requireChildPhotos(family(supabase), ['toy'], { checkPhoto })).rejects.toMatchObject({ code: 'PHOTO_NOT_A_CHILD' });
    expect(checkPhoto).toHaveBeenCalledOnce();
    expect(photo).toMatchObject({ child_check_status: 'rejected', child_check_code: 'PHOTO_NOT_A_CHILD' });
    expect(supabase.tables.ai_photo_checks).toEqual([expect.objectContaining({ photo_id: 'toy', source_kind: 'upload', status: 'rejected' })]);
  });

  it('404s for a photo that is not the family’s', async () => {
    await expect(requireChildPhotos(family(fakeSupabase()), ['someone-else'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
