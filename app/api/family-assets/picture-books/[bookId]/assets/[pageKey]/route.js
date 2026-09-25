import { readFamilyPictureBookPage } from '../../../../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { bookId, pageKey } = await params;
    const data = await readFamilyPictureBookPage(current, bookId, pageKey);
    return new Response(data, { headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 });
  }
}
