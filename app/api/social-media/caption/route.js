import { generateAiCaption } from '../../../../lib/backend.js';
import {
  getCurrentProfile,
  profileErrorResponse,
  writeCurrentPost,
} from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const body = await request.json();
    const payload = { ...body, childProfile: current.user.childProfile };
    const result = await generateAiCaption(payload);
    const saved = await writeCurrentPost(request, payload, result);
    if (!saved.user) return profileErrorResponse(saved);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
