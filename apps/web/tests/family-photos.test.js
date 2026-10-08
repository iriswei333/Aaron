import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { createFamilyPhoto, createFamilyPhotoFromDirectUpload } from '../lib/family-photos.js';

describe('family saved photos', () => {
  it('normalizes a private upload and writes owner-prefixed metadata', async () => {
    const objects = new Map();
    let inserted;
    const supabase = {
      storage: {
        from: () => ({
          upload: async (path, buffer) => { objects.set(path, buffer); return { error: null }; },
          remove: async () => ({ error: null }),
        }),
      },
      from: () => ({
        insert: (value) => {
          inserted = value;
          return { select: () => ({ single: async () => ({ data: { ...value, source_kind: value.source_kind, created_at: '2026-09-30T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z' }, error: null }) }) };
        },
      }),
    };
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#d98a4e' } }).png().toBuffer();
    const photo = await createFamilyPhoto({ mode: 'supabase', authUser: { id: 'family-123' }, supabase }, { buffer: png, mimeType: 'image/png', originalName: 'Train.png' }, { sourceKind: 'upload' });

    expect(inserted.storage_path).toMatch(/^family-123\/photos\/.+\.jpg$/);
    expect(inserted.mime_type).toBe('image/jpeg');
    expect(inserted.width).toBe(2048);
    expect(inserted.height).toBe(1024);
    expect(objects.get(inserted.storage_path)).toBeInstanceOf(Buffer);
    expect(photo.label).toBe('Train.png');
    expect(photo.contentUrl).toContain(photo.id);
  });

  it('finalizes a direct storage upload and removes the temporary object', async () => {
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#7ba36a' } }).png().toBuffer();
    const objects = new Map([['family-123/incoming/upload.png', png]]);
    const removed = [];
    const supabase = {
      storage: {
        from: () => ({
          download: async (path) => ({ data: new Blob([objects.get(path)]), error: null }),
          upload: async (path, buffer) => { objects.set(path, buffer); return { error: null }; },
          remove: async (paths) => { removed.push(...paths); paths.forEach((path) => objects.delete(path)); return { error: null }; },
        }),
      },
      from: () => ({
        insert: (value) => ({
          select: () => ({ single: async () => ({ data: { ...value, created_at: '2026-10-05T00:00:00.000Z', updated_at: '2026-10-05T00:00:00.000Z' }, error: null }) }),
        }),
      }),
    };

    const photo = await createFamilyPhotoFromDirectUpload(
      { mode: 'supabase', authUser: { id: 'family-123' }, supabase },
      { storagePath: 'family-123/incoming/upload.png', mimeType: 'image/png', originalName: 'Phone photo.png' },
      { sourceKind: 'picture_book' },
    );

    expect(photo.mimeType).toBe('image/jpeg');
    expect(photo.sourceKind).toBe('picture_book');
    expect(removed).toContain('family-123/incoming/upload.png');
    expect([...objects.keys()].some((path) => /^family-123\/photos\/.+\.jpg$/.test(path))).toBe(true);
  });

  it('rejects a direct upload outside the signed-in family path', async () => {
    await expect(createFamilyPhotoFromDirectUpload(
      { mode: 'supabase', authUser: { id: 'family-123' }, supabase: {} },
      { storagePath: 'another-family/incoming/upload.jpg', mimeType: 'image/jpeg', originalName: 'photo.jpg' },
    )).rejects.toThrow('uploaded photo path is invalid');
  });
});
