import {
  filterDiscoverItems,
  nextDiscoverFilterState,
  normalizeFamilyEvent,
  normalizePlaydate,
  normalizePlayground,
  normalizeStoryTime,
  sortDiscoverItemsByDistance,
  sourceRecord,
  uniqueDiscoverItems,
} from '@sproutcue/shared/discover-normalizers';
import { createPlaydatePayload, discoverGeocodeQuery, discoverPlanFor, familyEventId, savedPlanFor, uniqueById } from '@sproutcue/shared/discover-view';
import { localDatePart } from '@sproutcue/shared/playdates';
import { getChildProfile, normalizePlayPreferences } from '@sproutcue/shared/profile-defaults';
import { fallbackPlayOptions, loadTodayWeather, locationCoords, shortLocation, userLocation, WEATHER_NEEDS_LOCATION } from '@sproutcue/shared/today';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest, discover, familyPlans } from './api';
import type { PlayDate } from './family-data';
import { geocodeVenue } from './location';
import { useLocationEditor } from './location-editor';
import { createPlaydateRequest, joinPlaydateRequest, onPlaydatesChanged } from './playdates';
import { useSession } from './session';
import type { FamilyPlan, Weather } from './today-data';

// Data behind the Discover tab — the same sources as the web Discover tab (apps/web/src/tabs/play.js):
//   shared loadDiscover (playgrounds → nearby playdates, family events, story times),
//   GET /playdates?mine=1, GET /family-plans, Open-Meteo weather, PUT /location.

export type DiscoverKind = 'playground' | 'playdate' | 'family_event' | 'story_time';
export type DiscoverItem = {
  id: string;
  sourceId: string;
  kind: DiscoverKind;
  title: string;
  summary: string;
  location: { venue: string; address: string; latitude: number | null; longitude: number | null };
  schedule: { date: string; startsAt: string | null; endsAt: string | null; dateLabel: string; timeLabel: string };
  distance: { miles: number | null; label: string };
  ageRange: string;
  imageUrl: string;
  href: string;
  source: { id: string; label: string; url: string; resultType: string };
  status: string;
  actions: string[];
  detail: Record<string, any>;
};
export type FilterState = { todayOnly: boolean; playgroundOnly: boolean; kinds: string[] };
export type Playground = Record<string, any> & { key: string; name: string };
export type NewPlaydate = { startsAt: string; endsAt: string; visibility?: 'public' | 'private'; ageRange: string; maxFamilies: string; notes: string };

type Raw = {
  playgrounds: Playground[];
  playdates: PlayDate[];
  familyEvents: Record<string, any>[];
  storyTimes: Record<string, any>[];
  sources: Record<string, any> | null;
};

const EMPTY: Raw = { playgrounds: [], playdates: [], familyEvents: [], storyTimes: [], sources: null };

function providerStatus(raw: Raw, location: any) {
  const sources = raw.sources;
  if (!sources) return '';
  const parts: string[] = [];
  const events = sources.familyEvents;
  if (events?.status === 'error') parts.push(`Could not load family events: ${events.error}`);
  else if (events?.status === 'skipped') parts.push('Save a home city or location to find family events.');
  else if (events) {
    const payload = events.payload || {};
    const city = payload.locationCity || shortLocation(location);
    const range = payload.dateRangeLabel ? ` for ${payload.dateRangeLabel}` : '';
    parts.push(payload.fallback
      ? `No parsed event cards matched ${city}${range}; showing live search sources.`
      : `Showing ${raw.familyEvents.length} ${payload.cached ? 'cached' : 'updated'} ${payload.sourceLabel || 'family event sources'} event${raw.familyEvents.length === 1 ? '' : 's'} near ${city}${range}.`);
  }
  const stories = sources.storyTimes;
  if (stories?.status === 'error') parts.push(`Could not load story times: ${stories.error}`);
  else if (stories) {
    const payload = stories.payload || {};
    parts.push(raw.storyTimes.length
      ? `Showing all ${raw.storyTimes.length} ${payload.cached ? 'cached' : 'updated'} story time${raw.storyTimes.length === 1 ? '' : 's'} from ${payload.sourceLabel || 'library calendars'}.`
      : 'No story times found for the next week.');
  }
  return parts.join(' ');
}

export function useDiscoverData() {
  const { user, session, previewMode } = useSession();
  const editor = useLocationEditor();
  const signedIn = Boolean(session) && !previewMode;
  const location = useMemo(() => userLocation(user, getChildProfile(user).homeCity), [user]);
  const coords = locationCoords(location);
  const radiusMiles = normalizePlayPreferences((user?.playPreferences || {}) as any).searchRadiusMiles;
  const locationKey = `${location?.address || location?.label || ''}|${coords?.latitude ?? ''}|${coords?.longitude ?? ''}|${radiusMiles}`;

  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [minePlaydates, setMinePlaydates] = useState<PlayDate[]>([]);
  const [todayEvents, setTodayEvents] = useState<Record<string, any>[] | null>(null);
  const [plans, setPlans] = useState<FamilyPlan[]>([]);
  const [weather, setWeather] = useState<Weather>({ label: 'Weather loading', temperature: '--' });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayLoading, setTodayLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<FilterState>({ todayOnly: false, playgroundOnly: false, kinds: [] });
  const [resolved, setResolved] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const loadedKey = useRef('');
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'focus' | 'refresh' = 'focus') => {
      const id = ++requestId.current;
      loadedKey.current = locationKey;
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      const forceRefresh = mode === 'refresh';
      const [result, mine, saved, nextWeather] = await Promise.allSettled([
        signedIn && location ? discover.loadDiscover({ location, radiusMiles, forceRefresh }) : Promise.resolve(null),
        signedIn ? apiRequest<{ playDates?: PlayDate[] }>('/playdates?mine=1') : Promise.resolve({ playDates: [] }),
        signedIn ? familyPlans.loadFamilyPlans() : Promise.resolve({ plans: [] }),
        coords ? loadTodayWeather(coords) : Promise.resolve(WEATHER_NEEDS_LOCATION),
      ]);
      if (id !== requestId.current) return;
      if (result.status === 'fulfilled' && result.value) {
        const { groups, sources } = result.value;
        setRaw({
          playgrounds: groups.playgrounds.map(sourceRecord) as Playground[],
          playdates: groups.playdates.map(sourceRecord) as PlayDate[],
          familyEvents: groups.familyEvents.map(sourceRecord),
          storyTimes: groups.storyTimes.map(sourceRecord),
          sources,
        });
      } else {
        setRaw(EMPTY);
        if (result.status === 'rejected') setMessage(`Could not load Discover: ${result.reason?.message || result.reason}`);
      }
      if (mine.status === 'fulfilled') setMinePlaydates(mine.value.playDates || []);
      if (saved.status === 'fulfilled') {
        const list = Array.isArray(saved.value?.plans) ? saved.value.plans : saved.value?.events;
        setPlans(Array.isArray(list) ? list : []);
      }
      if (nextWeather.status === 'fulfilled') setWeather(nextWeather.value as Weather);
      if (forceRefresh) setTodayEvents(null);
      setLoading(false);
      setRefreshing(false);
    },
    [signedIn, location, coords?.latitude, coords?.longitude, radiusMiles, locationKey],
  );

  // Load on first visit and whenever the search location or radius changes; pull to refresh forces providers.
  useFocusEffect(
    useCallback(() => {
      if (loadedKey.current !== locationKey) load('focus');
    }, [load, locationKey]),
  );

  // "Today" also asks the event provider for same-day events (web loadTodayFamilyEvents).
  useEffect(() => {
    if (!filter.todayOnly || todayEvents || !signedIn || !location) return;
    let active = true;
    const date = localDatePart(new Date());
    setTodayLoading(true);
    discover
      .loadDiscover({ location, kinds: ['family_event'], startDate: date, endDate: date })
      .then((result) => active && setTodayEvents(result.groups.familyEvents.map(sourceRecord)))
      .catch(() => active && setTodayEvents([]))
      .finally(() => active && setTodayLoading(false));
    return () => {
      active = false;
    };
  }, [filter.todayOnly, todayEvents, signedIn, location]);

  const livePlaygrounds = raw.playgrounds.length > 0;
  const playgrounds: Playground[] = useMemo(
    () => (livePlaygrounds ? raw.playgrounds : (fallbackPlayOptions(location) as Playground[])),
    [livePlaygrounds, raw.playgrounds, location],
  );

  const allItems: DiscoverItem[] = useMemo(() => {
    const events = [...raw.familyEvents, ...(filter.todayOnly ? todayEvents || [] : [])].filter((event, index, list) => {
      const eventId = familyEventId(event);
      return eventId && list.findIndex((candidate) => familyEventId(candidate) === eventId) === index;
    });
    // Providers sometimes repeat an id (e.g. one story-time program at several branches): keep keys unique.
    const items = uniqueDiscoverItems([
      ...playgrounds.map(normalizePlayground),
      ...uniqueById(raw.playdates, minePlaydates).map(normalizePlaydate),
      ...events.map(normalizeFamilyEvent),
      ...raw.storyTimes.map(normalizeStoryTime),
    ]) as DiscoverItem[];
    return items.map((item) => {
      const point = resolved[item.id];
      return point ? { ...item, location: { ...item.location, ...point } } : item;
    });
  }, [playgrounds, raw, minePlaydates, todayEvents, filter.todayOnly, resolved]);

  const items: DiscoverItem[] = useMemo(
    () => sortDiscoverItemsByDistance(filterDiscoverItems(allItems, filter), coords) as DiscoverItem[],
    [allItems, filter, coords],
  );

  // Family events and story times often arrive without coordinates: place them with the OS geocoder.
  const searchLabel = location?.address || location?.label || '';
  useEffect(() => {
    if (Platform.OS === 'web' || !coords) return;
    const pending = items.filter((item) => item.location.latitude == null && !resolved[item.id] && discoverGeocodeQuery(item, searchLabel)).slice(0, 15);
    if (!pending.length) return;
    let active = true;
    Promise.all(pending.map(async (item) => [item.id, await geocodeVenue(discoverGeocodeQuery(item, searchLabel))] as const)).then((pairs) => {
      if (!active) return;
      const found = Object.fromEntries(pairs.filter(([, point]) => point)) as Record<string, { latitude: number; longitude: number }>;
      if (Object.keys(found).length) setResolved((current) => ({ ...current, ...found }));
    });
    return () => {
      active = false;
    };
  }, [items, coords, resolved, searchLabel]);

  // Status messages (saved, joined, created…) fade after a few seconds.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const choose = useCallback((selection: string) => setFilter((current) => nextDiscoverFilterState(current, selection) as FilterState), []);
  const isSaved = useCallback((item: DiscoverItem) => Boolean(savedPlanFor(item, plans)), [plans]);

  const toggleSave = useCallback(
    async (item: DiscoverItem) => {
      const plan = discoverPlanFor(item);
      if (!plan || !signedIn) return;
      const existing = savedPlanFor(item, plans);
      const previous = plans;
      const label = item.kind === 'story_time' ? 'Story time' : 'Event';
      setPlans(existing ? plans.filter((saved) => saved.id !== existing.id) : [...plans, plan]);
      try {
        if (existing) await familyPlans.removeFamilyPlan(existing.id);
        else {
          const response = await familyPlans.saveFamilyPlan(plan);
          setPlans((current) => current.map((saved) => (saved.kind === plan.kind && saved.externalId === plan.externalId && !saved.id ? response.item : saved)));
        }
        setMessage(existing ? `${label} removed from your family plans.` : `${label} saved to your family plans.`);
      } catch (error: any) {
        setPlans(previous);
        setMessage(`Could not update your plans: ${error?.message || error}`);
      }
    },
    [plans, signedIn],
  );

  const reloadPlaydates = useCallback(async () => {
    const [nearby, mine] = await Promise.allSettled([
      livePlaygrounds ? discover.loadPlaydatesForPlaygrounds(raw.playgrounds) : Promise.resolve({ items: [] }),
      apiRequest<{ playDates?: PlayDate[] }>('/playdates?mine=1'),
    ]);
    if (nearby.status === 'fulfilled') setRaw((current) => ({ ...current, playdates: nearby.value.items.map(sourceRecord) as PlayDate[] }));
    if (mine.status === 'fulfilled') setMinePlaydates(mine.value.playDates || []);
  }, [livePlaygrounds, raw.playgrounds]);

  // Joining, editing or cancelling on the playdate screen refreshes the playdates shown here.
  const reloadRef = useRef(reloadPlaydates);
  useEffect(() => {
    reloadRef.current = reloadPlaydates;
  }, [reloadPlaydates]);
  useEffect(() => onPlaydatesChanged(() => reloadRef.current()), []);

  const join = useCallback(async (item: DiscoverItem) => {
    try {
      await joinPlaydateRequest(item.detail.id);
      setMessage('Joined. This play date is now on your family profile.');
    } catch (error: any) {
      setMessage(`Could not join play date: ${error?.message || error}`);
    }
  }, []);

  /** Throws with a friendly message so the create sheet can show it. Returns the new playdate. */
  const createPlaydate = useCallback(async (playground: Playground, form: NewPlaydate) => {
    const payload = createPlaydatePayload(playground, form);
    const created = await createPlaydateRequest(payload);
    setMessage(payload.visibility === 'private'
      ? 'Private play date created. Only this family profile can see it.'
      : 'Public play date created. Other signed-in families can find it from this playground.');
    return created;
  }, []);

  // A new search location makes earlier venue look-ups irrelevant.
  useEffect(() => {
    setResolved({});
  }, [locationKey]);

  const defaultLocationStatus = !location
    ? 'No location saved. Use your current location or enter an address.'
    : location.source === 'child-profile'
      ? 'Using the home city from the child profile. Save a precise place for live nearby results.'
      : !coords
        ? `Showing map searches for ${shortLocation(location)}. Use current location or a recognized place for live nearby results.`
        : loading
          ? `Finding indoor and outdoor options near ${shortLocation(location)}…`
          : livePlaygrounds
            ? `Showing ${raw.playgrounds.length} options within ${radiusMiles} mile${radiusMiles === 1 ? '' : 's'} of ${shortLocation(location)}.`
            : `No live nearby places found around ${shortLocation(location)}; showing map searches.`;

  return {
    location,
    coords,
    radiusMiles,
    weather,
    items,
    allItems,
    playgrounds,
    filter,
    choose,
    loading,
    todayLoading,
    refreshing,
    refresh: () => load('refresh'),
    providerStatus: providerStatus(raw, location),
    /** A saved location with map coordinates: Discover shows a compact summary instead of the setup panel. */
    locationSet: Boolean(coords) && location?.source !== 'child-profile',
    locationStatus: editor.status || defaultLocationStatus,
    locating: editor.locating,
    locateMe: editor.locateMe,
    searchAddress: editor.searchAddress,
    isSaved,
    toggleSave,
    join,
    createPlaydate,
    message,
    clearMessage: () => setMessage(''),
    signedIn,
  };
}

export type DiscoverData = ReturnType<typeof useDiscoverData>;
