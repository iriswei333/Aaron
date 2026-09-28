import { generateFamilyPictureBookPage, serializeFamilyPictureBook } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { bookAssetId, pageKey } = await request.json();
    if (!bookAssetId || !pageKey) return Response.json({ error: 'bookAssetId and pageKey are required.' }, { status: 400 });
    const book = await generateFamilyPictureBookPage(current, String(bookAssetId), String(pageKey));
    return Response.json({ book: serializeFamilyPictureBook(book) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}
