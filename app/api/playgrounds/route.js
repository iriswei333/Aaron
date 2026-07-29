import {
  readLocalPlaygroundCache,
  readSupabasePlaygroundCache,
  writeLocalPlaygroundCache,
  writeSupabasePlaygroundCache,
} from '../../../lib/backend.js';
import { fetchNearbyPlaygrounds, playgroundCacheKey } from '../../../lib/playgrounds.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

const CACHE_TTL_DAYS = 7;

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function cacheEntry({ cacheKey, latitude, longitude, playgrounds, fetchedAt }) {
  return {
    cacheKey,
    latitude,
    longitude,
    playgrounds,
    source: 'openstreetmap-overpass',
    fetchedAt,
    expiresAt: new Date(new Date(fetchedAt).getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const url = new URL(request.url);
    const latitude = validCoordinate(url.searchParams.get('latitude'), -90, 90);
    const longitude = validCoordinate(url.searchParams.get('longitude'), -180, 180);
    if (latitude === null || longitude === null) {
      return Response.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
    }

    const cacheKey = playgroundCacheKey({ latitude, longitude });
    const cached = current.mode === 'supabase'
      ? await readSupabasePlaygroundCache(current.supabase, cacheKey)
      : await readLocalPlaygroundCache(cacheKey);
    if (cached) return Response.json({ ...cached, cached: true, authMode: current.mode });

    const fetchedAt = new Date().toISOString();
    const entry = cacheEntry({
      cacheKey,
      latitude,
      longitude,
      playgrounds: await fetchNearbyPlaygrounds({ latitude, longitude }),
      fetchedAt,
    });
    let saved = entry;
    try {
      saved = current.mode === 'supabase'
        ? await writeSupabasePlaygroundCache(current.supabase, entry)
        : await writeLocalPlaygroundCache(entry);
    } catch {
      // A cache write must not prevent live nearby results from rendering.
    }
    return Response.json({ ...saved, cached: false, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
