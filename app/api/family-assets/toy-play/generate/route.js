import { generateToyPlay } from '../../../../../lib/family-toy-plays.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) return Response.json({ error: 'Use multipart/form-data with one photo or savedPhotoId.' }, { status: 400 });
    return Response.json(await generateToyPlay(current, await request.formData()));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
