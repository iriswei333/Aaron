import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoCheckError } from '../lib/child-photo-check.js';

const mocks = vi.hoisted(() => ({
  requireChildPhotos: vi.fn(),
  createFamilyPhoto: vi.fn(),
  createFamilyPhotoFromDirectUpload: vi.fn(),
  enqueueAiJob: vi.fn(),
  createFamilyPictureBook: vi.fn(),
}));

vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('../lib/profile-session.js', () => ({
  getCurrentProfile: async () => ({ mode: 'supabase', user: { id: 'family-1' }, authUser: { id: 'family-1' } }),
  profileErrorResponse: () => Response.json({ error: 'signed out' }, { status: 401 }),
}));
vi.mock('../lib/family-photos.js', () => ({
  requireChildPhotos: mocks.requireChildPhotos,
  createFamilyPhoto: mocks.createFamilyPhoto,
  createFamilyPhotoFromDirectUpload: mocks.createFamilyPhotoFromDirectUpload,
  photoInputFromForm: vi.fn(),
}));
vi.mock('../lib/ai-jobs.js', () => ({ enqueueAiJob: mocks.enqueueAiJob, processAiJob: vi.fn() }));
vi.mock('../lib/family-practice-stories.js', () => ({ deletePracticeStory: vi.fn(), listPracticeStories: vi.fn(), PRACTICE_STORY_TOPICS: [] }));
vi.mock('../lib/family-picture-books.js', () => ({
  createFamilyPictureBook: mocks.createFamilyPictureBook,
  deleteFamilyPictureBook: vi.fn(), getFamilyPictureBook: vi.fn(), listFamilyPictureBooks: vi.fn(), serializeFamilyPictureBook: (book) => book,
}));

const { POST: postPracticeStory } = await import('../app/api/family-assets/practice-stories/route.js');
const { POST: postPictureBook } = await import('../app/api/family-assets/picture-books/route.js');
const { POST: postDirectUpload } = await import('../app/api/family-assets/photos/direct-upload/route.js');

const rejection = () => new PhotoCheckError('Not a child photo.', { code: 'PHOTO_NOT_A_CHILD', help: 'Tips', photoErrors: [{ index: 1, photoId: 'p2', code: 'PHOTO_NOT_A_CHILD', severity: 'block' }] });
const json = (body) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); });

describe('practice stories', () => {
  const body = { challenge: 'bedtime', interests: 'trains', language: 'zh-CN', savedPhotoIds: ['p1', 'p2'] };

  it('returns 422 and queues nothing when a photo is rejected', async () => {
    mocks.requireChildPhotos.mockRejectedValue(rejection());
    const response = await postPracticeStory(json(body));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Not a child photo.', code: 'PHOTO_NOT_A_CHILD', help: 'Tips', photoErrors: [{ index: 1, photoId: 'p2', code: 'PHOTO_NOT_A_CHILD', severity: 'block' }] });
    expect(mocks.requireChildPhotos).toHaveBeenCalledWith(expect.anything(), ['p1', 'p2'], { language: 'zh-CN' });
    expect(mocks.enqueueAiJob).not.toHaveBeenCalled();
  });

  it('returns 503 when the check is unavailable', async () => {
    mocks.requireChildPhotos.mockRejectedValue(new PhotoCheckError('Try again.', { code: 'PHOTO_CHECK_UNAVAILABLE' }));
    expect((await postPracticeStory(json(body))).status).toBe(503);
    expect(mocks.enqueueAiJob).not.toHaveBeenCalled();
  });

  it('queues the story once the photos pass', async () => {
    mocks.requireChildPhotos.mockResolvedValue([]);
    mocks.enqueueAiJob.mockResolvedValue({ job: { id: 'job-1' }, usage: {} });
    expect((await postPracticeStory(json(body))).status).toBe(202);
    expect(mocks.enqueueAiJob).toHaveBeenCalledOnce();
  });
});

describe('picture books', () => {
  it('returns 422 from book creation and passes the language through', async () => {
    mocks.createFamilyPictureBook.mockRejectedValue(rejection());
    const response = await postPictureBook(json({ childName: 'Kai', templateSlug: 'x', language: 'zh-CN', savedPhotoIds: ['p1', 'p2'] }));
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('PHOTO_NOT_A_CHILD');
    expect(mocks.createFamilyPictureBook.mock.calls[0][1].get('language')).toBe('zh-CN');
  });
});

describe('direct upload', () => {
  it('returns 422 with the photo position the client sent', async () => {
    mocks.createFamilyPhotoFromDirectUpload.mockRejectedValue(rejection());
    const response = await postDirectUpload(json({ storagePath: 'family-1/incoming/x.jpg', sourceKind: 'picture_book', photoIndex: 1, language: 'en' }));
    expect(response.status).toBe(422);
    expect(mocks.createFamilyPhotoFromDirectUpload).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ sourceKind: 'picture_book', photoIndex: 1, language: 'en' }));
  });

  it('keeps other upload errors as 400', async () => {
    mocks.createFamilyPhotoFromDirectUpload.mockRejectedValue(new Error('The uploaded photo path is invalid.'));
    expect((await postDirectUpload(json({ storagePath: 'nope' }))).status).toBe(400);
  });
});
