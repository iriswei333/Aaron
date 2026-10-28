import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, aiConsentCopy, hasAiConsent, isAiConsentError, normalizeAiConsent,
} from '../src/ai-consent.js';

test('consent counts only for the current version', () => {
  assert.equal(hasAiConsent(null), false);
  assert.equal(hasAiConsent({}), false);
  assert.equal(hasAiConsent({ aiConsent: null }), false);
  assert.equal(hasAiConsent({ aiConsent: { grantedAt: '2026-10-28T00:00:00Z', version: '2020-01-01' } }), false);
  assert.equal(hasAiConsent({ aiConsent: { grantedAt: '', version: AI_CONSENT_VERSION } }), false);
  assert.equal(hasAiConsent({ aiConsent: { grantedAt: '2026-10-28T00:00:00Z', version: AI_CONSENT_VERSION } }), true);
});

test('recognizes consent errors from the API', () => {
  assert.equal(isAiConsentError({ code: AI_CONSENT_REQUIRED }), true);
  assert.equal(isAiConsentError({ status: 403, data: { code: AI_CONSENT_REQUIRED } }), true);
  assert.equal(isAiConsentError({ status: 403, data: { code: 'OTHER' } }), false);
  assert.equal(isAiConsentError(null), false);
});

test('normalizes the stored consent record', () => {
  assert.equal(normalizeAiConsent(null, AI_CONSENT_VERSION), null);
  assert.deepEqual(normalizeAiConsent('2026-10-28T00:00:00Z', AI_CONSENT_VERSION), { grantedAt: '2026-10-28T00:00:00Z', version: AI_CONSENT_VERSION });
});

test('copy exists in both languages and names the provider', () => {
  for (const language of ['en', 'zh-CN']) {
    const copy = aiConsentCopy(language);
    assert.ok(copy.title && copy.allow && copy.decline && copy.sends.length === 2);
    assert.match(copy.intro, /OpenAI/);
  }
  assert.equal(aiConsentCopy('fr'), aiConsentCopy('en'));
});
