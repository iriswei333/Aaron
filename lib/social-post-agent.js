import { currentWeekendRange, fetchFamilyEvents, fetchParentMapEventDetails } from './family-events.js';
import { recommendWeekendEvent } from './social-recommendations.js';
import { getForcedPartnershipEvents } from './social-partnership-events.js';

export const DEFAULT_SOCIAL_REGIONS = [
  { city: 'Seattle', label: 'Seattle' },
  { city: 'Bellevue', label: 'Bellevue' },
  { city: 'Tacoma', label: 'Tacoma' },
  { city: 'Kirkland', label: 'Kirkland' },
  { city: 'Lynnwood', label: 'Lynnwood' },
  { city: 'Edmonds', label: 'Edmonds' },
];

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
export const DEFAULT_EVENT_DISTANCE_MILES = 15;
const SOCIAL_CITY_COORDINATES = new Map([
  ['seattle', { latitude: 47.6062, longitude: -122.3321 }],
  ['bellevue', { latitude: 47.6101, longitude: -122.2015 }],
  ['tacoma', { latitude: 47.2529, longitude: -122.4443 }],
  ['kirkland', { latitude: 47.6769, longitude: -122.2060 }],
  ['lynnwood', { latitude: 47.8209, longitude: -122.3151 }],
  ['edmonds', { latitude: 47.8107, longitude: -122.3774 }],
]);
const geocodeCache = new Map();
const parentMapDetailsCache = new Map();
let nominatimQueue = Promise.resolve();
const BANNER_CONTENTS = [
  '带上家人，一起去玩！',
  '周末快乐，亲子同行！',
  '一起发现身边的小惊喜！',
  '亲子时光，从今天开始！',
  '把周末过成美好回忆！',
];

function clean(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeFeedbackText(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function eventFamilyKey(value) {
  const title = clean(value).toLowerCase();
  const spacedFamily = /\s+at\s+/i.test(title) ? title.split(/\s+at\s+/i)[0] : '';
  const colonFamily = /\s*:\s*/.test(title) ? title.split(/\s*:\s*/)[0] : '';
  const compactSeriesMatch = title.match(/^(.{8,}storystroll)/);
  const compactMatch = title.match(/^(.{8,})at[a-z0-9\u4e00-\u9fff]{5,}$/);
  const family = normalizeFeedbackText(spacedFamily || colonFamily || compactSeriesMatch?.[1] || compactMatch?.[1] || '');
  return family.length >= 8 ? family : '';
}

function firstSentence(value) {
  const text = clean(value);
  const match = text.match(/^.*?[。！？.!?](?:[”’」』\")\)]*)?/);
  return match?.[0]?.trim() || text;
}

function decodeHtml(value) {
  return clean(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

function metaContent(html, key) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    return decodeHtml(tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '');
  }
  return '';
}

function findStructuredEvent(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const event = findStructuredEvent(item);
      if (event) return event;
    }
    return null;
  }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Event')) return value;
  for (const nested of Object.values(value)) {
    const event = findStructuredEvent(nested);
    if (event) return event;
  }
  return null;
}

function structuredEventFromHtml(html) {
  for (const match of String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const event = findStructuredEvent(JSON.parse(match[1].trim()));
      if (event) return event;
    } catch {
      // Continue to visible-page fallbacks when a JSON-LD block is malformed.
    }
  }
  return null;
}

function formatClock(hourValue, minuteValue = '00', suffix = '') {
  let hour = Number(hourValue);
  const minute = String(minuteValue || '00').padStart(2, '0');
  let period = clean(suffix).toLowerCase().replace(/\./g, '');
  if (!period) {
    period = hour >= 12 ? 'pm' : 'am';
  }
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}${minute === '00' ? '' : `:${minute}`} ${period === 'pm' ? 'p.m.' : 'a.m.'}`;
}

function timeLabelFromStructuredEvent(event) {
  const start = clean(event?.startDate).match(/T(\d{1,2}):(\d{2})/);
  if (!start) return '';
  const end = clean(event?.endDate).match(/T(\d{1,2}):(\d{2})/);
  const startLabel = formatClock(start[1], start[2]);
  if (!end) return startLabel;
  return `${startLabel.replace(/\s(?:a|p)\.m\.$/, '')}–${formatClock(end[1], end[2])}`;
}

function timeLabelFromPageText(text) {
  const match = clean(text).match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!match) return '';
  const endSuffix = match[6];
  const startSuffix = match[3] || endSuffix;
  return `${formatClock(match[1], match[2], startSuffix).replace(/\s(?:a|p)\.m\.$/, '')}–${formatClock(match[4], match[5], endSuffix)}`;
}

function forcedEventDateLabel(date) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function structuredVenue(event) {
  const location = event?.location;
  if (typeof location === 'string') return { name: clean(location), address: '' };
  const address = location?.address;
  const addressText = typeof address === 'string'
    ? clean(address)
    : [address?.streetAddress, address?.addressLocality, address?.addressRegion, address?.postalCode, address?.addressCountry]
      .map((part) => clean(part)).filter(Boolean).join(', ');
  return { name: clean(location?.name), address: addressText };
}

function decodeSourceHtml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function unwrapSavedViewSource(html) {
  const source = String(html || '');
  if (!/class=["']line-content["']/.test(source)) return source;
  return [...source.matchAll(/<td\b[^>]*class=["']line-content["'][^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => match[1]
      .replace(/<a\b[^>]*class=["'][^"']*html-attribute-value[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<\/?span\b[^>]*>/gi, ''))
    .map(decodeSourceHtml)
    .join('\n');
}

function recommendationYear(html, now = new Date()) {
  const published = String(html || '').match(/(?:datePublished["']?\s*[:=]\s*["']|article:published_time[\s\S]{0,160}?content=["'])(\d{4})-/i)?.[1];
  return Number(published) || now.getFullYear();
}

function recommendationDate(value, year) {
  const match = clean(value).match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})\b/i);
  if (!match) return '';
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
  const day = Number(match[2]);
  return month && day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function recommendationCity(locationText) {
  const text = decodeHtml(locationText).replace(/\s+/g, ' ').trim();
  const stateMatch = text.match(/,\s*([^,]+?),?\s+(?:WA|Washington)(?:\s+\d{5})?\s*$/i);
  if (stateMatch) return clean(stateMatch[1]);
  const parts = text.split(',').map(clean).filter(Boolean);
  return parts.length > 1 ? parts.at(-1).replace(/\s+(?:WA|Washington)(?:\s+\d{5})?$/i, '').trim() : '';
}

function absoluteHttpUrl(value, baseUrl) {
  try {
    const parsed = new URL(decodeSourceHtml(value).replace(/\\\//g, '/'), baseUrl);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

export function parseEventRecommendationPage(html, { url = 'https://www.parentmap.com/', now = new Date() } = {}) {
  const source = unwrapSavedViewSource(html);
  const year = recommendationYear(source, now);
  const headings = [...source.matchAll(/<h3\b[^>]*class=["'][^"']*is-style-listicle-heading[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi)];
  return headings.map((heading, index) => {
    const headingHtml = heading[1];
    const anchor = headingHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) return null;
    const blockStart = (heading.index || 0) + heading[0].length;
    const blockEnd = headings[index + 1]?.index ?? source.length;
    const block = source.slice(blockStart, blockEnd);
    const paragraph = block.match(/<p\b[^>]*class=["'][^"']*wp-block-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
    const dateLabel = clean(decodeHtml(paragraph.match(/<strong\b[^>]*>\s*Date:\s*<\/strong>([\s\S]*?)(?=<br\b)/i)?.[1] || ''));
    const cost = clean(decodeHtml(paragraph.match(/<strong\b[^>]*>\s*Cost:\s*<\/strong>([\s\S]*?)(?=<br\b)/i)?.[1] || ''));
    const locationHtml = paragraph.match(/<strong\b[^>]*>\s*Location:\s*<\/strong>([\s\S]*?)(?=<br\b)/i)?.[1] || '';
    const locationAnchor = locationHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    const venue = clean(decodeHtml(locationAnchor?.[1] || ''));
    const venueAddress = clean(decodeHtml(locationHtml.replace(locationAnchor?.[0] || '', '').replace(/^\s*,\s*/, '')));
    const summary = clean(decodeHtml(paragraph.split(/<br\s*\/?>\s*<br\s*\/?>/i).slice(1).join(' ')));
    const eventUrl = absoluteHttpUrl(anchor[1], url);
    const date = recommendationDate(dateLabel, year);
    if (!eventUrl || !date) return null;
    return {
      city: recommendationCity(venueAddress),
      date,
      title: clean(decodeHtml(anchor[2])),
      summary,
      theme: 'Family event recommendation',
      dateLabel,
      timeLabel: 'Time listed on event page',
      venue,
      venueAddress,
      url: eventUrl,
      sourceUrl: eventUrl,
      recommendationUrl: new URL(url).href,
      source: 'parentmap',
      sourceLabel: 'ParentMap',
      tags: ['Family event recommendation'],
      ageSlugs: [],
      free: /^free\b/i.test(cost) ? true : null,
      cost,
      resultType: 'event',
    };
  }).filter(Boolean);
}

function parentMapCalendarLinks(html, baseUrl) {
  const source = String(html || '').replace(/\\\//g, '/');
  const values = [...source.matchAll(/(?:href\s*=\s*["']|["']url["']\s*:\s*["'])([^"']*\/calendar\/[^"'#?]+)/gi)]
    .map((match) => absoluteHttpUrl(match[1], baseUrl))
    .filter(Boolean);
  return [...new Set(values)];
}

export async function resolveParentMapEventUrl(url, date, { fetchImpl = fetch } = {}) {
  let current = new URL(url).href;
  if (new URL(current).pathname.includes('/calendar/')) return current;
  const visited = new Set();
  for (let depth = 0; depth < 4 && !visited.has(current); depth += 1) {
    visited.add(current);
    const response = await fetchImpl(current, {
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'SproutCue social recommendation importer' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`ParentMap link returned ${response.status}: ${current}`);
    const responseUrl = response.url || current;
    if (new URL(responseUrl).pathname.includes('/calendar/')) return responseUrl;
    const links = parentMapCalendarLinks(await response.text(), responseUrl);
    const dated = links.find((link) => new URL(link).pathname.includes(`/${date}/`));
    if (dated) return dated;
    if (links[0]) return links[0];
    current = responseUrl;
  }
  return current;
}

export async function fetchEventRecommendationsFromUrl({ url, now = new Date() } = {}, { fetchImpl = fetch } = {}) {
  const sourceUrl = new URL(url).href;
  const response = await fetchImpl(sourceUrl, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'SproutCue social recommendation importer' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Event recommendation page returned ${response.status}.`);
  const events = parseEventRecommendationPage(await response.text(), { url: response.url || sourceUrl, now });
  return Promise.all(events.map(async (event) => {
    try {
      const canonicalUrl = await resolveParentMapEventUrl(event.url, event.date, { fetchImpl });
      const detailResponse = await fetchImpl(canonicalUrl, {
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'SproutCue social recommendation importer' },
        signal: AbortSignal.timeout(12000),
      });
      if (!detailResponse.ok) throw new Error(`Event detail returned ${detailResponse.status}.`);
      const finalUrl = detailResponse.url || canonicalUrl;
      const detail = parseForcedEventPage(await detailResponse.text(), { url: finalUrl, city: event.city, date: event.date });
      return {
        ...detail,
        ...event,
        city: event.city || detail.city,
        summary: event.summary || detail.summary,
        timeLabel: detail.timeLabel,
        venue: event.venue || detail.venue,
        venueAddress: event.venueAddress || detail.venueAddress,
        imageUrl: detail.imageUrl,
        url: finalUrl,
        sourceUrl: finalUrl,
        recommendationUrl: sourceUrl,
        source: 'parentmap',
        sourceLabel: 'ParentMap',
        cliForcedEvent: false,
      };
    } catch (error) {
      return { ...event, resolutionError: error.message };
    }
  }));
}

export function parseForcedEventPage(html, { url, city, date } = {}) {
  const sourceUrl = new URL(url);
  const structured = structuredEventFromHtml(html);
  const pageText = decodeHtml(html);
  const headings = [...String(html || '').matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtml(match[1])).filter(Boolean);
  const rawTitle = clean(structured?.name)
    || metaContent(html, 'og:title')
    || headings.find((heading) => !/website|experience|details|visit us/i.test(heading))
    || `Event from ${sourceUrl.hostname}`;
  const title = rawTitle.replace(/\s+[|–—-]\s+(?:Redmond Town Center|[^|–—-]+ official site)$/i, '').trim();
  const visibleSummary = pageText.match(/Weather Dependent\s+([\s\S]{30,700}?)(?=\s+(?:Specialty Shows|View all events|Visit Us)\b)/i)?.[1] || '';
  const summary = decodeHtml(structured?.description || visibleSummary || metaContent(html, 'og:description'));
  const structuredLocation = structuredVenue(structured);
  const visibleVenue = pageText.match(/\bWhere\s+(.{2,140}?)(?=\s+(?:Spring|Fall|Weather|When|Join us|Details)\b)/i)?.[1] || '';
  const visibleAddress = pageText.match(/\b\d{2,6}\s+[A-Za-z0-9 .'-]+(?:Avenue|Ave\.?|Street|St\.?|Road|Rd\.?|Boulevard|Blvd\.?|Way|Drive|Dr\.?)\s*(?:NE|NW|SE|SW)?(?:,?\s+Suite\s+[A-Za-z0-9-]+)?,?\s+[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i)?.[0] || '';
  const image = Array.isArray(structured?.image) ? structured.image[0] : structured?.image;
  const price = Array.isArray(structured?.offers) ? structured.offers[0]?.price : structured?.offers?.price;
  const sourceName = sourceUrl.hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    city: clean(city),
    date: clean(date),
    title,
    summary: summary || `Event details from ${sourceName}.`,
    theme: 'Community event',
    dateLabel: forcedEventDateLabel(date),
    timeLabel: timeLabelFromStructuredEvent(structured) || timeLabelFromPageText(pageText) || 'Time listed on event page',
    venue: structuredLocation.name || clean(visibleVenue) || clean(city),
    venueAddress: structuredLocation.address || clean(visibleAddress),
    url: sourceUrl.href,
    sourceUrl: sourceUrl.href,
    imageUrl: typeof image === 'string' ? image : image?.url || metaContent(html, 'og:image'),
    source: 'forced-url',
    sourceLabel: `${sourceName} official website`,
    tags: ['Community event'],
    ageSlugs: [],
    free: price === 0 || price === '0' ? true : null,
    resultType: 'event',
    forcedRecommendation: true,
    recommendationType: 'forced-url',
    cliForcedEvent: true,
  };
}

export async function fetchForcedEventFromUrl({ url, city, date } = {}) {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'SproutCue weekly social agent forced event' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Forced event page returned ${response.status}.`);
  return parseForcedEventPage(await response.text(), { url, city, date });
}

function validCoordinates(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? { latitude, longitude }
    : null;
}

export function distanceMiles(origin, destination) {
  const start = validCoordinates(origin);
  const end = validCoordinates(destination);
  if (!start || !end) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(end.latitude - start.latitude);
  const longitudeDelta = radians(end.longitude - start.longitude);
  const startLatitude = radians(start.latitude);
  const endLatitude = radians(end.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function geocodeWithGooglePlaces(query, center) {
  const apiKey = clean(process.env.GOOGLE_PLACES_API_KEY);
  if (!apiKey) return null;
  const body = { textQuery: query, maxResultCount: 1 };
  if (center) {
    body.locationBias = { circle: { center, radius: 50000 } };
  }
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
      'x-goog-fieldmask': 'places.formattedAddress,places.location',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Google Places returned ${response.status}.`);
  return validCoordinates((await response.json()).places?.[0]?.location);
}

async function geocodeWithNominatim(query) {
  const request = nominatimQueue.catch(() => null).then(async () => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('q', query);
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'SproutCue weekly social agent venue filter',
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}.`);
    const result = (await response.json())?.[0];
    return validCoordinates({ latitude: result?.lat, longitude: result?.lon });
  });
  nominatimQueue = request.then(() => new Promise((resolve) => setTimeout(resolve, 1100)));
  return request;
}

export async function geocodeSocialLocation(query, center = null) {
  const normalizedQuery = clean(query).toLowerCase();
  if (!normalizedQuery) return null;
  const cacheKey = normalizedQuery;
  if (!geocodeCache.has(cacheKey)) {
    geocodeCache.set(cacheKey, (async () => {
      try {
        const googleResult = await geocodeWithGooglePlaces(query, center);
        if (googleResult) return googleResult;
      } catch {
        // Use the public fallback when Google Places is unavailable or rejects the request.
      }
      return geocodeWithNominatim(query);
    })());
  }
  try {
    return await geocodeCache.get(cacheKey);
  } catch (error) {
    geocodeCache.delete(cacheKey);
    throw error;
  }
}

async function destinationCoordinates(city, geocode) {
  return SOCIAL_CITY_COORDINATES.get(clean(city).toLowerCase())
    || validCoordinates(await geocode(`${city}, Washington, USA`));
}

async function cachedParentMapDetails(eventUrl) {
  const key = clean(eventUrl);
  if (!parentMapDetailsCache.has(key)) {
    parentMapDetailsCache.set(key, fetchParentMapEventDetails(key));
  }
  try {
    return await parentMapDetailsCache.get(key);
  } catch (error) {
    parentMapDetailsCache.delete(key);
    throw error;
  }
}

export async function filterParentMapEventsByDistance(events = [], {
  city,
  maxDistanceMiles = DEFAULT_EVENT_DISTANCE_MILES,
  fetchDetails = fetchParentMapEventDetails,
  geocode = geocodeSocialLocation,
} = {}) {
  const maximumMiles = Number(maxDistanceMiles);
  const origin = await destinationCoordinates(city, geocode);
  if (!origin || !Number.isFinite(maximumMiles) || maximumMiles <= 0) {
    return { events: [], candidates: [], skipped: events.length, unlocated: events.length, reason: 'Destination city could not be located.' };
  }

  const inspected = await Promise.all(events.filter((event) => event?.source === 'parentmap').map(async (event) => {
    try {
      const details = fetchDetails === fetchParentMapEventDetails
        ? await cachedParentMapDetails(event.url)
        : await fetchDetails(event.url);
      const venue = details?.venue;
      if (!venue?.address) return null;
      const coordinates = await geocode(venue.address, origin);
      const miles = distanceMiles(origin, coordinates);
      if (miles === null) return null;
      return {
        ...event,
        venue: venue.name || event.venue,
        venueAddress: venue.address,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        distanceMiles: Number(miles.toFixed(2)),
        parentMapDescription: details.description || '',
      };
    } catch {
      return null;
    }
  }));
  const candidates = inspected.filter(Boolean);
  const matched = candidates.filter((event) => event.distanceMiles <= maximumMiles);
  const parentMapEventCount = events.filter((event) => event?.source === 'parentmap').length;
  return {
    events: matched,
    candidates,
    skipped: parentMapEventCount - matched.length,
    unlocated: parentMapEventCount - candidates.length,
    reason: '',
  };
}

function compareLocationFallbackCandidates(a, b, context = {}) {
  const scoreDifference = recommendWeekendEvent(b, { ...context, date: b.date || context.date }).score
    - recommendWeekendEvent(a, { ...context, date: a.date || context.date }).score;
  if (scoreDifference) return scoreDifference;
  const aDistance = Number.isFinite(Number(a.distanceMiles)) ? Number(a.distanceMiles) : Number.POSITIVE_INFINITY;
  const bDistance = Number.isFinite(Number(b.distanceMiles)) ? Number(b.distanceMiles) : Number.POSITIVE_INFINITY;
  return aDistance - bDistance;
}

export function rankLocationFallbackCandidates(events = [], { city = '', date = '' } = {}) {
  return [...events]
    .sort((a, b) => compareLocationFallbackCandidates(a, b, { city, date }))
    .map((event) => ({ ...event, locationFilterFallback: true }));
}

function searchUrl(city, startDate, endDate) {
  const query = encodeURIComponent(`family events kids ${city} ${startDate} ${endDate}`);
  return `${SEARCH_ENDPOINT}?q=${query}`;
}

async function fetchWebSearchEvents({ city, startDate, endDate }) {
  const sourceUrl = searchUrl(city, startDate, endDate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: 'text/html', 'user-agent': 'SproutCue weekly social agent' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}.`);
    const html = await response.text();
    const titles = [...html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => decodeHtml(match[1]));
    const urls = [...html.matchAll(/class="result__a"[^>]+href="([^"]+)"/gi)].map((match) => match[1]);
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a?>/gi)].map((match) => decodeHtml(match[1]));
    return titles.slice(0, 5).map((title, index) => ({
      id: `web-search-${slug(city)}-${slug(title)}`,
      title,
      theme: 'Web search',
      summary: snippets[index] || `Search result for family events in ${city}. Verify details on the linked page.`,
      date: startDate,
      dateLabel: `${startDate}–${endDate}`,
      timeLabel: '详情请查看活动页面',
      venue: city,
      url: urls[index] || sourceUrl,
      imageUrl: '',
      tags: ['Web search', 'Family event'],
      ageSlugs: ['all-ages'],
      free: null,
      source: 'duckduckgo',
      sourceLabel: 'DuckDuckGo web search',
      sourceUrl,
      resultType: 'event',
    }));
  } finally {
    clearTimeout(timeout);
  }
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function eventScore(event, context = {}) {
  const tags = `${event.theme || ''} ${(event.tags || []).join(' ')}`.toLowerCase();
  return (event.resultType === 'event' ? 20 : 0)
    + (event.forcedRecommendation ? 1000 : 0)
    + (event.free === true ? 6 : 0)
    + (event.venue ? 3 : 0)
    + (/festival|community|arts|play|family|seasonal/.test(tags) ? 4 : 0)
    + (event.imageUrl ? 2 : 0)
    + recommendWeekendEvent(event, context).score;
}

function bestEvent(events = [], context = {}) {
  return events
    .filter((event) => event?.resultType !== 'search-link' && event?.title)
    .sort((a, b) => {
      if (a.locationFilterFallback && b.locationFilterFallback) {
        return compareLocationFallbackCandidates(a, b, context);
      }
      return eventScore(b, context) - eventScore(a, context);
    })[0] || null;
}

function eventKey(event) {
  const normalize = (value) => clean(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  const canonicalUrl = clean(event.url || event.sourceUrl)
    .toLowerCase()
    .replace(/\/\d{4}-\d{2}-\d{2}\/?$/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '');
  return canonicalUrl || normalize(event.title);
}

function bannerContent(city, date, title) {
  const seed = `${city}|${date}|${title}`.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
  return BANNER_CONTENTS[seed % BANNER_CONTENTS.length];
}

function compactLocation(event, city) {
  return clean(event.venue, city).replace(/\s+/g, ' ');
}

function dayLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '周末';
  return ({ Saturday: '星期六', Sunday: '星期日' })[
    date.toLocaleDateString('en-US', { weekday: 'long' })
  ] || '周末';
}

function makeCaption(event, city, dateLabel, sourceLabel = 'ParentMap') {
  const free = event.free === true ? '免费入场，' : '';
  const details = [dateLabel, event.timeLabel, compactLocation(event, city)].filter(Boolean).join(' · ');
  return `这个周末去${city}玩什么？🌿\n\n推荐：${event.title}\n${free}${details}\n\n${event.summary || '适合亲子一起参加的周末活动。'}\n\n带上家人，轻松安排一个有趣的周末！\n\n资料整理：SproutCue\n活动来源：${sourceLabel}`;
}

function eventHighlights(event) {
  const facts = [];
  if (event.free === true) facts.push('🎟️ 活动免费参加');
  const theme = clean(event.theme);
  if (theme && !/family event|web search|local search/i.test(theme)) {
    const icon = /art|culture|craft/i.test(theme) ? '🎨'
      : /music|concert|dance/i.test(theme) ? '🎵'
        : /outdoor|play|recreation|sport|nature/i.test(theme) ? '🌿'
          : /festival|community|seasonal|holiday/i.test(theme) ? '🎉'
            : /education|learning|science|library/i.test(theme) ? '📚' : '⭐';
    const themeLabel = /art|culture|craft/i.test(theme) ? '艺术与文化'
      : /music|concert|dance/i.test(theme) ? '音乐与舞蹈'
        : /outdoor|play|recreation|sport|nature/i.test(theme) ? '户外与运动'
          : /festival|community|seasonal|holiday/i.test(theme) ? '节庆与社区'
            : /education|learning|science|library/i.test(theme) ? '教育与探索' : '亲子活动';
    facts.push(`${icon} 可以体验${themeLabel}主题活动`);
  }
  const summary = clean(event.summary).replace(/\.$/, '');
  if (summary && !/^at\s+/i.test(summary) && /[\u4e00-\u9fff]/.test(summary)) facts.push(`✨ ${summary}`);
  if (!facts.length) facts.push('👨‍👩‍👧‍👦 适合亲子一起体验');
  if (facts.length === 1) facts.push('💛 适合安排周末亲子时光');
  return [`${facts.slice(0, 3).join('。')}。`];
}

async function generateAiHighlights(post) {
  if (!process.env.OPENAI_API_KEY) return null;
  const content = [post.title, post.description, post.theme, post.venue, post.dateLabel, post.timeLabel]
    .filter(Boolean)
    .join('\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_HIGHLIGHTS_MODEL || 'gpt-5',
        store: false,
        input: [
          {
            role: 'system',
            content: '你是亲子活动编辑。根据活动真实内容，生成恰好 1 条简洁、具体、自然的简体中文亮点文案。亮点必须由 2 到 3 个短句组成，总体简短，适合放入周末活动汇总。不要编造信息，不要重复日期、时间、地点，不要加序号或前缀。',
          },
          { role: 'user', content: `请为下面这个活动生成 Mandarin highlights：\n\n${content}` },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'event_highlights',
            strict: true,
            schema: {
              type: 'object',
              properties: { highlights: { type: 'array', items: { type: 'string' }, maxItems: 1 } },
              required: ['highlights'],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const outputText = data.output_text || data.output?.flatMap((item) => item.content || [])
      .find((item) => item.type === 'output_text')?.text || '';
    const parsed = JSON.parse(outputText);
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map((highlight) => clean(highlight, 120)).filter(Boolean).slice(0, 2)
      : [];
    return highlights.length ? highlights : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function makeSocialPost({ event, city, regionLabel, dateLabel, sourceUrl, sourceLabel }) {
  const recommendation = recommendWeekendEvent(event, { city, date: event.date || dateLabel });
  return {
    id: `social-${slug(city)}-${event.date || dateLabel}-${slug(event.title)}`.slice(0, 220),
    region: regionLabel || city,
    city,
    title: event.title,
    theme: event.theme || '',
    headline: `${city} · ${dayLabel(event.date)}亲子精选`,
    bannerText: bannerContent(city, event.date || dateLabel, event.title),
    highlights: eventHighlights(event),
    description: event.summary || '',
    caption: makeCaption(event, city, dateLabel, sourceLabel || event.sourceLabel),
    date: event.date || '',
    dateLabel: event.dateLabel || dateLabel,
    timeLabel: event.timeLabel || '时间请以活动页面为准',
    cost: event.cost || '',
    free: event.free ?? null,
    venue: event.venue || city,
    venueAddress: event.venueAddress || '',
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    distanceMiles: event.distanceMiles ?? null,
    parentMapDescription: event.parentMapDescription || '',
    imageUrl: event.imageUrl || '',
    eventUrl: event.url || sourceUrl || '',
    sourceUrl: event.sourceUrl || sourceUrl || '',
    source: event.source || 'parentmap',
    sourceLabel: sourceLabel || event.sourceLabel || 'ParentMap',
    matchingKeywords: recommendation.matchingKeywords,
    recommendationReasons: recommendation.reasons,
    recommendationScore: recommendation.score,
    author: 'SproutCue',
    status: 'draft',
  };
}

export function makeWeeklyRoundup(posts = [], startDate = '', endDate = '') {
  const cityCount = new Set(posts.map((post) => post.city)).size;
  const highlightTitles = posts.slice(0, 2).map((post) => `「${post.title}」`).join('和');
  const highlights = posts.length
    ? `本周亮点包括${highlightTitles}，适合安排轻松又充实的亲子时光。${posts.length > 2 ? '从户外探索到社区活动，各个城市都有值得带孩子一起体验的选择。' : ''}`
    : '本周暂时没有找到已确认的活动，建议稍后再查看周末清单。';
  const formatStreetAddress = (value) => clean(value)
    .replace(/,\s*(?:United States|USA)$/i, '')
    .replace(/,\s*,+/g, ',')
    .replace(/,\s*([A-Z]{2}),\s*(\d{5}(?:-\d{4})?)$/i, ', $1 $2');
  const lines = posts.map((post) => {
    const venue = clean(post.venue);
    const address = formatStreetAddress(post.venueAddress);
    const details = [venue, address && address.toLowerCase() !== venue.toLowerCase() ? address : ''].filter(Boolean).join(' · ');
    const highlights = (post.highlights || []).slice(0, 1).map((highlight) => `亮点：${firstSentence(highlight)}`).join('；');
    return `- ${post.city}：${post.title}\n  地点：${details || post.city}\n  ${highlights}`;
  });
  return {
    title: `本周末亲子活动精选｜${cityCount}城${posts.length}场`,
    caption: `这个周末，${cityCount} 个城市都有适合家庭的活动！🌿\n\n${highlights}\n\n我们整理了 ${posts.length} 场地区亮点：\n\n${lines.join('\n\n')}\n\n收藏这份周末清单，带上家人一起出门玩吧！\n\n想让周末更轻松？来 SproutCue 找附近的 playdate、游乐场、故事时间和周末活动吧！🛝📚 创建你的家庭卡片，认识附近愿意一起玩的家庭，一起发现更多亲子时光！💛\n\n资料整理：SproutCue\n活动日期：${startDate}–${endDate}`,
    posts: posts.map((post) => ({ city: post.city, title: post.title, date: post.date, dateLabel: post.dateLabel, timeLabel: post.timeLabel, venue: post.venue, venueAddress: post.venueAddress, highlights: post.highlights, matchingKeywords: post.matchingKeywords, recommendationReasons: post.recommendationReasons, sourceLabel: post.sourceLabel, eventUrl: post.eventUrl })),
    startDate,
    endDate,
    author: 'SproutCue',
  };
}

export async function generateWeeklySocialPosts({
  regions = DEFAULT_SOCIAL_REGIONS,
  childProfile = {},
  alternateSlots = new Set(),
  excludedEventSlots = new Set(),
  forcedInputEvents = [],
  dates = [],
  venueDistanceFilter = true,
  maxDistanceMiles = DEFAULT_EVENT_DISTANCE_MILES,
  now = new Date(),
} = {}) {
  const weekend = currentWeekendRange(now);
  const requestedDates = [...new Set(dates.map((date) => clean(date)).filter(Boolean))].sort();
  const days = requestedDates.length ? requestedDates : [weekend.startDate, weekend.endDate];
  const startDate = days[0];
  const endDate = days[days.length - 1];
  const results = await Promise.all(regions.flatMap((region) => days.map(async (day) => {
    const city = clean(region.city || region.label);
    if (!city) return { region, day, fetched: null, event: null, error: 'Region city is required.' };
    const commandEvents = forcedInputEvents.filter((event) => clean(event.city).toLowerCase() === city.toLowerCase()
      && event.date === day);
    if (commandEvents.length) {
      return {
        region,
        day,
        fetched: {
          dateRangeLabel: day,
          sourceUrls: commandEvents.map((event) => event.sourceUrl || event.url).filter(Boolean),
          providerStatus: 'Command-line forced event selected.',
          fallback: false,
        },
        events: commandEvents,
        event: commandEvents[0],
        method: 'Command-line forced URL',
      };
    }
    const forcedEvents = getForcedPartnershipEvents({ city, date: day });
    try {
      const fetched = await fetchFamilyEvents({
        locationCity: city,
        startDate: day,
        endDate: day,
        childProfile,
        page: 1,
        includeParentMapCandidates: venueDistanceFilter,
      });
      const distanceResult = venueDistanceFilter
        ? await filterParentMapEventsByDistance(fetched.parentMapCandidates || [], { city, maxDistanceMiles })
        : null;
      const locationFallbackUsed = Boolean(venueDistanceFilter && !distanceResult.events.length && distanceResult.candidates.length);
      const parentMapEvents = locationFallbackUsed
        ? rankLocationFallbackCandidates(distanceResult.candidates, { city, date: day })
        : distanceResult?.events || fetched.events || [];
      const events = [...forcedEvents, ...parentMapEvents];
      const matchedEvent = bestEvent(events, { city, date: day });
      const sourceUrls = [...new Set([...forcedEvents.map((event) => event.sourceUrl), ...(fetched.sourceUrls || [])].filter(Boolean))];
      if (matchedEvent) return {
        region,
        day,
        fetched: { ...fetched, sourceUrls },
        events,
        event: matchedEvent,
        method: matchedEvent.locationFilterFallback
          ? 'ParentMap recommendation fallback'
          : matchedEvent.sourceLabel || 'Family event source',
        distanceSkipped: distanceResult?.skipped || 0,
        locationFallbackUsed: Boolean(matchedEvent.locationFilterFallback),
      };
      if (venueDistanceFilter) {
        return {
          region,
          day,
          fetched: { ...fetched, sourceUrls },
          events: [],
          event: null,
          method: 'ParentMap venue-distance filter',
          distanceSkipped: distanceResult?.skipped || 0,
          distanceError: distanceResult?.reason || '',
        };
      }
      try {
        const searched = await fetchWebSearchEvents({ city, startDate: day, endDate: day });
        const searchedEvents = [...forcedEvents, ...searched];
        const searchedEvent = bestEvent(searchedEvents, { city, date: day });
        return {
          region,
          day,
          fetched: { ...fetched, sourceUrls: [...sourceUrls, searchUrl(city, day, day)] },
          events: searchedEvents,
          event: searchedEvent,
          method: searchedEvent ? 'DuckDuckGo web search' : 'ParentMap + web search',
          searchError: searchedEvent ? '' : 'No web-search result matched.',
        };
      } catch (searchError) {
        if (forcedEvents.length) return { region, day, fetched: { ...fetched, sourceUrls }, events: forcedEvents, event: forcedEvents[0], method: 'Partnership event' };
        return { region, day, fetched, events: [], event: null, method: 'ParentMap + web search', searchError: searchError.message };
      }
    } catch (error) {
      if (forcedEvents.length) {
        return {
          region,
          day,
          fetched: { dateRangeLabel: day, sourceUrls: forcedEvents.map((event) => event.sourceUrl), providerStatus: 'Forced partnership event selected.' },
          events: forcedEvents,
          event: forcedEvents[0],
          method: 'Partnership event',
          searchError: error.message,
        };
      }
      return { region, day, fetched: null, event: null, error: error.message };
    }
  })));
  const usedEventKeys = new Set();
  const selectedResults = results.map((result) => {
    const candidates = result.events || (result.event ? [result.event] : []);
    const availableCandidates = candidates
      .filter((candidate) => {
        const exactKey = `${clean(result.region.city || result.region.label).toLowerCase()}|${result.day}|${normalizeFeedbackText(candidate.title)}`;
        const familyKey = eventFamilyKey(candidate.title);
        return !excludedEventSlots.has(exactKey) && (!familyKey || !excludedEventSlots.has(`family|${familyKey}`));
      })
      .filter((candidate) => !usedEventKeys.has(eventKey(candidate)))
      .sort((a, b) => {
        const context = { city: clean(result.region.city || result.region.label), date: result.day };
        if (a.locationFilterFallback && b.locationFilterFallback) {
          return compareLocationFallbackCandidates(a, b, context);
        }
        return eventScore(b, context) - eventScore(a, context);
      });
    const slotKey = `${clean(result.region.city || result.region.label).toLowerCase()}|${result.day}`;
    const initialEventKey = result.event ? eventKey(result.event) : '';
    // The shared usedEventKeys set applies the same no-duplicate rule to
    // replacement events as it does to the normal weekend selections.
    const event = alternateSlots.has(slotKey)
      ? availableCandidates.find((candidate) => eventKey(candidate) !== initialEventKey) || null
      : availableCandidates[0] || null;
    if (event) usedEventKeys.add(eventKey(event));
    return { ...result, event, duplicateSkipped: Boolean(result.events?.length) && !event };
  });
  const posts = selectedResults
    .filter(({ event }) => event)
    .map(({ region, fetched, event }) => makeSocialPost({
      event,
      city: clean(region.city || region.label),
      regionLabel: clean(region.label || region.city),
      dateLabel: fetched.dateRangeLabel,
      sourceUrl: event.sourceUrl || event.url || fetched.sourceUrls?.[0],
      sourceLabel: event.sourceLabel,
    }));
  const enrichedPosts = await Promise.all(posts.map(async (post) => {
    let description = post.parentMapDescription || post.description;
    let venue = post.venue;
    let venueAddress = post.venueAddress;
    if (!post.parentMapDescription) {
      try {
        const details = await fetchParentMapEventDetails(post.eventUrl);
        description = details.description || description;
        venue = details.venue?.name || venue;
        venueAddress = details.venue?.address || venueAddress;
      } catch {
        // Keep the calendar summary when an event detail page is unavailable.
      }
    }
    const aiHighlights = await generateAiHighlights({ ...post, description });
    return {
      ...post,
      description,
      venue,
      venueAddress,
      highlights: aiHighlights || eventHighlights({ ...post, summary: description, theme: post.theme }),
      highlightSource: aiHighlights ? 'openai' : 'local-fallback',
    };
  }));
  const roundup = makeWeeklyRoundup(enrichedPosts, startDate, endDate);
  return {
    id: `weekly-${startDate}`,
    weekKey: startDate,
    startDate,
    endDate,
    regions: regions.map((region) => clean(region.city || region.label)).filter(Boolean),
    posts: enrichedPosts,
    roundup,
    source: posts.some((post) => post.source !== 'parentmap') ? 'mixed' : 'parentmap',
    searchMode: forcedInputEvents.length ? 'forced-url' : venueDistanceFilter ? 'parentmap-venue-distance' : 'normal',
    maxDistanceMiles: venueDistanceFilter ? Number(maxDistanceMiles) : null,
    slotCount: regions.length * days.length,
    generatedAt: new Date().toISOString(),
    statuses: selectedResults.map(({ region, day, fetched, event, error, method, searchError, duplicateSkipped, distanceSkipped, distanceError }) => ({
      city: clean(region.city || region.label),
      day,
      matched: Boolean(event),
      fallback: fetched?.fallback ?? false,
      providerStatus: event
        ? `${event.locationFilterFallback ? 'ParentMap recommendation fallback' : method || event.sourceLabel || 'Family event source'} result selected.${event.locationFilterFallback ? ` No event was within ${Number(maxDistanceMiles)} miles; selected the highest recommendation score, using nearest distance to break ties.` : ''}${venueDistanceFilter && event.source === 'parentmap' ? ` Venue is ${event.distanceMiles} miles from ${clean(region.city || region.label)}.` : ''}`
        : venueDistanceFilter
          ? `${distanceError || `No ParentMap event with a geocodable venue was within ${Number(maxDistanceMiles)} miles.`}${distanceSkipped ? ` Skipped ${distanceSkipped} ParentMap candidate${distanceSkipped === 1 ? '' : 's'}.` : ''}`
          : `${duplicateSkipped ? 'Duplicate event skipped across the weekend.' : (fetched?.providerStatus || error || 'No matching event found.')}${searchError ? ` Web search: ${searchError}` : ''}`,
      sourceUrl: event?.sourceUrl || event?.url || fetched?.sourceUrls?.[0] || '',
    })),
  };
}

export async function generateSocialPostsFromRecommendationUrl({ url, now = new Date() } = {}, options = {}) {
  const events = await fetchEventRecommendationsFromUrl({ url, now }, options);
  const usableEvents = events.filter((event) => event.city && event.date && event.title);
  if (!usableEvents.length) throw new Error('No dated event recommendations with locations were found on the page.');
  const posts = usableEvents.map((event) => makeSocialPost({
    event,
    city: event.city,
    regionLabel: event.city,
    dateLabel: event.dateLabel,
    sourceUrl: event.sourceUrl || event.url,
    sourceLabel: event.sourceLabel || 'ParentMap',
  }));
  const enrichedPosts = await Promise.all(posts.map(async (post) => {
    const highlights = await generateAiHighlights(post);
    return {
      ...post,
      highlights: highlights || eventHighlights({ ...post, summary: post.description, theme: post.theme }),
      highlightSource: highlights ? 'openai' : 'local-fallback',
    };
  }));
  const dates = usableEvents.map((event) => event.date).sort();
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const sourceUrl = new URL(url).href;
  return {
    id: `recommendations-${startDate}`,
    weekKey: startDate,
    startDate,
    endDate,
    regions: [...new Set(usableEvents.map((event) => event.city))],
    posts: enrichedPosts,
    roundup: makeWeeklyRoundup(enrichedPosts, startDate, endDate),
    source: 'parentmap',
    sourceUrl,
    searchMode: 'recommendations-url',
    maxDistanceMiles: null,
    slotCount: usableEvents.length,
    generatedAt: new Date().toISOString(),
    statuses: usableEvents.map((event) => ({
      city: event.city,
      day: event.date,
      matched: true,
      fallback: false,
      providerStatus: event.resolutionError
        ? `Recommendation imported; canonical event URL could not be resolved: ${event.resolutionError}`
        : 'Recommendation imported from the supplied page and resolved to its event page.',
      sourceUrl: event.sourceUrl || event.url,
    })),
  };
}
