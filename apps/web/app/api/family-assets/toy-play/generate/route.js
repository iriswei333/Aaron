import { after } from 'next/server';
import { enqueueAiJob, processAiJob } from '../../../../../lib/ai-jobs.js';
import { createFamilyPhoto, photoInputFromForm } from '../../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const contentType = request.headers.get('content-type') || '';
    let formData;
    if (contentType.includes('application/json')) {
      const body = await request.json() || {};
      formData = new FormData();
      formData.set('savedPhotoId', String(body.savedPhotoId || ''));
      formData.set('language', body.language === 'zh-CN' ? 'zh-CN' : 'en');
    } else if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
    } else {
      return Response.json({ error: 'Use JSON with savedPhotoId or multipart/form-data with one photo.' }, { status: 400 });
    }
    let savedPhotoId = String(formData.get('savedPhotoId') || '').trim();
    if (!savedPhotoId) {
      const photo = await createFamilyPhoto(current, await photoInputFromForm(formData), { label: 'Toy play photo', sourceKind: 'toy_play' });
      savedPhotoId = photo.id;
    }
    const queued = await enqueueAiJob(current, { jobType: 'toy_play', payload: { savedPhotoId, language: formData.get('language') === 'zh-CN' ? 'zh-CN' : 'en' }, estimatedSeconds: 45 });
    after(() => processAiJob(current, queued.job.id));
    return Response.json(queued, { status: 202 });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code || null }, { status: error.code === 'DAILY_AI_LIMIT_REACHED' ? 429 : 400 });
  }
}
