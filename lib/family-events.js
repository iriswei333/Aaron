const FAMILY_EVENT_CACHE_TTL_HOURS = 12;
const FAMILY_EVENT_LIMIT = 8;
const FAMILY_EVENT_PAGE_COUNT = 5;
const FAMILY_EVENT_CANDIDATE_LIMIT = FAMILY_EVENT_LIMIT * FAMILY_EVENT_PAGE_COUNT;
const PARENTMAP_CALENDAR_URL = 'https://www.parentmap.com/calendar/';
const SEATTLES_CHILD_CALENDAR_URL = 'https://www.seattleschild.com/calendar/';
const PARENTMAP_CATEGORIES = [
  'play-recreation',
  'festivals-community',
  'seasonal-holiday',
  'arts-culture',
  'education-learning',
];
const PUGET_SOUND_REGIONS = new Map([
  ['seattle', 'seattle'],
  ['west seattle', 'seattle'],
  ['ballard', 'seattle'],
  ['capitol hill', 'seattle'],
  ['queen anne', 'seattle'],
  ['bellevue', 'eastside'],
  ['redmond', 'eastside'],
  ['kirkland', 'eastside'],
  ['issaquah', 'eastside'],
  ['sammamish', 'eastside'],
  ['mercer island', 'eastside'],
  ['bothell', 'eastside'],
  ['woodinville', 'eastside'],
  ['newcastle', 'eastside'],
  ['renton', 'south-sound'],
  ['kent', 'south-sound'],
  ['auburn', 'south-sound'],
  ['tukwila', 'south-sound'],
  ['federal way', 'south-sound'],
  ['tacoma', 'south-sound'],
  ['olympia', 'south-sound'],
  ['puyallup', 'south-sound'],
  ['everett', 'north-sound'],
  ['lynnwood', 'north-sound'],
  ['edmonds', 'north-sound'],
  ['shoreline', 'north-sound'],
  ['mukilteo', 'north-sound'],
  ['mill creek', 'north-sound'],
  ['marysville', 'north-sound'],
]);

const MONTHS = new Map([
  ['january', '01'],
  ['february', '02'],
  ['march', '03'],
  ['april', '04'],
  ['may', '05'],
  ['june', '06'],
  ['july', '07'],
  ['august', '08'],
  ['september', '09'],
  ['october', '10'],
  ['november', '11'],
  ['december', '12'],
]);

const HTML_ENTITIES = {
  amp: '&',
  apos: "'",
  hellip: '...',
  ldquo: '"',
  lsquo: "'",
  mdash: '-',
  ndash: '-',
  nbsp: ' ',
  quot: '"',
  rdquo: '"',
  rsquo: "'",
};

function cleanText(value, maxLength = 220) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function slugify(value, maxLength = 120) {
  return cleanText(value, maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => HTML_ENTITIES[entity.toLowerCase()] ?? match);
}

function htmlToText(fragment, maxLength = 220) {
  return cleanText(
    decodeHtml(String(fragment || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')),
    maxLength,
  );
}

function validDateString(value) {
  const text = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return text;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(startDate, endDate) {
  const dates = [];
  let cursor = startDate;
  while (cursor <= endDate && dates.length < 7) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateStringFromLocalDate(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function monthDayLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateRangeLabel(startDate, endDate) {
  if (startDate === endDate) return monthDayLabel(startDate);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${monthDayLabel(startDate)}-${monthDayLabel(endDate)}${sameYear ? '' : `, ${end.getFullYear()}`}`;
}

function seattlesChildDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}-${date.getFullYear()}`;
}

export function familyEventDateRangeLabel(startDate, endDate) {
  return dateRangeLabel(startDate, endDate);
}

export function currentWeekendRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  if (day === 0) {
    start.setDate(start.getDate() - 1);
  } else {
    start.setDate(start.getDate() + ((6 - day + 7) % 7));
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    startDate: dateStringFromLocalDate(start),
    endDate: dateStringFromLocalDate(end),
  };
}

function looksLikeStreetAddress(value) {
  return /^\d+\s+/.test(value) || /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane)\b/i.test(value);
}

function cityFromText(value) {
  const text = cleanText(value, 160);
  if (!text) return '';
  const parts = text.split(',').map((part) => cleanText(part, 80)).filter(Boolean);
  if (parts.length >= 2 && looksLikeStreetAddress(parts[0])) return parts[1];
  // Onboarding commonly stores a neighborhood plus city (for example,
  // "Capitol Hill, Seattle"). Prefer the known city component so the
  // provider receives a supported region instead of the neighborhood label.
  const knownCity = parts
    .slice()
    .reverse()
    .find((part) => PUGET_SOUND_REGIONS.has(part.toLowerCase()));
  if (knownCity) return knownCity;
  const embeddedCity = [...PUGET_SOUND_REGIONS.keys()]
    .sort((a, b) => b.length - a.length)
    .find((city) => text.toLowerCase().includes(city));
  if (embeddedCity) return embeddedCity.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return parts[0] || '';
}

function isGenericLocationLabel(value) {
  return ['current location', 'manual location', 'saved location', 'home'].includes(
    cleanText(value, 80).toLowerCase(),
  );
}

function cityFromCoordinates(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';

  // ParentMap exposes Puget Sound regions rather than neighborhood-level
  // coordinates. Use the nearest supported city for coordinate-only saves.
  const knownCities = [
    ['Seattle', 47.6062, -122.3321],
    ['Bellevue', 47.6101, -122.2015],
    ['Tacoma', 47.2529, -122.4443],
    ['Everett', 47.9789, -122.2021],
    ['Olympia', 47.0379, -122.9007],
  ];
  const milesPerDegreeLat = 69;
  const nearest = knownCities
    .map(([city, cityLatitude, cityLongitude]) => {
      const miles = Math.sqrt(
        ((latitude - cityLatitude) * milesPerDegreeLat) ** 2
        + ((longitude - cityLongitude) * milesPerDegreeLat * Math.cos(latitude * Math.PI / 180)) ** 2,
      );
      return { city, miles };
    })
    .sort((a, b) => a.miles - b.miles)[0];
  return nearest && nearest.miles <= 35 ? nearest.city : '';
}

export function familyEventCityForUser(user, requestedLocation = '') {
  const requestedCity = cityFromText(requestedLocation);
  if (requestedCity && !isGenericLocationLabel(requestedLocation)) return requestedCity;

  const savedLocation = user?.location;
  const savedLocationText = savedLocation && typeof savedLocation === 'object'
    ? savedLocation.address || (savedLocation.source === 'browser-geolocation' ? '' : savedLocation.label)
    : savedLocation;
  const savedCity = savedLocation && typeof savedLocation === 'object'
    ? cleanText(savedLocation.city || savedLocation.locality || savedLocation.town, 80)
      || cityFromText(savedLocationText)
    : cityFromText(savedLocationText);
  if (savedCity && !isGenericLocationLabel(savedCity)) return savedCity;

  const coordinateCity = cityFromCoordinates(savedLocation);
  if (coordinateCity) return coordinateCity;

  const childProfile = user?.childProfile;
  const children = Array.isArray(childProfile?.children) ? childProfile.children : [];
  const activeChild = children.find((child) => child.id && child.id === childProfile?.activeChildId) || children[0] || null;
  return cleanText(activeChild?.homeCity, 80);
}

function locationZipForUser(user, requestedLocation = '') {
  const requestedZip = String(requestedLocation || '').match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  if (requestedZip) return requestedZip.slice(0, 5);
  const savedLocation = user?.location;
  const savedText = savedLocation && typeof savedLocation === 'object'
    ? [savedLocation.postalCode, savedLocation.zip, savedLocation.zipCode, savedLocation.address].filter(Boolean).join(' ')
    : savedLocation;
  return String(savedText || '').match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) || '';
}

export function normalizeFamilyEventRequest(user, searchParams = new URLSearchParams()) {
  const requestedRange = currentWeekendRange();
  const startDate = validDateString(searchParams.get('start')) || requestedRange.startDate;
  const endDate = validDateString(searchParams.get('end')) || requestedRange.endDate;
  const orderedStart = startDate <= endDate ? startDate : endDate;
  const orderedEnd = startDate <= endDate ? endDate : startDate;
  const locationCity = familyEventCityForUser(user, searchParams.get('location') || '');
  return {
    locationCity,
    locationZip: locationZipForUser(user, searchParams.get('location') || ''),
    startDate: orderedStart,
    endDate: orderedEnd,
  };
}

function regionForCity(city) {
  const normalized = cleanText(city, 80).toLowerCase();
  if (!normalized) return '';
  if (PUGET_SOUND_REGIONS.has(normalized)) return PUGET_SOUND_REGIONS.get(normalized);
  const matched = [...PUGET_SOUND_REGIONS.entries()].find(([knownCity]) => normalized.includes(knownCity));
  return matched?.[1] || '';
}

function ageSlugsForChild(childProfile = {}) {
  const birthday = childProfile.birthday ? new Date(`${childProfile.birthday}T00:00:00`) : null;
  if (birthday && !Number.isNaN(birthday.getTime())) {
    const now = new Date();
    let years = now.getFullYear() - birthday.getFullYear();
    if (
      now.getMonth() < birthday.getMonth()
      || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate())
    ) {
      years -= 1;
    }
    if (years < 1) return ['baby', 'toddlers-preschoolers', 'all-ages'];
    if (years <= 4) return ['toddlers-preschoolers', 'all-ages'];
    if (years <= 10) return ['elementary', 'all-ages'];
    return ['tweens-teens', 'all-ages'];
  }

  const label = cleanText(childProfile.ageLabel, 32).toLowerCase();
  const yearMatch = label.match(/(\d+)\s*y/);
  const years = yearMatch ? Number(yearMatch[1]) : null;
  if (years !== null) {
    if (years < 1) return ['baby', 'toddlers-preschoolers', 'all-ages'];
    if (years <= 4) return ['toddlers-preschoolers', 'all-ages'];
    if (years <= 10) return ['elementary', 'all-ages'];
    return ['tweens-teens', 'all-ages'];
  }
  return ['toddlers-preschoolers', 'elementary', 'all-ages'];
}

function titleDateFromHref(href) {
  const match = href.match(/\/(\d{4}-\d{2}-\d{2})\/?$/);
  return match?.[1] || '';
}

function isDateLabel(value) {
  return /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s+[a-z]+\s+\d{1,2}$/i.test(value);
}

function isTimeLabel(value) {
  return /\d/.test(value) && /(a\.m\.|p\.m\.|\bam\b|\bpm\b)/i.test(value);
}

function parseDateTimeParagraph(value) {
  const text = cleanText(value, 180);
  const match = text.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+\.?\s+\d{1,2})(?:\s*@\s*(.+))?$/i);
  if (!match) return null;
  return {
    dateLabel: `${match[1]}, ${match[2]}`,
    timeLabel: cleanText(match[3] || '', 80),
  };
}

function isoDateFromDateLabel(label, fallbackDate) {
  const match = cleanText(label, 80).match(/([a-z]+)\.?\s+(\d{1,2})$/i);
  if (!match) return fallbackDate;
  const month = MONTHS.get(match[1].toLowerCase());
  if (!month) return fallbackDate;
  const year = fallbackDate.slice(0, 4);
  return `${year}-${month}-${padDatePart(match[2])}`;
}

function classSlugs(classAttr, prefix) {
  const matcher = new RegExp(`\\b${prefix}-([a-z0-9-]+)\\b`, 'g');
  return [...classAttr.matchAll(matcher)].map((match) => match[1]);
}

function formatIsoTime(isoDate) {
  const match = String(isoDate || '').match(/T(\d{2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

function formatIsoDateLabel(isoDate, fallbackDate) {
  const date = validDateString(String(isoDate || '').slice(0, 10)) || fallbackDate;
  if (!date) return '';
  const localDate = new Date(`${date}T12:00:00`);
  const weekday = localDate.toLocaleDateString('en-US', { weekday: 'long' });
  const month = localDate.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month}. ${Number(date.slice(8, 10))}`;
}

function parseParentMapStructuredEvents(html, requestedDate, sourceUrl) {
  const scripts = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const eventNodes = nodes.flatMap((node) => node?.['@graph'] || node).filter((node) => {
        const type = node?.['@type'];
        return type === 'Event' || (Array.isArray(type) && type.includes('Event'));
      });
      for (const node of eventNodes) {
        const startDate = String(node.startDate || '');
        const endDate = String(node.endDate || '');
        const eventDate = validDateString(startDate.slice(0, 10)) || requestedDate;
        const startTime = formatIsoTime(startDate);
        const endTime = formatIsoTime(endDate);
        const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : startTime;
        const venue = typeof node.location === 'string' ? node.location : node.location?.name || '';
        const price = node.offers?.price;
        events.push({
          id: `parentmap-jsonld-${slugify(node.name || 'event')}-${eventDate}`,
          title: cleanText(node.name, 180),
          theme: 'Family event',
          summary: cleanText(node.description, 180),
          date: eventDate,
          dateLabel: formatIsoDateLabel(startDate, requestedDate),
          timeLabel,
          venue: cleanText(venue, 160),
          url: node.url || sourceUrl,
          imageUrl: typeof node.image === 'string' ? node.image : node.image?.url || '',
          tags: [],
          regionSlugs: [],
          ageSlugs: ['all-ages'],
          free: price === '0' || price === 0,
          source: 'parentmap',
          sourceLabel: 'ParentMap',
          sourceUrl,
          resultType: 'event',
        });
      }
    } catch {
      // A malformed JSON-LD block should not prevent parsing the calendar cards.
    }
  }
  return events.filter((event) => event.title);
}

export function parseParentMapEvents(html, requestedDate, sourceUrl) {
  const listMatch = html.match(/<ul class="wp-block-post-template[\s\S]*?<\/ul>/i);
  const listHtml = listMatch?.[0] || html;
  const blocks = listHtml.match(/<li class="wp-block-post [\s\S]*?<\/li>/gi) || [];
  if (!blocks.length) return parseParentMapStructuredEvents(html, requestedDate, sourceUrl);

  return blocks.map((block) => {
    const classAttr = block.match(/<li class="([^"]*)"/i)?.[1] || '';
    const postId = classAttr.match(/\bpost-(\d+)\b/)?.[1] || '';
    const titleMatch = block.match(/<h3[^>]*wp-block-post-title[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const href = decodeHtml(titleMatch?.[1] || '');
    const title = htmlToText(titleMatch?.[2] || '', 180);
    if (!title || !href) return null;

    const paragraphTexts = [...block.matchAll(/<p class="[^"]*wp-block-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => htmlToText(match[1], 160))
      .filter(Boolean);
    const combinedDateTime = paragraphTexts
      .map((text, index) => ({ parsed: parseDateTimeParagraph(text), index }))
      .find((item) => item.parsed);
    const dateIndex = combinedDateTime?.index ?? paragraphTexts.findIndex(isDateLabel);
    const dateLabel = combinedDateTime?.parsed.dateLabel || (dateIndex >= 0 ? paragraphTexts[dateIndex] : '');
    const timeLabel = combinedDateTime?.parsed.timeLabel || (dateIndex >= 0 && isTimeLabel(paragraphTexts[dateIndex + 1])
      ? paragraphTexts[dateIndex + 1]
      : '');
    const consumedParagraphs = combinedDateTime ? 1 : (timeLabel ? 2 : 1);
    const venue = paragraphTexts.slice(dateIndex + consumedParagraphs)
      .find((text) => text !== 'Free' && text !== title && !isDateLabel(text) && !isTimeLabel(text)) || '';
    const categoryBlock = block.match(/<div class="taxonomy-tribe_events_cat[\s\S]*?<\/div>/i)?.[0] || '';
    const tags = [...categoryBlock.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => htmlToText(match[1], 60))
      .filter(Boolean);
    const imageUrl = decodeHtml(block.match(/<img[^>]*\ssrc="([^"]+)"/i)?.[1] || '');
    const eventDate = titleDateFromHref(href) || isoDateFromDateLabel(dateLabel, requestedDate);
    const regionSlugs = classSlugs(classAttr, 'event_region');
    const ageSlugs = classSlugs(classAttr, 'event_age');
    const free = /template-part-event-list-item-corner-isfree[\s\S]*?>\s*Free\s*</i.test(block);
    const tagSummary = tags.length ? tags.join(', ') : 'Family-friendly calendar listing';
    const venueSummary = venue ? `At ${venue}.` : '';

    return {
      id: `parentmap-${postId || slugify(title)}-${eventDate}`,
      title,
      theme: tags[0] || 'Family event',
      summary: cleanText(`${venueSummary} ${tagSummary}.`, 180),
      date: eventDate,
      dateLabel: dateLabel || monthDayLabel(eventDate),
      timeLabel,
      venue,
      url: href,
      imageUrl,
      tags,
      regionSlugs,
      ageSlugs,
      free,
      source: 'parentmap',
      sourceLabel: 'ParentMap',
      sourceUrl,
      resultType: 'event',
    };
  }).filter(Boolean);
}

async function fetchTextWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'SproutCue family-event-cache (+https://www.parentmap.com/calendar/)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Event source returned ${response.status}.`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchParentMapEventDescription(eventUrl) {
  if (!/^https?:\/\/www\.parentmap\.com\/calendar\//i.test(String(eventUrl || ''))) return '';
  const html = await fetchTextWithTimeout(eventUrl);
  const contentMatch = html.match(/<div[^>]+class="[^"]*entry-content[^\"]*wp-block-post-content[^\"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (!contentMatch) return '';
  const paragraphs = [...contentMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => htmlToText(match[1], 500))
    .filter(Boolean);
  return cleanText(paragraphs.join(' '), 1400);
}

function parentMapUrl({ date, region, ageSlugs, page = 1 }) {
  const url = new URL(PARENTMAP_CALENDAR_URL);
  url.searchParams.set('date', date);
  url.searchParams.set('page', String(page));
  if (region) url.searchParams.set('region', region);
  url.searchParams.set('age', ageSlugs.join(','));
  url.searchParams.set('category', PARENTMAP_CATEGORIES.join(','));
  return url.toString();
}

function seattlesChildUrl({ startDate, endDate, zip }) {
  const url = new URL(SEATTLES_CHILD_CALENDAR_URL);
  url.searchParams.set('start_date', seattlesChildDate(startDate));
  url.searchParams.set('end_date', seattlesChildDate(endDate));
  url.searchParams.set('date_range', '');
  url.searchParams.set('keyword', '');
  url.searchParams.set('event_category', '');
  url.searchParams.set('event_age[]', '1336');
  if (zip) url.searchParams.set('event_location', zip);
  return url.toString();
}

function parseSeattlesChildStructuredEvents(html, requestedDate, sourceUrl) {
  const scripts = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const events = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const eventNodes = nodes.flatMap((node) => node?.['@graph'] || node).filter((node) => {
        const type = node?.['@type'];
        return type === 'Event' || (Array.isArray(type) && type.includes('Event'));
      });
      for (const node of eventNodes) {
        const startDate = String(node.startDate || '');
        const eventDate = validDateString(startDate.slice(0, 10)) || requestedDate;
        const startTime = formatIsoTime(startDate);
        const endTime = formatIsoTime(String(node.endDate || ''));
        events.push({
          id: `seattles-child-jsonld-${slugify(node.name || 'event')}-${eventDate}`,
          title: cleanText(node.name, 180),
          theme: 'Seattle\'s Child',
          summary: cleanText(node.description, 180),
          date: eventDate,
          dateLabel: formatIsoDateLabel(startDate, requestedDate),
          timeLabel: startTime && endTime ? `${startTime}–${endTime}` : startTime,
          venue: cleanText(typeof node.location === 'string' ? node.location : node.location?.name, 160),
          url: node.url || sourceUrl,
          imageUrl: typeof node.image === 'string' ? node.image : node.image?.url || '',
          tags: [], regionSlugs: [], ageSlugs: ['all-ages'], free: node.offers?.price === '0' || node.offers?.price === 0,
          source: 'seattles-child', sourceLabel: "Seattle's Child", sourceUrl, resultType: 'event',
        });
      }
    } catch {
      // Fall through to the calendar-card parser.
    }
  }
  return events.filter((event) => event.title);
}

function parseSeattlesChildEventCard(block, requestedDate, sourceUrl) {
  if (!/(View Details|trumbaEmbed|event[_-](?:title|date|location))/i.test(block)) return null;
  const detailMatch = block.match(/<a[^>]+href=["']([^"']*(?:trumbaEmbed|event)[^"']*)["'][^>]*>/i);
  const headingMatch = block.match(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/i);
  const title = htmlToText(headingMatch?.[1] || '', 180);
  if (!title || /^view details$/i.test(title)) return null;
  const text = htmlToText(block, 1200);
  const dateMatch = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i);
  const eventDate = dateMatch
    ? isoDateFromDateLabel(`${dateMatch[1]} ${dateMatch[2]}`, `${dateMatch[3] || requestedDate.slice(0, 4)}-${requestedDate.slice(5)}`)
    : requestedDate;
  const timeMatch = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.|am|pm)\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.|am|pm)\b/i);
  const imageUrl = decodeHtml(block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '');
  return {
    id: `seattles-child-${slugify(title)}-${eventDate}`,
    title, theme: 'Seattle\'s Child', summary: 'Family event from Seattle\'s Child calendar.',
    date: eventDate, dateLabel: dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : monthDayLabel(eventDate),
    timeLabel: cleanText(timeMatch?.[0] || '', 80), venue: '', url: decodeHtml(detailMatch?.[1] || sourceUrl), imageUrl,
    tags: [], regionSlugs: [], ageSlugs: ['all-ages'], free: null,
    source: 'seattles-child', sourceLabel: "Seattle's Child", sourceUrl, resultType: 'event',
  };
}

export function parseSeattlesChildEvents(html, requestedDate, sourceUrl = SEATTLES_CHILD_CALENDAR_URL) {
  const structured = parseSeattlesChildStructuredEvents(html, requestedDate, sourceUrl);
  if (structured.length) return structured;
  const blocks = String(html || '').match(/<(?:article|li|div)\b[^>]*(?:event|calendar)[^>]*>[\s\S]*?<\/(?:article|li|div)>/gi) || [];
  return blocks.map((block) => parseSeattlesChildEventCard(block, requestedDate, sourceUrl)).filter(Boolean);
}

async function fetchParentMapEvents({ locationRegion, startDate, endDate, childProfile, pages = [1] }) {
  if (!locationRegion) return { events: [], sourceUrls: [], errors: [] };

  const ageSlugs = ageSlugsForChild(childProfile);
  const requestedUrls = pages.flatMap((page) => datesBetween(startDate, endDate)
    .map((date) => parentMapUrl({ date, region: locationRegion, ageSlugs, page })));
  const dayRequests = requestedUrls.map(async (url, index) => {
    const date = new URL(url).searchParams.get('date') || startDate;
    const html = await fetchTextWithTimeout(url);
    return { url, events: parseParentMapEvents(html, date, url) };
  });

  const results = await Promise.allSettled(dayRequests);
  const sourceUrls = requestedUrls;
  const errors = [];
  const events = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      events.push(...result.value.events);
    } else {
      errors.push(result.reason?.message || 'Could not load a family event source.');
    }
  }

  return { events, sourceUrls, errors };
}

async function fetchSeattlesChildEvents({ startDate, endDate, zip }) {
  const url = seattlesChildUrl({ startDate, endDate, zip });
  try {
    const html = await fetchTextWithTimeout(url);
    return { events: parseSeattlesChildEvents(html, startDate, url), sourceUrls: [url], errors: [] };
  } catch (error) {
    return { events: [], sourceUrls: [url], errors: [error.message || 'Could not load Seattle\'s Child.'] };
  }
}

function eventRank(event) {
  const tagText = event.tags.join(' ').toLowerCase();
  let score = 0;
  if (event.free) score += 4;
  if (tagText.includes('play')) score += 3;
  if (tagText.includes('festival') || tagText.includes('seasonal')) score += 2;
  if (event.ageSlugs.includes('toddlers-preschoolers') || event.ageSlugs.includes('all-ages')) score += 2;
  if (event.venue) score += 1;
  return score;
}

function dedupeAndRankEvents(events, startDate, endDate) {
  const seen = new Set();
  return events
    .filter((event) => event.date >= startDate && event.date <= endDate)
    .filter((event) => {
      const key = `${event.url}|${event.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return eventRank(b) - eventRank(a);
    })
    .slice(0, FAMILY_EVENT_CANDIDATE_LIMIT);
}

function selectFamilyEventPage(events, page = 1) {
  const pageCount = Math.max(1, Math.ceil(events.length / FAMILY_EVENT_LIMIT));
  const safePage = ((Math.max(1, Number(page) || 1) - 1) % Math.min(FAMILY_EVENT_PAGE_COUNT, pageCount)) + 1;
  const offset = (safePage - 1) * FAMILY_EVENT_LIMIT;
  return events.slice(offset, offset + FAMILY_EVENT_LIMIT);
}

function googleSearchUrl(query) {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  return url.toString();
}

function fallbackSearchEvents({ locationCity, startDate, endDate, sourceUrls = [] }) {
  const city = cleanText(locationCity, 80) || 'your city';
  const range = dateRangeLabel(startDate, endDate);
  const parentMapSourceUrl = sourceUrls.find((url) => /parentmap\.com\/calendar\//i.test(url)) || PARENTMAP_CALENDAR_URL;
  const seattlesChildSourceUrl = sourceUrls.find((url) => /seattleschild\.com\/calendar\//i.test(url)) || SEATTLES_CHILD_CALENDAR_URL;
  const searches = [
    {
      title: `Search family events in ${city}`,
      theme: 'Local search',
      query: `family events ${city} ${range}`,
      summary: `Live web search for family-friendly events around ${city} for ${range}.`,
    },
    {
      title: `Search parks and libraries in ${city}`,
      theme: 'Parks + libraries',
      query: `${city} kids events parks library ${range}`,
      summary: `Find public library, parks, and community-center events for ${range}.`,
    },
    {
      title: 'Open ParentMap calendar',
      theme: 'ParentMap',
      query: '',
      summary: 'Browse ParentMap directly when the parser has no matching cards yet.',
      url: parentMapSourceUrl,
    },
    {
      title: "Open Seattle's Child calendar",
      theme: "Seattle's Child",
      query: '',
      summary: "Browse Seattle's Child directly when its calendar cards are not available to the server parser.",
      url: seattlesChildSourceUrl,
    },
  ];

  return searches.map((search, index) => ({
    id: `family-event-search-${slugify(city)}-${startDate}-${index}`,
    title: search.title,
    theme: search.theme,
    summary: search.summary,
    date: startDate,
    dateLabel: range,
    timeLabel: '',
    venue: city,
    url: search.url || googleSearchUrl(search.query),
    imageUrl: '',
    tags: [search.theme],
    regionSlugs: [],
    ageSlugs: [],
    free: null,
    source: 'search-link',
    sourceLabel: 'Search link',
    sourceUrl: search.url || googleSearchUrl(search.query),
    resultType: 'search-link',
  }));
}

export function familyEventCacheKey({ locationCity, startDate, endDate, source = 'family-events-v1', filters = {} }) {
  const normalizedFilters = Object.keys(filters)
    .sort()
    .reduce((next, key) => ({ ...next, [key]: filters[key] }), {});
  return [
    source,
    slugify(locationCity || 'unknown-city', 80),
    startDate,
    endDate,
    slugify(JSON.stringify(normalizedFilters), 120),
  ].filter(Boolean).join(':');
}

export function familyEventExpiresAt(now = new Date()) {
  return new Date(now.getTime() + FAMILY_EVENT_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function fetchFamilyEvents({ locationCity, startDate, endDate, childProfile = {}, page = 1, locationZip = '' }) {
  const locationRegion = regionForCity(locationCity);
  const [parentMap, seattlesChild] = await Promise.all([
    fetchParentMapEvents({
      locationRegion,
      startDate,
      endDate,
      childProfile,
      pages: Array.from({ length: FAMILY_EVENT_PAGE_COUNT }, (_, index) => index + 1),
    }),
    fetchSeattlesChildEvents({ startDate, endDate, zip: locationZip }),
  ]);
  const sourceUrls = [...parentMap.sourceUrls, ...seattlesChild.sourceUrls];
  const errors = [...parentMap.errors, ...seattlesChild.errors];
  const rankedEvents = dedupeAndRankEvents([...parentMap.events, ...seattlesChild.events], startDate, endDate);
  const pageEvents = selectFamilyEventPage(rankedEvents, page);
  const hasParsedEvents = rankedEvents.length > 0;
  const selectedPage = rankedEvents.length
    ? ((Math.max(1, Number(page) || 1) - 1) % Math.min(FAMILY_EVENT_PAGE_COUNT, Math.ceil(rankedEvents.length / FAMILY_EVENT_LIMIT))) + 1
    : 1;
  const events = hasParsedEvents
    ? pageEvents
    : fallbackSearchEvents({ locationCity, startDate, endDate, sourceUrls });

  return {
    locationCity,
    locationRegion,
    startDate,
    endDate,
    dateRangeLabel: dateRangeLabel(startDate, endDate),
    source: hasParsedEvents ? 'parentmap+seattles-child' : 'search-link',
    sourceLabel: hasParsedEvents ? "ParentMap + Seattle's Child" : 'Search links',
    sourceUrls: sourceUrls.length ? sourceUrls : [PARENTMAP_CALENDAR_URL, SEATTLES_CHILD_CALENDAR_URL],
    events,
    fallback: !hasParsedEvents,
    providerStatus: hasParsedEvents
      ? `Updated from ParentMap and Seattle's Child for ${cleanText(locationCity, 80)}; showing page ${selectedPage} of ${Math.max(1, Math.ceil(rankedEvents.length / FAMILY_EVENT_LIMIT))}.`
      : `${locationRegion ? 'No parsed event results matched yet' : 'No supported local event region was found'}; showing live search links.`,
    errors,
  };
}
