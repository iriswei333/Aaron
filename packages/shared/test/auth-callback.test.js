import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authCallbackErrorMessage, parseAuthCallbackUrl } from '../src/auth-callback.js';

test('reads the PKCE code from app, Expo Go and web redirects', () => {
  assert.equal(parseAuthCallbackUrl('sproutcue://auth/callback?code=abc123').code, 'abc123');
  assert.equal(parseAuthCallbackUrl('exp://192.168.1.20:8081/--/auth/callback?code=xyz').code, 'xyz');
  assert.equal(parseAuthCallbackUrl('http://localhost:8081/auth/callback?code=w&state=s#').code, 'w');
});

test('reads implicit-flow tokens from the hash', () => {
  const parsed = parseAuthCallbackUrl('sproutcue://auth/callback#access_token=at&refresh_token=rt&expires_in=3600');
  assert.equal(parsed.accessToken, 'at');
  assert.equal(parsed.refreshToken, 'rt');
  assert.equal(parsed.code, '');
});

test('reads and explains errors', () => {
  const denied = parseAuthCallbackUrl('sproutcue://auth/callback?error=access_denied&error_description=The+user+denied');
  assert.equal(denied.error, 'access_denied');
  assert.equal(denied.errorDescription, 'The user denied');
  assert.equal(authCallbackErrorMessage(denied), 'Google sign-in was cancelled.');
  const other = parseAuthCallbackUrl('sproutcue://auth/callback#error=server_error&error_description=Unable%20to%20exchange');
  assert.equal(authCallbackErrorMessage(other), 'Unable to exchange');
  assert.equal(authCallbackErrorMessage(parseAuthCallbackUrl('sproutcue://auth/callback?code=1')), '');
  assert.equal(parseAuthCallbackUrl('').code, '');
});
