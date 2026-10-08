import { deletePracticeStory, listPracticeStories, PRACTICE_STORY_TOPICS } from '../../../../lib/family-practice-stories.js';
import { after } from 'next/server';
import { enqueueAiJob, processAiJob } from '../../../../lib/ai-jobs.js';
import { createFamilyPhoto, photoInputFromForm } from '../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';
import { practiceStoryChallenge, practiceStoryLength, practiceStoryParentGoals, practiceStoryTheme } from '@sproutcue/shared/practice-story-options';

export const runtime = 'nodejs';
export const maxDuration = 300;
const MAX_PHOTOS = 5;
const MAX_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;

function savedPhotoIds(formData) {
  const values = [...formData.getAll('savedPhotoIds'), ...formData.getAll('savedPhotoId')].flatMap((value) => {
    try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : [value]; }
    catch { return [value]; }
  });
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ assets: await listPracticeStories(current), topics: PRACTICE_STORY_TOPICS, authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const contentType = request.headers.get('content-type') || '';
    let formData;
    if (contentType.includes('application/json')) {
      const body = await request.json() || {};
      formData = new FormData();
      formData.set('goal', String(body.goal || ''));
      formData.set('interests', String(body.interests || ''));
      formData.set('language', body.language === 'zh-CN' ? 'zh-CN' : 'en');
      formData.set('challenge', String(body.challenge || ''));
      formData.set('parentGoals', Array.isArray(body.parentGoals) ? body.parentGoals.join(',') : String(body.parentGoals || ''));
      formData.set('storyTheme', String(body.storyTheme || ''));
      formData.set('adventureLength', String(body.adventureLength || ''));
      for (const photoId of Array.isArray(body.savedPhotoIds) ? body.savedPhotoIds : []) formData.append('savedPhotoIds', String(photoId));
    } else if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
    } else {
      return Response.json({ error: 'Use JSON savedPhotoIds or multipart/form-data with up to 5 optional photos.' }, { status: 400 });
    }
    const ids = savedPhotoIds(formData);
    const uploads = [...formData.getAll('photos'), ...formData.getAll('photo')]
      .filter((photo) => photo && typeof photo.arrayBuffer === 'function' && photo.size);
    if (ids.length + uploads.length > MAX_PHOTOS) return Response.json({ error: 'Choose no more than 5 uploaded or saved reference photos.' }, { status: 400 });
    if (uploads.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_PHOTO_BYTES) return Response.json({ error: 'The combined uploaded photos must be 90 MB or smaller.' }, { status: 400 });
    for (const upload of uploads) {
      const single = new FormData(); single.set('photo', upload);
      const saved = await createFamilyPhoto(current, await photoInputFromForm(single), { label: 'Practice story photo', sourceKind: 'practice_story' });
      ids.push(saved.id);
    }
    const challenge = practiceStoryChallenge(formData.get('challenge'));
    const payload = {
      goal: String(formData.get('goal') || '').trim(),
      challenge: challenge?.id || '',
      interests: String(formData.get('interests') || '').trim(),
      parentGoals: practiceStoryParentGoals(formData.get('parentGoals')).map((item) => item.id),
      storyTheme: practiceStoryTheme(formData.get('storyTheme'))?.id || '',
      adventureLength: practiceStoryLength(formData.get('adventureLength')).id,
      language: formData.get('language') === 'zh-CN' ? 'zh-CN' : 'en',
      savedPhotoIds: ids,
    };
    if ((!payload.goal && !payload.challenge) || !payload.interests) return Response.json({ error: 'Choose a current challenge and add at least one favorite thing.' }, { status: 400 });
    const queued = await enqueueAiJob(current, { jobType: 'practice_story', payload, estimatedSeconds: ids.length ? 75 : 30 });
    after(() => processAiJob(current, queued.job.id));
    return Response.json(queued, { status: 202 });
  } catch (error) { return Response.json({ error: error.message, code: error.code || null }, { status: error.code === 'DAILY_AI_LIMIT_REACHED' ? 429 : 400 }); }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const assetId = new URL(request.url).searchParams.get('assetId');
    if (!assetId) return Response.json({ error: 'assetId is required.' }, { status: 400 });
    await deletePracticeStory(current, assetId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}
