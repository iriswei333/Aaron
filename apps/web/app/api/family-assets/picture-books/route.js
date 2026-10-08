import { createFamilyPictureBook, deleteFamilyPictureBook, getFamilyPictureBook, listFamilyPictureBooks, serializeFamilyPictureBook } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

function uploadFailure(error) {
  const message = error instanceof Error ? error.message : 'Picture-book upload failed.';
  if (/request body|payload|body.*(?:exceed|large)|too large/i.test(message)) {
    return Response.json({
      error: 'The picture-book upload is too large to process.',
      code: 'PICTURE_BOOK_UPLOAD_TOO_LARGE',
      help: 'Choose fewer or smaller photos and try again. HEIC files are converted after upload, so the original upload must fit within the request limit.',
    }, { status: 413 });
  }
  return Response.json({ error: message, code: 'PICTURE_BOOK_UPLOAD_FAILED' }, { status: 400 });
}

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
    const contentType = request.headers.get('content-type') || '';
    let formData;
    if (contentType.includes('application/json')) {
      const body = await request.json() || {};
      formData = new FormData();
      formData.set('childName', String(body.childName || ''));
      formData.set('templateSlug', String(body.templateSlug || ''));
      if (body.childId) formData.set('childId', String(body.childId));
      for (const photoId of Array.isArray(body.savedPhotoIds) ? body.savedPhotoIds : []) {
        formData.append('savedPhotoIds', String(photoId));
      }
    } else if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
    } else {
      return Response.json({ error: 'Use JSON savedPhotoIds or multipart/form-data with 2–5 reference photos.' }, { status: 400 });
    }
    const book = await createFamilyPictureBook(current, formData);
    return Response.json({ book: serializeFamilyPictureBook(book) }, { status: 201 });
  } catch (error) {
    return uploadFailure(error);
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
