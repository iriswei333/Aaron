import { readFamilyPhoto } from '../../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const photoId = new URL(request.url).searchParams.get('photoId');
    const { photo, buffer } = await readFamilyPhoto(current, photoId);
    return new Response(buffer, { headers: { 'content-type': photo.mimeType, 'content-length': String(buffer.length), 'cache-control': 'private, no-store', 'content-disposition': `inline; filename="family-photo-${photo.id}.jpg"` } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 });
  }
}
