// Discover tab view helpers shared by apps/web and apps/mobile:
// filter chips, kind labels, schedule text, saved-plan payloads, map links and geocoding.
// Plain JavaScript only — no DOM, React, or platform APIs.

/** Filter chips, in display order: [selection, label]. */
export const DISCOVER_FILTERS = [
  ['all', 'All'],
  ['today', 'Today'],
  ['playground', 'Playgrounds'],
  ['playdate', 'Playdates'],
  ['family_event', 'Family events'],
  ['story_time', 'Story times'],
];

/**
 * @param {string} filter
 * @param {{ todayOnly?: boolean, playgroundOnly?: boolean, kinds?: string[] }} state
 */
export function discoverFilterIsActive(filter, { todayOnly = false, playgroundOnly = false, kinds = [] } = {}) {
  if (filter === 'all') return !todayOnly && !playgroundOnly;
  if (filter === 'today') return todayOnly;
  if (filter === 'playground') return playgroundOnly;
  return kinds.includes(filter);
}

/** @param {string} kind */
export function discoverKindLabel(kind) {
  if (kind === 'playground') return 'Playground';
  if (kind === 'playdate') return 'Playdate';
  if (kind === 'family_event') return 'Family event';
  return 'Story time';
}

/** @param {string} kind */
export function discoverKindIcon(kind) {
  if (kind === 'playground') return '🛝';
  if (kind === 'playdate') return '☺';
  if (kind === 'family_event') return '🎟️';
  return '📖';
}

/** "Sat, Oct 10 · 10:30 AM", or the provider's own date/time labels. @param {any} item */
export function discoverScheduleLabel(item) {
  if (item?.schedule?.startsAt) {
    const start = new Date(item.schedule.startsAt);
    if (!Number.isNaN(start.getTime())) {
      return `${start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  return [item?.schedule?.dateLabel || item?.schedule?.date, item?.schedule?.timeLabel].filter(Boolean).join(' · ');
}

function slugId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

/** Stable id for a provider family event (the saved plan's externalId). @param {any} event */
export function familyEventId(event = {}) {
  return slugId([event.title, event.dateLabel, event.timeLabel, event.venue, event.url].filter(Boolean).join('|'));
}

/** Stable id for a library story time (the saved plan's externalId). @param {any} event */
export function storyTimeId(event = {}) {
  return slugId(event.id || [event.title, event.date, event.timeLabel, event.venue, event.url].filter(Boolean).join('|'));
}

/** Family-plan payload for POST /family-plans when saving a family event. @param {any} event */
export function familyEventPlan(event = {}) {
  return {
    kind: 'external_event',
    title: event.title || 'Family event',
    summary: event.summary || 'Family-friendly event.',
    dueDate: event.date || null,
    status: 'attending',
    source: event.source || 'parentmap',
    externalId: familyEventId(event),
    venue: event.venue || '',
    url: event.url || '',
    metadata: {
      dateLabel: event.dateLabel || '',
      date: event.date || '',
      timeLabel: event.timeLabel || '',
      imageUrl: event.imageUrl || '',
    },
  };
}

/** Family-plan payload for POST /family-plans when saving a story time. @param {any} event */
export function storyTimePlan(event = {}) {
  return {
    kind: 'story_time',
    title: event.title || 'Story time',
    summary: event.summary || 'Library story time.',
    dueDate: event.date || null,
    status: 'planned',
    source: event.source || 'library',
    externalId: storyTimeId(event),
    venue: event.venue || '',
    url: event.url || event.sourceUrl || '',
    metadata: {
      date: event.date || '',
      dateLabel: event.dateLabel || '',
      timeLabel: event.timeLabel || '',
      imageUrl: event.imageUrl || '',
      tags: Array.isArray(event.tags) ? event.tags : [],
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      sourceLabel: event.sourceLabel || '',
    },
  };
}

/**
 * The family-plan payload for a savable Discover item (family event or story time), else null.
 * @param {any} item normalized Discover item
 * @returns {Record<string, any> | null}
 */
export function discoverPlanFor(item) {
  if (!item || item.source?.resultType === 'search-link') return null;
  if (item.kind === 'family_event') return familyEventPlan(item.detail || {});
  if (item.kind === 'story_time') return storyTimePlan(item.detail || {});
  return null;
}

/**
 * The saved plan matching a Discover item, if the family already saved it.
 * @param {any} item
 * @param {any[]} savedPlans rows from GET /family-plans
 */
export function savedPlanFor(item, savedPlans = []) {
  const plan = discoverPlanFor(item);
  if (!plan?.externalId) return null;
  return (Array.isArray(savedPlans) ? savedPlans : []).find((saved) => (
    saved?.kind === plan.kind && saved.externalId === plan.externalId && saved.status !== 'cancelled'
  )) || null;
}

/**
 * Why a playground is suggested, based on today's weather.
 * @param {{ preference?: string, distance?: string }} option raw playground
 * @param {boolean} indoorWeather
 */
export function playgroundRecommendationReason(option, indoorWeather) {
  const weatherFit = option?.preference === (indoorWeather ? 'indoor' : 'outdoor')
    ? (indoorWeather ? 'an indoor weather backup' : 'outdoor play today')
    : (indoorWeather ? 'a weather-friendly outdoor option' : 'a backup if plans change');
  return `Recommended for ${weatherFit}; ${option?.distance || 'nearby'} from your saved location.`;
}

/** Address text to geocode a family event or story time that came without coordinates. */
export function discoverGeocodeQuery(item, searchLocationLabel = '') {
  if (!['family_event', 'story_time'].includes(item?.kind)) return '';
  const address = String(item?.location?.address || '').trim();
  const venue = String(item?.location?.venue || '').trim();
  const place = address || venue;
  if (!place) return '';
  if (item.kind === 'story_time') {
    if (address) return address;
    const sourceId = String(item?.source?.id || item?.detail?.source || '').toLowerCase();
    if (sourceId === 'kcls') return `${venue}, King County Library System, WA, USA`;
    if (sourceId === 'spl') return `${venue}, Seattle Public Library, Seattle, WA, USA`;
    return venue;
  }
  const searchArea = String(searchLocationLabel || '').trim();
  if (!searchArea || place.toLocaleLowerCase().includes(searchArea.toLocaleLowerCase())) return place;
  return `${place}, ${searchArea}`;
}

/** Google Maps search link for any Discover item ("Open in map"). */
export function discoverMapUrl(item, searchLocationLabel = '') {
  if (!item) return '';
  const latitude = Number(item.location?.latitude);
  const longitude = Number(item.location?.longitude);
  const hasCoordinates = item.location?.latitude != null && item.location?.longitude != null
    && Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0);
  let query = '';
  if (hasCoordinates) query = `${latitude},${longitude}`;
  else if (['family_event', 'story_time'].includes(item.kind)) query = discoverGeocodeQuery(item, searchLocationLabel);
  else query = [item.location?.venue || item.title, item.location?.address].filter(Boolean).join(', ');
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Empty-state copy for the results list / map selection.
 * @param {{ todayOnly?: boolean, playgroundOnly?: boolean, loading?: boolean }} state
 */
export function discoverEmptyCopy({ todayOnly = false, playgroundOnly = false, loading = false } = {}) {
  if (loading) return { title: 'Finding adventures…', body: 'Checking playgrounds, playdates, events, and story times near you.' };
  if (todayOnly) return { title: 'No matching adventures scheduled today', body: 'Try another event type or come back after refreshing the providers.' };
  if (playgroundOnly) return { title: 'No nearby playgrounds found', body: 'Update your location or increase your playground search distance.' };
  return { title: 'No adventures in this category yet', body: 'Try another category, refresh the providers, or update your location.' };
}

/** "3 ideas" / "1 idea". @param {number} count */
export function discoverCountLabel(count) {
  return `${count} ${count === 1 ? 'idea' : 'ideas'}`;
}

/** Merge playdate lists (nearby + the family's own), keeping the first copy of each id. @param {...any[]} lists */
export function uniqueById(...lists) {
  const seen = new Set();
  return lists.flat().filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Payload for POST /playdates from a playground and the create form.
 * @param {any} playground raw playground (key, name, type, address, latitude, longitude)
 * @param {{ startsAt: string, endsAt: string, visibility?: string, ageRange?: string, maxFamilies?: string | number, notes?: string }} form
 */
export function createPlaydatePayload(playground, form) {
  if (!playground?.key) throw new Error('Choose a playground first.');
  return {
    playgroundKey: playground.key,
    playgroundName: playground.name,
    playgroundType: playground.type,
    playgroundAddress: playground.address || '',
    playgroundLatitude: playground.latitude ?? null,
    playgroundLongitude: playground.longitude ?? null,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    visibility: form.visibility === 'private' ? 'private' : 'public',
    ageRange: String(form.ageRange || '').trim(),
    maxFamilies: form.maxFamilies === undefined || form.maxFamilies === null ? '' : String(form.maxFamilies),
    notes: String(form.notes || '').trim(),
  };
}

// ── Address lookup (web "Input address"; mobile fallback when the OS geocoder has no match) ──

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchJson(fetchImpl, url, init, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(url, { ...init, ...(controller ? { signal: controller.signal } : {}) });
    if (!response.ok) throw new Error('Address lookup failed.');
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** @param {string} address @param {typeof fetch} [fetchImpl] */
export async function geocodeWithNominatim(address, fetchImpl = globalThis.fetch, timeoutMs = 8000) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
  const [result] = await fetchJson(fetchImpl, url, { headers: { accept: 'application/json' } }, timeoutMs) || [];
  if (!result) throw new Error('No matching place found.');
  const latitude = finite(result.lat);
  const longitude = finite(result.lon);
  if (latitude === null || longitude === null) throw new Error('Address lookup did not return coordinates.');
  return { label: result.name || 'Manual location', address: result.display_name || address, latitude, longitude, source: 'nominatim-geocoding' };
}

/** @param {string} address @param {typeof fetch} [fetchImpl] */
export async function geocodeWithOpenMeteo(address, fetchImpl = globalThis.fetch, timeoutMs = 8000) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`;
  const data = await fetchJson(fetchImpl, url, {}, timeoutMs);
  const result = data?.results?.[0];
  if (!result) throw new Error('No matching place found.');
  const latitude = finite(result.latitude);
  const longitude = finite(result.longitude);
  if (latitude === null || longitude === null) throw new Error('Place lookup did not return coordinates.');
  const parts = [result.name, result.admin1, result.country].filter(Boolean);
  return { label: result.name || 'Manual location', address: parts.join(', ') || address, latitude, longitude, source: 'open-meteo-geocoding' };
}

/**
 * Typed address → saved-location payload. Nominatim first, Open-Meteo as a fallback.
 * @param {string} address
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ label: string, address: string, latitude: number, longitude: number, source: string }>}
 */
export async function geocodeAddress(address, fetchImpl = globalThis.fetch) {
  try {
    return await geocodeWithNominatim(address, fetchImpl);
  } catch {
    return geocodeWithOpenMeteo(address, fetchImpl);
  }
}

/**
 * One-line address from a reverse-geocode result (expo-location LocationGeocodedAddress shape).
 * @param {{ name?: string|null, street?: string|null, streetNumber?: string|null, district?: string|null, city?: string|null, subregion?: string|null, region?: string|null, postalCode?: string|null, country?: string|null } | null | undefined} place
 */
export function formatReverseGeocode(place) {
  if (!place) return '';
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  const parts = [place.district || street || place.name, place.city || place.subregion, place.region, place.country];
  return parts.map((part) => String(part || '').trim()).filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(', ');
}
