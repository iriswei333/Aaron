import { readPracticeStoryCover } from '../../../../../lib/family-practice-stories.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const storyId = new URL(request.url).searchParams.get('storyId');
    if (!storyId) return Response.json({ error: 'storyId is required.' }, { status: 400 });
    return new Response(await readPracticeStoryCover(current, storyId), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' } });
  } catch (error) { return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 }); }
}
