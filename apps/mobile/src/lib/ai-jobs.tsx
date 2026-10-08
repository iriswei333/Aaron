import { aiCreationDestination, aiJobIsDone } from '@sproutcue/shared/studio';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AiCompletionToast, AiWaitSheet } from '@/components/studio/ai-wait-sheet';

import { apiRequest } from './api';
import { useSession } from './session';

// AI creations run as background jobs on the server (picture-book pages, practice stories, toy play).
// Like the web (apps/web/src/ai-jobs.js): start a job → show the progress sheet → poll
// GET /ai-jobs?jobId every 3 s (that request also nudges a queued job to start) → open the result.
// The family can leave the sheet; polling continues and a toast appears when it's done.

export type AiJob = {
  id: string;
  jobType?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string;
  progress?: number;
  estimatedSeconds?: number;
  createdAt?: string;
  result?: { assetId?: string; title?: string; assetType?: string; pageKey?: string; href?: string } | null;
  error?: string | null;
};
export type AiUsage = { unlimited?: boolean; used?: number; limit?: number } | null;
export type AiNotification = { id: string; type?: string; title?: string; message?: string; href?: string; assetId?: string | null; readAt?: string | null; createdAt?: string };

type AiJobsState = {
  job: AiJob | null;
  usage: AiUsage;
  sheetOpen: boolean;
  pollError: string;
  /** Show the progress sheet for a job the API just queued ({ job, usage } from the create request). */
  start: (job: AiJob, usage?: AiUsage) => void;
  showSheet: () => void;
  hideSheet: () => void;
  openCreation: (result: AiJob['result']) => void;
  notifications: AiNotification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  openNotification: (notification: AiNotification) => void;
  /** Called when any job finishes, so lists (books, Family assets) can reload. */
  onFinished: (listener: (job: AiJob) => void) => () => void;
};

const AiJobsContext = createContext<AiJobsState | null>(null);
const POLL_MS = 3000;

export function AiJobsProvider({ children }: { children: ReactNode }) {
  const { session, previewMode } = useSession();
  const signedIn = Boolean(session) && !previewMode;
  const [job, setJob] = useState<AiJob | null>(null);
  const [usage, setUsage] = useState<AiUsage>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pollError, setPollError] = useState('');
  const [toast, setToast] = useState<AiJob | null>(null);
  const [notifications, setNotifications] = useState<AiNotification[]>([]);
  const listeners = useRef(new Set<(job: AiJob) => void>());
  const sheetOpenRef = useRef(false);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  const refreshNotifications = useCallback(async () => {
    if (!signedIn) return;
    try {
      const result = await apiRequest<{ notifications?: AiNotification[] }>('/notifications');
      setNotifications(result.notifications || []);
    } catch {}
  }, [signedIn]);

  useEffect(() => {
    if (signedIn) refreshNotifications();
    else {
      setNotifications([]);
      setJob(null);
      setSheetOpen(false);
    }
  }, [signedIn, refreshNotifications]);

  // Poll the active job until it finishes.
  const jobId = job && !aiJobIsDone(job.status) ? job.id : '';
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const result = await apiRequest<{ job: AiJob }>(`/ai-jobs?jobId=${encodeURIComponent(jobId)}`);
        if (stopped) return;
        setPollError('');
        setJob(result.job);
        if (aiJobIsDone(result.job.status)) {
          listeners.current.forEach((listener) => listener(result.job));
          refreshNotifications();
          if (!sheetOpenRef.current) setToast(result.job);
        }
      } catch (error: any) {
        if (!stopped) setPollError(error?.message || 'Could not check on this creation.');
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [jobId, refreshNotifications]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(timer);
  }, [toast]);

  const start = useCallback((next: AiJob, nextUsage: AiUsage = null) => {
    setJob(next);
    setUsage(nextUsage);
    setPollError('');
    setToast(null);
    setSheetOpen(true);
  }, []);

  const openCreation = useCallback((result: AiJob['result']) => {
    setSheetOpen(false);
    setToast(null);
    const destination = aiCreationDestination(result || null);
    if (!destination) {
      router.push('/family');
      return;
    }
    if (destination.kind === 'picture_book') router.push({ pathname: '/create/books/[id]', params: { id: destination.id, ...(destination.pageKey ? { page: destination.pageKey } : {}) } });
    else if (destination.kind === 'practice_story') router.push({ pathname: '/create/stories/[id]', params: { id: destination.id } });
    else router.push({ pathname: '/family', params: { toyPlay: destination.id } });
  }, []);

  const openNotification = useCallback(
    (notification: AiNotification) => {
      if (!notification.readAt) {
        setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)));
        apiRequest('/notifications', { method: 'PATCH', body: { notificationId: notification.id } }).catch(() => {});
      }
      if (notification.type === 'ai_asset_failed') return;
      openCreation({ href: notification.href, assetId: notification.assetId || undefined });
    },
    [openCreation],
  );

  const onFinished = useCallback((listener: (job: AiJob) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<AiJobsState>(
    () => ({
      job,
      usage,
      sheetOpen,
      pollError,
      start,
      showSheet: () => setSheetOpen(true),
      hideSheet: () => setSheetOpen(false),
      openCreation,
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
      refreshNotifications,
      openNotification,
      onFinished,
    }),
    [job, usage, sheetOpen, pollError, start, openCreation, notifications, refreshNotifications, openNotification, onFinished],
  );

  return (
    <AiJobsContext.Provider value={value}>
      {children}
      <AiWaitSheet
        visible={sheetOpen && Boolean(job)}
        job={job}
        usage={usage}
        error={pollError}
        onLeave={() => setSheetOpen(false)}
        onOpen={() => openCreation(job?.result)}
      />
      {toast ? (
        <AiCompletionToast
          job={toast}
          onOpen={() => openCreation(toast.result)}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </AiJobsContext.Provider>
  );
}

export function useAiJobs() {
  const value = useContext(AiJobsContext);
  if (!value) throw new Error('useAiJobs must be used inside <AiJobsProvider>.');
  return value;
}
