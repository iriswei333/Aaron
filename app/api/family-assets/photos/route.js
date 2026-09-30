import { createFamilyPhoto, deleteFamilyPhoto, listFamilyPhotos, photoInputFromForm, updateFamilyPhoto } from '../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ photos: await listFamilyPhotos(current), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) return Response.json({ error: 'Use multipart/form-data with one photo field.' }, { status: 400 });
    const formData = await request.formData();
    const photo = await createFamilyPhoto(current, await photoInputFromForm(formData), { label: formData.get('label'), sourceKind: 'upload' });
    return Response.json({ photo }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    if (!body?.photoId) return Response.json({ error: 'photoId is required.' }, { status: 400 });
    return Response.json({ photo: await updateFamilyPhoto(current, body.photoId, { label: body.label }) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const photoId = new URL(request.url).searchParams.get('photoId');
    if (!photoId) return Response.json({ error: 'photoId is required.' }, { status: 400 });
    await deleteFamilyPhoto(current, photoId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 400 });
  }
}
