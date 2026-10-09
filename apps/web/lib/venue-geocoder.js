import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Map positions for family events and story times that arrive without coordinates
// (ParentMap, Seattle's Child and KCLS give a venue name or address only).
// Looked up once with Google Places Text Search and cached for everyone in
// Supabase `venue_geocodes` (or data/venue-geocodes.json locally), so phones and the
// web map get pins without each device geocoding dozens of venues.

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
// Puget Sound: bias results toward the region the event calendars cover.
const REGION_BIAS = { circle: { center: { latitude: 47.6062, longitude: -122.3321 }, radius: 50000 } };
const NOT_FOUND_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_STATE = resolve('data/venue-geocodes.json');
const MAX_LOOKUPS_PER_REQUEST = 120;
const CONCURRENCY = 4;

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function hasCoordinates(event) {
  const latitude = finite(event?.latitude); const longitude = finite(event?.longitude);
  return latitude != null && longitude != null && !(latitude === 0 && longitude === 0);
}

/** Text query for an event's venue, or '' when it can't be placed (search links, no venue). */
export function venueQuery(event) {
  if (!event || hasCoordinates(event) || event.resultType === 'search-link') return '';
  const address = clean(event.address || event.venueAddress);
  const venue = clean(event.venue);
  let query = address || venue;
  if (!query) return '';
  if (!address && event.source === 'kcls') query = `${venue}, King County Library System`;
  if (!address && event.source === 'spl') query = `${venue}, Seattle Public Library, Seattle`;
  return /\b(WA|Washington)\b/i.test(query) ? query : `${query}, WA`;
}

export function venueQueryKey(query) { return clean(query).toLowerCase().slice(0, 300); }

async function readLocal() {
  try { return JSON.parse(await readFile(LOCAL_STATE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

function cacheStore(current) {
  if (current?.mode === 'supabase' && current.supabase) {
    const table = () => current.supabase.from('venue_geocodes');
    return {
      async read(keys) {
        const { data, error } = await table().select('query_key, latitude, longitude, found, checked_at').in('query_key', keys);
        if (error) throw new Error(error.message);
        return Object.fromEntries((data || []).map((row) => [row.query_key, { latitude: row.latitude, longitude: row.longitude, found: row.found, checkedAt: row.checked_at }]));
      },
      async write(rows) {
        if (!rows.length) return;
        await table().upsert(rows.map((row) => ({ query_key: row.key, query: row.query, latitude: row.latitude, longitude: row.longitude, formatted_address: row.formattedAddress || null, found: row.found, checked_at: row.checkedAt })), { onConflict: 'query_key' });
      },
    };
  }
  return {
    async read(keys) { const state = await readLocal(); return Object.fromEntries(keys.filter((key) => state[key]).map((key) => [key, state[key]])); },
    async write(rows) {
      if (!rows.length) return;
      const state = await readLocal();
      rows.forEach((row) => { state[row.key] = { latitude: row.latitude, longitude: row.longitude, found: row.found, checkedAt: row.checkedAt }; });
      await mkdir(resolve('data'), { recursive: true });
      await writeFile(LOCAL_STATE, `${JSON.stringify(state, null, 2)}\n`);
    },
  };
}

export async function geocodeWithGooglePlaces(query, { apiKey = process.env.GOOGLE_PLACES_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  const key = clean(apiKey);
  if (!key) return null;
  const response = await fetchImpl(PLACES_URL, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-goog-api-key': key, 'x-goog-fieldmask': 'places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, locationBias: REGION_BIAS }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}.`);
  const place = (await response.json())?.places?.[0];
  const latitude = finite(place?.location?.latitude); const longitude = finite(place?.location?.longitude);
  return latitude == null || longitude == null ? { found: false } : { found: true, latitude, longitude, formattedAddress: clean(place.formattedAddress) };
}

/**
 * Returns the events with latitude/longitude filled in where a venue could be placed.
 * Never throws: on any problem the events come back unchanged (the app still geocodes on the phone).
 * @param {any} current profile session (for the cache)
 * @param {any[]} events raw family-event / story-time records
 * @param {{ lookup?: typeof geocodeWithGooglePlaces, now?: Date }} [options]
 */
export async function addVenueCoordinates(current, events, { lookup = geocodeWithGooglePlaces, now = new Date() } = {}) {
  if (!Array.isArray(events) || !events.length) return events;
  try {
    const queries = new Map();
    events.forEach((event) => { const query = venueQuery(event); if (query) queries.set(venueQueryKey(query), query); });
    if (!queries.size) return events;
    const store = cacheStore(current);
    const cached = await store.read([...queries.keys()]).catch(() => ({}));
    const points = {};
    const missing = [];
    queries.forEach((query, key) => {
      const hit = cached[key];
      if (hit?.found && finite(hit.latitude) != null) points[key] = { latitude: Number(hit.latitude), longitude: Number(hit.longitude) };
      else if (!hit || now - new Date(hit.checkedAt || 0) > NOT_FOUND_RETRY_MS) missing.push([key, query]);
    });

    const fresh = [];
    const todo = missing.slice(0, MAX_LOOKUPS_PER_REQUEST);
    const worker = async () => {
      while (todo.length) {
        const [key, query] = todo.shift();
        try {
          const result = await lookup(query);
          if (!result) continue; // no API key configured
          fresh.push({ key, query, found: result.found, latitude: result.latitude ?? null, longitude: result.longitude ?? null, formattedAddress: result.formattedAddress, checkedAt: now.toISOString() });
          if (result.found) points[key] = { latitude: result.latitude, longitude: result.longitude };
        } catch (error) {
          console.warn('[venues] Lookup failed:', error?.message || error); // not cached, retried next time
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await store.write(fresh).catch((error) => console.warn('[venues] Cache write failed:', error?.message || error));

    return events.map((event) => {
      const point = points[venueQueryKey(venueQuery(event))];
      return point ? { ...event, latitude: point.latitude, longitude: point.longitude } : event;
    });
  } catch (error) {
    console.warn('[venues] Could not add venue coordinates:', error?.message || error);
    return events;
  }
}
