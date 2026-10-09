import {
  readLocalFamilyEventCache,
  readLocalSocialFamilyEventCache,
  readSupabaseFamilyEventCache,
  readSupabaseSocialFamilyEventCache,
  writeLocalFamilyEventCache,
  writeSupabaseFamilyEventCache,
} from '../../../lib/backend.js';
import {
  familyEventCacheKey,
  familyEventDateRangeLabel,
  familyEventExpiresAt,
  fetchFamilyEvents,
  normalizeFamilyEventRequest,
  resolveFamilyEventWebsites,
} from '../../../lib/family-events.js';
import { getChildProfile } from '@sproutcue/shared/profile-defaults';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';
import { addVenueCoordinates } from '../../../lib/venue-geocoder.js';

export const runtime = 'nodejs';
// The first look-up of new event venues (Google Places) can take a few seconds.
export const maxDuration = 60;

// Events cached before venue look-ups existed get map positions on the way out (shared cache, cheap).
async function cacheResponse(entry, current, cached) {
  return Response.json({
    ...entry,
    events: await addVenueCoordinates(current, entry.events),
    dateRangeLabel: familyEventDateRangeLabel(entry.startDate, entry.endDate),
    cached,
    authMode: current.mode,
  });
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const url = new URL(request.url);
    const eventRequest = normalizeFamilyEventRequest(current.user, url.searchParams);
    const { startDate, endDate } = eventRequest;
    // The family's saved location only limits playgrounds and playdates. Family events use the
    // metro-area calendars (city → ParentMap region, Seattle by default) without a ZIP filter.
    const locationCity = eventRequest.locationCity || 'Seattle';
    const locationZip = '';
    const filters = {
      provider: 'parentmap',
      secondaryProvider: 'seattles-child',
      range: 'weekend',
      locationZip,
      version: 5,
    };
    const cacheKey = familyEventCacheKey({ locationCity, startDate, endDate, filters });
    const refresh = url.searchParams.get('refresh') === '1';

    if (!refresh) {
      const cached = current.mode === 'supabase'
        ? await readSupabaseFamilyEventCache(current.supabase, cacheKey)
        : await readLocalFamilyEventCache(cacheKey);
      if (cached) return cacheResponse(cached, current, true);

      const socialCached = current.mode === 'supabase'
        ? await readSupabaseSocialFamilyEventCache(current.supabase, { locationCity, startDate, endDate })
        : await readLocalSocialFamilyEventCache({ locationCity, startDate, endDate });
      if (socialCached) return cacheResponse(socialCached, current, true);
    }

    const fetchedAt = new Date().toISOString();
    const fetched = await fetchFamilyEvents({
      locationCity,
      startDate,
      endDate,
      childProfile: getChildProfile(current.user),
      locationZip,
    });
    const entry = {
      cacheKey,
      locationCity,
      locationRegion: fetched.locationRegion,
      startDate,
      endDate,
      source: fetched.source,
      sourceLabel: fetched.sourceLabel,
      sourceUrls: fetched.sourceUrls,
      filters,
      events: await addVenueCoordinates(current, await resolveFamilyEventWebsites(fetched.events)),
      fallback: fetched.fallback,
      providerStatus: fetched.providerStatus,
      fetchedAt,
      expiresAt: familyEventExpiresAt(new Date(fetchedAt)),
    };

    let saved = entry;
    try {
      saved = current.mode === 'supabase'
        ? await writeSupabaseFamilyEventCache(current.supabase, entry)
        : await writeLocalFamilyEventCache(entry);
    } catch (cacheError) {
      saved = {
        ...entry,
        providerStatus: `${entry.providerStatus} Cache write skipped: ${cacheError.message}`,
      };
    }

    return cacheResponse(saved, current, false);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
