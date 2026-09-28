import { readFamilyPictureBookPage } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { searchParams } = new URL(request.url);
    const bookAssetId = searchParams.get('bookAssetId');
    const pageKey = searchParams.get('pageKey');
    if (!bookAssetId || !pageKey) return Response.json({ error: 'bookAssetId and pageKey are required.' }, { status: 400 });
    const data = await readFamilyPictureBookPage(current, bookAssetId, pageKey);
    return new Response(data, { headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 });
  }
}
