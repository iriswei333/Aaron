#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { writeLocalFamilyEventCache, writeSupabaseFamilyEventCache } from '../lib/backend.js';
import { familyEventCacheEntriesFromSocialRun } from '../lib/family-events.js';
import {
  DEFAULT_EVENT_DISTANCE_MILES,
  DEFAULT_SOCIAL_REGIONS,
  fetchForcedEventFromUrl,
  generateSocialPostsFromRecommendationUrl,
  generateWeeklySocialPosts,
  makeSocialPost,
  makeWeeklyRoundup,
} from '../lib/social-post-agent.js';
import { getForcedPartnershipEvents } from '../lib/social-partnership-events.js';
import { savePartnershipEvent } from '../lib/social-partnership-events-file.js';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const imageGen = process.env.IMAGE_GEN || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills/.system/imagegen/scripts/image_gen.py');
const MAX_WEEKLY_POSTERS = 8;
const MAX_ROUNDUP_WORDS = 670;
const DEFAULT_REGION_POSTER_LIMIT = 1;
const REGION_POSTER_LIMITS = new Map(DEFAULT_SOCIAL_REGIONS.map((region) => [region.slug, region.eventLimit]));
const POSTER_FORMAT = {
  width: 1024,
  height: 1536,
  aspectRatio: '2:3',
  safeMargin: '64 px',
};

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function argValues(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function parseRejectedEvent(value) {
  if (value && typeof value === 'object') {
    const title = String(value.title || '').trim();
    return {
      title,
      normalizedTitle: normalizeFeedbackText(value.normalizedTitle || title),
      reason: String(value.reason || '').trim(),
    };
  }
  const parts = value.split('|');
  const legacyFormat = parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]?.trim());
  const rawTitle = (legacyFormat ? parts[2] : parts[0] || '').trim();
  return {
    title: rawTitle,
    normalizedTitle: normalizeFeedbackText(rawTitle),
    reason: (legacyFormat ? parts.slice(3) : parts.slice(1)).join('|').trim(),
  };
}

function normalizeFeedbackText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function rejectedEventKey(event) {
  return `title|${event.normalizedTitle || normalizeFeedbackText(event.title)}`;
}

function rejectedEventKeys(event) {
  return [rejectedEventKey(event)];
}

const dryRun = process.argv.includes('--dry-run');
const skipImages = process.argv.includes('--skip-images');
const sampleRun = process.argv.includes('--sample');
const listScores = process.argv.includes('--list-scores');
const regenerationRequests = argValues('--regenerate');
const rejectedEventRequests = argValues('--reject-event');
const feedback = argValue('--feedback');
const sourceRoundupPath = argValue('--from-roundup');
const forceEventUrlInput = argValue('--force-event-url');
const recommendationUrlInput = argValue('--recommendations-url') || argValue('--events-url');
const handpickedEventsPathInput = argValue('--events-file');
const excludedRecommendationUrlInputs = argValues('--exclude-event-url');
const forcedCity = argValue('--city').trim();
const forcedDate = argValue('--date').trim();
const savePartnership = process.argv.includes('--save-partnership');
const normalEventSearch = process.argv.includes('--normal-event-search');
const venueDistanceFilter = process.argv.includes('--venue-distance-filter')
  && !normalEventSearch;
const requestedDistanceMiles = Number(argValue('--max-distance-miles', String(DEFAULT_EVENT_DISTANCE_MILES)));
const maxDistanceMiles = Number.isFinite(requestedDistanceMiles) && requestedDistanceMiles > 0
  ? requestedDistanceMiles
  : DEFAULT_EVENT_DISTANCE_MILES;
const outputDir = resolve(argValue('--output', join(projectRoot, 'output/social-posts')));
const defaultRegionList = DEFAULT_SOCIAL_REGIONS.map((item) => item.slug).join(',');
const configuredRegions = argValue('--regions', defaultRegionList)
  .split(',')
  .map((regionSlug) => regionSlug.trim().toLowerCase())
  .filter(Boolean)
  .map((regionSlug) => {
    const region = DEFAULT_SOCIAL_REGIONS.find((candidate) => candidate.slug === regionSlug);
    if (!region) throw new Error(`Unsupported ParentMap region "${regionSlug}". Use: ${defaultRegionList}.`);
    return region;
  });

function normalizedForcedEventUrl(value) {
  const markdownUrl = String(value || '').trim().match(/^\[(https?:\/\/[^\]]+)\]\(https?:\/\/[^)]+\)$/i)?.[1];
  const candidate = markdownUrl || String(value || '').trim();
  if (!candidate) return '';
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('--force-event-url must use http:// or https://.');
  return parsed.href;
}

function validForcedDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function eventFeatureTiles(post) {
  const text = [post.title, post.theme, post.description, ...(post.highlights || []), ...(post.matchingKeywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tiles = [];
  const add = (title, subtitle) => {
    if (!tiles.some((tile) => tile.title === title)) tiles.push({ title, subtitle });
  };

  if (/state fair|county fair|carnival|carnival ride/.test(text)) {
    add('游乐体验', '一起欢笑');
    add('市集探索', '发现新鲜');
    add('亲子同乐', '留下回忆');
  }
  if (/fall festival|autumn festival|harvest|pumpkin|apple festival|farm/.test(text)) {
    add('秋日探索', '发现季节');
    add('农场体验', '亲近自然');
    add('节庆同乐', '一起庆祝');
  }
  if (/story|book|read|library|watercress|storywalk/.test(text)) {
    add('故事探索', '一起阅读');
    add('想象时间', '发现新世界');
    add('亲子共读', '分享时光');
  }
  if (/music|concert|dance|live performance/.test(text)) {
    add('音乐欣赏', '一起律动');
    add('现场欢乐', '共享节奏');
    add('亲子放松', '享受周末');
  }
  if (/art|museum|craft|culture|sculpture/.test(text)) {
    add('艺术发现', '激发灵感');
    add('创意体验', '动手探索');
    add('亲子欣赏', '分享发现');
  }
  if (/park|trail|outdoor|nature|walk|run|bike|garden|explor/.test(text)) {
    add('户外探索', '亲近自然');
    add('健康活动', '一起出发');
    add('发现风景', '享受周末');
  }
  add('亲子时光', '一起体验');
  add('周末发现', '探索身边');
  add('家庭欢乐', '创造回忆');
  return tiles.slice(0, 3);
}

function posterPrompt(post) {
  const revisionFeedback = feedback ? `\nRevision feedback to address: ${feedback}\n` : '';
  const featureTiles = eventFeatureTiles(post);
  const featureTileText = featureTiles.map((tile, index) => `${index + 1}. “${tile.title}” / “${tile.subtitle}”`).join('\n');
  const headline = post.headline || '周末亲子精选';
  const posterHighlight = String(post.highlights?.[0] || post.bannerText || '带上家人，一起去玩！')
    .match(/^.*?[。！？.!?](?:[”’」』")\)]*)?/)?.[0]
    ?.replace(/^[^\p{L}\p{N}\u4e00-\u9fff]+/u, '')
    || post.bannerText
    || '带上家人，一起去玩！';
  return `Use case: ads-marketing
Asset type: fixed-format vertical ${POSTER_FORMAT.aspectRatio} Mandarin social media event poster
Primary request: Create a polished family-event poster for ${post.title} using the exact reusable SproutCue template modeled on the supplied reference layout. Do not put a city or region name in the top banner.
Canvas: exactly ${POSTER_FORMAT.width}x${POSTER_FORMAT.height} px, ${POSTER_FORMAT.aspectRatio}; keep all content inside a ${POSTER_FORMAT.safeMargin} safe margin.
Fixed visual system: warm cream paper-textured background; deep navy #082b52 ribbon and facts bar; rounded coral-orange #f0643d event panel; cream stitched banners; leafy green #3c713d accents; three cheerful flat-cartoon family characters; crisp dark outlines; soft print texture; consistent bright family-friendly palette. Only the event-specific content and illustration details may change between posters.
Fixed reference layout, from top to bottom: (1) top 11% — a centered navy swallowtail ribbon containing the day/weekend headline without a city or region name, with small orange accent marks and leafy sprigs around it; (2) 11–34% — one large rounded coral-orange panel with a thin cream stitched border containing the event name in large cream display type, wrapping across no more than three lines; (3) 31–40% — a cream swallowtail banner overlapping the lower edge of the orange panel with the fixed weekend label; (4) 36–70% — a welcoming event-themed scene with exactly three family characters, centered beneath the banners, with no text over the illustration; (5) 69–79% — one rounded cream feature strip divided into three equal tiles with circular icons; (6) 79–88% — one full-width navy facts bar divided into three columns for date, time, and location; (7) 88–96% — a centered green Mandarin event-highlight band with leafy/orange accents, allowing two compact lines when needed; (8) 96–100% — a centered navy pill containing the SproutCue credit. Preserve this order, alignment, proportions, and generous spacing for every poster.
Feature tile copy: use these exact three event-specific feature tiles in the three equal feature tiles, in this order:
${featureTileText}
Text rules: render only the following text blocks in their assigned template sections, with no extra copy, labels, QR codes, logos, watermarks, or decorative lettering:
“${headline}”
“${post.title}”
“周末亲子精选”
${featureTiles.map((tile) => `“${tile.title}”\n“${tile.subtitle}”`).join('\n')}
“${post.dateLabel || post.date || '本周末'}”
“${post.timeLabel || '时间请以活动页面为准'}”
“${post.venue || post.city}”
“${posterHighlight}”
“资料整理：SproutCue”${revisionFeedback}
Constraints: preserve every supplied event text and fact exactly; keep the three feature tiles exactly as written; prioritize mobile legibility over illustration detail; use no alternate layout, collage, dense background, extra text, event-source label, QR code, phone number, fake logo, watermark, invented detail, or tiny unreadable copy.`;
}

function recommendationSummaryPosterPrompt(posts, startDate, endDate) {
  const eventBlocks = posts.map((post, index) => `${index + 1}. “${post.title}”\n“${post.dateLabel || post.date} · ${post.venue || post.city}”`).join('\n');
  return `Use case: ads-marketing
Asset type: fixed-format vertical ${POSTER_FORMAT.aspectRatio} family-event roundup poster
Primary request: Create one polished SproutCue summary poster containing every supplied event, date, and venue exactly once.
Canvas: exactly ${POSTER_FORMAT.width}x${POSTER_FORMAT.height} px, ${POSTER_FORMAT.aspectRatio}; keep all content inside a ${POSTER_FORMAT.safeMargin} safe margin.
Visual system: use the established SproutCue warm cream paper-textured background, deep navy #082b52, coral-orange #f0643d, leafy green #3c713d, rounded panels, stitched cream details, crisp dark outlines, and subtle leafy/orange accents.
Layout: place a navy ribbon headline at the top, then arrange the event list in two balanced columns of rounded cream cards. Each card must contain the event title followed immediately by its date and venue. Use compact but highly legible typography and consistent spacing. Do not use a large central illustration; small simple event icons are allowed only when they do not reduce text space. Finish with a green call-to-action and the SproutCue footer pill.
Text rules: render only the following text, preserving spelling, punctuation, dates, venues, and event order exactly. Do not omit, merge, abbreviate, or duplicate an event:
“周末亲子活动总览”
“${startDate}–${endDate}”
${eventBlocks}
“收藏清单，带上家人一起出发！”
“资料整理：SproutCue”
Constraints: every numbered event must be visible in this one image; prioritize exact readable text over decoration; no extra copy, QR code, phone number, source label, fake logo, watermark, invented detail, or tiny unreadable text.`;
}

function posterFilename(post, weekKey, includeTitle = false) {
  const city = post.city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const title = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return `${city}-${post.date || weekKey}${includeTitle && title ? `-${title}` : ''}.png`;
}

function parseRegenerationRequest(value) {
  const [city, date] = value.split(',');
  return { city: city.trim().toLowerCase(), date: (date || '').trim() };
}

function regenerationKey(request) {
  return `${request.city}|${request.date}`;
}

function posterEventKey(post) {
  const identity = post.eventUrl || post.sourceUrl || post.title;
  return `${post.city.toLowerCase()}|${post.date || ''}|${identity}`.toLowerCase();
}

function regenerationSlotKey(post, weekKey = '') {
  return `${String(post.regionSlug || post.region || post.city).toLowerCase()}|${post.date || weekKey}`;
}

function limitWords(value, limit = MAX_ROUNDUP_WORDS) {
  const words = value.trim().split(/\s+/);
  return words.length <= limit ? value : `${words.slice(0, limit).join(' ')}\n\n（内容已截取至 ${limit} 字以内。）`;
}

async function readExistingPosterNames(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png')).map((entry) => entry.name));
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

async function readRejectedEvents(path) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(value) ? value.map(parseRejectedEvent).filter((event) => event.title) : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadRunFromRoundup(roundupPath) {
  const resolvedRoundupPath = resolve(roundupPath);
  const manifestPath = resolvedRoundupPath.replace(/-roundup\.md$/i, '.json');
  if (manifestPath === resolvedRoundupPath) {
    throw new Error('--from-roundup must point to a weekly-YYYY-MM-DD-roundup.md file.');
  }
  const run = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(run.posts) || !run.weekKey || !run.startDate || !run.endDate) {
    throw new Error(`The companion manifest is missing weekly event data: ${manifestPath}`);
  }
  return { ...run, sourceManifestPath: manifestPath };
}

function regionPosterLimit(post) {
  return REGION_POSTER_LIMITS.get(String(post.regionSlug || '').toLowerCase()) || DEFAULT_REGION_POSTER_LIMIT;
}

function selectPosterSet(posts, limit = MAX_WEEKLY_POSTERS, weekKey = '', regenerationTargets = new Set()) {
  const groups = new Map();
  for (const post of posts) {
    const regionKey = post.regionSlug || post.region || post.city;
    if (!groups.has(regionKey)) groups.set(regionKey, []);
    groups.get(regionKey).push(post);
  }
  const selected = [];
  const selectedEventKeys = new Set();
  const isRegenerationTarget = (post) => regenerationTargets.has(regenerationSlotKey(post, weekKey));
  for (const regionPosts of groups.values()) {
    const targets = regionPosts.filter(isRegenerationTarget);
    const ranked = [...regionPosts].sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0));
    const regionCandidates = [...targets, ...ranked].filter((post, index, candidates) => candidates.findIndex((candidate) => candidate.id === post.id) === index);
    for (const post of regionCandidates.slice(0, regionPosterLimit(regionPosts[0]))) {
      if (selected.length >= limit) break;
      const eventKey = posterEventKey(post);
      if (!selectedEventKeys.has(eventKey)) {
        selected.push(post);
        selectedEventKeys.add(eventKey);
      }
    }
    if (selected.length >= limit) break;
  }
  return selected;
}

function showProgress(completed, total, current = '') {
  const width = 28;
  const filled = total ? Math.round((completed / total) * width) : 0;
  const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
  process.stdout.write(`\rGenerating posters [${bar}] ${completed}/${total}${current ? ` · ${current}` : ''}`);
  if (completed >= total) process.stdout.write('\n');
}

function printCandidateScores(candidateScores = []) {
  if (!candidateScores.length) {
    console.log('Candidate scores: no ParentMap candidates found.');
    return;
  }
  console.log('Candidate scores:');
  let currentRegion = '';
  candidateScores.forEach((candidate, index) => {
    if (candidate.region !== currentRegion) {
      currentRegion = candidate.region;
      console.log(`\n${candidate.regionLabel || candidate.region}`);
    }
    const componentText = Object.entries(candidate.components || {})
      .filter(([, score]) => score)
      .map(([name, score]) => `${name} +${score}`)
      .join(', ');
    const state = candidate.rejected ? 'rejected' : candidate.selected ? 'selected' : 'not selected';
    console.log(`${index + 1}. ${candidate.total} · ${state} · ${candidate.date} · ${candidate.title}`);
    console.log(`   ${componentText || 'no positive score components'}`);
    if (candidate.matchingKeywords?.length) console.log(`   keywords: ${candidate.matchingKeywords.join(', ')}`);
    if (candidate.url) console.log(`   ${candidate.url}`);
  });
}

function runImageBatch(jobs, promptPath, outputDir, force = false) {
  return new Promise((resolve, reject) => {
    const args = ['generate-batch', '--input', promptPath, '--out-dir', outputDir, '--concurrency', '2'];
    if (force) args.push('--force');
    const child = spawn('python3', [imageGen, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let completed = 0;
    let pending = '';
    showProgress(0, jobs.length);
    child.stdout.on('data', (chunk) => { process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) {
        stderr += `${line}\n`;
        const match = line.match(/\[job (\d+)\/(\d+)\] (completed|failed)/);
        if (match) {
          completed += 1;
          showProgress(completed, Number(match[2]), match[3] === 'failed' ? `job ${match[1]} failed` : `job ${match[1]} complete`);
        }
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (pending) stderr += pending;
      if (code === 0) resolve();
      else reject(new Error(stderr || `Image generation exited with code ${code}.`));
    });
  });
}

async function writeSocialRunToFamilyEventCache(run) {
  const entries = familyEventCacheEntriesFromSocialRun(run);
  if (!entries.length) return { count: 0, target: 'none' };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await Promise.all(entries.map((entry) => writeSupabaseFamilyEventCache(supabase, entry)));
    return { count: entries.length, target: 'Supabase family_event_cache' };
  }
  await Promise.all(entries.map((entry) => writeLocalFamilyEventCache(entry)));
  return { count: entries.length, target: 'local family-event cache' };
}

async function main() {
  const hasForcedArguments = Boolean(forceEventUrlInput || forcedCity || forcedDate);
  const recommendationUrl = normalizedForcedEventUrl(recommendationUrlInput);
  const handpickedEventsPath = handpickedEventsPathInput ? resolve(handpickedEventsPathInput) : '';
  const excludedRecommendationUrls = excludedRecommendationUrlInputs.map(normalizedForcedEventUrl);
  if (excludedRecommendationUrls.length && !recommendationUrl) {
    throw new Error('--exclude-event-url requires --recommendations-url or --events-url.');
  }
  if (savePartnership && !hasForcedArguments) {
    throw new Error('--save-partnership requires --force-event-url, --city, and --date.');
  }
  if (hasForcedArguments && !(forceEventUrlInput && forcedCity && forcedDate)) {
    throw new Error('--force-event-url, --city, and --date must be provided together.');
  }
  if (forcedDate && !validForcedDate(forcedDate)) throw new Error('--date must use a valid YYYY-MM-DD date.');
  if (hasForcedArguments && sourceRoundupPath) throw new Error('--force-event-url cannot be combined with --from-roundup.');
  if (hasForcedArguments && regenerationRequests.length) throw new Error('--force-event-url cannot be combined with --regenerate.');
  if (recommendationUrl && (hasForcedArguments || sourceRoundupPath || regenerationRequests.length || savePartnership)) {
    throw new Error('--recommendations-url cannot be combined with forced, roundup, regeneration, or partnership options.');
  }
  if (handpickedEventsPath && (recommendationUrl || hasForcedArguments || sourceRoundupPath || regenerationRequests.length || savePartnership)) {
    throw new Error('--events-file cannot be combined with recommendation, forced, roundup, regeneration, or partnership options.');
  }
  const forceEventUrl = normalizedForcedEventUrl(forceEventUrlInput);
  const forcedInputEvents = forceEventUrl
    ? [await fetchForcedEventFromUrl({ url: forceEventUrl, city: forcedCity, date: forcedDate })]
    : [];
  let partnershipSaved = false;
  if (savePartnership && forcedInputEvents.length) {
    const duplicate = getForcedPartnershipEvents({ city: forcedCity, date: forcedDate })
      .some((event) => new URL(event.url || event.sourceUrl).href === forceEventUrl);
    if (!duplicate) {
      await savePartnershipEvent(join(projectRoot, 'lib/social-partnership-events.js'), forcedInputEvents[0]);
      partnershipSaved = true;
    }
  }
  const regions = forcedInputEvents.length ? [{ slug: forcedCity.toLowerCase().replace(/\s+/g, '-'), city: forcedCity, label: forcedCity, eventLimit: 1 }] : configuredRegions;
  const regenerationTargets = new Set(regenerationRequests.map(parseRegenerationRequest).map(regenerationKey));
  await mkdir(outputDir, { recursive: true });
  const rejectedEventsPath = join(outputDir, 'event-feedback.json');
  const rejectedEvents = [...await readRejectedEvents(rejectedEventsPath), ...rejectedEventRequests.map(parseRejectedEvent)]
    .filter((event, index, events) => event.title
      && events.findIndex((candidate) => rejectedEventKey(candidate) === rejectedEventKey(event)) === index);
  if (rejectedEventRequests.length) {
    await writeFile(rejectedEventsPath, `${JSON.stringify(rejectedEvents, null, 2)}\n`);
  }
  const excludedEventSlots = new Set(rejectedEvents.flatMap(rejectedEventKeys));
  let handpickedEvents = [];
  if (handpickedEventsPath) {
    const specs = JSON.parse(await readFile(handpickedEventsPath, 'utf8'));
    if (!Array.isArray(specs) || !specs.length) throw new Error('--events-file must contain a non-empty JSON array.');
    handpickedEvents = await Promise.all(specs.map(async (spec, index) => {
      const dates = (Array.isArray(spec.dates) ? spec.dates : [spec.date]).filter(Boolean);
      if (!spec.url || !spec.city || !dates.length || dates.some((date) => !validForcedDate(date))) {
        throw new Error(`Invalid event at --events-file index ${index}; url, city, and valid YYYY-MM-DD date(s) are required.`);
      }
      let fetched = {};
      try {
        fetched = await fetchForcedEventFromUrl({ url: spec.url, city: spec.city, date: dates[0] });
      } catch (error) {
        if (!spec.title) throw error;
        fetched = { sourceUrl: spec.url, url: spec.url, sourceLabel: new URL(spec.url).hostname };
      }
      const event = {
        ...fetched,
        ...spec,
        date: dates[0],
        dateLabel: spec.dateLabel || dates.join(', '),
        sourceUrl: spec.url,
        url: spec.url,
      };
      const post = makeSocialPost({
        event,
        city: spec.city,
        regionLabel: spec.city,
        dateLabel: event.dateLabel,
        sourceUrl: spec.url,
        sourceLabel: event.sourceLabel,
      });
      if (Array.isArray(spec.highlights) && spec.highlights.length) post.highlights = spec.highlights;
      return post;
    }));
  }
  const handpickedDates = handpickedEvents.flatMap((post) => post.dateLabel.match(/\d{4}-\d{2}-\d{2}/g) || [post.date]).sort();
  const handpickedWeekKey = handpickedDates.find((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 6)
    || handpickedDates[0];
  const handpickedRun = handpickedEvents.length ? {
    generatedAt: new Date().toISOString(),
    weekKey: handpickedWeekKey,
    startDate: handpickedDates[0],
    endDate: handpickedDates[handpickedDates.length - 1],
    regions: [...new Set(handpickedEvents.map((post) => post.city))].map((city) => ({ city, label: city })),
    slotCount: handpickedEvents.length,
    posts: handpickedEvents,
    statuses: handpickedEvents.map((post) => ({ city: post.city, day: post.dateLabel, matched: true, providerStatus: 'Hand-picked URL selected.' })),
    searchMode: 'handpicked-urls',
    sourcePath: handpickedEventsPath,
  } : null;
  const run = sourceRoundupPath
    ? await loadRunFromRoundup(sourceRoundupPath)
    : recommendationUrl
      ? await generateSocialPostsFromRecommendationUrl({ url: recommendationUrl, excludeUrls: excludedRecommendationUrls })
    : handpickedRun
      ? handpickedRun
    : await generateWeeklySocialPosts({
      regions,
      alternateSlots: regenerationTargets,
      excludedEventSlots,
      forcedInputEvents,
      dates: forcedInputEvents.length ? [forcedDate] : [],
      includeCandidateScores: listScores,
      parentMapOnly: !normalEventSearch,
      venueDistanceFilter,
      maxDistanceMiles,
    });
  let cacheWrite = { count: 0, target: 'none' };
  try {
    cacheWrite = await writeSocialRunToFamilyEventCache(run);
  } catch (error) {
    console.warn(`Family-event cache write skipped: ${error.message}`);
  }
  const existingPosterNames = await readExistingPosterNames(outputDir);
  const posterLimit = sampleRun ? 1 : MAX_WEEKLY_POSTERS;
  const isHandpickedRun = run.searchMode === 'handpicked-urls';
  const isRecommendationRun = Boolean(recommendationUrl || run.searchMode === 'recommendations-url' || isHandpickedRun);
  const posterSet = isRecommendationRun
    ? [...run.posts].sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0)).slice(0, posterLimit)
    : selectPosterSet(run.posts, posterLimit, run.weekKey, regenerationTargets);
  const includeTitleInFilename = isRecommendationRun;
  const filenameSlotCounts = new Map();
  for (const post of posterSet) {
    const slot = `${post.city.toLowerCase()}|${post.date || run.weekKey}`;
    filenameSlotCounts.set(slot, (filenameSlotCounts.get(slot) || 0) + 1);
  }
  const filenameFor = (post) => {
    const slot = `${post.city.toLowerCase()}|${post.date || run.weekKey}`;
    return posterFilename(post, run.weekKey, includeTitleInFilename || filenameSlotCounts.get(slot) > 1);
  };
  const posterPosts = posterSet.filter((post) => forcedInputEvents.length
    || regenerationTargets.has(regenerationSlotKey(post, run.weekKey))
    || !existingPosterNames.has(filenameFor(post)));
  const supportsSummaryPoster = Boolean(run.posts.length && (!forcedInputEvents.length || isHandpickedRun) && run.searchMode !== 'forced-url');
  const summaryPosterFilename = supportsSummaryPoster
    ? `${isHandpickedRun ? 'weekly' : isRecommendationRun ? 'recommendations' : 'weekly'}-${run.weekKey}-all-events.png`
    : '';
  const shouldGenerateSummaryPoster = Boolean(summaryPosterFilename
    && (!existingPosterNames.has(summaryPosterFilename) || regenerationTargets.size > 0));
  const roundupPosterPosts = posterSet;
  const roundup = makeWeeklyRoundup(roundupPosterPosts, run.startDate, run.endDate);
  roundup.caption = limitWords(roundup.caption);
  const matchedRegenerationTargets = new Set(posterPosts.filter((post) => regenerationTargets.has(regenerationSlotKey(post, run.weekKey))).map((post) => regenerationSlotKey(post, run.weekKey)));
  const unmatchedRegenerationRequests = [...regenerationTargets].filter((target) => !matchedRegenerationTargets.has(target));
  const artifactPrefix = `${isHandpickedRun ? 'weekly' : isRecommendationRun ? 'recommendations' : 'weekly'}-${run.weekKey}`;
  const manifestPath = join(outputDir, `${artifactPrefix}.json`);
  const promptPath = join(outputDir, `${artifactPrefix}.jsonl`);
  const manifest = {
    ...run,
    roundup,
    imageDirectory: outputDir,
    imageGenCommand: imageGen,
    posterLimit,
    existingPosterCount: existingPosterNames.size,
    skippedExistingPosterCount: forcedInputEvents.length ? 0 : posterSet.filter((post) => existingPosterNames.has(filenameFor(post))
      && !regenerationTargets.has(regenerationSlotKey(post, run.weekKey))).length,
    regenerationRequests,
    feedback,
    rejectedEvents,
    unmatchedRegenerationRequests,
    sampleRun,
    posterPostIds: posterPosts.map((post) => post.id),
    posterSetPostIds: posterSet.map((post) => post.id),
    summaryPoster: supportsSummaryPoster ? {
      filename: summaryPosterFilename,
      eventCount: run.posts.length,
      eventPostIds: run.posts.map((post) => post.id),
      generatedThisRun: shouldGenerateSummaryPoster,
    } : null,
    posterLimitByRegion: Object.fromEntries([...new Set(posterSet.map((post) => post.regionSlug || post.region))]
      .map((region) => [region, regionPosterLimit(posterSet.find((post) => (post.regionSlug || post.region) === region))])),
    roundupPostIds: roundupPosterPosts.map((post) => post.id),
    roundupWordLimit: MAX_ROUNDUP_WORDS,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const roundupPath = join(outputDir, `${artifactPrefix}-roundup.md`);
  const shouldWriteRoundup = !sourceRoundupPath && (regenerationTargets.size === 0 || matchedRegenerationTargets.size > 0);
  if (shouldWriteRoundup) {
    await writeFile(roundupPath, `# ${roundup.title}\n\n${roundup.caption}\n`);
  }
  const jobs = posterPosts.map((post) => ({
    prompt: posterPrompt(post),
    use_case: 'ads-marketing',
    size: `${POSTER_FORMAT.width}x${POSTER_FORMAT.height}`,
    quality: 'high',
    out: filenameFor(post),
  }));
  if (shouldGenerateSummaryPoster) jobs.push({
    prompt: recommendationSummaryPosterPrompt(run.posts, run.startDate, run.endDate),
    use_case: 'ads-marketing',
    size: `${POSTER_FORMAT.width}x${POSTER_FORMAT.height}`,
    quality: 'high',
    out: summaryPosterFilename,
  });
  await writeFile(promptPath, jobs.map((job) => JSON.stringify(job)).join('\n') + (jobs.length ? '\n' : ''));

  console.log(forcedInputEvents.length ? `Event date: ${run.startDate}` : `Weekend: ${run.startDate}–${run.endDate}`);
  if (sourceRoundupPath) console.log(`Source roundup: ${sourceRoundupPath} (event search skipped).`);
  else if (recommendationUrl) console.log(`Event search mode: recommendations from ${recommendationUrl}.`);
  else if (isHandpickedRun) console.log(`Event search mode: hand-picked URLs from ${run.sourcePath}.`);
  else if (forcedInputEvents.length) console.log(`Event search mode: forced URL for ${forcedCity} on ${forcedDate}.`);
  else console.log(`Event search mode: ${venueDistanceFilter ? `ParentMap venues within ${maxDistanceMiles} miles` : normalEventSearch ? 'legacy merged providers and web fallback' : 'ParentMap region parameters'}.`);
  if (savePartnership) console.log(partnershipSaved
    ? 'Saved forced event to lib/social-partnership-events.js.'
    : 'Partnership event already exists; source file was unchanged.');
  if (excludedRecommendationUrls.length) console.log(`Excluded recommendation URLs: ${excludedRecommendationUrls.join(', ')}`);
  if (listScores) printCandidateScores(run.candidateScores || []);
  console.log(`Matched ${run.posts.length} of ${run.slotCount || run.regions.length * 2} event slots.`);
  console.log(`Family-event cache: wrote ${cacheWrite.count} city row${cacheWrite.count === 1 ? '' : 's'} to ${cacheWrite.target}.`);
  const skippedExistingCount = forcedInputEvents.length ? 0 : posterSet.filter((post) => existingPosterNames.has(filenameFor(post))
    && !regenerationTargets.has(regenerationSlotKey(post, run.weekKey))).length;
  console.log(`Poster jobs: ${jobs.length} (${posterPosts.length} individual of ${run.posts.length} matched events${supportsSummaryPoster ? ` plus ${shouldGenerateSummaryPoster ? '1' : '0'} all-events summary` : ''}; ${sampleRun ? 'sample limit: 1' : `weekly individual limit: ${MAX_WEEKLY_POSTERS}`}; skipped ${skippedExistingCount} existing).`);
  if (regenerationRequests.length) console.log(`Regenerating: ${regenerationRequests.join('; ')}`);
  if (unmatchedRegenerationRequests.length) console.warn(`No matching event found for regeneration request(s): ${unmatchedRegenerationRequests.join(', ')}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Prompts:  ${promptPath}`);
  console.log(`Roundup:  ${roundupPath}${shouldWriteRoundup ? '' : ' (unchanged; no alternate event found)'}`);
  for (const status of run.statuses) {
    const cities = Array.isArray(status.cities) && status.cities.length ? ` in ${status.cities.join(', ')}` : '';
    console.log(`${status.regionLabel || status.region || status.city} ${status.day}: ${status.matched ? `matched ${status.selectedCount || 1}${cities}` : status.providerStatus}`);
  }

  if (dryRun || skipImages || jobs.length === 0) {
    console.log(dryRun ? 'Dry run: no images generated.' : 'Image generation skipped.');
    return;
  }
  try {
    await runImageBatch(jobs, promptPath, outputDir, matchedRegenerationTargets.size > 0 || forcedInputEvents.length > 0);
    console.log(`Generated ${jobs.length} poster image${jobs.length === 1 ? '' : 's'} in ${outputDir}`);
  } catch (error) {
    console.error(error.stderr || error.message);
    console.error('Image generation needs OPENAI_API_KEY and network access. The manifest and prompts were kept.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
