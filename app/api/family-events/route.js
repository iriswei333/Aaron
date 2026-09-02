import {
  readLocalFamilyEventCache,
  readSupabaseFamilyEventCache,
  writeLocalFamilyEventCache,
  writeSupabaseFamilyEventCache,
} from '../../../lib/backend.js';
import {
  familyEventCacheKey,
  familyEventDateRangeLabel,
  familyEventExpiresAt,
  fetchFamilyEvents,
  normalizeFamilyEventRequest,
} from '../../../lib/family-events.js';
import { getChildProfile } from '../../../lib/profile-defaults.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

function cacheResponse(entry, current, cached) {
  return Response.json({
    ...entry,
    dateRangeLabel: familyEventDateRangeLabel(entry.startDate, entry.endDate),
    cached,
    authMode: current.mode,
  });
}

function pageForRequestId(requestId) {
  const digits = String(Math.abs(requestId));
  const hash = [...digits].reduce((total, digit, index) => (
    total + Number(digit) * (index + 1)
  ), 0);
  return (hash % 5) + 1;
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const url = new URL(request.url);
    const { locationCity, locationZip, startDate, endDate } = normalizeFamilyEventRequest(current.user, url.searchParams);
    const requestId = Number(url.searchParams.get('request'));
    const page = Number.isFinite(requestId) ? pageForRequestId(requestId) : 1;
    const filters = {
      provider: 'parentmap',
      secondaryProvider: 'seattles-child',
      range: 'weekend',
      page,
      locationZip,
      version: 2,
    };
    const cacheKey = familyEventCacheKey({ locationCity, startDate, endDate, filters });
    const refresh = url.searchParams.get('refresh') === '1';

    if (!refresh) {
      const cached = current.mode === 'supabase'
        ? await readSupabaseFamilyEventCache(current.supabase, cacheKey)
        : await readLocalFamilyEventCache(cacheKey);
      if (cached) return cacheResponse(cached, current, true);
    }

    const fetchedAt = new Date().toISOString();
    const fetched = await fetchFamilyEvents({
      locationCity,
      startDate,
      endDate,
      childProfile: getChildProfile(current.user),
      page,
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
      events: fetched.events,
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
