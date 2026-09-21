#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { DEFAULT_SOCIAL_REGIONS, generateWeeklySocialPosts, makeWeeklyRoundup } from '../lib/social-post-agent.js';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const imageGen = process.env.IMAGE_GEN || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills/.system/imagegen/scripts/image_gen.py');
const MAX_WEEKLY_POSTERS = 8;
const MAX_ROUNDUP_WORDS = 670;
const DEFAULT_CITY_POSTER_LIMIT = 1;
const CITY_POSTER_LIMITS = new Map([
  ['seattle', 2],
  ['bellevue', 2],
]);
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
      city: String(value.city || '').trim().toLowerCase(),
      date: String(value.date || '').trim(),
      title,
      normalizedTitle: normalizeFeedbackText(value.normalizedTitle || title),
      family: normalizeFeedbackText(value.family || eventFamilyKey(title)),
      reason: String(value.reason || '').trim(),
    };
  }
  const [city, date, title, ...reasonParts] = value.split('|');
  const rawTitle = (title || '').trim();
  return {
    city: (city || '').trim().toLowerCase(),
    date: (date || '').trim(),
    title: rawTitle,
    normalizedTitle: normalizeFeedbackText(rawTitle),
    family: eventFamilyKey(rawTitle),
    reason: reasonParts.join('|').trim(),
  };
}

function normalizeFeedbackText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function eventFamilyKey(value) {
  const title = String(value ?? '').trim().toLowerCase();
  // Treat the shared series name before a location suffix as one family, so
  // rejecting “Salmon SEEson at North Creek Trail Park” also rejects its
  // “Salmon SEEson at Issaquah Creek” variant.
  const spacedFamily = /\s+at\s+/i.test(title) ? title.split(/\s+at\s+/i)[0] : '';
  const compactMatch = title.match(/^(.{8,})at[a-z0-9\u4e00-\u9fff]{5,}$/);
  const family = normalizeFeedbackText(spacedFamily || compactMatch?.[1] || '');
  return family.length >= 8 ? family : '';
}

function rejectedEventKey(event) {
  return `${event.city}|${event.date}|${event.normalizedTitle || normalizeFeedbackText(event.title)}`;
}

function rejectedEventKeys(event) {
  const keys = [rejectedEventKey(event)];
  if (event.family) keys.push(`family|${event.family}`);
  return keys;
}

const dryRun = process.argv.includes('--dry-run');
const skipImages = process.argv.includes('--skip-images');
const sampleRun = process.argv.includes('--sample');
const regenerationRequests = argValues('--regenerate');
const rejectedEventRequests = argValues('--reject-event');
const feedback = argValue('--feedback');
const sourceRoundupPath = argValue('--from-roundup');
const outputDir = resolve(argValue('--output', join(projectRoot, 'output/social-posts')));
const defaultRegionList = DEFAULT_SOCIAL_REGIONS.map((item) => item.city).join(',');
const regions = argValue('--regions', defaultRegionList)
  .split(',')
  .map((city) => city.trim())
  .filter(Boolean)
  .map((city) => ({ city, label: city }));

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
  return `Use case: ads-marketing
Asset type: fixed-format vertical ${POSTER_FORMAT.aspectRatio} Mandarin social media event poster
Primary request: Create a polished family-event poster for ${post.title} in ${post.city} using the exact reusable SproutCue template modeled on the supplied reference layout.
Canvas: exactly ${POSTER_FORMAT.width}x${POSTER_FORMAT.height} px, ${POSTER_FORMAT.aspectRatio}; keep all content inside a ${POSTER_FORMAT.safeMargin} safe margin.
Fixed visual system: warm cream paper-textured background; deep navy #082b52 ribbon and facts bar; rounded coral-orange #f0643d event panel; cream stitched banners; leafy green #3c713d accents; three cheerful flat-cartoon family characters; crisp dark outlines; soft print texture; consistent bright family-friendly palette. Only the event content and a subtle city landmark may change between posters.
Fixed reference layout, from top to bottom: (1) top 11% — a centered navy swallowtail ribbon containing the city/day headline, with small orange accent marks and leafy sprigs around it; (2) 11–34% — one large rounded coral-orange panel with a thin cream stitched border containing the event name in large cream display type, wrapping across no more than three lines; (3) 31–40% — a cream swallowtail banner overlapping the lower edge of the orange panel with the fixed weekend label; (4) 36–70% — a welcoming city scene with exactly three family characters, centered beneath the banners, with no text over the illustration; (5) 69–79% — one rounded cream feature strip divided into three equal tiles with circular icons; (6) 79–88% — one full-width navy facts bar divided into three columns for date, time, and location; (7) 88–96% — a centered green Mandarin call-to-action with leafy/orange accents; (8) 96–100% — a centered navy pill containing the SproutCue credit. Preserve this order, alignment, proportions, and generous spacing for every poster.
Feature tile copy: use these exact three event-specific feature tiles in the three equal feature tiles, in this order:
${featureTileText}
Text rules: render only the following text blocks in their assigned template sections, with no extra copy, labels, QR codes, logos, watermarks, or decorative lettering:
“${post.headline}”
“${post.title}”
“周末亲子精选”
${featureTiles.map((tile) => `“${tile.title}”\n“${tile.subtitle}”`).join('\n')}
“${post.dateLabel || post.date || '本周末'}”
“${post.timeLabel || '时间请以活动页面为准'}”
“${post.venue || post.city}”
“${post.bannerText || '带上家人，一起去玩！'}”
“资料整理：SproutCue”${revisionFeedback}
Constraints: preserve every supplied event text and fact exactly; keep the three feature tiles exactly as written; prioritize mobile legibility over illustration detail; use no alternate layout, collage, dense background, extra text, event-source label, QR code, phone number, fake logo, watermark, invented detail, or tiny unreadable copy.`;
}

function posterFilename(post, weekKey) {
  return `${post.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${post.date || weekKey}.png`;
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
    return Array.isArray(value) ? value.map(parseRejectedEvent).filter((event) => event.city && event.date && event.title) : [];
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

function cityPosterLimit(city) {
  return CITY_POSTER_LIMITS.get(city.toLowerCase()) || DEFAULT_CITY_POSTER_LIMIT;
}

function selectPosterSet(posts, limit = MAX_WEEKLY_POSTERS, weekKey = '', regenerationTargets = new Set()) {
  const groups = new Map();
  for (const post of posts) {
    if (!groups.has(post.city)) groups.set(post.city, []);
    groups.get(post.city).push(post);
  }
  const selected = [];
  const selectedEventKeys = new Set();
  const isRegenerationTarget = (post) => regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || weekKey}`);
  for (const cityPosts of groups.values()) {
    const targets = cityPosts.filter(isRegenerationTarget);
    const ranked = [...cityPosts].sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0));
    const cityCandidates = [...targets, ...ranked].filter((post, index, candidates) => candidates.findIndex((candidate) => candidate.id === post.id) === index);
    for (const post of cityCandidates.slice(0, cityPosterLimit(cityPosts[0].city))) {
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

async function main() {
  const regenerationTargets = new Set(regenerationRequests.map(parseRegenerationRequest).map(regenerationKey));
  await mkdir(outputDir, { recursive: true });
  const rejectedEventsPath = join(outputDir, 'event-feedback.json');
  const rejectedEvents = [...await readRejectedEvents(rejectedEventsPath), ...rejectedEventRequests.map(parseRejectedEvent)]
    .filter((event, index, events) => event.city && event.date && event.title
      && events.findIndex((candidate) => rejectedEventKey(candidate) === rejectedEventKey(event)) === index);
  if (rejectedEventRequests.length) {
    await writeFile(rejectedEventsPath, `${JSON.stringify(rejectedEvents, null, 2)}\n`);
  }
  const excludedEventSlots = new Set(rejectedEvents.flatMap(rejectedEventKeys));
  const run = sourceRoundupPath
    ? await loadRunFromRoundup(sourceRoundupPath)
    : await generateWeeklySocialPosts({ regions, alternateSlots: regenerationTargets, excludedEventSlots });
  const existingPosterNames = await readExistingPosterNames(outputDir);
  const posterLimit = sampleRun ? 1 : MAX_WEEKLY_POSTERS;
  const posterSet = selectPosterSet(run.posts, posterLimit, run.weekKey, regenerationTargets);
  const posterPosts = posterSet.filter((post) => regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || run.weekKey}`)
    || !existingPosterNames.has(posterFilename(post, run.weekKey)));
  const roundupPosterPosts = posterSet;
  const roundup = makeWeeklyRoundup(roundupPosterPosts, run.startDate, run.endDate);
  roundup.caption = limitWords(roundup.caption);
  const matchedRegenerationTargets = new Set(posterPosts.filter((post) => regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || run.weekKey}`)).map((post) => `${post.city.toLowerCase()}|${post.date || run.weekKey}`));
  const unmatchedRegenerationRequests = [...regenerationTargets].filter((target) => !matchedRegenerationTargets.has(target));
  const manifestPath = join(outputDir, `weekly-${run.weekKey}.json`);
  const promptPath = join(outputDir, `weekly-${run.weekKey}.jsonl`);
  const manifest = {
    ...run,
    roundup,
    imageDirectory: outputDir,
    imageGenCommand: imageGen,
    posterLimit,
    existingPosterCount: existingPosterNames.size,
    skippedExistingPosterCount: posterSet.filter((post) => existingPosterNames.has(posterFilename(post, run.weekKey))
      && !regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || run.weekKey}`)).length,
    regenerationRequests,
    feedback,
    rejectedEvents,
    unmatchedRegenerationRequests,
    sampleRun,
    posterPostIds: posterPosts.map((post) => post.id),
    posterSetPostIds: posterSet.map((post) => post.id),
    posterLimitByCity: Object.fromEntries([...new Set(posterSet.map((post) => post.city))].map((city) => [city, cityPosterLimit(city)])),
    roundupPostIds: roundupPosterPosts.map((post) => post.id),
    roundupWordLimit: MAX_ROUNDUP_WORDS,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const roundupPath = join(outputDir, `weekly-${run.weekKey}-roundup.md`);
  const shouldWriteRoundup = !sourceRoundupPath && (regenerationTargets.size === 0 || matchedRegenerationTargets.size > 0);
  if (shouldWriteRoundup) {
    await writeFile(roundupPath, `# ${roundup.title}\n\n${roundup.caption}\n`);
  }
  const jobs = posterPosts.map((post) => ({
    prompt: posterPrompt(post),
    use_case: 'ads-marketing',
    size: `${POSTER_FORMAT.width}x${POSTER_FORMAT.height}`,
    quality: 'high',
    out: posterFilename(post, run.weekKey),
  }));
  await writeFile(promptPath, jobs.map((job) => JSON.stringify(job)).join('\n') + (jobs.length ? '\n' : ''));

  console.log(`Weekend: ${run.startDate}–${run.endDate}`);
  if (sourceRoundupPath) console.log(`Source roundup: ${sourceRoundupPath} (event search skipped).`);
  console.log(`Matched ${run.posts.length} of ${run.regions.length * 2} Saturday/Sunday slots.`);
  const skippedExistingCount = posterSet.filter((post) => existingPosterNames.has(posterFilename(post, run.weekKey))
    && !regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || run.weekKey}`)).length;
  console.log(`Poster jobs: ${jobs.length} of ${run.posts.length} matched events (${sampleRun ? 'sample limit: 1' : `weekly limit: ${MAX_WEEKLY_POSTERS}`}; skipped ${skippedExistingCount} existing).`);
  if (regenerationRequests.length) console.log(`Regenerating: ${regenerationRequests.join('; ')}`);
  if (unmatchedRegenerationRequests.length) console.warn(`No matching event found for regeneration request(s): ${unmatchedRegenerationRequests.join(', ')}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Prompts:  ${promptPath}`);
  console.log(`Roundup:  ${roundupPath}${shouldWriteRoundup ? '' : ' (unchanged; no alternate event found)'}`);
  for (const status of run.statuses) console.log(`${status.city} ${status.day}: ${status.matched ? 'matched' : status.providerStatus}`);

  if (dryRun || skipImages || jobs.length === 0) {
    console.log(dryRun ? 'Dry run: no images generated.' : 'Image generation skipped.');
    return;
  }
  try {
    await runImageBatch(jobs, promptPath, outputDir, matchedRegenerationTargets.size > 0);
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
