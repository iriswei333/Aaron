const STORY_TIME_CACHE_TTL_HOURS = 6;
const STORY_TIME_LIMIT = 40;
const SPL_ICAL_URL = 'https://www.trumba.com/calendars/kalendaro.ics?filter2=_1770646_&filterfield2=60861';
const SPL_PAGE_URL = 'https://www.spl.org/programs-and-services/fun-and-games/story-time/story-time-calendar';
const KCLS_EVENTS_URL = 'https://kcls.bibliocommons.com/v2/events?types=56a93a3efa6b611f62020111%2C56e76b62414af7d25900d917%2C5679e09452c7b9de5c012125';
const SPL_BRANCH_COORDINATES = [
  ['central library', 47.6067, -122.3325],
  ['greenwood branch', 47.6905, -122.3553],
  ['ballard branch', 47.6687, -122.3847],
  ['fremont branch', 47.6496, -122.3496],
  ['queen anne branch', 47.6383, -122.3575],
  ['wallingford branch', 47.6615, -122.3348],
  ['northeast branch', 47.6784, -122.2905],
  ['lake city branch', 47.7191, -122.2958],
  ['west seattle branch', 47.5608, -122.3875],
  ['columbia branch', 47.5593, -122.2861],
  ['beacon hill branch', 47.5793, -122.3113],
];

function cleanText(value, maxLength = 240) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function htmlToText(value, maxLength = 240) {
  return cleanText(decode(value), maxLength);
}

function decode(value) {
  return String(value || '')
    // Some calendar exports escape the entity terminator as `\\;`.
    .replace(/&#(\d+)\\*;/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+)\\*;/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function isoDate(value) {
  const match = String(value || '').match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function formatDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatIcalDate(value) {
  const match = String(value || '').match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!match[4]) return { date, timeLabel: '' };
  const hour = Number(match[4]);
  const minute = match[5];
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  return { date, timeLabel: `${hour % 12 || 12}:${minute} ${suffix}` };
}

function branchCoordinates(location) {
  const normalized = String(location || '').toLowerCase();
  const match = SPL_BRANCH_COORDINATES.find(([name]) => normalized.includes(name));
  return match ? { latitude: match[1], longitude: match[2] } : null;
}

function distanceMiles(origin, destination) {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(destination.latitude - origin.latitude);
  const dLon = radians(destination.longitude - origin.longitude);
  const lat1 = radians(origin.latitude);
  const lat2 = radians(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function unfoldIcal(text) {
  return String(text || '').replace(/\r?\n[ \t]/g, '');
}

function parseIcalEvents(text, sourceUrl) {
  return unfoldIcal(text).split(/BEGIN:VEVENT/i).slice(1).map((block) => {
    const field = (name) => block.match(new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:([^\\n]*)`, 'i'))?.[1] || '';
    const start = formatIcalDate(field('DTSTART'));
    if (!start) return null;
    const title = decode(field('SUMMARY'));
    const url = decode(field('URL')) || SPL_PAGE_URL;
    const location = decode(field('LOCATION'));
    const coordinates = branchCoordinates(location);
    return {
      id: `spl-${decode(field('UID')) || `${title}-${start.date}`}`,
      title: cleanText(title || 'Story Time', 180),
      summary: 'Stories, songs, rhymes, and early learning activities for young children and caregivers.',
      date: start.date,
      dateLabel: formatDate(start.date),
      timeLabel: start.timeLabel,
      venue: cleanText(location, 160),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      url,
      source: 'spl',
      sourceLabel: 'Seattle Public Library',
      sourceUrl,
      free: true,
      tags: ['Story Time', 'Seattle'],
    };
  }).filter(Boolean);
}

function parseJsonLd(html, sourceUrl, source) {
  const scripts = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const nodes = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((node) => node?.['@graph'] || node).filter(Boolean);
      for (const node of nodes) {
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (!types.includes('Event') || !/story\s*time|storytime|early\s*learning/i.test(`${node.name} ${node.description}`)) continue;
        const date = isoDate(node.startDate);
        if (!date) continue;
        const location = typeof node.location === 'string' ? node.location : [node.location?.name, node.location?.address?.addressLocality].filter(Boolean).join(', ');
        events.push({
          id: `${source}-${node.identifier || node.url || node.name}-${date}`,
          title: cleanText(node.name || 'Story Time', 180),
          summary: cleanText(node.description || 'Stories, songs, rhymes, and early learning activities.', 220),
          date, dateLabel: formatDate(date),
          timeLabel: node.startDate?.match(/T(\d{2}:\d{2})/)?.[1] || '',
          venue: cleanText(location, 160),
          latitude: source === 'spl' ? branchCoordinates(location)?.latitude ?? null : null,
          longitude: source === 'spl' ? branchCoordinates(location)?.longitude ?? null : null,
          url: node.url || sourceUrl, source, sourceLabel: source === 'kcls' ? 'King County Library System' : 'Seattle Public Library', sourceUrl,
          free: true, tags: ['Story Time'],
        });
      }
    } catch { /* Ignore malformed JSON-LD and keep parsing other blocks. */ }
  }
  return events;
}

function parseKclsEvents(html, sourceUrl) {
  const jsonEvents = parseJsonLd(html, sourceUrl, 'kcls');
  const markup = String(html || '');
  const locationNames = [...markup.matchAll(/<div[^>]+class=["'][^"']*cp-event-location-name[^"']*["'][^>]*>[\s\S]*?<\/div>/gi)]
    .map((match) => {
      const visibleName = match[0].match(/<span[^>]+aria-hidden=["']true["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || match[0];
      return htmlToText(visibleName, 160).replace(/^Event location:\s*/i, '');
    })
    .filter(Boolean);
  const blocks = markup.match(/<(?:article|li)[^>]*>[\s\S]*?<\/(?:article|li)>/gi)
    || markup.match(/<div[^>]+class=["'][^"']*event-details[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*event-details|$)/gi)
    || [];
  const cardEvents = blocks.map((block) => {
    const titleMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/i);
    const title = cleanText(decode(block.match(/<(?:h2|h3|h4)[^>]*>([\s\S]*?)<\/(?:h2|h3|h4)>/i)?.[1] || ''));
    const numericDate = isoDate(block.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/)?.[1]);
    const monthDate = block.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\b/i);
    const monthNumber = monthDate ? String(new Date(`${monthDate[1]} 1, 2000`).getMonth() + 1).padStart(2, '0') : '';
    const date = numericDate || (monthDate ? `${new Date().getFullYear()}-${monthNumber}-${String(monthDate[2]).padStart(2, '0')}` : '');
    if (!title || !date || !/story\s*time|storytime/i.test(`${title} ${block}`)) return null;
    const href = decode(titleMatch?.[1] || sourceUrl);
    const locationBlock = block.match(/<div[^>]+class=["'][^"']*cp-event-location-name[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0] || '';
    const locationVisibleName = locationBlock.match(/<span[^>]+aria-hidden=["']true["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || locationBlock;
    const venue = htmlToText(locationVisibleName, 160)
      .replace(/^Event location:\s*/i, '')
      || cleanText(block.match(/(?:Event location|Location)[^<]{0,80}/i)?.[0] || '');
    return { id: `kcls-${title}-${date}`, title, summary: 'Stories, music, movement, and rhymes that support early literacy.', date, dateLabel: formatDate(date), timeLabel: cleanText(block.match(/\b\d{1,2}:\d{2}\s*(?:a\.m\.|p\.m\.|AM|PM)/i)?.[0] || ''), venue, url: href.startsWith('/') ? `https://kcls.bibliocommons.com${href}` : href, source: 'kcls', sourceLabel: 'King County Library System', sourceUrl, free: true, tags: ['Story Time', 'King County'] };
  }).filter(Boolean);
  const normalizedCardEvents = cardEvents.map((event, index) => ({
    ...event,
    venue: event.venue && !/[<>]|location-name["']?\s*>/i.test(event.venue)
      ? event.venue
      : locationNames[index] || '',
  }));
  return [...jsonEvents, ...normalizedCardEvents];
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { accept: 'text/html, text/calendar, application/xhtml+xml', 'user-agent': 'SproutCue story-time-cache' }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Story time source returned ${response.status}.`);
  return response.text();
}

function inRange(events, startDate, endDate) {
  const seen = new Set();
  return events.filter((event) => event.date >= startDate && event.date <= endDate).filter((event) => {
    const key = `${event.source}|${event.url}|${event.date}|${event.timeLabel}|${event.venue}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => `${a.date} ${a.timeLabel}`.localeCompare(`${b.date} ${b.timeLabel}`));
}

function isStoryTime(event) {
  return /story\s*time|storytime/i.test(`${event.title} ${(event.tags || []).join(' ')}`)
    && !/closed|closure|notary|holiday hours|board meeting/i.test(event.title || '');
}

export function storyTimeCacheKey({ locationCity, startDate, endDate, latitude = null, longitude = null, radiusMiles = null }) {
  const coordinates = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    ? `:${Number(latitude).toFixed(2)}:${Number(longitude).toFixed(2)}:${Number(radiusMiles || 0).toFixed(1)}`
    : '';
  return `story-times-v2:${String(locationCity || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${startDate}:${endDate}${coordinates}`;
}

export function storyTimeExpiresAt(now = new Date()) {
  return new Date(now.getTime() + STORY_TIME_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function fetchStoryTimes({ locationCity, startDate, endDate, latitude = null, longitude = null, radiusMiles = 5 }) {
  const isSeattle = /seattle|west\s+seattle|ballard|capitol\s+hill|queen\s+anne/i.test(locationCity || '');
  const sources = isSeattle ? [{ source: 'spl', url: SPL_ICAL_URL, parse: (text) => parseIcalEvents(text, SPL_PAGE_URL) }] : [{ source: 'kcls', url: KCLS_EVENTS_URL, parse: (text) => parseKclsEvents(text, KCLS_EVENTS_URL) }];
  const results = await Promise.allSettled(sources.map(async (item) => item.parse(await fetchText(item.url))));
  let events = inRange(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []), startDate, endDate).filter(isStoryTime);
  if (isSeattle && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
    const origin = { latitude: Number(latitude), longitude: Number(longitude) };
    events = events
      .map((event) => ({ ...event, distanceMiles: event.latitude !== null && event.longitude !== null ? distanceMiles(origin, event) : null }))
      .filter((event) => event.distanceMiles === null || event.distanceMiles <= radiusMiles)
      .sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999) || `${a.date} ${a.timeLabel}`.localeCompare(`${b.date} ${b.timeLabel}`));
  }
  events = events.slice(0, STORY_TIME_LIMIT);
  const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message || 'Could not load story times.');
  return { locationCity, startDate, endDate, source: isSeattle ? 'spl' : 'kcls', sourceLabel: isSeattle ? 'Seattle Public Library' : 'King County Library System', sourceUrls: sources.map((item) => item.url), events, fallback: events.length === 0, providerStatus: errors.length ? errors.join(' ') : `Updated from ${isSeattle ? 'Seattle Public Library' : 'King County Library System'}.`, errors };
}
