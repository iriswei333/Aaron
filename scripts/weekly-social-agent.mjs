#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { DEFAULT_SOCIAL_REGIONS, generateWeeklySocialPosts, makeWeeklyRoundup } from '../lib/social-post-agent.js';

const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const imageGen = process.env.IMAGE_GEN || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills/.system/imagegen/scripts/image_gen.py');
const MAX_WEEKLY_POSTERS = 8;
const MAX_ROUNDUP_WORDS = 670;

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

const dryRun = process.argv.includes('--dry-run');
const skipImages = process.argv.includes('--skip-images');
const sampleRun = process.argv.includes('--sample');
const regenerationRequests = argValues('--regenerate');
const feedback = argValue('--feedback');
const outputDir = resolve(argValue('--output', join(projectRoot, 'output/social-posts')));
const defaultRegionList = DEFAULT_SOCIAL_REGIONS.map((item) => item.city).join(',');
const regions = argValue('--regions', defaultRegionList)
  .split(',')
  .map((city) => city.trim())
  .filter(Boolean)
  .map((city) => ({ city, label: city }));

function posterPrompt(post) {
  const revisionFeedback = feedback ? `\nRevision feedback to address: ${feedback}\n` : '';
  return `Use case: ads-marketing
Asset type: vertical 4:5 Mandarin social media event poster
Primary request: Create a polished Mandarin family-event poster for ${post.title} in ${post.city}, based on a clean, friendly community flyer style similar to a children’s safety-day poster: warm cream background, rounded coral/orange headline panel, bold readable display typography, three cheerful illustrated family characters, a navy ribbon, simple circular feature icons, and clear information bands.
Scene/backdrop: welcoming local weekend event with a subtle ${post.city} landmark or neighborhood backdrop, simplified so the text remains easy to read.
Style/medium: professional flat cartoon illustration, bright family-friendly colors, crisp outlines, light print texture, generous margins, no dense collage.
Composition/framing: vertical 4:5; headline in the top third; family characters in the middle; date/time/location and SproutCue brand credit in clean bands near the bottom.
Text (verbatim; render exactly in simplified Chinese and English where shown):
“${post.headline}”
“${post.title}”
“周末亲子精选”
“${post.dateLabel || post.date || '本周末'}”
“${post.timeLabel || '时间请以活动页面为准'}”
“${post.venue || post.city}”
“${post.bannerText || '带上家人，一起去玩！'}”
“资料整理：SproutCue”${revisionFeedback}
Constraints: preserve the event title and facts exactly; keep only the SproutCue brand name as the poster credit; make all text legible at mobile size; no event-source label, QR code, phone number, fake logo, watermark, invented detail, or tiny unreadable copy.`;
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

function selectPosterPosts(posts, limit = MAX_WEEKLY_POSTERS, existingPosterNames = new Set(), weekKey = '', regenerationTargets = new Set()) {
  const groups = new Map();
  for (const post of posts) {
    if (!groups.has(post.city)) groups.set(post.city, []);
    groups.get(post.city).push(post);
  }
  const selected = [];
  const selectedIds = new Set();
  const selectedEventKeys = new Set();
  const isRegenerationTarget = (post) => regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || weekKey}`);
  for (const post of posts) {
    if (selected.length >= limit) break;
    const eventKey = posterEventKey(post);
    if (isRegenerationTarget(post) && !selectedEventKeys.has(eventKey)) {
      selected.push(post);
      selectedIds.add(post.id);
      selectedEventKeys.add(eventKey);
    }
  }
  let offset = 0;
  while (selected.length < limit) {
    let added = false;
    for (const cityPosts of groups.values()) {
      const post = cityPosts[offset];
      if (post && selected.length < limit && !selectedIds.has(post.id)
        && !selectedEventKeys.has(posterEventKey(post))
        && (isRegenerationTarget(post) || !existingPosterNames.has(posterFilename(post, weekKey)))) {
        selected.push(post);
        selectedIds.add(post.id);
        selectedEventKeys.add(posterEventKey(post));
        added = true;
      }
    }
    if (!added) break;
    offset += 1;
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
  const run = await generateWeeklySocialPosts({ regions, alternateSlots: regenerationTargets });
  await mkdir(outputDir, { recursive: true });
  const existingPosterNames = await readExistingPosterNames(outputDir);
  const posterLimit = sampleRun ? 1 : MAX_WEEKLY_POSTERS;
  const posterPosts = selectPosterPosts(run.posts, posterLimit, existingPosterNames, run.weekKey, regenerationTargets);
  const roundupPosterPosts = [...posterPosts, ...run.posts.filter((post) => existingPosterNames.has(posterFilename(post, run.weekKey)))]
    .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index)
    .slice(0, posterLimit);
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
    skippedExistingPosterCount: run.posts.filter((post) => existingPosterNames.has(posterFilename(post, run.weekKey))
      && !regenerationTargets.has(`${post.city.toLowerCase()}|${post.date || run.weekKey}`)).length,
    regenerationRequests,
    feedback,
    unmatchedRegenerationRequests,
    sampleRun,
    posterPostIds: posterPosts.map((post) => post.id),
    roundupPostIds: roundupPosterPosts.map((post) => post.id),
    roundupWordLimit: MAX_ROUNDUP_WORDS,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const roundupPath = join(outputDir, `weekly-${run.weekKey}-roundup.md`);
  const shouldWriteRoundup = regenerationTargets.size === 0 || matchedRegenerationTargets.size > 0;
  if (shouldWriteRoundup) {
    await writeFile(roundupPath, `# ${roundup.title}\n\n${roundup.caption}\n`);
  }
  const jobs = posterPosts.map((post) => ({
    prompt: posterPrompt(post),
    use_case: 'ads-marketing',
    size: '1024x1536',
    quality: 'high',
    out: posterFilename(post, run.weekKey),
  }));
  await writeFile(promptPath, jobs.map((job) => JSON.stringify(job)).join('\n') + (jobs.length ? '\n' : ''));

  console.log(`Weekend: ${run.startDate}–${run.endDate}`);
  console.log(`Matched ${run.posts.length} of ${run.regions.length * 2} Saturday/Sunday slots.`);
  const skippedExistingCount = run.posts.filter((post) => existingPosterNames.has(posterFilename(post, run.weekKey))
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
