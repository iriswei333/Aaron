import {
  readLocalStoryTimeCache, readSupabaseStoryTimeCache,
  writeLocalStoryTimeCache, writeSupabaseStoryTimeCache,
} from '../../../lib/backend.js';
import { familyEventCityForUser, familyEventDateRangeLabel } from '../../../lib/family-events.js';
import { storyTimeCacheKey, storyTimeExpiresAt, fetchStoryTimes } from '../../../lib/story-times.js';
import { getChildProfile, normalizePlayPreferences } from '../../../lib/profile-defaults.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

function dateValue(value, fallback) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : fallback;
}

function coordinateValue(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function range() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dateString = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { start: dateString(start), end: dateString(end) };
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const url = new URL(request.url);
    const defaults = range();
    const startDate = dateValue(url.searchParams.get('start'), defaults.start);
    const endDate = dateValue(url.searchParams.get('end'), defaults.end);
    // Resolve from the saved profile/location rather than the display label sent
    // by the client; coordinate-only labels are not city names.
    const locationCity = familyEventCityForUser({ ...current.user, childProfile: getChildProfile(current.user) }, '') || 'Seattle';
    const latitude = coordinateValue(url.searchParams.get('latitude'), -90, 90);
    const longitude = coordinateValue(url.searchParams.get('longitude'), -180, 180);
    const { searchRadiusMiles: radiusMiles } = normalizePlayPreferences(current.user.playPreferences);
    const cacheKey = storyTimeCacheKey({ locationCity, startDate, endDate, latitude, longitude, radiusMiles });
    const refresh = url.searchParams.get('refresh') === '1';
    if (!refresh) {
      const cached = current.mode === 'supabase' ? await readSupabaseStoryTimeCache(current.supabase, cacheKey) : await readLocalStoryTimeCache(cacheKey);
      if (cached) return Response.json({ ...cached, dateRangeLabel: familyEventDateRangeLabel(startDate, endDate), cached: true, authMode: current.mode });
    }
    const fetchedAt = new Date().toISOString();
    const fetched = await fetchStoryTimes({ locationCity, startDate, endDate, latitude, longitude, radiusMiles });
    const entry = { cacheKey, ...fetched, fetchedAt, expiresAt: storyTimeExpiresAt(new Date(fetchedAt)) };
    let saved;
    try { saved = current.mode === 'supabase' ? await writeSupabaseStoryTimeCache(current.supabase, entry) : await writeLocalStoryTimeCache(entry); }
    catch (error) { saved = { ...entry, providerStatus: `${entry.providerStatus} Cache write skipped: ${error.message}` }; }
    return Response.json({ ...saved, dateRangeLabel: familyEventDateRangeLabel(startDate, endDate), cached: false, authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
