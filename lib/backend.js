import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  getChildProfile,
  normalizeChildProfile,
} from './profile-defaults.js';

const DATA_DIR = resolve('data');
const DATA_FILE = join(DATA_DIR, 'app-state.json');
const PROFILE_COLUMNS = [
  'id',
  'email',
  'display_name',
  'child_profile',
  'social_links',
  'location',
  'food_plan',
  'amazon_errands',
  'family_objects',
  'created_at',
  'updated_at',
].join(', ');
const PLAY_DATE_COLUMNS = [
  'id',
  'host_user_id',
  'playground_key',
  'playground_name',
  'playground_type',
  'playground_address',
  'playground_latitude',
  'playground_longitude',
  'starts_at',
  'ends_at',
  'visibility',
  'notes',
  'age_range',
  'max_families',
  'participant_count',
  'created_at',
  'updated_at',
].join(', ');
const FAMILY_EVENT_CACHE_COLUMNS = [
  'cache_key',
  'location_city',
  'location_region',
  'start_date',
  'end_date',
  'source',
  'source_label',
  'source_urls',
  'filters',
  'events',
  'fallback',
  'provider_status',
  'fetched_at',
  'expires_at',
].join(', ');
const PLAYGROUND_CACHE_COLUMNS = [
  'cache_key',
  'latitude',
  'longitude',
  'playgrounds',
  'source',
  'fetched_at',
  'expires_at',
].join(', ');
const PARENTING_RESOURCE_CACHE_COLUMNS = [
  'age_filter',
  'source_url',
  'resources',
  'fetched_at',
  'expires_at',
].join(', ');

export const LOCAL_USER_COOKIE = 'sproutCueLocalUserId';
export const LEGACY_LOCAL_USER_COOKIE = 'aaronLocalUserId';

export function defaultStore() {
  return { users: {}, posts: [], playDates: [], familyEventCache: {}, playgroundCache: {}, parentingResourceCache: {}, chatMessages: [] };
}

function normalizeStore(store) {
  return {
    users: store?.users && typeof store.users === 'object' ? store.users : {},
    posts: Array.isArray(store?.posts) ? store.posts : [],
    playDates: Array.isArray(store?.playDates) ? store.playDates : [],
    familyEventCache: store?.familyEventCache && typeof store.familyEventCache === 'object'
      ? store.familyEventCache
      : {},
    playgroundCache: store?.playgroundCache && typeof store.playgroundCache === 'object'
      ? store.playgroundCache
      : {},
    parentingResourceCache: store?.parentingResourceCache && typeof store.parentingResourceCache === 'object'
      ? store.parentingResourceCache
      : {},
    chatMessages: Array.isArray(store?.chatMessages) ? store.chatMessages : [],
  };
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function readStore() {
  try {
    return normalizeStore(JSON.parse(await readFile(DATA_FILE, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return defaultStore();
    throw error;
  }
}

export async function writeStore(store) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

export async function mutateStore(mutator) {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

export function findUserByEmail(store, email) {
  const normalized = normalizeEmail(email);
  return Object.values(store.users).find((user) => normalizeEmail(user.email) === normalized);
}

export function publicUserSummary(user) {
  return {
    id: user.id,
    email: user.email || '',
    displayName: user.displayName,
    childProfile: normalizeChildProfile(user.childProfile),
    updatedAt: user.updatedAt,
  };
}

export function createUser({
  id = randomUUID(),
  displayName = 'Family Profile',
  email = '',
  childProfile = {},
} = {}) {
  const now = new Date().toISOString();
  return {
    id,
    email: normalizeEmail(email),
    displayName,
    childProfile: normalizeChildProfile(childProfile),
    createdAt: now,
    updatedAt: now,
    socialLinks: { icloudPhotosUrl: '', instagramUrl: '', tiktokUrl: '' },
    location: null,
    foodPlan: { favorites: ['peas', 'broccoli', 'banana'], weeklyMenu: [] },
    amazonErrands: {
      tasks: [],
    },
    familyObjects: [],
  };
}

export function updateUser(user, patch) {
  Object.assign(user, patch, { updatedAt: new Date().toISOString() });
  return user;
}

export function profileRowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || '',
    displayName: row.display_name || 'Family Profile',
    childProfile: normalizeChildProfile(row.child_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    socialLinks: row.social_links || { icloudPhotosUrl: '', instagramUrl: '', tiktokUrl: '' },
    location: row.location,
    foodPlan: row.food_plan || { favorites: ['peas', 'broccoli', 'banana'], weeklyMenu: [] },
    amazonErrands: row.amazon_errands || {
      tasks: [],
    },
    familyObjects: Array.isArray(row.family_objects) ? row.family_objects : [],
  };
}

export function userToProfileRow(user) {
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    display_name: user.displayName || 'Family Profile',
    child_profile: normalizeChildProfile(user.childProfile),
    social_links: user.socialLinks,
    location: user.location,
    food_plan: user.foodPlan,
    amazon_errands: user.amazonErrands,
    family_objects: Array.isArray(user.familyObjects) ? user.familyObjects : [],
    updated_at: user.updatedAt || new Date().toISOString(),
  };
}

function supabaseError(error, fallback) {
  if (!error) return null;
  return new Error(error.message || fallback);
}

function cleanText(value, maxLength = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function toNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePlaygroundKey(value, fallbackName = '') {
  const source = cleanText(value || fallbackName, 180).toLowerCase();
  return source
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function normalizePlayDateInput(body = {}) {
  const playgroundName = cleanText(body.playgroundName, 140);
  const playgroundKey = normalizePlaygroundKey(body.playgroundKey, playgroundName);
  if (!playgroundName || !playgroundKey) {
    throw new Error('Choose a playground before creating a play date.');
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Choose a valid play date start and end time.');
  }
  if (startsAt >= endsAt) {
    throw new Error('Play date end time must be after the start time.');
  }

  const maxFamiliesValue = Number.parseInt(body.maxFamilies, 10);
  const maxFamilies = Number.isFinite(maxFamiliesValue)
    ? Math.min(Math.max(maxFamiliesValue, 2), 20)
    : null;

  return {
    playgroundKey,
    playgroundName,
    playgroundType: cleanText(body.playgroundType, 80),
    playgroundAddress: cleanText(body.playgroundAddress, 180),
    playgroundLatitude: toNullableNumber(body.playgroundLatitude),
    playgroundLongitude: toNullableNumber(body.playgroundLongitude),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    visibility: body.visibility === 'private' ? 'private' : 'public',
    notes: cleanText(body.notes, 240),
    ageRange: cleanText(body.ageRange, 40),
    maxFamilies,
  };
}

function localParticipantCount(playDate) {
  return (playDate.participants || []).filter((participant) => participant.status === 'joined').length;
}

function serializeLocalPlayDate(playDate, userId) {
  const participants = Array.isArray(playDate.participants) ? playDate.participants : [];
  const participantCount = localParticipantCount(playDate);
  const isHost = playDate.hostUserId === userId;
  const isJoined = participants.some((participant) => participant.userId === userId && participant.status === 'joined');
  const hasRoom = !playDate.maxFamilies || participantCount < playDate.maxFamilies;

  return {
    id: playDate.id,
    playgroundKey: playDate.playgroundKey,
    playgroundName: playDate.playgroundName,
    playgroundType: playDate.playgroundType || '',
    playgroundAddress: playDate.playgroundAddress || '',
    playgroundLatitude: playDate.playgroundLatitude ?? null,
    playgroundLongitude: playDate.playgroundLongitude ?? null,
    startsAt: playDate.startsAt,
    endsAt: playDate.endsAt,
    visibility: playDate.visibility,
    notes: playDate.notes || '',
    ageRange: playDate.ageRange || '',
    maxFamilies: playDate.maxFamilies ?? null,
    participantCount,
    isHost,
    isJoined,
    canJoin: playDate.visibility === 'public' && !isHost && !isJoined && hasRoom,
    hostLabel: isHost ? 'You' : 'Another family',
    createdAt: playDate.createdAt,
    updatedAt: playDate.updatedAt,
  };
}

function serializeSupabasePlayDate(row, userId, joinedIds = new Set()) {
  const participantCount = Number(row.participant_count) || 0;
  const isHost = row.host_user_id === userId;
  const isJoined = isHost || joinedIds.has(row.id);
  const maxFamilies = row.max_families ?? null;
  const hasRoom = !maxFamilies || participantCount < maxFamilies;

  return {
    id: row.id,
    playgroundKey: row.playground_key,
    playgroundName: row.playground_name,
    playgroundType: row.playground_type || '',
    playgroundAddress: row.playground_address || '',
    playgroundLatitude: row.playground_latitude ?? null,
    playgroundLongitude: row.playground_longitude ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    visibility: row.visibility,
    notes: row.notes || '',
    ageRange: row.age_range || '',
    maxFamilies,
    participantCount,
    isHost,
    isJoined,
    canJoin: row.visibility === 'public' && !isHost && !isJoined && hasRoom,
    hostLabel: isHost ? 'You' : 'Another family',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canViewLocalPlayDate(playDate, userId) {
  if (playDate.visibility === 'public') return true;
  if (playDate.hostUserId === userId) return true;
  return (playDate.participants || []).some((participant) => (
    participant.userId === userId && participant.status === 'joined'
  ));
}

function isUpcoming(playDate) {
  return new Date(playDate.endsAt).getTime() >= Date.now();
}

function serializeFamilyEventCache(entry = {}) {
  entry = entry || {};
  return {
    cacheKey: entry.cacheKey || entry.cache_key || '',
    locationCity: entry.locationCity || entry.location_city || '',
    locationRegion: entry.locationRegion || entry.location_region || '',
    startDate: entry.startDate || entry.start_date || '',
    endDate: entry.endDate || entry.end_date || '',
    source: entry.source || 'search-link',
    sourceLabel: entry.sourceLabel || entry.source_label || '',
    sourceUrls: Array.isArray(entry.sourceUrls || entry.source_urls) ? (entry.sourceUrls || entry.source_urls) : [],
    filters: entry.filters && typeof entry.filters === 'object' ? entry.filters : {},
    events: Array.isArray(entry.events) ? entry.events : [],
    fallback: Boolean(entry.fallback),
    providerStatus: entry.providerStatus || entry.provider_status || '',
    fetchedAt: entry.fetchedAt || entry.fetched_at || new Date().toISOString(),
    expiresAt: entry.expiresAt || entry.expires_at || new Date().toISOString(),
  };
}

function familyEventCacheToRow(entry = {}) {
  const serialized = serializeFamilyEventCache(entry);
  return {
    cache_key: serialized.cacheKey,
    location_city: serialized.locationCity,
    location_region: serialized.locationRegion,
    start_date: serialized.startDate,
    end_date: serialized.endDate,
    source: serialized.source,
    source_label: serialized.sourceLabel,
    source_urls: serialized.sourceUrls,
    filters: serialized.filters,
    events: serialized.events,
    fallback: serialized.fallback,
    provider_status: serialized.providerStatus,
    fetched_at: serialized.fetchedAt,
    expires_at: serialized.expiresAt,
  };
}

function isFreshFamilyEventCache(entry) {
  if (!entry) return false;
  const serialized = serializeFamilyEventCache(entry);
  return serialized.cacheKey
    && Array.isArray(serialized.events)
    && new Date(serialized.expiresAt).getTime() > Date.now();
}

function isMissingCacheTable(error) {
  return error?.code === '42P01'
    || /(family_event_cache|playground_cache|parenting_resource_cache)/i.test(error?.message || '') && /does not exist/i.test(error.message);
}

function pruneLocalFamilyEventCache(cache = {}) {
  const now = Date.now();
  const staleCutoff = now - 24 * 60 * 60 * 1000;
  for (const [cacheKey, entry] of Object.entries(cache)) {
    const expiresAt = new Date(entry?.expiresAt || entry?.expires_at || 0).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt < staleCutoff) {
      delete cache[cacheKey];
    }
  }

  const entries = Object.entries(cache);
  if (entries.length <= 100) return;
  entries
    .sort(([, a], [, b]) => new Date(a?.fetchedAt || a?.fetched_at || 0) - new Date(b?.fetchedAt || b?.fetched_at || 0))
    .slice(0, entries.length - 100)
    .forEach(([cacheKey]) => {
      delete cache[cacheKey];
    });
}

export async function readLocalFamilyEventCache(cacheKey) {
  const key = cleanText(cacheKey, 260);
  if (!key) return null;
  const store = await readStore();
  const entry = store.familyEventCache[key];
  return isFreshFamilyEventCache(entry) ? serializeFamilyEventCache(entry) : null;
}

export async function writeLocalFamilyEventCache(entry) {
  const serialized = serializeFamilyEventCache(entry);
  if (!serialized.cacheKey) return serialized;
  return mutateStore((store) => {
    store.familyEventCache = store.familyEventCache || {};
    pruneLocalFamilyEventCache(store.familyEventCache);
    store.familyEventCache[serialized.cacheKey] = serialized;
    return serialized;
  });
}

export async function readSupabaseFamilyEventCache(supabase, cacheKey) {
  const key = cleanText(cacheKey, 260);
  if (!key) return null;
  const { data, error } = await supabase
    .from('family_event_cache')
    .select(FAMILY_EVENT_CACHE_COLUMNS)
    .eq('cache_key', key)
    .maybeSingle();

  if (error) {
    if (isMissingCacheTable(error)) return null;
    throw supabaseError(error, 'Could not load cached family events.');
  }
  return isFreshFamilyEventCache(data) ? serializeFamilyEventCache(data) : null;
}

export async function writeSupabaseFamilyEventCache(supabase, entry) {
  const row = familyEventCacheToRow(entry);
  if (!row.cache_key) return serializeFamilyEventCache(entry);
  const { data, error } = await supabase
    .from('family_event_cache')
    .upsert(row, { onConflict: 'cache_key' })
    .select(FAMILY_EVENT_CACHE_COLUMNS)
    .single();

  if (error) {
    if (isMissingCacheTable(error)) return serializeFamilyEventCache(entry);
    throw supabaseError(error, 'Could not save cached family events.');
  }
  return serializeFamilyEventCache(data);
}

function serializeParentingResourceCache(entry = {}) {
  return {
    ageFilter: entry.ageFilter || entry.age_filter || '',
    sourceUrl: entry.sourceUrl || entry.source_url || '',
    resources: Array.isArray(entry.resources) ? entry.resources : [],
    fetchedAt: entry.fetchedAt || entry.fetched_at || new Date().toISOString(),
    expiresAt: entry.expiresAt || entry.expires_at || new Date().toISOString(),
  };
}

function parentingResourceCacheToRow(entry = {}) {
  const serialized = serializeParentingResourceCache(entry);
  return {
    age_filter: serialized.ageFilter,
    source_url: serialized.sourceUrl,
    resources: serialized.resources,
    fetched_at: serialized.fetchedAt,
    expires_at: serialized.expiresAt,
  };
}

function isFreshParentingResourceCache(entry) {
  if (!entry) return false;
  const serialized = serializeParentingResourceCache(entry);
  return Boolean(serialized.ageFilter && serialized.resources.length)
    && new Date(serialized.expiresAt).getTime() > Date.now();
}

export async function readLocalParentingResourceCache(ageFilter) {
  const key = cleanText(ageFilter, 40);
  if (!key) return null;
  const store = await readStore();
  const entry = store.parentingResourceCache[key];
  return isFreshParentingResourceCache(entry) ? serializeParentingResourceCache(entry) : null;
}

export async function writeLocalParentingResourceCache(entry) {
  const serialized = serializeParentingResourceCache(entry);
  if (!serialized.ageFilter) return serialized;
  return mutateStore((store) => {
    store.parentingResourceCache = store.parentingResourceCache || {};
    store.parentingResourceCache[serialized.ageFilter] = serialized;
    return serialized;
  });
}

export async function readSupabaseParentingResourceCache(supabase, ageFilter) {
  const key = cleanText(ageFilter, 40);
  if (!key) return null;
  const { data, error } = await supabase
    .from('parenting_resource_cache')
    .select(PARENTING_RESOURCE_CACHE_COLUMNS)
    .eq('age_filter', key)
    .maybeSingle();
  if (error) {
    if (isMissingCacheTable(error)) return null;
    throw supabaseError(error, 'Could not load cached parenting resources.');
  }
  return isFreshParentingResourceCache(data) ? serializeParentingResourceCache(data) : null;
}

export async function writeSupabaseParentingResourceCache(supabase, entry) {
  const row = parentingResourceCacheToRow(entry);
  if (!row.age_filter) return serializeParentingResourceCache(entry);
  const { data, error } = await supabase
    .from('parenting_resource_cache')
    .upsert(row, { onConflict: 'age_filter' })
    .select(PARENTING_RESOURCE_CACHE_COLUMNS)
    .single();
  if (error) {
    if (isMissingCacheTable(error)) return serializeParentingResourceCache(entry);
    throw supabaseError(error, 'Could not save cached parenting resources.');
  }
  return serializeParentingResourceCache(data);
}

function serializePlaygroundCache(entry = {}) {
  entry = entry || {};
  return {
    cacheKey: entry.cacheKey || entry.cache_key || '',
    latitude: toNullableNumber(entry.latitude),
    longitude: toNullableNumber(entry.longitude),
    playgrounds: Array.isArray(entry.playgrounds) ? entry.playgrounds : [],
    source: entry.source || 'openstreetmap-overpass',
    fetchedAt: entry.fetchedAt || entry.fetched_at || new Date().toISOString(),
    expiresAt: entry.expiresAt || entry.expires_at || new Date().toISOString(),
  };
}

function playgroundCacheToRow(entry = {}) {
  const serialized = serializePlaygroundCache(entry);
  return {
    cache_key: serialized.cacheKey,
    latitude: serialized.latitude,
    longitude: serialized.longitude,
    playgrounds: serialized.playgrounds,
    source: serialized.source,
    fetched_at: serialized.fetchedAt,
    expires_at: serialized.expiresAt,
  };
}

function isFreshPlaygroundCache(entry) {
  if (!entry) return false;
  const serialized = serializePlaygroundCache(entry);
  return Boolean(serialized.cacheKey)
    && new Date(serialized.expiresAt).getTime() > Date.now();
}

function pruneLocalPlaygroundCache(cache = {}) {
  const entries = Object.entries(cache);
  if (entries.length <= 100) return;
  entries
    .sort(([, a], [, b]) => new Date(a?.fetchedAt || 0) - new Date(b?.fetchedAt || 0))
    .slice(0, entries.length - 100)
    .forEach(([cacheKey]) => delete cache[cacheKey]);
}

export async function readLocalPlaygroundCache(cacheKey) {
  const key = cleanText(cacheKey, 180);
  if (!key) return null;
  const store = await readStore();
  const entry = store.playgroundCache[key];
  return isFreshPlaygroundCache(entry) ? serializePlaygroundCache(entry) : null;
}

export async function writeLocalPlaygroundCache(entry) {
  const serialized = serializePlaygroundCache(entry);
  if (!serialized.cacheKey) return serialized;
  return mutateStore((store) => {
    store.playgroundCache = store.playgroundCache || {};
    pruneLocalPlaygroundCache(store.playgroundCache);
    store.playgroundCache[serialized.cacheKey] = serialized;
    return serialized;
  });
}

export async function readSupabasePlaygroundCache(supabase, cacheKey) {
  const key = cleanText(cacheKey, 180);
  if (!key) return null;
  const { data, error } = await supabase
    .from('playground_cache')
    .select(PLAYGROUND_CACHE_COLUMNS)
    .eq('cache_key', key)
    .maybeSingle();
  if (error) {
    if (isMissingCacheTable(error)) return null;
    throw supabaseError(error, 'Could not load cached nearby playgrounds.');
  }
  return isFreshPlaygroundCache(data) ? serializePlaygroundCache(data) : null;
}

export async function writeSupabasePlaygroundCache(supabase, entry) {
  const row = playgroundCacheToRow(entry);
  if (!row.cache_key) return serializePlaygroundCache(entry);
  const { data, error } = await supabase
    .from('playground_cache')
    .upsert(row, { onConflict: 'cache_key' })
    .select(PLAYGROUND_CACHE_COLUMNS)
    .single();
  if (error) {
    if (isMissingCacheTable(error)) return serializePlaygroundCache(entry);
    throw supabaseError(error, 'Could not save cached nearby playgrounds.');
  }
  return serializePlaygroundCache(data);
}

export async function listLocalPlayDates(userId, playgroundKey) {
  const key = normalizePlaygroundKey(playgroundKey);
  const store = await readStore();
  return store.playDates
    .filter((playDate) => playDate.playgroundKey === key && isUpcoming(playDate) && canViewLocalPlayDate(playDate, userId))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 30)
    .map((playDate) => serializeLocalPlayDate(playDate, userId));
}

export async function listLocalUserPlayDates(userId) {
  const store = await readStore();
  return store.playDates
    .filter((playDate) => isUpcoming(playDate) && canViewLocalPlayDate(playDate, userId)
      && (playDate.hostUserId === userId || (playDate.participants || []).some((participant) => (
        participant.userId === userId && participant.status === 'joined'
      ))))
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 50)
    .map((playDate) => serializeLocalPlayDate(playDate, userId));
}

export async function createLocalPlayDate(userId, body) {
  const input = normalizePlayDateInput(body);
  const now = new Date().toISOString();

  return mutateStore((store) => {
    const playDate = {
      id: randomUUID(),
      hostUserId: userId,
      ...input,
      participants: [{ userId, role: 'host', status: 'joined', joinedAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    store.playDates.unshift(playDate);
    return serializeLocalPlayDate(playDate, userId);
  });
}

export async function joinLocalPlayDate(userId, playDateId) {
  const now = new Date().toISOString();

  return mutateStore((store) => {
    const playDate = store.playDates.find((candidate) => candidate.id === playDateId);
    if (!playDate || !isUpcoming(playDate)) throw new Error('Play date is no longer available.');
    if (playDate.visibility !== 'public') throw new Error('This play date is private.');
    if (playDate.hostUserId === userId) return serializeLocalPlayDate(playDate, userId);

    playDate.participants = Array.isArray(playDate.participants) ? playDate.participants : [];
    const alreadyJoined = playDate.participants.some((participant) => (
      participant.userId === userId && participant.status === 'joined'
    ));
    if (!alreadyJoined) {
      const participantCount = localParticipantCount(playDate);
      if (playDate.maxFamilies && participantCount >= playDate.maxFamilies) {
        throw new Error('This play date is already full.');
      }
      playDate.participants.push({ userId, role: 'guest', status: 'joined', joinedAt: now });
      playDate.updatedAt = now;
    }

    return serializeLocalPlayDate(playDate, userId);
  });
}

export async function listLocalChatContacts(userId) {
  const store = await readStore();
  const related = new Set();
  store.playDates.forEach((playDate) => {
    const participants = Array.isArray(playDate.participants) ? playDate.participants : [];
    if (!participants.some((item) => item.userId === userId && item.status === 'joined')) return;
    participants.filter((item) => item.userId !== userId && item.status === 'joined').forEach((item) => related.add(item.userId));
    if (playDate.hostUserId !== userId) related.add(playDate.hostUserId);
  });
  return [...related].map((id) => {
    const user = store.users[id];
    return user ? { id, displayName: user.displayName || 'Parent', email: user.email || '', childProfile: normalizeChildProfile(user.childProfile) } : null;
  }).filter(Boolean);
}

export async function listLocalChatMessages(userId, contactId) {
  const store = await readStore();
  return store.chatMessages.filter((message) => (message.senderId === userId && message.recipientId === contactId) || (message.senderId === contactId && message.recipientId === userId)).slice(-100);
}

export async function createLocalChatMessage(userId, body) {
  const recipientId = cleanText(body.recipientId, 80);
  const text = cleanText(body.text, 2000);
  const mediaType = body.mediaType === 'video' ? 'video' : body.mediaType === 'photo' ? 'photo' : '';
  const mediaUrl = mediaType ? String(body.mediaUrl || '').slice(0, 400000) : '';
  if (!recipientId || (!text && !mediaUrl)) throw new Error('Add a message, photo, or short video.');
  return mutateStore((store) => {
    const message = { id: randomUUID(), senderId: userId, recipientId, text, mediaType, mediaUrl, createdAt: new Date().toISOString() };
    store.chatMessages.unshift(message);
    store.chatMessages = store.chatMessages.slice(0, 2000);
    return message;
  });
}

export async function listSupabaseChatContacts(supabase, authUser) {
  const { data: memberships, error: membershipError } = await supabase.from('play_date_participants').select('play_date_id').eq('user_id', authUser.id).eq('status', 'joined');
  if (membershipError || !memberships?.length) return [];
  const ids = memberships.map((row) => row.play_date_id);
  const { data: others, error: otherError } = await supabase.from('play_date_participants').select('user_id').in('play_date_id', ids).neq('user_id', authUser.id).eq('status', 'joined');
  if (otherError) throw supabaseError(otherError, 'Could not load playdate chat contacts.');
  if (!others?.length) return [];
  const userIds = [...new Set(others.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, display_name, email, child_profile').in('id', userIds);
  if (profileError) throw supabaseError(profileError, 'Could not load chat contacts.');
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return userIds.map((id) => {
    const profile = profileById.get(id);
    return {
      id,
      displayName: profile?.display_name || 'Parent',
      email: profile?.email || '',
      childProfile: normalizeChildProfile(profile?.child_profile),
    };
  });
}

export async function listSupabaseChatMessages(supabase, authUser, contactId) {
  const { data, error } = await supabase.from('chat_messages').select('id, sender_id, recipient_id, text, media_type, media_url, created_at').or(`and(sender_id.eq.${authUser.id},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${authUser.id})`).order('created_at', { ascending: true }).limit(100);
  if (error) throw supabaseError(error, 'Could not load chat messages.');
  return (data || []).map((row) => ({ id: row.id, senderId: row.sender_id, recipientId: row.recipient_id, text: row.text, mediaType: row.media_type, mediaUrl: row.media_url, createdAt: row.created_at }));
}

export async function createSupabaseChatMessage(supabase, authUser, body) {
  const text = cleanText(body.text, 2000);
  const mediaType = body.mediaType === 'video' ? 'video' : body.mediaType === 'photo' ? 'photo' : '';
  const mediaUrl = mediaType ? String(body.mediaUrl || '').slice(0, 400000) : '';
  if (!body.recipientId || (!text && !mediaUrl)) throw new Error('Add a message, photo, or short video.');
  const { data, error } = await supabase.from('chat_messages').insert({ sender_id: authUser.id, recipient_id: body.recipientId, text, media_type: mediaType, media_url: mediaUrl }).select('id, sender_id, recipient_id, text, media_type, media_url, created_at').single();
  if (error) throw supabaseError(error, 'Could not send chat message.');
  return { id: data.id, senderId: data.sender_id, recipientId: data.recipient_id, text: data.text, mediaType: data.media_type, mediaUrl: data.media_url, createdAt: data.created_at };
}

export async function listSupabasePlayDates(supabase, authUser, playgroundKey) {
  const key = normalizePlaygroundKey(playgroundKey);
  const { data, error } = await supabase
    .from('play_dates')
    .select(PLAY_DATE_COLUMNS)
    .eq('playground_key', key)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(30);

  if (error) throw supabaseError(error, 'Could not load play dates.');
  if (!data?.length) return [];

  const ids = data.map((playDate) => playDate.id);
  const { data: joinedRows, error: participantError } = await supabase
    .from('play_date_participants')
    .select('play_date_id')
    .eq('user_id', authUser.id)
    .eq('status', 'joined')
    .in('play_date_id', ids);

  if (participantError) throw supabaseError(participantError, 'Could not load play date attendees.');
  const joinedIds = new Set((joinedRows || []).map((row) => row.play_date_id));
  return data.map((row) => serializeSupabasePlayDate(row, authUser.id, joinedIds));
}

export async function listSupabaseUserPlayDates(supabase, authUser) {
  const { data: memberships, error: membershipError } = await supabase
    .from('play_date_participants')
    .select('play_date_id')
    .eq('user_id', authUser.id)
    .eq('status', 'joined');
  if (membershipError) throw supabaseError(membershipError, 'Could not load your playdates.');

  const membershipIds = (memberships || []).map((row) => row.play_date_id);
  const hostQuery = supabase
    .from('play_dates')
    .select(PLAY_DATE_COLUMNS)
    .eq('host_user_id', authUser.id)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(50);
  const joinedQuery = membershipIds.length
    ? supabase
      .from('play_dates')
      .select(PLAY_DATE_COLUMNS)
      .in('id', membershipIds)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(50)
    : Promise.resolve({ data: [], error: null });
  const [{ data: hosted, error: hostedError }, { data: joined, error: joinedError }] = await Promise.all([hostQuery, joinedQuery]);
  if (hostedError) throw supabaseError(hostedError, 'Could not load your hosted playdates.');
  if (joinedError) throw supabaseError(joinedError, 'Could not load your joined playdates.');

  const rows = [...(hosted || []), ...(joined || [])]
    .filter((row, index, all) => all.findIndex((candidate) => candidate.id === row.id) === index)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 50);
  const joinedIds = new Set(membershipIds);
  return rows.map((row) => serializeSupabasePlayDate(row, authUser.id, joinedIds));
}

function playDateInputToRow(authUser, input) {
  return {
    host_user_id: authUser.id,
    playground_key: input.playgroundKey,
    playground_name: input.playgroundName,
    playground_type: input.playgroundType,
    playground_address: input.playgroundAddress,
    playground_latitude: input.playgroundLatitude,
    playground_longitude: input.playgroundLongitude,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    visibility: input.visibility,
    notes: input.notes,
    age_range: input.ageRange,
    max_families: input.maxFamilies,
  };
}

export async function createSupabasePlayDate(supabase, authUser, body) {
  const input = normalizePlayDateInput(body);
  const { data: inserted, error } = await supabase
    .from('play_dates')
    .insert(playDateInputToRow(authUser, input))
    .select(PLAY_DATE_COLUMNS)
    .single();

  if (error) throw supabaseError(error, 'Could not create the play date.');

  const { error: participantError } = await supabase
    .from('play_date_participants')
    .insert({
      play_date_id: inserted.id,
      user_id: authUser.id,
      role: 'host',
      status: 'joined',
    });

  if (participantError) {
    await supabase.from('play_dates').delete().eq('id', inserted.id);
    throw supabaseError(participantError, 'Could not add the host to the play date.');
  }

  const { data: created, error: reloadError } = await supabase
    .from('play_dates')
    .select(PLAY_DATE_COLUMNS)
    .eq('id', inserted.id)
    .single();

  if (reloadError) throw supabaseError(reloadError, 'Could not load the created play date.');
  return serializeSupabasePlayDate(created, authUser.id, new Set([created.id]));
}

export async function joinSupabasePlayDate(supabase, authUser, playDateId) {
  const { data: playDate, error } = await supabase
    .from('play_dates')
    .select(PLAY_DATE_COLUMNS)
    .eq('id', playDateId)
    .maybeSingle();

  if (error) throw supabaseError(error, 'Could not load this play date.');
  if (!playDate || new Date(playDate.ends_at).getTime() < Date.now()) {
    throw new Error('Play date is no longer available.');
  }
  if (playDate.visibility !== 'public') throw new Error('This play date is private.');
  if (playDate.host_user_id === authUser.id) {
    return serializeSupabasePlayDate(playDate, authUser.id, new Set([playDate.id]));
  }
  if (playDate.max_families && Number(playDate.participant_count) >= playDate.max_families) {
    throw new Error('This play date is already full.');
  }

  const { error: insertError } = await supabase
    .from('play_date_participants')
    .insert({
      play_date_id: playDate.id,
      user_id: authUser.id,
      role: 'guest',
      status: 'joined',
    });

  if (insertError && insertError.code !== '23505') {
    throw supabaseError(insertError, 'Could not join this play date.');
  }

  const { data: updated, error: reloadError } = await supabase
    .from('play_dates')
    .select(PLAY_DATE_COLUMNS)
    .eq('id', playDate.id)
    .single();

  if (reloadError) throw supabaseError(reloadError, 'Could not refresh this play date.');
  return serializeSupabasePlayDate(updated, authUser.id, new Set([updated.id]));
}

export async function ensureSupabaseProfile(supabase, authUser, options = {}) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw supabaseError(error, 'Could not load the signed-in profile.');

  const nextDisplayName = String(options.displayName || '').trim();
  if (data) {
    if (nextDisplayName && nextDisplayName !== data.display_name) {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: nextDisplayName, updated_at: new Date().toISOString() })
        .eq('id', authUser.id)
        .select(PROFILE_COLUMNS)
        .single();
      if (updateError) throw supabaseError(updateError, 'Could not update the profile.');
      return profileRowToUser(updated);
    }
    return profileRowToUser(data);
  }

  const created = createUser({
    id: authUser.id,
    email: authUser.email,
    displayName: nextDisplayName || authUser.displayName || 'Family Profile',
  });
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert(userToProfileRow(created))
    .select(PROFILE_COLUMNS)
    .single();

  if (insertError) throw supabaseError(insertError, 'Could not create the signed-in profile.');
  return profileRowToUser(inserted);
}

export async function updateSupabaseProfileField(supabase, authUser, field, body) {
  const current = await ensureSupabaseProfile(supabase, authUser);
  const columnByField = {
    socialLinks: 'social_links',
    location: 'location',
    foodPlan: 'food_plan',
    amazonErrands: 'amazon_errands',
    familyObjects: 'family_objects',
    childProfile: 'child_profile',
  };
  const column = columnByField[field];
  if (!column) throw new Error('Unknown profile field.');

  const value = field === 'location'
    ? body
    : field === 'childProfile'
      ? normalizeChildProfile(body, current.childProfile)
      : field === 'familyObjects'
        ? (Array.isArray(body) ? body : [])
      : { ...current[field], ...body };
  const { data, error } = await supabase
    .from('profiles')
    .update({ [column]: value, updated_at: new Date().toISOString() })
    .eq('id', authUser.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw supabaseError(error, 'Could not save the profile.');
  return profileRowToUser(data);
}
