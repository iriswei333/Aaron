import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { createFamilyPhoto } from '../lib/family-photos.js';

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
});
