import {
  fetchParentingResources,
  parentingAgeFilter,
  parentingResourceUrl,
} from '../../../lib/parenting-resources.js';
import {
  readLocalParentingResourceCache,
  readSupabaseParentingResourceCache,
  writeLocalParentingResourceCache,
  writeSupabaseParentingResourceCache,
} from '../../../lib/backend.js';
import { getChildProfile } from '../../../lib/profile-defaults.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const childProfile = getChildProfile(current.user);
    const ageFilter = parentingAgeFilter(childProfile);
    const refresh = new URL(request.url).searchParams.get('refresh') === '1';
    if (!refresh) {
      const cached = current.mode === 'supabase'
        ? await readSupabaseParentingResourceCache(current.supabase, ageFilter)
        : await readLocalParentingResourceCache(ageFilter);
      if (cached) return Response.json({ ...cached, cached: true, authMode: current.mode });
    }

    const fetchedAt = new Date();
    const result = await fetchParentingResources(childProfile);
    const expiresAt = new Date(fetchedAt);
    expiresAt.setDate(expiresAt.getDate() + 1);
    const entry = {
      ageFilter,
      sourceUrl: result.sourceUrl || parentingResourceUrl(ageFilter),
      resources: result.resources,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    let saved = entry;
    try {
      saved = current.mode === 'supabase'
        ? await writeSupabaseParentingResourceCache(current.supabase, entry)
        : await writeLocalParentingResourceCache(entry);
    } catch {
      // A cache write should not prevent fresh articles from rendering.
    }
    return Response.json({ ...saved, cached: false, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load parenting resources.' }, { status: 502 });
  }
}
