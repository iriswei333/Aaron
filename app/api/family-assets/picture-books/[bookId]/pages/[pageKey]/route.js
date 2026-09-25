import { generateFamilyPictureBookPage, serializeFamilyPictureBook } from '../../../../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { bookId, pageKey } = await params;
    const book = await generateFamilyPictureBookPage(current, bookId, pageKey);
    return Response.json({ book: serializeFamilyPictureBook(book) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}
