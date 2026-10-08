import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiCreationDestination, aiJobIsDone, aiJobProgressPercent, aiJobRemainingSeconds, aiJobTimeLabel, aiUsageLabel, incomingPhotoPath,
  photoMimeType, photoSelectionSummary, pictureBookPageLabel, pictureBookPages, pictureBookProgress, pictureBookStatusLabel,
  practiceStoryRequest, toggleInterest, validateAiPhotos,
} from '../src/studio.js';
import * as shared from '../src/index.js';

test('index exports studio helpers', () => assert.equal(typeof shared.aiJobTimeLabel, 'function'));

test('photo types and rules', () => {
  assert.equal(photoMimeType({ mimeType: 'image/jpg' }), 'image/jpeg');
  assert.equal(photoMimeType({ fileName: 'IMG_1.HEIC' }), 'image/heic');
  assert.equal(incomingPhotoPath('u1', 'abc', 'image/jpeg'), 'u1/incoming/abc.jpg');
  assert.throws(() => incomingPhotoPath('', 'abc', 'image/jpeg'));
  const ok = { mimeType: 'image/jpeg', fileSize: 3 * 1024 * 1024 };
  assert.equal(validateAiPhotos([ok, ok], { min: 2, max: 5 }), '');
  assert.match(validateAiPhotos([ok], { min: 2, max: 5 }), /2 to 5/);
  assert.match(validateAiPhotos([], { min: 1, max: 1 }), /Choose 1 photo\./);
  assert.match(validateAiPhotos([{ mimeType: 'image/gif', fileSize: 1 }], { min: 1, max: 1 }), /JPEG/);
  assert.match(validateAiPhotos([{ mimeType: 'image/png', fileSize: 21 * 1024 * 1024 }]), /20 MB/);
  assert.equal(photoSelectionSummary([ok, ok]), '2 photos ready · 6.0 MB total');
  assert.equal(photoSelectionSummary([{ fileSize: 20480 }]), '1 photo ready · 20 KB total');
});

test('AI job progress', () => {
  assert.equal(aiJobIsDone('failed'), true);
  assert.equal(aiJobIsDone('running'), false);
  const now = Date.parse('2026-10-08T10:00:30Z');
  assert.equal(aiJobRemainingSeconds({ createdAt: '2026-10-08T10:00:00Z', estimatedSeconds: 95 }, now), 65);
  assert.equal(aiJobTimeLabel(65), '1:05');
  assert.equal(aiJobTimeLabel(9), '0:09');
  assert.equal(aiJobTimeLabel(0), 'Finishing up…');
  assert.equal(aiJobProgressPercent({ progress: 0 }), 4);
  assert.equal(aiJobProgressPercent({ status: 'succeeded', progress: 50 }), 100);
  assert.equal(aiUsageLabel({ used: 2, limit: 5 }), '2 of 5 AI creations used today');
  assert.equal(aiUsageLabel(null), '');
});

test('finished creations open the right viewer', () => {
  assert.deepEqual(aiCreationDestination({ assetType: 'practice_story', assetId: 's1' }), { kind: 'practice_story', id: 's1' });
  assert.deepEqual(aiCreationDestination({ href: '/picture-books?bookAssetId=b1&pageKey=cover' }), { kind: 'picture_book', id: 'b1', pageKey: 'cover' });
  assert.deepEqual(aiCreationDestination({ href: '/family?toyPlay=t9' }), { kind: 'toy_play', id: 't9' });
  assert.equal(aiCreationDestination({ href: '/family' }), null);
});

test('picture book pages and progress', () => {
  const book = { pages: { doctor: { pageOrder: 1, status: 'ready', url: '/x' }, cover: { pageOrder: 0, status: 'ready', titleEn: 'My First Jobs' }, chef: { pageOrder: 2, status: 'pending' } } };
  assert.deepEqual(pictureBookPages(book).map((page) => page.key), ['cover', 'doctor', 'chef']);
  assert.equal(pictureBookPages(book)[0].label, 'My First Jobs');
  assert.equal(pictureBookPageLabel('race-car-driver'), 'Race car driver');
  assert.deepEqual(pictureBookProgress(book), { ready: 2, total: 3, complete: false, generating: false });
  assert.equal(pictureBookStatusLabel('generating'), 'Making this page…');
});

test('practice story request', () => {
  assert.throws(() => practiceStoryRequest({ interests: 'cars' }), /challenge/);
  const body = practiceStoryRequest({ challenge: 'sleep', interests: 'cars, trains,, dinosaurs', language: 'fr', savedPhotoIds: ['a', 'a', 'b'] });
  assert.equal(body.interests, 'cars, trains, dinosaurs');
  assert.equal(body.language, 'en');
  assert.deepEqual(body.savedPhotoIds, ['a', 'b']);
  assert.equal(toggleInterest('cars, trains', 'Trains'), 'cars');
  assert.equal(toggleInterest('cars', 'music'), 'cars, music');
});
