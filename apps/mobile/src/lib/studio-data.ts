import { practiceStoryRequest } from '@sproutcue/shared/studio';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAiJobs, type AiJob, type AiUsage } from './ai-jobs';
import { apiRequest, apiUrl } from './api';
import type { PracticeStoryAsset } from './family-data';
import { uploadAiPhotos, type PickedPhoto, type SavedPhoto } from './photo-upload';
import { useSession } from './session';
import { getAccessToken } from './supabase';

// Play Studio data — the same endpoints as apps/web/src/tabs/studio.js.

export type PictureBookPage = { pageOrder?: number; pageType?: string; titleEn?: string; titleZh?: string; status?: string; error?: string | null; url?: string | null };
export type PictureBook = {
  id: string;
  title?: string;
  childName?: string;
  status?: string;
  createdAt?: string;
  template?: { slug?: string; name?: string };
  pages?: Record<string, PictureBookPage>;
};
export type PictureBookTemplate = { id?: string; slug: string; name: string; description?: string; pageCount?: number | null };
type Queued = { job: AiJob; usage?: AiUsage };

// ── Picture books ────────────────────────────────────────────────────────────

let booksCache: PictureBook[] | null = null;
let templatesCache: PictureBookTemplate[] | null = null;

export function usePictureBooks() {
  const { session, previewMode } = useSession();
  const signedIn = Boolean(session) && !previewMode;
  const ai = useAiJobs();
  const [books, setBooks] = useState<PictureBook[]>(booksCache || []);
  const [templates, setTemplates] = useState<PictureBookTemplate[]>(templatesCache || []);
  const [loading, setLoading] = useState(!booksCache);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(
    async (mode: 'focus' | 'refresh' = 'focus') => {
      if (!signedIn) {
        setLoading(false);
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      const [bookResult, templateResult] = await Promise.allSettled([
        apiRequest<{ books?: PictureBook[] }>('/family-assets/picture-books'),
        templatesCache ? Promise.resolve({ templates: templatesCache }) : apiRequest<{ templates?: PictureBookTemplate[] }>('/family-assets/picture-book-templates'),
      ]);
      if (bookResult.status === 'fulfilled') {
        booksCache = bookResult.value.books || [];
        setBooks(booksCache);
        setStatus('');
      } else setStatus(`Could not load your books: ${bookResult.reason?.message || bookResult.reason}`);
      if (templateResult.status === 'fulfilled') {
        templatesCache = templateResult.value.templates || [];
        setTemplates(templatesCache);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [signedIn],
  );

  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );
  // A finished page or whole book: reload so statuses and images update.
  useEffect(() => ai.onFinished((job) => {
    if (job.result?.assetType === 'picture_book' || job.jobType?.includes('picture')) load('focus');
  }), [ai, load]);

  const queue = useCallback(
    async (body: Record<string, unknown>, pending: string) => {
      setStatus(pending);
      try {
        const result = await apiRequest<Queued>('/family-assets/picture-book-pages', { method: 'POST', body });
        setStatus('');
        // Show the page as "making" right away.
        setBooks((current) => current.map((book) => {
          if (book.id !== body.bookAssetId) return book;
          const pages = { ...book.pages };
          Object.keys(pages).forEach((key) => {
            if ((body.wholeBook && pages[key].status !== 'ready') || key === body.pageKey) pages[key] = { ...pages[key], status: 'generating' };
          });
          return { ...book, pages };
        }));
        ai.start(result.job, result.usage);
      } catch (error: any) {
        setStatus(error?.message || 'Could not start this page.');
      }
    },
    [ai],
  );

  const makePage = (bookId: string, pageKey: string) => queue({ bookAssetId: bookId, pageKey }, 'Starting this page…');
  const makeWholeBook = (bookId: string) => queue({ bookAssetId: bookId, wholeBook: true }, 'Queueing the remaining pages…');

  const createBook = useCallback(async (form: { childName: string; templateSlug: string; photos: PickedPhoto[] }, onProgress: (text: string) => void) => {
    const saved = await uploadAiPhotos(form.photos, { label: form.childName ? `${form.childName} picture-book photo` : 'Picture-book photo', sourceKind: 'picture_book' }, onProgress);
    onProgress('Creating the private picture book…');
    const result = await apiRequest<{ book: PictureBook }>('/family-assets/picture-books', {
      method: 'POST',
      body: { childName: form.childName, templateSlug: form.templateSlug, savedPhotoIds: saved.map((photo) => photo.id) },
      timeoutMs: 60_000,
    });
    booksCache = [result.book, ...(booksCache || [])];
    setBooks(booksCache);
    return result.book;
  }, []);

  const deleteBook = useCallback(async (bookId: string) => {
    await apiRequest(`/family-assets/picture-books?bookAssetId=${encodeURIComponent(bookId)}`, { method: 'DELETE' });
    booksCache = (booksCache || []).filter((book) => book.id !== bookId);
    setBooks(booksCache);
  }, []);

  return { books, templates, loading, refreshing, status, setStatus, refresh: () => load('refresh'), makePage, makeWholeBook, createBook, deleteBook };
}

/** Downloads the finished book as a PDF and opens the share sheet (Books, Files, Print, AirDrop…). */
export async function sharePictureBookPdf(book: PictureBook) {
  const path = `/family-assets/picture-book-pdf?bookAssetId=${encodeURIComponent(book.id)}`;
  const token = await getAccessToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const name = `${String(book.title || 'picture-book').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'picture-book'}.pdf`;
  if (Platform.OS === 'web') {
    const response = await fetch(apiUrl(path), { headers });
    if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || `Request failed with ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    globalThis.open?.(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(apiUrl(path), target, { headers });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: book.title || 'Picture book' });
}

// ── Saved photos (reuse in the story maker) ──────────────────────────────────

export function useSavedPhotos(enabled: boolean) {
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiRequest<{ photos?: SavedPhoto[] }>('/family-assets/photos')
      .then((result) => active && setPhotos(result.photos || []))
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [enabled]);
  return { photos, loaded };
}

// ── Practice stories ─────────────────────────────────────────────────────────

export type StoryForm = { goal: string; challenge: string; interests: string; parentGoals: string[]; storyTheme: string; adventureLength: string; language: 'en' | 'zh-CN'; savedPhotoIds: string[]; newPhotos: PickedPhoto[] };

/** Uploads new photos, queues the story, and shows the AI progress sheet. Throws a friendly message. */
export function useCreatePracticeStory() {
  const ai = useAiJobs();
  return useCallback(
    async (form: StoryForm, onProgress: (text: string) => void) => {
      const body = practiceStoryRequest({ ...form, savedPhotoIds: [] }); // validates before any upload
      const uploaded = form.newPhotos.length
        ? await uploadAiPhotos(form.newPhotos, { label: 'Practice story photo', sourceKind: 'practice_story' }, onProgress)
        : [];
      onProgress(form.newPhotos.length || form.savedPhotoIds.length ? 'Writing the story and illustrating the big step…' : 'Writing a gentle, age-matched story…');
      const request = practiceStoryRequest({ ...body, savedPhotoIds: [...form.savedPhotoIds, ...uploaded.map((photo) => photo.id)] });
      const result = await apiRequest<Queued>('/family-assets/practice-stories', { method: 'POST', body: request, timeoutMs: 60_000 });
      ai.start(result.job, result.usage);
    },
    [ai],
  );
}

/** Queues a toy play idea from one photo. Throws a friendly message. */
export function useCreateToyPlay() {
  const ai = useAiJobs();
  const uploadedFor = useRef<{ uri: string; id: string } | null>(null);
  return useCallback(
    async (photo: PickedPhoto, language: 'en' | 'zh-CN', onProgress: (text: string) => void) => {
      // Retrying with the same photo reuses the upload (web toyPlaySavedPhotoId).
      if (uploadedFor.current?.uri !== photo.uri) {
        onProgress(language === 'zh-CN' ? '正在私密上传玩具照片…' : 'Uploading the toy photo privately…');
        const [saved] = await uploadAiPhotos([photo], { label: 'Toy play photo', sourceKind: 'toy_play' });
        uploadedFor.current = { uri: photo.uri, id: saved.id };
      }
      onProgress(language === 'zh-CN' ? '正在识别玩具，并生成适合孩子年龄的玩法…' : 'Looking at the toy and making an age-matched play idea…');
      const result = await apiRequest<Queued>('/family-assets/toy-play/generate', { method: 'POST', body: { savedPhotoId: uploadedFor.current.id, language }, timeoutMs: 60_000 });
      ai.start(result.job, result.usage);
    },
    [ai],
  );
}

/** One saved practice story, for the story reader. */
export function usePracticeStory(id: string) {
  const ai = useAiJobs();
  const [story, setStory] = useState<PracticeStoryAsset | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const load = useCallback(async () => {
    try {
      const result = await apiRequest<{ assets?: PracticeStoryAsset[] }>('/family-assets/practice-stories');
      const found = (result.assets || []).find((asset) => asset.id === id) || null;
      setStory(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setStatus((current) => (current === 'ready' ? current : 'missing'));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => ai.onFinished((job) => {
    if (job.result?.assetId === id) load();
  }), [ai, id, load]);
  const remove = useCallback(async () => {
    await apiRequest(`/family-assets/practice-stories?assetId=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }, [id]);
  return { story, status, remove };
}
