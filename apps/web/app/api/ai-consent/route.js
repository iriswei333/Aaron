import { AI_CONSENT_VERSION, hasAiConsent } from '@sproutcue/shared/ai-consent';
import { setAiConsent } from '../../../lib/ai-consent.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

// AI consent for the signed-in parent (Apple Guideline 5.1.2(i)).
//   GET    → { aiConsent, allowed, version }
//   PUT    { version } → agree to the current AI consent text; returns { user, allowed }
//   DELETE → withdraw consent and cancel AI jobs that haven't started; returns { user, allowed }

function body(user) {
  return { user, aiConsent: user?.aiConsent || null, allowed: hasAiConsent(user), version: AI_CONSENT_VERSION };
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json(body(current.user));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { version } = await request.json().catch(() => ({}));
    // The app must show the current text: an outdated app can't record agreement to text it never showed.
    if (version !== AI_CONSENT_VERSION) {
      return Response.json({ error: 'Update SproutCue to review the latest AI terms.', code: 'AI_CONSENT_VERSION_MISMATCH', version: AI_CONSENT_VERSION }, { status: 409 });
    }
    return Response.json(body(await setAiConsent(current, true)));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json(body(await setAiConsent(current, false)));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
