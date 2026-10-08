import {
  getCurrentProfile,
  profileErrorResponse,
  updateCurrentProfileDetails,
} from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ user: current.user, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const current = await updateCurrentProfileDetails(request, body);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ user: current.user, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
