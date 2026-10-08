import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

const locationCache = new Map();

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function cleanText(value, maxLength = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

async function findGooglePlace(query, center, radiusMeters, apiKey) {
  const cacheKey = `${query.toLocaleLowerCase()}|${center.latitude.toFixed(3)}|${center.longitude.toFixed(3)}`;
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);
  const request = fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-fieldmask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center,
          radius: Math.min(50000, Math.max(5000, radiusMeters * 4)),
        },
      },
    }),
    signal: AbortSignal.timeout(8000),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}.`);
    const payload = await response.json();
    const place = payload.places?.[0];
    const latitude = validCoordinate(place?.location?.latitude, -90, 90);
    const longitude = validCoordinate(place?.location?.longitude, -180, 180);
    if (latitude === null || longitude === null) return null;
    return {
      latitude,
      longitude,
      name: cleanText(place.displayName?.text, 160),
      address: cleanText(place.formattedAddress, 200),
    };
  });
  locationCache.set(cacheKey, request);
  try {
    return await request;
  } catch (error) {
    locationCache.delete(cacheKey);
    throw error;
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
    if (!apiKey) return Response.json({ error: 'Google Places is not configured.' }, { status: 503 });

    const body = await request.json();
    const latitude = validCoordinate(body.center?.lat, -90, 90);
    const longitude = validCoordinate(body.center?.lng, -180, 180);
    if (latitude === null || longitude === null) {
      return Response.json({ error: 'A valid search center is required.' }, { status: 400 });
    }
    const radiusMeters = Math.min(50000, Math.max(1000, Number(body.radiusMeters) || 4828));
    const seen = new Set();
    const items = (Array.isArray(body.items) ? body.items : []).map((item) => ({
      id: cleanText(item?.id, 200),
      query: cleanText(item?.query),
    })).filter((item) => {
      const key = `${item.id}|${item.query.toLocaleLowerCase()}`;
      if (!item.id || !item.query || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);

    const results = await Promise.allSettled(items.map(async (item) => ({
      id: item.id,
      ...await findGooglePlace(item.query, { latitude, longitude }, radiusMeters, apiKey),
    })));
    const locations = results
      .filter((result) => result.status === 'fulfilled' && Number.isFinite(result.value?.latitude))
      .map((result) => result.value);
    return Response.json({ locations, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message || 'Discover venue lookup failed.' }, { status: error.status || 500 });
  }
}
