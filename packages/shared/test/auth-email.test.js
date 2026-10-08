import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailRetryAfterSeconds, emailSignInErrorMessage, isEmailCodeComplete, isLikelyEmail, normalizeEmailCode } from '../src/auth-email.js';

test('isLikelyEmail', () => {
  assert.equal(isLikelyEmail(' parent+test@example.com '), true);
  assert.equal(isLikelyEmail('parent@example'), false);
  assert.equal(isLikelyEmail('not an email'), false);
  assert.equal(isLikelyEmail(''), false);
});

test('email codes', () => {
  assert.equal(normalizeEmailCode('123 456'), '123456');
  assert.equal(isEmailCodeComplete('12345'), false);
  assert.equal(isEmailCodeComplete('123-456'), true);
  assert.equal(isEmailCodeComplete('12345678'), true);
});

test('rate limits and expired links read clearly', () => {
  const rate = { code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' };
  assert.equal(emailRetryAfterSeconds(rate.message), 42);
  assert.equal(emailRetryAfterSeconds('nothing here'), 60);
  assert.equal(emailSignInErrorMessage(rate), 'Please wait 42 seconds before asking for another email.');
  assert.match(emailSignInErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' }), /expired/);
  assert.match(emailSignInErrorMessage(new TypeError('Failed to fetch')), /connection/);
  assert.equal(emailSignInErrorMessage({ message: 'Signups not allowed for otp' }), 'Signups not allowed for otp');
});
