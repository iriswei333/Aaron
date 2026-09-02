import { currentWeekendRange, fetchFamilyEvents, fetchParentMapEventDescription } from './family-events.js';

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
  return `这个周末去${city}玩什么？🌿\n\n推荐：${event.title}\n${free}${details}\n\n${event.summary || '适合亲子一起参加的周末活动。'}\n\n带上家人，轻松安排一个有趣的周末！\n\n资料整理：Sproutecue\n活动来源：${sourceLabel}`;
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

export function makeWeeklyRoundup(posts = [], startDate = '', endDate = '') {
  const cityCount = new Set(posts.map((post) => post.city)).size;
  const highlightTitles = posts.slice(0, 2).map((post) => `「${post.title}」`).join('和');
  const highlights = posts.length
    ? `本周亮点包括${highlightTitles}，适合安排轻松又充实的亲子时光。${posts.length > 2 ? '从户外探索到社区活动，各个城市都有值得带孩子一起体验的选择。' : ''}`
    : '本周暂时没有找到已确认的活动，建议稍后再查看周末清单。';
  const lines = posts.map((post, index) => {
    const details = [post.dateLabel || post.date, post.timeLabel, post.venue].filter(Boolean).join(' · ');
    const highlights = (post.highlights || []).slice(0, 2).map((highlight) => `亮点：${highlight}`).join('；');
    return `${index + 1}. ${post.city}：${post.title}\n   ${details}\n   ${highlights}`;
  });
  return {
    title: `本周末亲子活动精选｜${cityCount}城${posts.length}场`,
    caption: `这个周末，${cityCount} 个城市都有适合家庭的活动！🌿\n\n${highlights}\n\n我们整理了 ${posts.length} 场地区亮点：\n\n${lines.join('\n\n')}\n\n收藏这份周末清单，带上家人一起出门玩吧！\n\n资料整理：Sproutecue\n活动日期：${startDate}–${endDate}`,
    posts: posts.map((post) => ({ city: post.city, title: post.title, date: post.date, dateLabel: post.dateLabel, timeLabel: post.timeLabel, venue: post.venue, highlights: post.highlights, sourceLabel: post.sourceLabel, eventUrl: post.eventUrl })),
    startDate,
    endDate,
    author: 'Sproutecue',
  };
}

export async function generateWeeklySocialPosts({
  regions = DEFAULT_SOCIAL_REGIONS,
  childProfile = {},
  now = new Date(),
} = {}) {
  const { startDate, endDate } = currentWeekendRange(now);
  const days = [startDate, endDate];
  const results = await Promise.all(regions.flatMap((region) => days.map(async (day) => {
    const city = clean(region.city || region.label);
    if (!city) return { region, day, fetched: null, event: null, error: 'Region city is required.' };
    try {
      const fetched = await fetchFamilyEvents({ locationCity: city, startDate: day, endDate: day, childProfile, page: 1 });
      const matchedEvent = bestEvent(fetched.events);
      if (matchedEvent) return { region, day, fetched, events: fetched.events, event: matchedEvent, method: matchedEvent.sourceLabel || 'Family event source' };
      try {
        const searched = await fetchWebSearchEvents({ city, startDate: day, endDate: day });
        const searchedEvent = bestEvent(searched);
        return {
          region,
          day,
          fetched: { ...fetched, sourceUrls: [...(fetched.sourceUrls || []), searchUrl(city, day, day)] },
          events: searched,
          event: searchedEvent,
          method: searchedEvent ? 'DuckDuckGo web search' : 'ParentMap + web search',
          searchError: searchedEvent ? '' : 'No web-search result matched.',
        };
      } catch (searchError) {
        return { region, day, fetched, events: [], event: null, method: 'ParentMap + web search', searchError: searchError.message };
      }
    } catch (error) {
      return { region, day, fetched: null, event: null, error: error.message };
    }
  })));
  const usedEventKeys = new Set();
  const selectedResults = results.map((result) => {
    const candidates = result.events || (result.event ? [result.event] : []);
    const event = candidates
      .filter((candidate) => !usedEventKeys.has(eventKey(candidate)))
      .sort((a, b) => eventScore(b) - eventScore(a))[0] || null;
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
    let description = post.description;
    try {
      description = await fetchParentMapEventDescription(post.eventUrl) || description;
    } catch {
      // Keep the calendar summary when an event detail page is unavailable.
    }
    const aiHighlights = await generateAiHighlights({ ...post, description });
    return {
      ...post,
      description,
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
    generatedAt: new Date().toISOString(),
    statuses: selectedResults.map(({ region, day, fetched, event, error, method, searchError, duplicateSkipped }) => ({
      city: clean(region.city || region.label),
      day,
      matched: Boolean(event),
      fallback: fetched?.fallback ?? false,
      providerStatus: event ? `${method || event.sourceLabel || 'Family event source'} result selected.` : `${duplicateSkipped ? 'Duplicate event skipped across the weekend.' : (fetched?.providerStatus || error || 'No matching event found.')}${searchError ? ` Web search: ${searchError}` : ''}`,
      sourceUrl: event?.sourceUrl || event?.url || fetched?.sourceUrls?.[0] || '',
    })),
  };
}
