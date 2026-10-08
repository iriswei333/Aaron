import { sourceRecord } from '@sproutcue/shared/discover-normalizers';
import { getChildProfile, normalizePlayPreferences } from '@sproutcue/shared/profile-defaults';
import { fallbackPlayOptions, loadTodayWeather, locationCoords, userLocation, WEATHER_NEEDS_LOCATION } from '@sproutcue/shared/today';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { apiRequest, discover, familyPlans } from './api';
import type { PlayDate } from './family-data';
import { useSession } from './session';

// Data behind the Today tab — the same sources as the web Today tab:
//   GET /playdates?mine=1, GET /family-plans, nearby playgrounds (shared Discover loader),
//   and Open-Meteo weather for the family's saved location.

export type Weather = { label: string; temperature: string; precipitation?: string; wind?: string };
export type PlayOption = { key?: string; name?: string; type?: string; distance?: string; best?: string; preference?: string; imageUrl?: string; href?: string };
export type FamilyPlan = Record<string, any>;

export function useTodayData() {
  const { user, session, previewMode } = useSession();
  const [playDates, setPlayDates] = useState<PlayDate[]>([]);
  const [plans, setPlans] = useState<FamilyPlan[]>([]);
  const [weather, setWeather] = useState<Weather>({ label: 'Weather loading', temperature: '--' });
  const [options, setOptions] = useState<PlayOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const signedIn = Boolean(session) && !previewMode;
  const location = useMemo(() => userLocation(user, getChildProfile(user).homeCity), [user]);
  const radiusMiles = normalizePlayPreferences((user?.playPreferences || {}) as any).searchRadiusMiles;

  const load = useCallback(
    async (mode: 'focus' | 'refresh' = 'focus') => {
      if (mode === 'refresh') setRefreshing(true);
      const coords = locationCoords(location);
      const [mine, saved, nextWeather, nearby] = await Promise.allSettled([
        signedIn ? apiRequest<{ playDates?: PlayDate[] }>('/playdates?mine=1') : Promise.resolve({ playDates: [] }),
        signedIn ? familyPlans.loadFamilyPlans() : Promise.resolve({ plans: [] }),
        coords ? loadTodayWeather(coords) : Promise.resolve(WEATHER_NEEDS_LOCATION),
        coords && signedIn ? discover.loadDiscover({ location, radiusMiles, kinds: ['playground'] }) : Promise.resolve(null),
      ]);
      if (mine.status === 'fulfilled') setPlayDates(mine.value.playDates || []);
      if (saved.status === 'fulfilled') {
        const list = Array.isArray(saved.value?.plans) ? saved.value.plans : saved.value?.events;
        setPlans(Array.isArray(list) ? list.filter((item: FamilyPlan) => ['external_event', 'story_time'].includes(item.kind)) : []);
      }
      if (nextWeather.status === 'fulfilled') setWeather(nextWeather.value as Weather);
      const live = nearby.status === 'fulfilled' && nearby.value ? (nearby.value.groups.playgrounds || []).map(sourceRecord) : [];
      setOptions(live.length ? live : fallbackPlayOptions(location));
      setLoaded(true);
      setRefreshing(false);
    },
    [signedIn, location, radiusMiles],
  );

  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  return { playDates, plans, weather, options, location, loaded, refreshing, refresh: () => load('refresh') };
}

// Getting-ready story (web todayStoryModal): create with a goal, then optionally save to Family AI assets.
export type TodayStoryResult = {
  goal?: string;
  story?: { title?: string; summary?: string; scenes?: { heading?: string; storyText?: string; practiceCue?: string }[]; celebration?: string };
};

// AI story generation runs inside this request and often takes 20–60 s,
// so it gets a longer limit than the app's default 15 s.
const STORY_TIMEOUT_MS = 120_000;

export async function createTodayStory(goalId: string) {
  const result = await apiRequest<{ story: TodayStoryResult }>('/family-assets/practice-stories/playground', { method: 'POST', body: { goalId }, timeoutMs: STORY_TIMEOUT_MS });
  return result.story;
}

export async function saveTodayStory(story: TodayStoryResult) {
  const result = await apiRequest<{ asset: { id: string } }>('/family-assets/practice-stories/playground', { method: 'PUT', body: { story }, timeoutMs: 60_000 });
  return result.asset;
}
