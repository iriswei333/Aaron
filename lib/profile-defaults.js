export const APP_NAME = 'SproutCue';
export const DEFAULT_CAPTION_LANGUAGE = 'zh-CN';
export const DEFAULT_CAPTION_TONE = '温柔可爱';

export const captionLanguageOptions = [
  ['zh-CN', 'Simplified Chinese'],
  ['en', 'English'],
  ['bilingual', 'Chinese + English'],
];

export const captionToneOptions = ['温柔可爱', '俏皮活泼', '季节感', '车车主题'];

export const DEFAULT_CHILD = {
  id: '',
  name: '',
  birthday: '',
  ageLabel: '',
  homeCity: '',
  foodPreferences: '',
  allergies: '',
  favoriteActivities: [],
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

export function isChildComplete(child = {}) {
  return Boolean(
    cleanText(child.name, 60)
    && (cleanDate(child.birthday) || cleanText(child.ageLabel, 32))
    && cleanText(child.homeCity, 80),
  );
}

export function normalizeChild(input = {}, previous = {}) {
  const merged = { ...DEFAULT_CHILD, ...(previous || {}), ...(input || {}) };
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
    ageLabel: cleanText(merged.ageLabel, 32),
    homeCity: cleanText(merged.homeCity, 80),
    foodPreferences: cleanText(merged.foodPreferences, 320),
    allergies: cleanText(merged.allergies, 220),
    favoriteActivities: cleanList(merged.favoriteActivities),
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
    && !cleanText(child.homeCity)
    && !cleanText(child.foodPreferences)
    && !cleanText(child.allergies)
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
      || 'homeCity' in input
      || 'foodPreferences' in input
      || 'allergies' in input
      || 'favoriteActivities' in input
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

  const usedIds = new Set();
  const children = childrenInput
    .map((child, index) => normalizeChild(child, previousChildFor(child, previousChildren, index)))
    .filter((child) => !isBlankChild(child))
    .map((child, index) => {
      let id = child.id || createChildId(`${child.name}-${index}`);
      while (usedIds.has(id)) id = createChildId(`${child.name}-${index}-${usedIds.size}`);
      usedIds.add(id);
      return { ...child, id };
    });

  const requestedActiveChildId = cleanText(input?.activeChildId, 100)
    || cleanText(previousProfile.activeChildId, 100);
  const activeChild = children.find((child) => child.id === requestedActiveChildId)
    || children.find(isChildComplete)
    || children[0]
    || null;

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
