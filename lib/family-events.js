const FAMILY_EVENT_CACHE_TTL_HOURS = 12;
const FAMILY_EVENT_LIMIT = 8;
const PARENTMAP_CALENDAR_URL = 'https://www.parentmap.com/calendar/';
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
  return parts[0] || '';
}

export function familyEventCityForUser(user, requestedLocation = '') {
  const requestedCity = cityFromText(requestedLocation);
  if (requestedCity) return requestedCity;

  const savedLocation = user?.location;
  const savedLocationText = savedLocation && typeof savedLocation === 'object'
    ? savedLocation.address || (savedLocation.source === 'browser-geolocation' ? '' : savedLocation.label)
    : savedLocation;
  const savedCity = savedLocation && typeof savedLocation === 'object'
    ? cleanText(savedLocation.city || savedLocation.locality || savedLocation.town, 80)
      || cityFromText(savedLocationText)
    : cityFromText(savedLocationText);
  if (savedCity) return savedCity;

  const childProfile = user?.childProfile;
  const children = Array.isArray(childProfile?.children) ? childProfile.children : [];
  const activeChild = children.find((child) => child.id && child.id === childProfile?.activeChildId) || children[0] || null;
  return cleanText(activeChild?.homeCity, 80);
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

function isoDateFromDateLabel(label, fallbackDate) {
  const match = cleanText(label, 80).match(/([a-z]+)\s+(\d{1,2})$/i);
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

function parseParentMapEvents(html, requestedDate, sourceUrl) {
  const listMatch = html.match(/<ul class="wp-block-post-template[\s\S]*?<\/ul>/i);
  const listHtml = listMatch?.[0] || html;
  const blocks = listHtml.match(/<li class="wp-block-post [\s\S]*?<\/li>/gi) || [];

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
    const dateIndex = paragraphTexts.findIndex(isDateLabel);
    const dateLabel = dateIndex >= 0 ? paragraphTexts[dateIndex] : '';
    const timeLabel = dateIndex >= 0 && isTimeLabel(paragraphTexts[dateIndex + 1])
      ? paragraphTexts[dateIndex + 1]
      : '';
    const venue = paragraphTexts.slice(dateIndex + (timeLabel ? 2 : 1))
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

function parentMapUrl({ date, region, ageSlugs }) {
  const url = new URL(PARENTMAP_CALENDAR_URL);
  url.searchParams.set('date', date);
  if (region) url.searchParams.set('region', region);
  url.searchParams.set('age', ageSlugs.join(','));
  url.searchParams.set('category', PARENTMAP_CATEGORIES.join(','));
  return url.toString();
}

async function fetchParentMapEvents({ locationRegion, startDate, endDate, childProfile }) {
  if (!locationRegion) return { events: [], sourceUrls: [], errors: [] };

  const ageSlugs = ageSlugsForChild(childProfile);
  const dayRequests = datesBetween(startDate, endDate).map(async (date) => {
    const url = parentMapUrl({ date, region: locationRegion, ageSlugs });
    const html = await fetchTextWithTimeout(url);
    return { url, events: parseParentMapEvents(html, date, url) };
  });

  const results = await Promise.allSettled(dayRequests);
  const sourceUrls = [];
  const errors = [];
  const events = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sourceUrls.push(result.value.url);
      events.push(...result.value.events);
    } else {
      errors.push(result.reason?.message || 'Could not load a family event source.');
    }
  }

  return { events, sourceUrls, errors };
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
    .slice(0, FAMILY_EVENT_LIMIT);
}

function googleSearchUrl(query) {
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  return url.toString();
}

function fallbackSearchEvents({ locationCity, startDate, endDate, sourceUrls = [] }) {
  const city = cleanText(locationCity, 80) || 'your city';
  const range = dateRangeLabel(startDate, endDate);
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
      url: sourceUrls[0] || PARENTMAP_CALENDAR_URL,
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

export async function fetchFamilyEvents({ locationCity, startDate, endDate, childProfile = {} }) {
  const locationRegion = regionForCity(locationCity);
  const { events: parentMapEvents, sourceUrls, errors } = await fetchParentMapEvents({
    locationRegion,
    startDate,
    endDate,
    childProfile,
  });
  const rankedEvents = dedupeAndRankEvents(parentMapEvents, startDate, endDate);
  const hasParsedEvents = rankedEvents.length > 0;
  const events = hasParsedEvents
    ? rankedEvents
    : fallbackSearchEvents({ locationCity, startDate, endDate, sourceUrls });

  return {
    locationCity,
    locationRegion,
    startDate,
    endDate,
    dateRangeLabel: dateRangeLabel(startDate, endDate),
    source: hasParsedEvents ? 'parentmap' : 'search-link',
    sourceLabel: hasParsedEvents ? 'ParentMap' : 'Search links',
    sourceUrls: sourceUrls.length ? sourceUrls : [PARENTMAP_CALENDAR_URL],
    events,
    fallback: !hasParsedEvents,
    providerStatus: hasParsedEvents
      ? `Updated from ParentMap for ${cleanText(locationCity, 80)}.`
      : `${locationRegion ? 'No parsed ParentMap results matched yet' : 'ParentMap does not cover this city directly'}; showing live search links.`,
    errors,
  };
}
