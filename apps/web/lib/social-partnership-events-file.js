import { readFile, writeFile } from 'node:fs/promises';

const PERSISTED_EVENT_FIELDS = [
  'city',
  'date',
  'title',
  'summary',
  'theme',
  'dateLabel',
  'timeLabel',
  'venue',
  'venueAddress',
  'url',
  'sourceUrl',
  'imageUrl',
  'source',
  'sourceLabel',
  'tags',
  'ageSlugs',
  'free',
  'resultType',
  'forcedRecommendation',
  'recommendationType',
];

export function partnershipEventRecord(event = {}) {
  const record = {};
  for (const field of PERSISTED_EVENT_FIELDS) {
    if (event[field] !== undefined && event[field] !== '') record[field] = event[field];
  }
  return {
    ...record,
    source: 'partnership',
    forcedRecommendation: true,
    recommendationType: 'partnership',
  };
}

export function appendPartnershipEventSource(source, event) {
  const markerIndex = String(source || '').lastIndexOf('\n];');
  if (markerIndex < 0) throw new Error('Could not find the PARTNERSHIP_EVENTS array terminator.');
  const serialized = JSON.stringify(partnershipEventRecord(event), null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return `${source.slice(0, markerIndex)}\n${serialized},${source.slice(markerIndex)}`;
}

export async function savePartnershipEvent(path, event) {
  const source = await readFile(path, 'utf8');
  await writeFile(path, appendPartnershipEventSource(source, event));
}
