// Welcome-flow ("family profile setup") options and logic shared by web and mobile.
import {
  DEFAULT_SEARCH_RADIUS_MILES,
  getChildProfile,
  normalizeChildProfile,
  normalizePlayPreferences,
} from './profile-defaults.js';

export const WELCOME_RELATIONSHIP_OPTIONS = [
  ['mom', 'Mom'],
  ['dad', 'Dad'],
  ['grandparent', 'Grandparent'],
  ['caregiver', 'Caregiver'],
];

export const PRACTICING_STEP_OPTIONS = [
  ['brushing teeth', '🪥 Brushing teeth'],
  ['washing hands', '🫧 Washing hands'],
  ['potty learning', '🚽 Potty learning'],
  ['leaving the playground', '👋 Leaving the playground'],
  ['meeting new friends', '☺ Meeting friends'],
  ['bedtime', '🌙 Bedtime'],
];

export const AVAILABILITY_TIME_OPTIONS = [
  ['morning', '🌅 Mornings'],
  ['afternoon', '☀️ Afternoons'],
  ['after-school', '🎒 After school'],
];

export const WELCOME_RADIUS_RANGE = { min: 1, max: 10 };

export const WELCOME_STEP_ERRORS = {
  1: 'Add your name, your kid’s name, and their age in months to continue.',
  2: 'Add your neighborhood so we can personalize nearby playdates.',
};

function clampRadius(value) {
  const number = Number(value) || DEFAULT_SEARCH_RADIUS_MILES;
  return Math.min(WELCOME_RADIUS_RANGE.max, Math.max(WELCOME_RADIUS_RANGE.min, Math.round(number)));
}

/**
 * @typedef {object} WelcomeDraft
 * @property {string} displayName
 * @property {string} relationship
 * @property {string} childName
 * @property {string} ageMonths Text as typed; see parseAgeMonths.
 * @property {string} storyLanguage
 * @property {string[]} interests
 * @property {string[]} practicingSteps
 * @property {string} neighborhood
 * @property {number} radius Miles, 1–10.
 * @property {string[]} days e.g. ['wed', 'sat']
 * @property {string[]} times e.g. ['morning']
 */

/**
 * Starting values for the welcome flow, prefilled from an existing profile when editing.
 * @param {any} user
 * @returns {WelcomeDraft}
 */
export function welcomeDraftFromUser(user) {
  const child = getChildProfile(user);
  const preferences = normalizePlayPreferences(user?.playPreferences);
  return {
    displayName: user?.displayName || '',
    relationship: '',
    childName: child.name || '',
    ageMonths: Number.isInteger(child.ageMonths) ? String(child.ageMonths) : '',
    storyLanguage: child.storyLanguage || 'en',
    interests: Array.isArray(child.favoriteActivities) ? [...child.favoriteActivities] : [],
    practicingSteps: Array.isArray(child.practicingSteps) ? [...child.practicingSteps] : [],
    neighborhood: user?.location?.address || user?.location?.label || child.homeCity || '',
    radius: clampRadius(preferences.searchRadiusMiles),
    days: [...preferences.availabilityDays],
    times: [],
  };
}

export function parseAgeMonths(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const months = Number(text);
  return months >= 0 && months <= 120 ? months : null;
}

/**
 * Returns an error message for the given step, or '' when the step can be completed.
 * @param {number} step
 * @param {Partial<WelcomeDraft>} draft
 * @returns {string}
 */
export function validateWelcomeStep(step, draft) {
  if (step === 1) {
    const ok = String(draft.displayName || '').trim() && String(draft.childName || '').trim() && parseAgeMonths(draft.ageMonths) !== null;
    return ok ? '' : WELCOME_STEP_ERRORS[1];
  }
  if (step === 2) return String(draft.neighborhood || '').trim() ? '' : WELCOME_STEP_ERRORS[2];
  return '';
}

/**
 * @param {string[]} list
 * @param {string} value
 * @returns {string[]}
 */
export function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** @param {any} location @param {string} neighborhood */
function sameNeighborhood(location, neighborhood) {
  const wanted = neighborhood.trim().toLowerCase();
  return [location?.address, location?.label].some((value) => String(value || '').trim().toLowerCase() === wanted);
}

/**
 * The three API calls that save the welcome flow, in order:
 *   PUT /profile          { displayName, childProfile }
 *   PUT /play-preferences { searchRadiusMiles, availabilityDays, visibility }
 *   PUT /location         { address, label, source }   (only when the neighborhood changed — re-saving
 *                                                       an unchanged one would drop its map coordinates)
 * @param {any} user
 * @param {WelcomeDraft} draft
 */
export function buildWelcomeSave(user, draft) {
  const existing = getChildProfile(user);
  const ageMonths = parseAgeMonths(draft.ageMonths);
  const neighborhood = String(draft.neighborhood || '').trim();
  const child = {
    ...existing,
    name: String(draft.childName || '').trim(),
    ageMonths,
    ageLabel: ageMonths === null ? '' : `${ageMonths}m`,
    storyLanguage: draft.storyLanguage || existing.storyLanguage || 'en',
    favoriteActivities: [...(draft.interests || [])],
    practicingSteps: [...(draft.practicingSteps || [])],
    ...(neighborhood ? { homeCity: neighborhood } : {}),
  };
  const childProfile = normalizeChildProfile({ activeChildId: existing.id || '', children: [child] });
  const preferences = normalizePlayPreferences(user?.playPreferences);
  return {
    profile: { displayName: String(draft.displayName || '').trim(), childProfile },
    playPreferences: {
      searchRadiusMiles: clampRadius(draft.radius),
      availabilityDays: [...(draft.days || [])],
      visibility: preferences.visibility,
    },
    location: neighborhood && !sameNeighborhood(user?.location, neighborhood)
      ? { address: neighborhood, label: neighborhood, source: 'onboarding' }
      : null,
  };
}
