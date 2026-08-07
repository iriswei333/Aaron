import {
  deleteLocalHomeBackground,
  deleteSupabaseHomeBackground,
  getLocalHomeBackground,
  getSupabaseHomeBackground,
  saveLocalHomeBackground,
  saveSupabaseHomeBackground,
  readStore,
} from '../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

function serializeLocalBackground(background) {
  if (!background) return null;
  return {
    id: background.id,
    fileName: background.fileName,
    mediaType: 'photo',
    mediaUrl: background.mediaUrl,
    source: background.source,
    updatedAt: background.updatedAt || background.createdAt,
  };
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const background = current.mode === 'supabase'
      ? await getSupabaseHomeBackground(current.supabase, current.authUser)
      : serializeLocalBackground(await getLocalHomeBackground(await readStore(), current.localUserId));
    return Response.json({ background });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load the home background.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    const mediaUrl = String(body.mediaUrl || '');
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(mediaUrl)) {
      return Response.json({ error: 'Choose a valid image for the home background.' }, { status: 400 });
    }
    if (mediaUrl.length > 8 * 1024 * 1024) {
      return Response.json({ error: 'That image is too large. Choose a smaller photo.' }, { status: 413 });
    }
    const background = current.mode === 'supabase'
      ? await saveSupabaseHomeBackground(current.supabase, current.authUser, { fileName: body.fileName, mediaUrl })
      : serializeLocalBackground(await saveLocalHomeBackground(current.localUserId, { fileName: body.fileName, mediaUrl }));
    return Response.json({ background });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not save the home background.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    if (current.mode === 'supabase') {
      await deleteSupabaseHomeBackground(current.supabase, current.authUser);
    } else {
      await deleteLocalHomeBackground(current.localUserId);
    }
    return Response.json({ background: null });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not remove the home background.' }, { status: 500 });
  }
}
