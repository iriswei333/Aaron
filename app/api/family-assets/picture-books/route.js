import { createFamilyPictureBook, deleteFamilyPictureBook, getFamilyPictureBook, listFamilyPictureBooks, serializeFamilyPictureBook } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const bookAssetId = new URL(request.url).searchParams.get('bookAssetId');
    if (bookAssetId) {
      const book = await getFamilyPictureBook(current, bookAssetId);
      return Response.json({ book: serializeFamilyPictureBook(book), authMode: current.mode });
    }
    const books = await listFamilyPictureBooks(current);
    return Response.json({ books: books.map(serializeFamilyPictureBook), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 });
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

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const bookAssetId = new URL(request.url).searchParams.get('bookAssetId');
    if (!bookAssetId) return Response.json({ error: 'bookAssetId is required.' }, { status: 400 });
    await deleteFamilyPictureBook(current, bookAssetId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}
