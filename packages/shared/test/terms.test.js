import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERMS_VERSION, privacyUrl, siteUrlFromApiBase, termsUrl } from '../src/terms.js';

test('builds terms and privacy links from the API base URL', () => {
  assert.equal(siteUrlFromApiBase('https://app.sproutcue.com/api'), 'https://app.sproutcue.com');
  assert.equal(siteUrlFromApiBase('https://app.sproutcue.com/api/'), 'https://app.sproutcue.com');
  assert.equal(termsUrl('https://app.sproutcue.com/api'), 'https://app.sproutcue.com/terms');
  assert.equal(privacyUrl('http://192.168.1.20:3000/api'), 'http://192.168.1.20:3000/privacy');
  assert.equal(termsUrl(''), '');
});

test('terms version is a date', () => {
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
