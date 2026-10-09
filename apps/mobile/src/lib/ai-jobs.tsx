import { aiCreationDestination, aiJobIsDone } from '@sproutcue/shared/studio';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { AiCompletionToast, AiWaitSheet } from '@/components/studio/ai-wait-sheet';

import { apiRequest } from './api';
import { haptics } from './haptics';
import { pushDataFrom, registerForPushNotifications, setVisibleAiJobId, type AiPushData } from './push-notifications';
import { useSession } from './session';

// AI creations run as background jobs on the server (picture-book pages, practice stories, toy play).
// Like the web (apps/web/src/ai-jobs.js): start a job → show the progress sheet → poll
// GET /ai-jobs?jobId every 3 s (that request also nudges a queued job to start) → open the result.
// The family can leave the sheet; polling continues and a toast appears when it's done.
// If they leave the app, the server sends a push notification (Expo push) when the creation
// is ready; tapping it opens the creation (see the push effects below).

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
  const { session, previewMode, loading, onboarded } = useSession();
  const signedIn = Boolean(session) && !previewMode;
  const userId = session?.user?.id ?? '';
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
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
          (result.job.status === 'succeeded' ? haptics.success : haptics.error)();
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
    // A good moment to ask for notification permission: they just started something
    // that finishes in the background. No-op if already asked, denied, or unsupported.
    if (userIdRef.current) registerForPushNotifications({ prompt: true, userId: userIdRef.current });
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
      if (!notification.readAt && notification.id) {
        setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)));
        apiRequest('/notifications', { method: 'PATCH', body: { notificationId: notification.id } }).catch(() => {});
      }
      if (notification.type === 'ai_asset_failed') return;
      openCreation({ href: notification.href, assetId: notification.assetId || undefined });
    },
    [openCreation],
  );

  // ── Push notifications ────────────────────────────────────────────────────
  // Register this device (only if notifications are already allowed; `start` asks).
  useEffect(() => {
    if (!signedIn || !userId || Platform.OS === 'web') return;
    registerForPushNotifications({ prompt: false, userId });
    // Tokens can change while the app runs; register the new one.
    const subscription = Notifications.addPushTokenListener(() => {
      registerForPushNotifications({ prompt: false, userId });
    });
    return () => subscription.remove();
  }, [signedIn, userId]);

  // The job on screen (sheet or toast) doesn't need a banner too.
  const trackedJobId = job?.id ?? '';
  useEffect(() => {
    setVisibleAiJobId(trackedJobId);
  }, [trackedJobId]);

  // A push arrived while the app is open: refresh the bell, and let lists reload for jobs
  // this screen wasn't polling (e.g. one started on the web).
  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = pushDataFrom(notification);
      if (!data.jobId) return;
      refreshNotifications();
      if (data.jobId === trackedJobId) return; // polling already reports this one
      const finished: AiJob = {
        id: data.jobId,
        status: data.type === 'ai_asset_failed' ? 'failed' : 'succeeded',
        result: { assetId: data.assetId || undefined, assetType: data.assetType || undefined, pageKey: data.pageKey || undefined, href: data.href || undefined },
      };
      listeners.current.forEach((listener) => listener(finished));
    });
    return () => subscription.remove();
  }, [signedIn, trackedJobId, refreshNotifications]);

  // Tapping a push opens the creation, whether the app was running or launched by the tap.
  // Wait until the signed-in tabs are mounted so the router can navigate.
  const readyToNavigate = signedIn && !loading && onboarded;
  const handledResponses = useRef(new Set<string>());
  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = response.notification.request.identifier;
      if (handledResponses.current.has(key)) return;
      handledResponses.current.add(key);
      const data: AiPushData = pushDataFrom(response.notification);
      if (!data.type?.startsWith('ai_asset_')) return;
      refreshNotifications();
      if (data.type === 'ai_asset_failed') {
        if (data.notificationId) apiRequest('/notifications', { method: 'PATCH', body: { notificationId: data.notificationId } }).catch(() => {});
        router.push('/studio');
        return;
      }
      openNotification({ id: data.notificationId || '', type: data.type, href: data.href || undefined, assetId: data.assetId, readAt: null });
    },
    [openNotification, refreshNotifications],
  );
  useEffect(() => {
    if (!readyToNavigate || Platform.OS === 'web') return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse();
      setTimeout(() => handleResponse(last), 0);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [readyToNavigate, handleResponse]);

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
