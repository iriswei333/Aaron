import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoverClient } from '../src/discover-client.js';
import { createFamilyPlansClient } from '../src/family-plans-client.js';

test('shared loaders require a request function', () => {
  assert.throws(() => createDiscoverClient(), /request function/);
  assert.throws(() => createFamilyPlansClient(), /request function/);
});

test('family plans client calls the right endpoints', async () => {
  const calls = [];
  const plans = createFamilyPlansClient(async (path, options = {}) => { calls.push([path, options.method || 'GET', options.body]); return {}; });
  await plans.loadFamilyPlans();
  await plans.saveFamilyPlan({ title: 'Story time' });
  await plans.saveFamilyPlan({ id: 'x'.repeat(30), title: 'Story time' });
  await plans.removeFamilyPlan('abc');
  await plans.removeFamilyPlan('');
  assert.deepEqual(calls.map(([path, method]) => `${method} ${path}`), [
    'GET /family-plans',
    'POST /family-plans',
    'PATCH /family-plans',
    'DELETE /family-plans?id=abc',
  ]);
});

test('discover client loads playdates through the injected request', async () => {
  const paths = [];
  const discover = createDiscoverClient(async (path) => { paths.push(path); return { playDates: [] }; });
  const result = await discover.loadPlaydatesForPlaygrounds([{ key: 'park-1', name: 'Tiny Park' }]);
  assert.ok(Array.isArray(result.items));
  assert.ok(paths.some((path) => path.startsWith('/playdates?playgroundKey=')));
});
