import { deleteAssetPrompt } from '@sproutcue/shared/family-profile';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { apiRequest } from './api';
import { useSession } from './session';

// Data behind the Family tab — the same four requests the web Family tab makes.

// A playdate as the API returns it (GET /playdates, /playdates?mine=1, /playdates/:id).
export type PlayDate = {
  id: string;
  playgroundKey?: string;
  playgroundName?: string;
  playgroundType?: string;
  playgroundAddress?: string;
  playgroundLatitude?: number | null;
  playgroundLongitude?: number | null;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  visibility?: string;
  participantCount?: number;
  maxFamilies?: number | null;
  ageRange?: string;
  notes?: string;
  hostLabel?: string;
  lastChangeSummary?: string;
  isHost?: boolean;
  isJoined?: boolean;
  isDeclined?: boolean;
  canJoin?: boolean;
};

export type PracticeStoryAsset = {
  id: string;
  title?: string;
  goal?: string;
  interests?: string[];
  coverUrl?: string | null;
  hasCoverImage?: boolean;
  createdAt?: string;
  story?: {
    title?: string;
    summary?: string;
    mission?: string;
    goal?: string;
    readAloudMinutes?: number;
    scenes?: { heading?: string; storyText?: string; sayTogether?: string; practiceCue?: string }[];
    celebration?: string;
    reflectionQuestions?: string[];
    caregiverTips?: string[];
  };
};

export type ToyPlayAsset = {
  id: string;
  title?: string;
  language?: string;
  childAgeMonths?: number;
  createdAt?: string;
  toy?: { name?: string; description?: string; confidence?: string };
  play?: {
    title?: string;
    summary?: string;
    durationMinutes?: number;
    ageRange?: string;
    developmentalGoals?: string[];
    materials?: string[];
    parentPrompts?: string[];
    steps?: string[];
    easierVariation?: string;
    harderVariation?: string;
    supervision?: string;
    safetyNotes?: string[];
  };
};

export type PictureBook = { id: string; title?: string; childName?: string; createdAt?: string; template?: { name?: string }; pages?: Record<string, { status?: string }> };

type FamilyData = {
  playDates: PlayDate[];
  pictureBooks: PictureBook[];
  toyPlayAssets: ToyPlayAsset[];
  practiceStoryAssets: PracticeStoryAsset[];
};

const EMPTY: FamilyData = { playDates: [], pictureBooks: [], toyPlayAssets: [], practiceStoryAssets: [] };

export function useFamilyData() {
  const { session, previewMode } = useSession();
  const [data, setData] = useState<FamilyData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [assetsStatus, setAssetsStatus] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const loadedOnce = useRef(false);
  const signedIn = Boolean(session) && !previewMode;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'focus' = 'initial') => {
      if (!signedIn) return;
      if (mode === 'refresh') setRefreshing(true);
      else if (!loadedOnce.current) setLoading(true);
      const [playDates, books, toys, stories] = await Promise.allSettled([
        apiRequest<{ playDates?: PlayDate[] }>('/playdates?mine=1'),
        apiRequest<{ books?: PictureBook[] }>('/family-assets/picture-books'),
        apiRequest<{ assets?: ToyPlayAsset[] }>('/family-assets/toy-plays'),
        apiRequest<{ assets?: PracticeStoryAsset[] }>('/family-assets/practice-stories'),
      ]);
      setData((current) => ({
        playDates: playDates.status === 'fulfilled' ? playDates.value.playDates || [] : current.playDates,
        pictureBooks: books.status === 'fulfilled' ? books.value.books || [] : current.pictureBooks,
        toyPlayAssets: toys.status === 'fulfilled' ? toys.value.assets || [] : current.toyPlayAssets,
        practiceStoryAssets: stories.status === 'fulfilled' ? stories.value.assets || [] : current.practiceStoryAssets,
      }));
      const assetFailure = [books, toys, stories].find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      setAssetsStatus(assetFailure ? `Could not load family AI assets: ${assetFailure.reason?.message || 'please try again.'}` : '');
      loadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    },
    [signedIn],
  );

  // Reload whenever the Family tab comes into view (e.g. after creating something in Play Studio).
  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  const deleteAsset = useCallback(async (kind: 'toy' | 'story', asset: { id: string; title?: string; hasCoverImage?: boolean }) => {
    const prompt = deleteAssetPrompt(kind, asset);
    setDeletingId(asset.id);
    setAssetsStatus(`Deleting ${kind === 'toy' ? 'saved play idea' : 'practice story'}…`);
    try {
      await apiRequest(`${prompt.endpoint}?assetId=${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
      setData((current) =>
        kind === 'toy'
          ? { ...current, toyPlayAssets: current.toyPlayAssets.filter((item) => item.id !== asset.id) }
          : { ...current, practiceStoryAssets: current.practiceStoryAssets.filter((item) => item.id !== asset.id) },
      );
      setAssetsStatus(prompt.doneMessage);
      return true;
    } catch (error) {
      setAssetsStatus(`${prompt.errorPrefix}: ${error instanceof Error ? error.message : 'please try again.'}`);
      return false;
    } finally {
      setDeletingId('');
    }
  }, []);

  return { ...data, loading, refreshing, assetsStatus, deletingId, refresh: () => load('refresh'), deleteAsset };
}
