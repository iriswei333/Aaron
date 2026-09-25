import { getPictureBookTemplate } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const slug = new URL(request.url).searchParams.get('slug') || undefined;
    return Response.json({ template: await getPictureBookTemplate(current, slug), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 404 });
  }
}
