import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editPlayDatePayload, pendingPlayDateUpdate, playDateCalendarFileName, playDateCalendarIcs, playDateRole, playDateShareContent,
  playDateShareUrl, playDateUpdateKey, sharedPlayDateCapacity, sharedPlayDateWhen,
} from '../src/playdates.js';

const base = { id: 'pd 1', playgroundName: 'Greenwood Park', playgroundAddress: '602 N 87th St, Seattle', startsAt: '2026-10-10T17:00:00Z', endsAt: '2026-10-10T18:30:00Z', visibility: 'public', status: 'upcoming', participantCount: 2 };

test('roles follow the web card precedence', () => {
  assert.equal(playDateRole({ ...base, status: 'cancelled', isHost: true }), 'cancelled');
  assert.equal(playDateRole({ ...base, isHost: true }), 'host-public');
  assert.equal(playDateRole({ ...base, isHost: true, visibility: 'private' }), 'host-private');
  assert.equal(playDateRole({ ...base, isJoined: true }), 'joined');
  assert.equal(playDateRole({ ...base, isDeclined: true }), 'declined');
  assert.equal(playDateRole({ ...base, canJoin: true }), 'can-join');
  assert.equal(playDateRole(base), 'full');
});

test('when, capacity and share link', () => {
  const when = sharedPlayDateWhen(base);
  assert.match(when.date, /October 10/);
  assert.match(when.time, /–/);
  assert.equal(sharedPlayDateWhen({}).date, 'Date to be confirmed');
  assert.equal(sharedPlayDateCapacity({ participantCount: 2, maxFamilies: 6 }), '2 of 6 families');
  assert.equal(sharedPlayDateCapacity({ participantCount: 1 }), '1 family joined');
  assert.equal(playDateShareUrl('http://192.168.1.5:3000/', 'pd 1'), 'http://192.168.1.5:3000/share/playdate/pd%201');
  const share = playDateShareContent(base, 'https://sproutcue.app');
  assert.equal(share.url, 'https://sproutcue.app/share/playdate/pd%201');
  assert.match(share.message, /Greenwood Park/);
});

test('update banner only for joined guests until acknowledged', () => {
  const updated = { ...base, isJoined: true, lastChangeSummary: 'Moved to 11:00 AM' };
  assert.equal(pendingPlayDateUpdate(updated), 'Moved to 11:00 AM');
  assert.equal(pendingPlayDateUpdate(updated, [playDateUpdateKey(updated)]), '');
  assert.equal(pendingPlayDateUpdate({ ...updated, isHost: true }), '');
});

test('edit payload keeps the playground and forces public', () => {
  const payload = editPlayDatePayload({ ...base, playgroundKey: 'k1', visibility: 'public' }, { startsAt: 'a', endsAt: 'b', maxFamilies: 5, notes: ' hi ' });
  assert.equal(payload.playDateId, 'pd 1');
  assert.equal(payload.playgroundKey, 'k1');
  assert.equal(payload.visibility, 'public');
  assert.equal(payload.maxFamilies, '5');
  assert.equal(payload.notes, 'hi');
  assert.throws(() => editPlayDatePayload({}, { startsAt: 'a', endsAt: 'b' }));
});

test('calendar invite is valid iCalendar', () => {
  const ics = playDateCalendarIcs({ ...base, notes: 'Snacks, bubbles; fun' }, { url: 'https://x.test/share/playdate/pd', now: new Date('2026-10-01T00:00:00Z') });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261010T170000Z\r\n/);
  assert.match(ics, /DTEND:20261010T183000Z\r\n/);
  assert.match(ics, /SUMMARY:Playdate at Greenwood Park/);
  assert.match(ics, /LOCATION:Greenwood Park\\, 602 N 87th St\\, Seattle/);
  assert.match(ics, /DESCRIPTION:Snacks\\, bubbles\\; fun\\nhttps:/);
  assert.equal(playDateCalendarFileName(base), 'playdate-greenwood-park.ics');
});
