import { createFamilyPictureBookPdf } from '../../../../lib/family-picture-book-pdf.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const bookAssetId = new URL(request.url).searchParams.get('bookAssetId');
    if (!bookAssetId) return Response.json({ error: 'bookAssetId is required.' }, { status: 400 });
    const { book, data } = await createFamilyPictureBookPdf(current, bookAssetId);
    const fileName = `${String(book.title || 'picture-book').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'picture-book'}.pdf`;
    return new Response(data, {
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition': `inline; filename="${fileName}"`,
        'content-type': 'application/pdf',
      },
    });
  } catch (error) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INCOMPLETE' ? 409 : 500;
    return Response.json({ error: error.message }, { status });
  }
}
