import { deletePracticeStory, generateAndSavePracticeStory, listPracticeStories, PRACTICE_STORY_TOPICS } from '../../../../lib/family-practice-stories.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

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
    return Response.json({ asset: await generateAndSavePracticeStory(current, await request.formData()) }, { status: 201 });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
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
