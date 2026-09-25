import { createFamilyPictureBook, listFamilyPictureBooks, serializeFamilyPictureBook } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const books = await listFamilyPictureBooks(current);
    return Response.json({ books: books.map(serializeFamilyPictureBook), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) {
      return Response.json({ error: 'Use multipart/form-data with 2–5 photos fields named photos.' }, { status: 400 });
    }
    const book = await createFamilyPictureBook(current, await request.formData());
    return Response.json({ book: serializeFamilyPictureBook(book) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
