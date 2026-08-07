import { deleteLocalUserData, deleteSupabaseUserData } from '../../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    if (current.mode === 'supabase') {
      await deleteSupabaseUserData(current.supabase, current.authUser);
    } else {
      await deleteLocalUserData(current.localUserId);
    }

    const response = NextResponse.json({ ok: true, authMode: current.mode });
    response.cookies.set('sproutCueLocalUserId', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    response.cookies.set('aaronLocalUserId', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    return Response.json({ error: error.message || 'Could not delete the parent data.' }, { status: 500 });
  }
}
