import { registerPushToken, unregisterPushToken } from '../../../../lib/push-tokens.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

// The native app registers its Expo push token here after the family allows
// notifications, and removes it on sign-out.
//   POST   { token: 'ExponentPushToken[…]', platform: 'ios' | 'android', deviceName? }
//   DELETE { token }

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    await registerPushToken(current, body);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'INVALID' ? 400 : 500 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { token } = await request.json().catch(() => ({}));
    await unregisterPushToken(current, token);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'INVALID' ? 400 : 500 });
  }
}
