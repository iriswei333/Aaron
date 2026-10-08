import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteAssetPrompt, familyAssetRow, familyPlayDates, playDateSummary, profilePlayDateTime, recentFamilyAssets } from '../src/family-profile.js';

test('familyPlayDates keeps hosted/joined ones, soonest first, undated last', () => {
  const list = familyPlayDates([
    { id: 'later', isHost: true, startsAt: '2026-10-20T17:00:00Z' },
    { id: 'other', startsAt: '2026-10-08T17:00:00Z' },
    { id: 'undated', isJoined: true },
    { id: 'soon', isJoined: true, startsAt: '2026-10-09T17:00:00Z' },
  ]);
  assert.deepEqual(list.map((item) => item.id), ['soon', 'later', 'undated']);
  assert.deepEqual(familyPlayDates(null), []);
});

test('playDateSummary and times read like the web', () => {
  assert.equal(playDateSummary({ isHost: true, visibility: 'public', participantCount: 2 }), 'Created by you · Public · 2 families');
  assert.equal(playDateSummary({ isJoined: true, visibility: 'private', status: 'cancelled', participantCount: 1 }), 'Joined playdate · Cancelled · 1 family');
  assert.deepEqual(profilePlayDateTime({}), { date: 'Time not set', time: '' });
  const timing = profilePlayDateTime({ startsAt: '2026-10-10T17:00:00Z', endsAt: '2026-10-10T18:30:00Z' });
  assert.ok(timing.date.length > 0 && timing.time.includes('–'));
});

test('recentFamilyAssets merges and keeps the newest four', () => {
  const recent = recentFamilyAssets({
    pictureBooks: [{ id: 'b1', createdAt: '2026-10-01' }],
    toyPlayAssets: [{ id: 't1', createdAt: '2026-10-05' }, { id: 't2', createdAt: '2026-09-01' }],
    practiceStoryAssets: [{ id: 's1', createdAt: '2026-10-06' }, { id: 's2', createdAt: '2026-10-03' }],
  });
  assert.deepEqual(recent.map((entry) => entry.item.id), ['s1', 't1', 's2', 'b1']);
});

test('familyAssetRow labels each kind', () => {
  assert.deepEqual(familyAssetRow({ kind: 'story', item: { title: 'Brave bath', goal: 'Bath time', interests: ['trains', 'dinosaurs'] } }), { title: 'Brave bath', subtitle: 'Bath time · trains, dinosaurs', action: 'Story →' });
  assert.equal(familyAssetRow({ kind: 'toy', item: { toy: { name: 'Blocks' }, play: { durationMinutes: 10 }, childAgeMonths: 28 } }).subtitle, 'Blocks · 10 minutes · Age 28 months');
  assert.equal(familyAssetRow({ kind: 'toy', item: { language: 'zh-CN' } }).action, '普通话玩法');
  assert.equal(familyAssetRow({ kind: 'book', item: { pages: { a: { status: 'ready' }, b: { status: 'pending' } } } }, 'Aaron').subtitle, 'Aaron · 1/2 pages ready');
});

test('deleteAssetPrompt matches the web confirmation', () => {
  const prompt = deleteAssetPrompt('toy', { title: 'Block tower' });
  assert.equal(prompt.title, 'Delete “Block tower”?');
  assert.equal(prompt.message, 'This permanently removes the saved play idea and its generated image.');
  assert.equal(prompt.endpoint, '/family-assets/toy-plays');
  assert.equal(deleteAssetPrompt('story', {}).message, 'This permanently removes the practice story.');
});
