import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_CONSENT_REQUIRED, AI_CONSENT_VERSION } from '@sproutcue/shared/ai-consent';

// AI consent (Apple Guideline 5.1.2(i)): nothing reaches OpenAI until the parent agrees.

const consented = { grantedAt: '2026-10-28T00:00:00.000Z', version: AI_CONSENT_VERSION };
const session = vi.hoisted(() => ({ user: null }));
const mocks = vi.hoisted(() => ({
  requireChildPhotos: vi.fn(),
  createFamilyPhoto: vi.fn(),
  createFamilyPhotoFromDirectUpload: vi.fn(),
  enqueueAiJob: vi.fn(),
  generatePlaygroundPracticeStory: vi.fn(),
}));

vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('../lib/profile-session.js', () => ({
  getCurrentProfile: async () => ({ mode: 'supabase', user: session.user, authUser: { id: 'family-1' }, supabase: {} }),
  profileErrorResponse: () => Response.json({ error: 'signed out' }, { status: 401 }),
}));
vi.mock('../lib/family-photos.js', () => ({
  requireChildPhotos: mocks.requireChildPhotos,
  createFamilyPhoto: mocks.createFamilyPhoto,
  createFamilyPhotoFromDirectUpload: mocks.createFamilyPhotoFromDirectUpload,
  photoInputFromForm: vi.fn(),
}));
vi.mock('../lib/ai-jobs.js', () => ({ enqueueAiJob: mocks.enqueueAiJob, processAiJob: vi.fn(), cancelQueuedAiJobs: vi.fn() }));
vi.mock('../lib/family-practice-stories.js', () => ({
  deletePracticeStory: vi.fn(), listPracticeStories: vi.fn(), PRACTICE_STORY_TOPICS: [],
  generatePlaygroundPracticeStory: mocks.generatePlaygroundPracticeStory, savePlaygroundPracticeStory: vi.fn(), PLAYGROUND_PRACTICE_GOALS: [],
}));

const { aiConsentErrorResponse, aiConsentResponse, requireAiConsent } = await import('../lib/ai-consent.js');
const { POST: postPracticeStory } = await import('../app/api/family-assets/practice-stories/route.js');
const { POST: postPlaygroundStory } = await import('../app/api/family-assets/practice-stories/playground/route.js');
const { POST: postToyPlay } = await import('../app/api/family-assets/toy-play/generate/route.js');
const { POST: postDirectUpload } = await import('../app/api/family-assets/photos/direct-upload/route.js');
const { PUT: putConsent } = await import('../app/api/ai-consent/route.js');

const json = (body, method = 'POST') => new Request('http://localhost/api', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  session.user = { id: 'family-1', aiConsent: null };
});

describe('consent checks', () => {
  it('requires consent to the current version', () => {
    expect(() => requireAiConsent({ user: { aiConsent: null } })).toThrow(expect.objectContaining({ code: AI_CONSENT_REQUIRED, status: 403 }));
    expect(() => requireAiConsent({ user: { aiConsent: { ...consented, version: '2020-01-01' } } })).toThrow(expect.objectContaining({ code: AI_CONSENT_REQUIRED }));
    expect(() => requireAiConsent({ user: { aiConsent: consented } })).not.toThrow();
  });

  it('turns consent errors (including the database exception text) into 403 responses', async () => {
    expect(aiConsentResponse({ user: { aiConsent: consented } })).toBeNull();
    const blocked = aiConsentResponse({ user: {} });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: AI_CONSENT_REQUIRED, version: AI_CONSENT_VERSION });
    expect(aiConsentErrorResponse(new Error('AI_CONSENT_REQUIRED')).status).toBe(403);
    expect(aiConsentErrorResponse(new Error('Something else'))).toBeNull();
  });
});

describe('AI routes without consent', () => {
  it('refuse a practice story before checking photos or queueing', async () => {
    const response = await postPracticeStory(json({ challenge: 'bedtime', interests: 'trains', savedPhotoIds: ['p1'] }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe(AI_CONSENT_REQUIRED);
    expect(mocks.requireChildPhotos).not.toHaveBeenCalled();
    expect(mocks.enqueueAiJob).not.toHaveBeenCalled();
  });

  it('refuse a playground story and a toy play idea', async () => {
    expect((await postPlaygroundStory(json({ goalId: 'making-friends' }))).status).toBe(403);
    expect(mocks.generatePlaygroundPracticeStory).not.toHaveBeenCalled();
    expect((await postToyPlay(json({ savedPhotoId: 'p1' }))).status).toBe(403);
    expect(mocks.createFamilyPhoto).not.toHaveBeenCalled();
    expect(mocks.enqueueAiJob).not.toHaveBeenCalled();
  });

  it('refuse photo uploads for AI features but allow general library uploads', async () => {
    const upload = { storagePath: 'family-1/incoming/a.jpg', mimeType: 'image/jpeg' };
    expect((await postDirectUpload(json({ ...upload, sourceKind: 'picture_book' }))).status).toBe(403);
    expect(mocks.createFamilyPhotoFromDirectUpload).not.toHaveBeenCalled();
    mocks.createFamilyPhotoFromDirectUpload.mockResolvedValue({ id: 'photo-1' });
    expect((await postDirectUpload(json({ ...upload, sourceKind: 'upload' }))).status).toBe(201);
  });

  it('run once consent is given', async () => {
    session.user = { id: 'family-1', aiConsent: consented };
    mocks.generatePlaygroundPracticeStory.mockResolvedValue({ title: 'Story' });
    expect((await postPlaygroundStory(json({ goalId: 'making-friends' }))).status).toBe(200);
  });
});

describe('PUT /api/ai-consent', () => {
  it('refuses agreement to an outdated version of the text', async () => {
    const response = await putConsent(json({ version: '2020-01-01' }, 'PUT'));
    expect(response.status).toBe(409);
    expect((await response.json()).version).toBe(AI_CONSENT_VERSION);
  });
});
