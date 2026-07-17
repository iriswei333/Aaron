import { profileErrorResponse, updateCurrentProfileField } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function PUT(request) {
  try {
    const body = await request.json();
    const current = await updateCurrentProfileField(request, 'foodPlan', body);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ user: current.user, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
