import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFamilyEvent, normalizePlayground, normalizeStoryTime, uniqueDiscoverItems } from '../src/discover-normalizers.js';
import { createDiscoverClient } from '../src/discover-client.js';
import {
  createPlaydatePayload, discoverCountLabel, discoverEmptyCopy, discoverFilterIsActive, discoverGeocodeQuery, discoverKindIcon,
  discoverKindLabel, discoverMapUrl, discoverPlanFor, discoverScheduleLabel, familyEventId, formatReverseGeocode, geocodeAddress,
  playgroundRecommendationReason, savedPlanFor, storyTimeId, uniqueById,
} from '../src/discover-view.js';
import * as shared from '../src/index.js';

const event = { title: 'Pumpkin Patch Fun!', dateLabel: 'Sat, Oct 10', timeLabel: '10 AM', venue: 'Oxbow Farm', url: 'https://example.com/e/1', date: '2026-10-10' };

test('index re-exports discover view helpers', () => {
  assert.equal(typeof shared.discoverKindLabel, 'function');
});

test('filters, labels and icons', () => {
  assert.equal(discoverFilterIsActive('all', { kinds: ['playdate'] }), true);
  assert.equal(discoverFilterIsActive('all', { todayOnly: true }), false);
  assert.equal(discoverFilterIsActive('playdate', { kinds: ['playdate'] }), true);
  assert.equal(discoverKindLabel('family_event'), 'Family event');
  assert.equal(discoverKindIcon('story_time'), '📖');
  assert.equal(discoverCountLabel(1), '1 idea');
  assert.equal(discoverCountLabel(4), '4 ideas');
  assert.match(discoverEmptyCopy({ todayOnly: true }).title, /today/);
});

test('schedule label prefers startsAt, then provider labels', () => {
  assert.equal(discoverScheduleLabel({ schedule: { dateLabel: 'Sat, Oct 10', timeLabel: '10 AM' } }), 'Sat, Oct 10 · 10 AM');
  assert.match(discoverScheduleLabel({ schedule: { startsAt: '2026-10-10T17:30:00Z' } }), / · /);
  assert.equal(discoverScheduleLabel({}), '');
});

test('saved plan ids match the web ids', () => {
  assert.equal(familyEventId(event), 'pumpkin-patch-fun-sat-oct-10-10-am-oxbow-farm-https-example-com-e-1');
  assert.equal(storyTimeId({ id: 'SPL:123' }), 'spl-123');
  const item = normalizeFamilyEvent(event);
  const plan = discoverPlanFor(item);
  assert.equal(plan.kind, 'external_event');
  assert.equal(plan.externalId, familyEventId(event));
  assert.equal(savedPlanFor(item, [{ kind: 'external_event', externalId: plan.externalId, status: 'attending', id: 'p1' }]).id, 'p1');
  assert.equal(savedPlanFor(item, [{ kind: 'external_event', externalId: plan.externalId, status: 'cancelled' }]), null);
  const story = normalizeStoryTime({ id: 's1', title: 'Baby Story Time', tags: ['baby'] });
  assert.equal(discoverPlanFor(story).kind, 'story_time');
  assert.deepEqual(discoverPlanFor(story).metadata.tags, ['baby']);
  assert.equal(discoverPlanFor(normalizeStoryTime({ title: 'More', resultType: 'search-link' })), null);
  assert.equal(discoverPlanFor(normalizePlayground({ key: 'p', name: 'Park' })), null);
});

test('recommendation reason and map links', () => {
  assert.match(playgroundRecommendationReason({ preference: 'outdoor', distance: '0.4 mi' }, false), /outdoor play today; 0.4 mi/);
  assert.match(playgroundRecommendationReason({ preference: 'outdoor' }, true), /weather-friendly outdoor/);
  const withCoords = normalizePlayground({ key: 'k', name: 'Denny Park', latitude: 47.6, longitude: -122.3 });
  assert.equal(discoverMapUrl(withCoords), 'https://www.google.com/maps/search/?api=1&query=47.6%2C-122.3');
  const noCoords = normalizeFamilyEvent(event);
  assert.equal(discoverGeocodeQuery(noCoords, 'Seattle'), 'Oxbow Farm, Seattle');
  assert.match(discoverMapUrl(noCoords, 'Seattle'), /Oxbow%20Farm%2C%20Seattle/);
  assert.equal(discoverGeocodeQuery(normalizeStoryTime({ venue: 'Ballard', source: 'spl' })), 'Ballard, Seattle Public Library, Seattle, WA, USA');
});

test('playdate payload and merging', () => {
  const payload = createPlaydatePayload({ key: 'denny', name: 'Denny Park', type: 'Park', latitude: 1, longitude: 2 }, {
    startsAt: 'a', endsAt: 'b', visibility: 'nope', maxFamilies: 4, notes: '  snacks ',
  });
  assert.equal(payload.visibility, 'public');
  assert.equal(payload.maxFamilies, '4');
  assert.equal(payload.notes, 'snacks');
  assert.throws(() => createPlaydatePayload({}, { startsAt: 'a', endsAt: 'b' }));
  assert.deepEqual(uniqueById([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: null }]).map((x) => x.id), [1, 2]);
});

test('address lookup falls back to Open-Meteo', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('nominatim')) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({ results: [{ name: 'Ballard', admin1: 'Washington', country: 'United States', latitude: 47.67, longitude: -122.38 }] }) };
  };
  const place = await geocodeAddress('Ballard', fetchImpl);
  assert.equal(calls.length, 2);
  assert.deepEqual(place, { label: 'Ballard', address: 'Ballard, Washington, United States', latitude: 47.67, longitude: -122.38, source: 'open-meteo-geocoding' });
  const direct = await geocodeAddress('x', async () => ({ ok: true, json: async () => [{ lat: '1.5', lon: '2', display_name: 'X St', name: 'X' }] }));
  assert.equal(direct.source, 'nominatim-geocoding');
  await assert.rejects(geocodeAddress('x', async () => ({ ok: false })));
});

test('reverse geocode formatting', () => {
  assert.equal(formatReverseGeocode({ district: 'Greenwood', city: 'Seattle', region: 'WA', country: 'United States' }), 'Greenwood, Seattle, WA, United States');
  assert.equal(formatReverseGeocode({ streetNumber: '100', street: 'Main St', city: 'Seattle', region: 'Seattle' }), '100 Main St, Seattle');
  assert.equal(formatReverseGeocode(null), '');
});

test('repeated provider ids stay unique (one story time at two branches)', async () => {
  const pajama = { id: 'kcls-Pajama Story Time-2026-10-07', title: 'Pajama Story Time', date: '2026-10-07', source: 'kcls' };
  const events = [{ ...pajama, venue: 'Bothell', timeLabel: '6:30 PM' }, { ...pajama, venue: 'Kirkland', timeLabel: '6:30 PM' }, { ...pajama, venue: 'Bothell', timeLabel: '6:30 PM' }];
  const items = uniqueDiscoverItems(events.map(normalizeStoryTime));
  assert.deepEqual(items.map((item) => item.id), ['story_time:kcls-Pajama Story Time-2026-10-07', 'story_time:kcls-Pajama Story Time-2026-10-07#2']);
  const client = createDiscoverClient(async () => ({ events }));
  const result = await client.loadDiscover({ kinds: ['story_time'] });
  assert.equal(new Set(result.groups.storyTimes.map((item) => item.id)).size, 2);
});
