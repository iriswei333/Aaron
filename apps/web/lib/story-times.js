import { parseParentMapEvents, parseParentMapEventVenue, parseParentMapEventWebsite } from './family-events.js';

const STORY_TIME_CACHE_TTL_HOURS = 24;
const SPL_ICAL_URL = 'https://www.trumba.com/calendars/kalendaro.ics?filter2=_1770646_&filterfield2=60861';
const SPL_PAGE_URL = 'https://www.spl.org/programs-and-services/fun-and-games/story-time/story-time-calendar';
const KCLS_EVENTS_URL = 'https://kcls.bibliocommons.com/v2/events?types=56a93a3efa6b611f62020111%2C56e76b62414af7d25900d917%2C5679e09452c7b9de5c012125';
const PARENTMAP_STORY_TIME_URL = 'https://www.parentmap.com/calendar/?search=story+time';
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
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

function isoDate(value) {
  const match = String(value || '').match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function formatDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatIsoTime(value) {
  const match = String(value || '').match(/T(\d{2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'p.m.' : 'a.m.'}`;
}

function jsonLdEventNodes(html) {
  const scripts = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const candidates = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((node) => node?.['@graph'] || node).filter(Boolean);
      nodes.push(...candidates.filter((node) => {
        const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
        return types.includes('Event');
      }));
    } catch { /* Ignore malformed JSON-LD and use the calendar-card fields. */ }
  }
  return nodes;
}

function parentMapImage(node) {
  if (typeof node?.image === 'string') return node.image;
  return node?.image?.url || node?.image?.contentUrl || '';
}

export function parseParentMapStoryTimeResults(html, requestedDate, sourceUrl = PARENTMAP_STORY_TIME_URL) {
  const virtualUrls = new Set();
  const listMatch = String(html || '').match(/<ul class=["']wp-block-post-template[\s\S]*?<\/ul>/i);
  const blocks = (listMatch?.[0] || String(html || '')).match(/<li class=["']wp-block-post [\s\S]*?<\/li>/gi) || [];
  for (const block of blocks) {
    const className = block.match(/<li class=["']([^"']*)/i)?.[1] || '';
    if (!/\btribe-events-virtual-event\b/i.test(className) && !/>\s*Virtual\s*</i.test(block)) continue;
    const href = decode(block.match(/<h3[^>]*wp-block-post-title[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)/i)?.[1] || '');
    if (href) virtualUrls.add(href);
  }

  return parseParentMapEvents(html, requestedDate, sourceUrl)
    .filter((event) => !virtualUrls.has(event.url))
    .filter(isStoryTime)
    .map((event) => ({
      ...event,
      summary: event.summary || 'A local story-time event for children and caregivers.',
      source: 'parentmap',
      sourceLabel: 'ParentMap',
      sourceUrl,
      tags: [...new Set(['Story Time', ...(event.tags || [])])],
    }));
}

export function parseParentMapStoryTimeEventPage(html, eventUrl = '') {
  const event = jsonLdEventNodes(html)[0] || null;
  const attendanceMode = String(event?.eventAttendanceMode || '');
  const venue = parseParentMapEventVenue(html);
  const startDate = String(event?.startDate || '');
  const endDate = String(event?.endDate || '');
  const startTime = formatIsoTime(startDate);
  const endTime = formatIsoTime(endDate);
  const address = event?.location?.address || {};
  const structuredAddress = typeof address === 'string' ? address : [
    address.streetAddress,
    address.addressLocality,
    [address.addressRegion, address.postalCode].filter(Boolean).join(' '),
    address.addressCountry,
  ].filter(Boolean).join(', ');
  return {
    virtual: /OnlineEventAttendanceMode/i.test(attendanceMode),
    date: isoDate(startDate),
    dateLabel: isoDate(startDate) ? formatDate(isoDate(startDate)) : '',
    timeLabel: startTime && endTime ? `${startTime}–${endTime}` : startTime,
    venue: cleanText(event?.location?.name || venue?.name, 160),
    address: cleanText(venue?.address || structuredAddress, 360),
    imageUrl: parentMapImage(event),
    websiteUrl: eventUrl ? parseParentMapEventWebsite(html, eventUrl) : '',
  };
}

async function fetchParentMapStoryTimes(startDate) {
  const html = await fetchText(PARENTMAP_STORY_TIME_URL);
  const candidates = parseParentMapStoryTimeResults(html, startDate, PARENTMAP_STORY_TIME_URL);
  const detailed = await Promise.all(candidates.map(async (event) => {
    try {
      const detail = parseParentMapStoryTimeEventPage(await fetchText(event.url), event.url);
      if (detail.virtual) return null;
      return {
        ...event,
        date: detail.date || event.date,
        dateLabel: detail.dateLabel || event.dateLabel,
        timeLabel: detail.timeLabel || event.timeLabel,
        venue: detail.venue || event.venue,
        address: detail.address,
        imageUrl: detail.imageUrl || event.imageUrl,
        listingUrl: event.url,
        url: detail.websiteUrl || event.url,
      };
    } catch {
      return event;
    }
  }));
  return detailed.filter(Boolean);
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

function unfoldIcal(text) {
  return String(text || '').replace(/\r?\n[ \t]/g, '');
}

function splEventUrl(eventId) {
  return eventId
    ? `${SPL_PAGE_URL}?trumbaEmbed=${encodeURIComponent(`view=event&eventid=${eventId}`)}`
    : SPL_PAGE_URL;
}

function descriptionEventUrl(description) {
  const html = decode(description);
  const descriptionBlock = html.match(/<[^>]+class=["'][^"']*\btwDescription\b[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i)?.[0] || html;
  const href = descriptionBlock.match(/href=["']([^"']+)["']/i)?.[1] || '';
  if (!href) return '';
  try {
    const url = new URL(href, SPL_PAGE_URL);
    return /^https?:$/i.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function parseIcalEvents(text, sourceUrl) {
  return unfoldIcal(text).split(/BEGIN:VEVENT/i).slice(1).map((block) => {
    const field = (name) => block.match(new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:([^\\n]*)`, 'i'))?.[1] || '';
    const start = formatIcalDate(field('DTSTART'));
    if (!start) return null;
    const title = decode(field('SUMMARY'));
    const feedUrl = decode(field('URL'));
    const descriptionUrl = descriptionEventUrl(field('DESCRIPTION'));
    const eventId = decode(field('X-TRUMBA-EVENTID') || field('X-TRUMBA-EVENT-ID'));
    const url = descriptionUrl || feedUrl || (eventId ? splEventUrl(eventId) : SPL_PAGE_URL);
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

function kclsEventsUrl(startDate, endDate, page = 1) {
  const url = new URL(KCLS_EVENTS_URL);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

function kclsPageCount(html) {
  const pages = [...String(html || '').matchAll(/[?&](?:amp;)?page=(\d+)/gi)].map((match) => Number(match[1]));
  return Math.min(20, Math.max(1, ...pages.filter(Number.isFinite)));
}

async function fetchKclsStoryTimes(startDate, endDate) {
  const sourceUrl = kclsEventsUrl(startDate, endDate);
  const firstPage = await fetchText(sourceUrl);
  const pageCount = kclsPageCount(firstPage);
  const remaining = await Promise.allSettled(Array.from({ length: pageCount - 1 }, async (_, index) => {
    const pageUrl = kclsEventsUrl(startDate, endDate, index + 2);
    return parseKclsEvents(await fetchText(pageUrl), pageUrl);
  }));
  return [
    ...parseKclsEvents(firstPage, sourceUrl),
    ...remaining.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
  ];
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

// Library feeds reuse one id for every session of a program on the same day (e.g. "Pajama Story Time"
// at several KCLS branches). The first keeps its id so saved plans still match; later ones get the
// time and branch added, which keeps ids unique for saved plans and list keys.
export function withUniqueStoryTimeIds(events = []) {
  const used = new Set();
  return events.map((event) => {
    let id = String(event.id || '');
    if (id && used.has(id)) {
      const base = [id, event.timeLabel, event.venue].filter(Boolean).join('-');
      id = base;
      for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    }
    used.add(id);
    return id === event.id ? event : { ...event, id };
  });
}

function isStoryTime(event) {
  return /story\s*time|storytime|story\s*walk/i.test(`${event.title} ${(event.tags || []).join(' ')}`)
    && !/closed|closure|notary|holiday hours|board meeting/i.test(event.title || '');
}

export function storyTimeCacheKey({ startDate, endDate }) {
  return `story-times-v9:all-libraries:${startDate}:${endDate}`;
}

export function storyTimeExpiresAt(now = new Date()) {
  return new Date(now.getTime() + STORY_TIME_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function fetchStoryTimes({ startDate, endDate }) {
  const kclsSourceUrl = kclsEventsUrl(startDate, endDate);
  const sources = [
    { source: 'spl', url: SPL_ICAL_URL, parse: (text) => parseIcalEvents(text, SPL_PAGE_URL) },
    { source: 'kcls', url: kclsSourceUrl },
    { source: 'parentmap', url: PARENTMAP_STORY_TIME_URL },
  ];
  const results = await Promise.allSettled([
    fetchText(sources[0].url).then(sources[0].parse),
    fetchKclsStoryTimes(startDate, endDate),
    fetchParentMapStoryTimes(startDate),
  ]);
  const events = withUniqueStoryTimeIds(inRange(results.flatMap((result) => result.status === 'fulfilled' ? result.value : []), startDate, endDate).filter(isStoryTime));
  const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message || 'Could not load story times.');
  const sourceLabel = 'Seattle Public Library + King County Library System + ParentMap';
  return { locationCity: 'Seattle and King County', startDate, endDate, source: 'spl+kcls+parentmap', sourceLabel, sourceUrls: sources.map((item) => item.url), events, fallback: events.length === 0, providerStatus: errors.length ? errors.join(' ') : `Updated from ${sourceLabel}.`, errors };
}
