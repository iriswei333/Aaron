import { deletePracticeStory, listPracticeStories, PRACTICE_STORY_TOPICS } from '../../../../lib/family-practice-stories.js';
import { after } from 'next/server';
import { enqueueAiJob, processAiJob } from '../../../../lib/ai-jobs.js';
import { createFamilyPhoto, photoInputFromForm } from '../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) return Response.json({ error: 'Use multipart/form-data with goal, interests, and an optional photo or savedPhotoId.' }, { status: 400 });
    const formData = await request.formData();
    let savedPhotoId = String(formData.get('savedPhotoId') || '').trim();
    const photo = formData.get('photo');
    if (!savedPhotoId && photo && typeof photo.arrayBuffer === 'function' && photo.size) {
      const saved = await createFamilyPhoto(current, await photoInputFromForm(formData), { label: 'Practice story photo', sourceKind: 'practice_story' });
      savedPhotoId = saved.id;
    }
    const payload = { goal: String(formData.get('goal') || '').trim(), interests: String(formData.get('interests') || '').trim(), language: formData.get('language') === 'zh-CN' ? 'zh-CN' : 'en', savedPhotoId: savedPhotoId || null };
    if (!payload.goal || !payload.interests) return Response.json({ error: 'Choose one goal and add at least one interest.' }, { status: 400 });
    const queued = await enqueueAiJob(current, { jobType: 'practice_story', payload, estimatedSeconds: savedPhotoId ? 75 : 30 });
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
