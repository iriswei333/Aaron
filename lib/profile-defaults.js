export const APP_NAME = 'SproutCue';
export const DEFAULT_CAPTION_LANGUAGE = 'zh-CN';
export const DEFAULT_CAPTION_TONE = '温柔可爱';

export const captionLanguageOptions = [
  ['zh-CN', 'Simplified Chinese'],
  ['en', 'English'],
  ['bilingual', 'Chinese + English'],
];

export const captionToneOptions = ['温柔可爱', '俏皮活泼', '季节感', '车车主题'];
export const STORY_LANGUAGE_OPTIONS = [
  ['en', 'English'],
  ['zh-CN', 'Mandarin Chinese'],
  ['es', 'Spanish'],
  ['bilingual', 'English + Mandarin'],
];

export const DEFAULT_CHILD = {
  id: '',
  name: '',
  birthday: '',
  ageMonths: null,
  ageLabel: '',
  homeCity: '',
  favoriteActivities: [],
  storyLanguage: 'en',
  practicingSteps: [],
  captionLanguage: DEFAULT_CAPTION_LANGUAGE,
  captionTone: DEFAULT_CAPTION_TONE,
  useRealNameInCaptions: false,
};

export const DEFAULT_CHILD_PROFILE = {
  activeChildId: '',
  children: [],
  onboardingComplete: false,
};

function cleanText(value, maxLength = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanDate(value) {
  const text = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date > new Date()) return '';
  return text;
}

function slugify(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function createChildId(seed = '') {
  const slug = slugify(seed);
  if (slug) return `child-${slug}`;
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return `child-${id}`;
  } catch {
    // Fall through to a compact time-based id for restricted runtimes.
  }
  return `child-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listFromText(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[,;\n]/);
}

function cleanList(value, maxItems = 8) {
  const seen = new Set();
  return listFromText(value)
    .map((item) => cleanText(item, 50))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function optionValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function ageMonthsFrom(input, now = new Date()) {
  const hasRequestedAge = input?.ageMonths !== null && input?.ageMonths !== undefined && input?.ageMonths !== '';
  const requested = Number(input?.ageMonths);
  if (hasRequestedAge && Number.isInteger(requested) && requested >= 0 && requested <= 120) return requested;
  const ageLabel = cleanText(input?.ageLabel, 32).toLowerCase();
  const monthsOnly = ageLabel.match(/^(\d{1,3})\s*m(?:onths?)?$/);
  if (monthsOnly && Number(monthsOnly[1]) <= 120) return Number(monthsOnly[1]);
  const yearsAndMonths = ageLabel.match(/^(\d{1,2})\s*y(?:ears?)?(?:\s*(\d{1,2})\s*m(?:onths?)?)?$/);
  if (yearsAndMonths) {
    const months = Number(yearsAndMonths[1]) * 12 + Number(yearsAndMonths[2] || 0);
    if (months <= 120) return months;
  }
  const birthday = cleanDate(input?.birthday);
  if (!birthday) return null;
  const birthDate = new Date(`${birthday}T00:00:00`);
  let months = (now.getFullYear() - birthDate.getFullYear()) * 12 + now.getMonth() - birthDate.getMonth();
  if (now.getDate() < birthDate.getDate()) months -= 1;
  return Math.max(0, Math.min(120, months));
}

export function isChildComplete(child = {}) {
  return Boolean(
    cleanText(child.name, 60)
    && ageMonthsFrom(child) !== null,
  );
}

export function normalizeChild(input = {}, previous = {}) {
  const merged = { ...DEFAULT_CHILD, ...(previous || {}), ...(input || {}) };
  const requestedStoryLanguage = input?.storyLanguage
    || previous?.storyLanguage
    || input?.captionLanguage
    || previous?.captionLanguage
    || 'en';
  const seed = [
    merged.name,
    merged.birthday,
    merged.ageLabel,
    merged.homeCity,
  ].filter(Boolean).join('-');

  return {
    id: cleanText(merged.id, 100) || createChildId(seed),
    name: cleanText(merged.name, 60),
    birthday: cleanDate(merged.birthday),
    ageMonths: ageMonthsFrom(merged),
    ageLabel: ageMonthsFrom(merged) === null ? cleanText(merged.ageLabel, 32) : `${ageMonthsFrom(merged)}m`,
    homeCity: cleanText(merged.homeCity, 80),
    favoriteActivities: cleanList(merged.favoriteActivities?.length ? merged.favoriteActivities : merged.favorites),
    storyLanguage: optionValue(
      requestedStoryLanguage,
      STORY_LANGUAGE_OPTIONS.map(([value]) => value),
      'en',
    ),
    practicingSteps: cleanList(merged.practicingSteps?.length ? merged.practicingSteps : merged.practiceSteps),
    captionLanguage: optionValue(
      merged.captionLanguage,
      captionLanguageOptions.map(([value]) => value),
      DEFAULT_CAPTION_LANGUAGE,
    ),
    captionTone: optionValue(merged.captionTone, captionToneOptions, DEFAULT_CAPTION_TONE),
    useRealNameInCaptions: Boolean(merged.useRealNameInCaptions),
  };
}

function isBlankChild(child = {}) {
  return !cleanText(child.name)
    && !cleanText(child.birthday)
    && !cleanText(child.ageLabel)
    && ageMonthsFrom(child) === null
    && !cleanText(child.homeCity)
    && cleanList(child.favoriteActivities).length === 0;
}

function previousChildFor(inputChild, previousChildren, index) {
  const childId = cleanText(inputChild?.id, 100);
  if (childId) {
    const byId = previousChildren.find((child) => child.id === childId);
    if (byId) return byId;
  }
  return previousChildren[index] || {};
}

function looksLikeLegacySingleChild(input = {}) {
  return !Array.isArray(input.children)
    && (
      'name' in input
      || 'birthday' in input
      || 'ageLabel' in input
      || 'ageMonths' in input
      || 'homeCity' in input
      || 'favoriteActivities' in input
      || 'favorites' in input
      || 'storyLanguage' in input
      || 'practicingSteps' in input
      || 'captionLanguage' in input
      || 'captionTone' in input
      || 'useRealNameInCaptions' in input
    );
}

export function normalizeChildProfile(input = {}, previous = {}) {
  const previousProfile = Array.isArray(previous?.children)
    ? previous
    : looksLikeLegacySingleChild(previous)
      ? {
        ...DEFAULT_CHILD_PROFILE,
        activeChildId: previous.id || '',
        children: isBlankChild(previous) ? [] : [normalizeChild(previous)],
      }
      : DEFAULT_CHILD_PROFILE;
  const previousChildren = Array.isArray(previousProfile.children)
    ? previousProfile.children.map((child) => normalizeChild(child))
    : [];

  let childrenInput = [];
  if (Array.isArray(input?.children)) {
    childrenInput = input.children;
  } else if (looksLikeLegacySingleChild(input)) {
    childrenInput = [input];
  } else if (previousChildren.length > 0) {
    childrenInput = previousChildren;
  }

  const normalizedChildren = childrenInput
    .map((child, index) => normalizeChild(child, previousChildFor(child, previousChildren, index)))
    .filter((child) => !isBlankChild(child));

  const requestedActiveChildId = cleanText(input?.activeChildId, 100)
    || cleanText(previousProfile.activeChildId, 100);
  const activeChild = normalizedChildren.find((child) => child.id === requestedActiveChildId)
    || normalizedChildren.find(isChildComplete)
    || normalizedChildren[0]
    || null;
  const children = activeChild ? [{ ...activeChild, id: activeChild.id || createChildId(activeChild.name) }] : [];

  return {
    activeChildId: activeChild?.id || '',
    children,
    onboardingComplete: children.some(isChildComplete),
  };
}

export function getChildProfileState(user) {
  return normalizeChildProfile(user?.childProfile || {});
}

export function getChildProfiles(user) {
  return getChildProfileState(user).children;
}

export function getChildProfile(user) {
  const profile = getChildProfileState(user);
  return profile.children.find((child) => child.id === profile.activeChildId)
    || profile.children[0]
    || normalizeChild({});
}

export function childDisplayName(childProfile, fallback = 'your child') {
  return cleanText(childProfile?.name, 60) || fallback;
}

export function childPossessiveName(childProfile, fallback = 'your child') {
  const name = childDisplayName(childProfile, fallback);
  if (name === fallback) return fallback;
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export function childAgeLabel(childProfile, now = new Date()) {
  const months = ageMonthsFrom(childProfile, now);
  if (months !== null) return `${months}m`;
  const birthday = childProfile?.birthday;
  if (birthday) {
    const birthDate = new Date(`${birthday}T00:00:00`);
    if (!Number.isNaN(birthDate.getTime()) && birthDate <= now) {
      let years = now.getFullYear() - birthDate.getFullYear();
      let months = now.getMonth() - birthDate.getMonth();
      if (now.getDate() < birthDate.getDate()) months -= 1;
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      if (years > 0) return `${years}y ${months}m`;
      return `${Math.max(months, 0)}m`;
    }
  }
  return cleanText(childProfile?.ageLabel, 32);
}

export function childProfileSummary(childProfile) {
  const child = Array.isArray(childProfile?.children)
    ? getChildProfile({ childProfile })
    : childProfile;
  return [
    childDisplayName(child, ''),
    childAgeLabel(child),
    cleanText(child?.homeCity, 80),
  ].filter(Boolean).join(' • ') || 'Personalized child profile';
}

export function captionSubject(childProfile, language = childProfile?.captionLanguage) {
  const canUseName = childProfile?.useRealNameInCaptions && childProfile?.name;
  if (canUseName) return childProfile.name;
  if (language === 'en') return 'my little one';
  if (language === 'bilingual') return '宝贝';
  return '宝贝';
}
export const DEFAULT_SEARCH_RADIUS_MILES = 3;
export const MIN_SEARCH_RADIUS_MILES = 1;
export const MAX_SEARCH_RADIUS_MILES = 25;
export const DEFAULT_AVAILABILITY_DAYS = ['wed', 'sat', 'sun'];
export const AVAILABILITY_DAY_OPTIONS = [
  ['mon', 'M'], ['tue', 'T'], ['wed', 'W'], ['thu', 'T'],
  ['fri', 'F'], ['sat', 'S'], ['sun', 'S'],
];
export const PROFILE_VISIBILITY_OPTIONS = [
  ['friends-nearby', 'Friends + nearby families'],
  ['nearby-only', 'Nearby families only'],
  ['invite-only', 'Invite-only'],
];

export function normalizePlayPreferences(preferences = {}) {
  const requested = Number(preferences?.searchRadiusMiles);
  const searchRadiusMiles = Number.isInteger(requested) && requested >= MIN_SEARCH_RADIUS_MILES && requested <= MAX_SEARCH_RADIUS_MILES
    ? requested
    : DEFAULT_SEARCH_RADIUS_MILES;
  const availabilityDays = Array.isArray(preferences?.availabilityDays)
    ? preferences.availabilityDays.filter((day) => AVAILABILITY_DAY_OPTIONS.some(([value]) => value === day)).slice(0, 7)
    : DEFAULT_AVAILABILITY_DAYS;
  const visibility = PROFILE_VISIBILITY_OPTIONS.some(([value]) => value === preferences?.visibility)
    ? preferences.visibility
    : PROFILE_VISIBILITY_OPTIONS[0][0];
  const blockedFamilies = Array.isArray(preferences?.blockedFamilies)
    ? preferences.blockedFamilies
      .map((family) => String(family || '').trim().replace(/\s+/g, ' ').slice(0, 80))
      .filter(Boolean)
      .filter((family, index, all) => all.indexOf(family) === index)
      .slice(0, 50)
    : [];
  return { searchRadiusMiles, availabilityDays, visibility, blockedFamilies };
}
