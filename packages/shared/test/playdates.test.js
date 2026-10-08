import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatThreadSchedule,
  filterNearbyPlayDates,
  nextEndTimeValue,
  playDateCapacity,
  playDateWindowFromForm,
  timeValueToMinutes,
} from '../src/playdates.js';

test('time helpers convert and step forward', () => {
  assert.equal(timeValueToMinutes('10:30'), 630);
  assert.equal(timeValueToMinutes('24:00'), null);
  assert.equal(nextEndTimeValue('10:30'), '11:00');
  assert.equal(nextEndTimeValue('23:59'), '');
});

test('playDateWindowFromForm rejects an end before the start', () => {
  assert.throws(() => playDateWindowFromForm('2026-10-10', '11:00', '10:00'), /End time must be after/);
  const window = playDateWindowFromForm('2026-10-10', '10:00', '11:30');
  assert.equal(new Date(window.endsAt) - new Date(window.startsAt), 90 * 60 * 1000);
});

test('playDateCapacity reads families', () => {
  assert.equal(playDateCapacity({ participantCount: 1 }), '1 family');
  assert.equal(playDateCapacity({ participantCount: 2, maxFamilies: 4 }), '2/4 families');
});

test('filterNearbyPlayDates keeps only today', () => {
  const now = new Date(2026, 9, 6, 9, 0);
  const items = [
    { id: 'today', startsAt: new Date(2026, 9, 6, 15, 0).toISOString() },
    { id: 'tomorrow', startsAt: new Date(2026, 9, 7, 10, 0).toISOString() },
  ];
  assert.deepEqual(filterNearbyPlayDates(items, 'today', now).map((item) => item.id), ['today']);
  assert.equal(filterNearbyPlayDates(items, 'all', now).length, 2);
});

test('chatThreadSchedule only formats playdate threads', () => {
  assert.equal(chatThreadSchedule({ type: 'direct', startsAt: '2026-10-10T17:00:00Z' }), '');
  assert.match(chatThreadSchedule({ type: 'playdate', startsAt: '2026-10-10T17:00:00Z', endsAt: '2026-10-10T18:30:00Z' }), /·/);
});
