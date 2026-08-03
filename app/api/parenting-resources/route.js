import { fetchParentingResources } from '../../../lib/parenting-resources.js';
import { getChildProfile } from '../../../lib/profile-defaults.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const result = await fetchParentingResources(getChildProfile(current.user));
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load parenting resources.' }, { status: 502 });
  }
}
