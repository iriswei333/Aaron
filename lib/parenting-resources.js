import { childAgeLabel } from './profile-defaults.js';

const PARENTMAP_BASE_URL = 'https://www.parentmap.com/raising-kids/';
const AGE_FILTERS = ['baby', 'toddlers-preschoolers', 'elementary'];

const HTML_ENTITIES = {
  amp: '&', apos: "'", hellip: '…', ldquo: '“', lsquo: '‘', mdash: '—', ndash: '–', nbsp: ' ', quot: '"', rdquo: '”', rsquo: '’',
};

function cleanText(value, maxLength = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => HTML_ENTITIES[entity.toLowerCase()] || match);
}

function htmlToText(value, maxLength = 240) {
  return cleanText(decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ')), maxLength);
}

function attributeValue(tag, name) {
  const match = String(tag || '').match(new RegExp(`${name}\\s*=\\s*["']([^"']+)`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function absoluteUrl(value) {
  try {
    return new URL(value, PARENTMAP_BASE_URL).toString();
  } catch {
    return '';
  }
}

function imageFromContext(context) {
  const images = [...String(context || '').matchAll(/<img\b[^>]*(?:data-src|data-lazy-src|src|srcset)\s*=\s*["']([^"']+)["'][^>]*>/gi)];
  const image = images.at(-1);
  if (!image) return '';
  const source = image[1].split(',').pop().trim().split(/\s+/)[0];
  return absoluteUrl(source);
}

function tagFromContext(context) {
  const matches = [
    ...String(context || '').matchAll(/<a\b[^>]*class=["'][^"']*wp-block-parent-map-primary-category[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi),
    ...String(context || '').matchAll(/<(?:span|div|a)[^>]*class=["'][^"']*(?:tag|category|topic)[^"']*["'][^>]*>([\s\S]*?)<\//gi),
  ];
  const match = matches.at(-1);
  return htmlToText(match?.[1] || '', 60);
}

function cardContext(html, start, end) {
  const before = html.slice(Math.max(0, start - 5000), start);
  const articleStart = before.lastIndexOf('<article');
  const articleEnd = html.indexOf('</article>', start);
  if (articleStart >= 0 && articleEnd > start) return html.slice(Math.max(0, start - (before.length - articleStart)), articleEnd + 10);
  return html.slice(Math.max(0, start - 6000), Math.min(html.length, end + 6000));
}

function extractResources(html) {
  const resources = [];
  const seen = new Set();
  const titlePattern = /<h3\b[^>]*class=["'][^"']*\barticle-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  while ((match = titlePattern.exec(html)) && resources.length < 20) {
    const titleBlock = match[1];
    const href = absoluteUrl(attributeValue(titleBlock.match(/<a\b[^>]*>/i)?.[0], 'href'));
    const resourceTitle = htmlToText(titleBlock, 180);
    if (!href || !href.includes('parentmap.com/') || resourceTitle.length < 18 || seen.has(href)) continue;
    if (/\/raising-kids\/?(?:\?|#|$)|\/taxonomy\/|\/category\/|\/search\//i.test(href)) continue;
    const nextTitle = titlePattern.lastIndex + 5000;
    const context = cardContext(html, match.index, nextTitle);
    const subtitleBlock = context.match(/<p\b[^>]*class=["'][^"']*\barticle-subtitle\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    seen.add(href);
    resources.push({
      title: resourceTitle,
      url: href,
      thumbnailUrl: imageFromContext(context),
      tag: tagFromContext(context) || 'Parenting tips',
      summary: htmlToText(subtitleBlock?.[1] || '', 240),
    });
  }
  return resources.slice(0, 5);
}

export function parentingAgeFilter(childProfile = {}) {
  const label = childAgeLabel(childProfile).toLowerCase();
  const years = Number(label.match(/(\d+)\s*y/)?.[1]);
  if (Number.isFinite(years)) return years >= 6 ? 'elementary' : years < 2 ? 'baby' : 'toddlers-preschoolers';
  const months = Number(label.match(/(\d+)\s*m/)?.[1]);
  if (Number.isFinite(months)) return months < 24 ? 'baby' : 'toddlers-preschoolers';
  return 'toddlers-preschoolers';
}

export function parentingResourceUrl(ageFilter) {
  const filter = AGE_FILTERS.includes(ageFilter) ? ageFilter : 'toddlers-preschoolers';
  return `${PARENTMAP_BASE_URL}?query-filter-100=${encodeURIComponent(filter)}`;
}

export async function fetchParentingResources(childProfile) {
  const ageFilter = parentingAgeFilter(childProfile);
  const url = parentingResourceUrl(ageFilter);
  const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': 'SproutCue/1.0 parenting resources' } });
  if (!response.ok) throw new Error(`ParentMap returned ${response.status}.`);
  const resources = extractResources(await response.text());
  if (resources.length < 5) throw new Error('ParentMap did not return five article cards.');
  return { ageFilter, sourceUrl: url, resources };
}
