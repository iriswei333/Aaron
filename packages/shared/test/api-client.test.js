import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApiClient, joinApiUrl } from '../src/api-client.js';

function fakeFetch(response = { ok: true, status: 200, body: { ok: true } }) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return { ok: response.ok, status: response.status, json: async () => response.body };
  };
  fn.calls = calls;
  return fn;
}

test('joinApiUrl handles slashes and absolute URLs', () => {
  assert.equal(joinApiUrl('https://app.example/api/', '/chat'), 'https://app.example/api/chat');
  assert.equal(joinApiUrl('/api', 'profile'), '/api/profile');
  assert.equal(joinApiUrl('/api', 'https://other.example/x'), 'https://other.example/x');
});

test('sends a bearer token when getAccessToken returns one', async () => {
  const fetchImpl = fakeFetch();
  const client = createApiClient({ baseUrl: 'https://app.example/api', getAccessToken: async () => 'tok123', fetchImpl });
  await client.request('/profile');
  assert.equal(fetchImpl.calls[0].url, 'https://app.example/api/profile');
  assert.equal(fetchImpl.calls[0].init.headers.authorization, 'Bearer tok123');
  assert.equal(fetchImpl.calls[0].init.headers['content-type'], 'application/json');
});

test('omits authorization without a token and merges custom headers', async () => {
  const fetchImpl = fakeFetch();
  const client = createApiClient({ getHeaders: () => ({ 'x-sproutcue-local-user-id': 'u1' }), fetchImpl });
  await client.request('/chat', { headers: { 'x-extra': '1' } });
  const { headers } = fetchImpl.calls[0].init;
  assert.equal(headers.authorization, undefined);
  assert.equal(headers['x-sproutcue-local-user-id'], 'u1');
  assert.equal(headers['x-extra'], '1');
});

test('serializes plain-object bodies as JSON', async () => {
  const fetchImpl = fakeFetch();
  const client = createApiClient({ fetchImpl });
  await client.request('/chat', { method: 'POST', body: { text: 'hi' } });
  assert.equal(fetchImpl.calls[0].init.body, '{"text":"hi"}');
});

test('does not force a JSON content type on FormData uploads', async () => {
  const fetchImpl = fakeFetch();
  const client = createApiClient({ fetchImpl });
  const form = new FormData();
  form.set('photo', 'x');
  await client.request('/family-assets/photos', { method: 'POST', body: form });
  assert.equal(fetchImpl.calls[0].init.headers['content-type'], undefined);
  assert.equal(fetchImpl.calls[0].init.body, form);
});

test('throws ApiError with the server message and status', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 401, body: { error: 'Sign in to access this profile.' } });
  const client = createApiClient({ fetchImpl });
  await assert.rejects(client.request('/profile'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message, 'Sign in to access this profile.');
    return true;
  });
});

test('resolveServerUrl makes server-relative links absolute for mobile', async () => {
  const { resolveServerUrl } = await import('../src/api-client.js');
  const photo = '/api/family-assets/photos/content?photoId=p1';
  assert.equal(resolveServerUrl('https://app.example/api', photo), 'https://app.example/api/family-assets/photos/content?photoId=p1');
  assert.equal(resolveServerUrl('/api', photo), photo);
  assert.equal(resolveServerUrl('https://app.example/api', 'https://cdn.example/x.png'), 'https://cdn.example/x.png');
  assert.equal(resolveServerUrl('https://app.example/api', 'data:image/png;base64,AA'), 'data:image/png;base64,AA');
  assert.equal(resolveServerUrl('https://app.example/api', ''), '');
  const client = createApiClient({ baseUrl: 'http://192.168.1.20:3000/api' });
  assert.equal(client.resolveUrl(photo), 'http://192.168.1.20:3000/api/family-assets/photos/content?photoId=p1');
});
