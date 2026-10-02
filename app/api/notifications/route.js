import { listNotifications, markNotificationRead } from '../../../lib/ai-jobs.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const notifications = await listNotifications(current);
    return Response.json({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { notificationId } = await request.json().catch(() => ({}));
    if (!notificationId) return Response.json({ error: 'notificationId is required.' }, { status: 400 });
    await markNotificationRead(current, notificationId);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
}
