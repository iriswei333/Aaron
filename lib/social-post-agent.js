import { currentWeekendRange, fetchFamilyEvents } from './family-events.js';

export const DEFAULT_SOCIAL_REGIONS = [
  { city: 'Seattle', label: 'Seattle' },
  { city: 'Bellevue', label: 'Bellevue' },
  { city: 'Tacoma', label: 'Tacoma' },
  { city: 'Kirkland', label: 'Kirkland' },
  { city: 'Lynnwood', label: 'Lynnwood' },
  { city: 'Edmonds', label: 'Edmonds' },
];

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';

function clean(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function decodeHtml(value) {
  return clean(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
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

function eventScore(event) {
  const tags = `${event.theme || ''} ${(event.tags || []).join(' ')}`.toLowerCase();
  return (event.resultType === 'event' ? 20 : 0)
    + (event.free === true ? 6 : 0)
    + (event.venue ? 3 : 0)
    + (/festival|community|arts|play|family|seasonal/.test(tags) ? 4 : 0)
    + (event.imageUrl ? 2 : 0);
}

function bestEvent(events = []) {
  return events
    .filter((event) => event?.resultType !== 'search-link' && event?.title)
    .sort((a, b) => eventScore(b) - eventScore(a))[0] || null;
}

function compactLocation(event, city) {
  return clean(event.venue, city).replace(/\s+/g, ' ');
}

function makeCaption(event, city, dateLabel, sourceLabel = 'ParentMap') {
  const free = event.free === true ? '免费入场，' : '';
  const details = [dateLabel, event.timeLabel, compactLocation(event, city)].filter(Boolean).join(' · ');
  return `这个周末去${city}玩什么？🌿\n\n推荐：${event.title}\n${free}${details}\n\n${event.summary || '适合亲子一起参加的周末活动。'}\n\n带上家人，轻松安排一个有趣的周末！\n\n资料整理：Sproutecue\n活动来源：${sourceLabel}`;
}

export function makeSocialPost({ event, city, regionLabel, dateLabel, sourceUrl, sourceLabel }) {
  return {
    id: `social-${slug(city)}-${event.date || dateLabel}-${slug(event.title)}`.slice(0, 220),
    region: regionLabel || city,
    city,
    title: event.title,
    headline: `${city} · 周末亲子精选`,
    caption: makeCaption(event, city, dateLabel, sourceLabel || event.sourceLabel),
    date: event.date || '',
    dateLabel: event.dateLabel || dateLabel,
    timeLabel: event.timeLabel || '时间请以活动页面为准',
    venue: event.venue || city,
    imageUrl: event.imageUrl || '',
    eventUrl: event.url || sourceUrl || '',
    sourceUrl: event.sourceUrl || sourceUrl || '',
    source: event.source || 'parentmap',
    sourceLabel: sourceLabel || event.sourceLabel || 'ParentMap',
    author: 'Sproutecue',
    status: 'draft',
  };
}

export async function generateWeeklySocialPosts({
  regions = DEFAULT_SOCIAL_REGIONS,
  childProfile = {},
  now = new Date(),
} = {}) {
  const { startDate, endDate } = currentWeekendRange(now);
  const results = await Promise.all(regions.map(async (region) => {
    const city = clean(region.city || region.label);
    if (!city) return { region, fetched: null, event: null, error: 'Region city is required.' };
    try {
      const fetched = await fetchFamilyEvents({ locationCity: city, startDate, endDate, childProfile, page: 1 });
      const parentMapEvent = bestEvent(fetched.events);
      if (parentMapEvent) return { region, fetched, event: parentMapEvent, method: 'ParentMap' };
      try {
        const searched = await fetchWebSearchEvents({ city, startDate, endDate });
        const searchedEvent = bestEvent(searched);
        return {
          region,
          fetched: { ...fetched, sourceUrls: [...(fetched.sourceUrls || []), searchUrl(city, startDate, endDate)] },
          event: searchedEvent,
          method: searchedEvent ? 'DuckDuckGo web search' : 'ParentMap + web search',
          searchError: searchedEvent ? '' : 'No web-search result matched.',
        };
      } catch (searchError) {
        return { region, fetched, event: null, method: 'ParentMap + web search', searchError: searchError.message };
      }
    } catch (error) {
      return { region, fetched: null, event: null, error: error.message };
    }
  }));
  const posts = results
    .filter(({ event }) => event)
    .map(({ region, fetched, event }) => makeSocialPost({
      event,
      city: clean(region.city || region.label),
      regionLabel: clean(region.label || region.city),
      dateLabel: fetched.dateRangeLabel,
      sourceUrl: fetched.sourceUrls?.[0],
      sourceLabel: event.sourceLabel,
    }));
  return {
    id: `weekly-${startDate}`,
    weekKey: startDate,
    startDate,
    endDate,
    regions: regions.map((region) => clean(region.city || region.label)).filter(Boolean),
    posts,
    source: posts.some((post) => post.source !== 'parentmap') ? 'mixed' : 'parentmap',
    generatedAt: new Date().toISOString(),
    statuses: results.map(({ region, fetched, event, error, method, searchError }) => ({
      city: clean(region.city || region.label),
      matched: Boolean(event),
      fallback: fetched?.fallback ?? false,
      providerStatus: event ? `${method || 'ParentMap'} result selected.` : `${fetched?.providerStatus || error || 'No matching event found.'}${searchError ? ` Web search: ${searchError}` : ''}`,
      sourceUrl: fetched?.sourceUrls?.[0] || '',
    })),
  };
}
