import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWelcomeSave, parseAgeMonths, toggleValue, validateWelcomeStep, welcomeDraftFromUser } from '../src/onboarding.js';

const user = {
  displayName: 'Nick',
  childProfile: { activeChildId: 'child-1', children: [{ id: 'child-1', name: 'Aaron', ageMonths: 28, favoriteActivities: ['trains'], storyLanguage: 'bilingual' }] },
  playPreferences: { searchRadiusMiles: 25, availabilityDays: ['sat'], visibility: 'invite-only' },
  location: { address: 'Greenwood, Seattle' },
};

test('welcomeDraftFromUser prefills an existing family', () => {
  const draft = welcomeDraftFromUser(user);
  assert.equal(draft.childName, 'Aaron');
  assert.equal(draft.ageMonths, '28');
  assert.deepEqual(draft.interests, ['trains']);
  assert.equal(draft.neighborhood, 'Greenwood, Seattle');
  assert.equal(draft.radius, 10); // clamped to the welcome range
});

test('validateWelcomeStep mirrors the web messages', () => {
  assert.match(validateWelcomeStep(1, { displayName: 'Nick', childName: '', ageMonths: '2' }), /kid’s name/);
  assert.equal(validateWelcomeStep(1, { displayName: 'Nick', childName: 'Aaron', ageMonths: '28' }), '');
  assert.match(validateWelcomeStep(2, { neighborhood: ' ' }), /neighborhood/);
  assert.equal(validateWelcomeStep(3, {}), '');
});

test('parseAgeMonths and toggleValue', () => {
  assert.equal(parseAgeMonths('24'), 24);
  assert.equal(parseAgeMonths('abc'), null);
  assert.equal(parseAgeMonths('200'), null);
  assert.deepEqual(toggleValue(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleValue(['a', 'b'], 'a'), ['b']);
});

test('buildWelcomeSave keeps the child id and existing visibility', () => {
  const draft = { ...welcomeDraftFromUser(user), interests: ['cars', 'dinosaurs'], radius: 4, days: ['wed', 'sun'] };
  const save = buildWelcomeSave(user, draft);
  assert.equal(save.profile.displayName, 'Nick');
  assert.equal(save.profile.childProfile.children[0].id, 'child-1');
  assert.deepEqual(save.profile.childProfile.children[0].favoriteActivities, ['cars', 'dinosaurs']);
  assert.equal(save.profile.childProfile.onboardingComplete, true);
  assert.deepEqual(save.playPreferences, { searchRadiusMiles: 4, availabilityDays: ['wed', 'sun'], visibility: 'invite-only' });
  // Unchanged neighborhood: don't re-save it (that would drop the saved map coordinates).
  assert.equal(save.location, null);
});

test('buildWelcomeSave saves a changed neighborhood', () => {
  const save = buildWelcomeSave(user, { ...welcomeDraftFromUser(user), neighborhood: ' Ballard, Seattle ' });
  assert.deepEqual(save.location, { address: 'Ballard, Seattle', label: 'Ballard, Seattle', source: 'onboarding' });
  const fromDevice = { ...user, location: { label: 'Current location', address: '', latitude: 47.6, longitude: -122.3 } };
  assert.equal(buildWelcomeSave(fromDevice, welcomeDraftFromUser(fromDevice)).location, null);
});

test('buildWelcomeSave works for a brand-new family', () => {
  const save = buildWelcomeSave(null, { displayName: 'Priya', childName: 'Maya', ageMonths: '30', interests: [], practicingSteps: [], neighborhood: '', radius: 3, days: [] });
  assert.equal(save.profile.childProfile.children[0].name, 'Maya');
  assert.ok(save.profile.childProfile.children[0].id);
  assert.equal(save.location, null);
});
