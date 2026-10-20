import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isPhotoCheckError,
  PHOTO_CHECK_CODES,
  PHOTO_CHECK_SEVERITY,
  photoCheckHelp,
  photoCheckMessage,
  photoCheckSeverity,
} from '../src/photo-check.js';

test('every code has a severity and an English and Mandarin message', () => {
  for (const code of Object.values(PHOTO_CHECK_CODES)) {
    assert.ok(PHOTO_CHECK_SEVERITY[code], code);
    assert.notEqual(photoCheckMessage(code, 'en'), photoCheckMessage(code, 'zh-CN'), code);
  }
});

test('severities split blocking, warning, and retry', () => {
  assert.equal(photoCheckSeverity('PHOTO_NOT_A_CHILD'), 'block');
  assert.equal(photoCheckSeverity('PHOTO_FACE_UNCLEAR'), 'warning');
  assert.equal(photoCheckSeverity('PHOTO_CHECK_UNAVAILABLE'), 'retry');
  assert.equal(photoCheckSeverity('SOMETHING_ELSE'), null);
});

test('unknown languages fall back to English', () => {
  assert.equal(photoCheckMessage('PHOTO_ADULT_ONLY', 'fr'), photoCheckMessage('PHOTO_ADULT_ONLY', 'en'));
  assert.match(photoCheckHelp('zh-CN'), /小提示/);
});

test('recognizes photo-check failures from ApiError or a response body', () => {
  assert.equal(isPhotoCheckError({ data: { code: 'PHOTO_NOT_A_CHILD' } }), true);
  assert.equal(isPhotoCheckError({ code: 'PHOTO_MULTIPLE_CHILDREN' }), true);
  assert.equal(isPhotoCheckError({ data: { code: 'DAILY_AI_LIMIT_REACHED' } }), false);
  assert.equal(isPhotoCheckError(null), false);
});

import { isRejectedChildPhoto, photoCheckDetails, photoCheckJobMessage, photoCheckLabel, photoCheckWarning, splitPhotoProblems } from '../src/photo-check.js';

test('reads 422 bodies from an ApiError and localizes each photo', () => {
  const details = photoCheckDetails({ data: { code: 'PHOTO_NOT_A_CHILD', photoErrors: [{ index: 1, photoId: 'p2', code: 'PHOTO_ADULT_ONLY' }, { code: 'BOGUS' }] } }, 'zh-CN');
  assert.equal(details.code, 'PHOTO_NOT_A_CHILD');
  assert.equal(details.photoErrors.length, 1);
  assert.equal(details.photoErrors[0].label, photoCheckLabel('PHOTO_ADULT_ONLY', 'zh-CN'));
  assert.equal(photoCheckDetails(new Error('network')), null);
});

test('splits problems between saved photos and new uploads', () => {
  const details = photoCheckDetails({ code: 'PHOTO_NOT_A_CHILD', photoErrors: [
    { index: 0, photoId: 'saved-1', code: 'PHOTO_NOT_A_CHILD' },
    { index: 2, photoId: 'new-b', code: 'PHOTO_NOT_REAL' },
    { index: 4, photoId: null, code: 'PHOTO_ADULT_ONLY' },
  ] });
  const { saved, uploads } = splitPhotoProblems(details, { savedPhotoIds: ['saved-1'], uploadedPhotoIds: ['new-a', 'new-b'], uploadOffset: 1 });
  assert.deepEqual(Object.keys(saved), ['saved-1']);
  assert.equal(uploads[1].code, 'PHOTO_NOT_REAL');
  assert.equal(uploads[3].code, 'PHOTO_ADULT_ONLY');
});

test('saved photo helpers', () => {
  assert.equal(photoCheckWarning({ childCheck: { status: 'passed', code: 'PHOTO_FACE_UNCLEAR' } }).severity, 'warning');
  assert.equal(photoCheckWarning({ childCheck: { status: 'passed', code: null } }), null);
  assert.equal(isRejectedChildPhoto({ childCheck: { status: 'rejected' } }), true);
  assert.match(photoCheckJobMessage({ errorCode: 'PHOTO_UNSAFE' }), /can’t be used/);
  assert.equal(photoCheckJobMessage({ errorCode: null }), null);
});
