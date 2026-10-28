import { chatThreadSchedule } from '@sproutcue/shared/playdates';
import { BLOCKED_MESSAGE_ERROR } from '@sproutcue/shared/user-blocks';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { apiRequest } from './api';
import { onPlaydatesChanged } from './playdates';
import { pushDataFrom, registerForPushNotifications, setVisibleChatThreadId } from './push-notifications';
import { useSession } from './session';

// Family chat — the same /api/chat endpoints the web Family tab uses (apps/web/src/tabs/social.js):
//   GET   /chat                 → { threads }            (playdate threads + direct chats)
//   GET   /chat?threadId=<id>   → { threads, messages }  (last 100 messages, oldest first)
//   POST  /chat                 → { message }            ({ threadId, recipientId, playDateId, text, mediaType, mediaUrl })
//   PATCH /chat                 → { ok }                 ({ action: 'markRead', threadId })
//   POST  /chat/report          → { report }             ({ messageId, reason, details }) — chat safety
//
// ChatProvider keeps the thread list (for the Family tab card, the Chats screen and the tab badge);
// useChatThread() drives one open conversation with light polling while it is on screen.

export type ChatParticipant = { id: string; displayName?: string };

export type ChatThread = {
  id: string;
  type: 'playdate' | 'direct' | string;
  playDateId?: string | null;
  title?: string;
  participantIds?: string[];
  participants?: ChatParticipant[];
  contactId?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  unreadCount?: number;
  lastMessageAt?: string;
  /** Newer servers include a preview of the latest message; older ones leave it out. */
  lastMessage?: { senderId?: string; text?: string; mediaType?: string } | null;
};

export type ChatMessage = {
  id: string;
  threadId?: string;
  senderId: string;
  recipientId?: string;
  text?: string;
  mediaType?: '' | 'photo' | 'video' | string;
  mediaUrl?: string;
  createdAt: string;
  /** Only on messages this device is still sending (or failed to send). */
  localState?: 'sending' | 'failed';
  /** Why a failed send can't be retried (e.g. this direct chat is blocked). */
  localError?: string;
};

/** A photo ready to send: a JPEG data URL small enough for the chat API. */
export type ChatPhoto = { uri: string; dataUrl: string; width: number; height: number; bytes: number };

export const CHAT_MESSAGE_MAX = 2000;
/** Show the character counter from here on. */
export const CHAT_COUNTER_FROM = 1800;
const POLL_MS = 5000;

// ── Thread list ───────────────────────────────────────────────────────────────

type ChatState = {
  threads: ChatThread[];
  loading: boolean;
  loaded: boolean;
  error: string;
  unreadTotal: number;
  refresh: () => Promise<void>;
  /** Local bookkeeping so the list and badge update without waiting for a reload. */
  markThreadRead: (threadId: string) => void;
  noteMessage: (threadId: string, message: ChatMessage) => void;
  mergeThreads: (threads: ChatThread[]) => void;
};

const ChatContext = createContext<ChatState | null>(null);

export function sortChatThreads(threads: ChatThread[] = []) {
  return [...threads].sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { session, previewMode, onboarded } = useSession();
  const enabled = Boolean(session) && !previewMode && onboarded;
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    const run = (async () => {
      try {
        const data = await apiRequest<{ threads?: ChatThread[] }>('/chat');
        setThreads(sortChatThreads(data.threads || []));
        setError('');
      } catch (err) {
        setError(`Chat unavailable: ${err instanceof Error ? err.message : 'please try again.'}`);
      } finally {
        setLoading(false);
        setLoaded(true);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [enabled]);

  // Load after sign-in, clear on sign-out.
  useEffect(() => {
    if (enabled) refresh();
    else {
      setThreads([]);
      setLoaded(false);
      setError('');
    }
  }, [enabled, refresh]);

  // Coming back to the app, or joining / leaving a playdate (which opens or closes its thread).
  useEffect(() => {
    if (!enabled) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const unsubscribe = onPlaydatesChanged(() => refresh());
    // A chat push while the app is open: update unread counts and the tab badge.
    const pushes = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener((notification) => {
      if (pushDataFrom(notification).type === 'chat_message') refresh();
    });
    return () => {
      appState.remove();
      unsubscribe();
      pushes?.remove();
    };
  }, [enabled, refresh]);

  const markThreadRead = useCallback((threadId: string) => {
    setThreads((current) => current.map((thread) => (thread.id === threadId && thread.unreadCount ? { ...thread, unreadCount: 0 } : thread)));
  }, []);

  const noteMessage = useCallback((threadId: string, message: ChatMessage) => {
    setThreads((current) =>
      sortChatThreads(
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, lastMessageAt: message.createdAt, lastMessage: { senderId: message.senderId, text: message.text, mediaType: message.mediaType } }
            : thread,
        ),
      ),
    );
  }, []);

  const mergeThreads = useCallback((incoming: ChatThread[]) => {
    if (incoming.length) setThreads(sortChatThreads(incoming));
  }, []);

  const value = useMemo<ChatState>(
    () => ({
      threads,
      loading,
      loaded,
      error,
      unreadTotal: threads.reduce((sum, thread) => sum + (Number(thread.unreadCount) || 0), 0),
      refresh,
      markThreadRead,
      noteMessage,
      mergeThreads,
    }),
    [threads, loading, loaded, error, refresh, markThreadRead, noteMessage, mergeThreads],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside <ChatProvider>.');
  return value;
}

// ── One conversation ─────────────────────────────────────────────────────────

function localId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Messages on screen: server messages, then this device's pending/failed ones. */
function mergeMessages(server: ChatMessage[], pending: ChatMessage[]) {
  const ids = new Set(server.map((message) => message.id));
  return [...server, ...pending.filter((message) => !ids.has(message.id))];
}

export function useChatThread(threadId: string) {
  const { user } = useSession();
  const chat = useChat();
  const { markThreadRead, noteMessage, mergeThreads } = chat;
  const thread = chat.threads.find((candidate) => candidate.id === threadId) || null;
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const lastSeenId = useRef('');

  const markRead = useCallback(async () => {
    markThreadRead(threadId);
    try {
      await apiRequest('/chat', { method: 'PATCH', body: JSON.stringify({ action: 'markRead', threadId }) });
    } catch {
      // Unread counts catch up on the next load.
    }
  }, [threadId, markThreadRead]);

  const userId = user?.id;
  const load = useCallback(
    async (mode: 'initial' | 'poll' = 'initial') => {
      if (!threadId) return;
      try {
        const data = await apiRequest<{ threads?: ChatThread[]; messages?: ChatMessage[] }>(`/chat?threadId=${encodeURIComponent(threadId)}`);
        const messages = data.messages || [];
        setServerMessages(messages);
        if (mode === 'initial') mergeThreads(data.threads || []);
        setStatus('ready');
        setError('');
        const newest = messages[messages.length - 1];
        if (newest && newest.id !== lastSeenId.current) {
          lastSeenId.current = newest.id;
          noteMessage(threadId, newest);
          if (newest.senderId !== userId || mode === 'initial') markRead();
        } else if (mode === 'initial') {
          markRead();
        }
      } catch (err) {
        if (mode === 'initial') {
          setStatus((current) => (current === 'ready' ? current : 'error'));
          setError(err instanceof Error ? err.message : 'Could not load this chat.');
        }
      }
    },
    [threadId, userId, mergeThreads, noteMessage, markRead],
  );

  // Load when the conversation opens; poll every few seconds while it stays on screen.
  useFocusEffect(
    useCallback(() => {
      load('initial');
      const timer = setInterval(() => load('poll'), POLL_MS);
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') load('poll');
      });
      // Pushes for this thread show no banner while it's open (push-notifications.ts);
      // load the new message right away instead of waiting for the next poll.
      setVisibleChatThreadId(threadId);
      const pushes = Platform.OS === 'web' ? null : Notifications.addNotificationReceivedListener((notification) => {
        const data = pushDataFrom(notification);
        if (data.type === 'chat_message' && data.threadId === threadId) load('poll');
      });
      return () => {
        clearInterval(timer);
        appState.remove();
        pushes?.remove();
        setVisibleChatThreadId('');
      };
    }, [load, threadId]),
  );

  const post = useCallback(
    async (message: ChatMessage) => {
      const recipientId =
        thread?.type === 'direct' ? thread.contactId || thread.participantIds?.find((id) => id !== user?.id) || '' : '';
      try {
        const data = await apiRequest<{ message: ChatMessage }>('/chat', {
          method: 'POST',
          body: JSON.stringify({
            threadId,
            recipientId,
            playDateId: thread?.playDateId || '',
            text: message.text || '',
            mediaType: message.mediaType || '',
            mediaUrl: message.mediaUrl || '',
          }),
        });
        const saved = data.message;
        setPending((current) => current.filter((item) => item.id !== message.id));
        setServerMessages((current) => (current.some((item) => item.id === saved.id) ? current : [...current, saved]));
        lastSeenId.current = saved.id;
        noteMessage(threadId, saved);
        return true;
      } catch (err) {
        // A block is final: say so instead of offering a retry that can't work.
        const localError = err instanceof Error && err.message === BLOCKED_MESSAGE_ERROR ? BLOCKED_MESSAGE_ERROR : undefined;
        setPending((current) => current.map((item) => (item.id === message.id ? { ...item, localState: 'failed', localError } : item)));
        return false;
      }
    },
    [thread, threadId, user?.id, noteMessage],
  );

  /** Sends text and/or a photo. Shows the message right away; marks it failed if the send doesn't go through. */
  const send = useCallback(
    (text: string, photo?: ChatPhoto | null) => {
      const body = text.trim().slice(0, CHAT_MESSAGE_MAX);
      if (!body && !photo) return Promise.resolve(false);
      const message: ChatMessage = {
        id: localId(),
        threadId,
        senderId: user?.id || 'me',
        text: body,
        mediaType: photo ? 'photo' : '',
        mediaUrl: photo?.dataUrl || '',
        createdAt: new Date().toISOString(),
        localState: 'sending',
      };
      setPending((current) => [...current, message]);
      // Sending is a natural moment to ask for notifications, so replies reach this phone.
      // No-op if already asked, denied, or unsupported.
      if (user?.id) registerForPushNotifications({ prompt: true, userId: user.id });
      return post(message);
    },
    [threadId, user?.id, post],
  );

  const retry = useCallback(
    (messageId: string) => {
      const message = pending.find((item) => item.id === messageId);
      if (!message) return;
      const again: ChatMessage = { ...message, localState: 'sending', createdAt: new Date().toISOString() };
      setPending((current) => current.map((item) => (item.id === messageId ? again : item)));
      post(again);
    },
    [pending, post],
  );

  const discard = useCallback((messageId: string) => {
    setPending((current) => current.filter((item) => item.id !== messageId));
  }, []);

  return {
    thread,
    messages: mergeMessages(serverMessages, pending),
    status,
    error,
    reload: () => load('initial'),
    send,
    retry,
    discard,
  };
}

// ── Chat safety: reporting ──────────────────────────────────────────────────

export type ChatReportResult = { id: string; createdAt: string; alreadyReported: boolean };

/** Files a report about someone else's message. Reasons: @sproutcue/shared/chat-report. */
export async function reportChatMessage(messageId: string, reason: string, details = ''): Promise<ChatReportResult> {
  const data = await apiRequest<{ report: ChatReportResult }>('/chat/report', {
    method: 'POST',
    body: JSON.stringify({ messageId, reason, details }),
  });
  if (!data?.report) throw new Error('The report didn’t reach our server. Please try again.');
  return data.report;
}

/** Only messages the server saved, from someone else, can be reported. */
export function canReportMessage(message: ChatMessage, meId?: string) {
  return Boolean(meId) && message.senderId !== meId && !message.localState && !message.id.startsWith('local-');
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function participantName(thread: ChatThread | null, senderId: string, meId?: string) {
  if (meId && senderId === meId) return 'You';
  return thread?.participants?.find((person) => person.id === senderId)?.displayName || 'Parent';
}

export function familyCount(thread: ChatThread | null) {
  return thread?.participantIds?.length || 0;
}

/** "Playdate chat · 4 families" / "Direct chat". */
export function threadKindLabel(thread: ChatThread | null) {
  if (thread?.type !== 'playdate') return 'Direct chat';
  const count = familyCount(thread);
  return `Playdate chat · ${count} ${count === 1 ? 'family' : 'families'}`;
}

/** Header subtitle in a conversation. */
export function threadSubtitle(thread: ChatThread | null) {
  if (!thread) return '';
  if (thread.type !== 'playdate') return 'Private 1:1 conversation';
  const schedule = chatThreadSchedule(thread);
  const count = familyCount(thread);
  return [schedule, `${count} ${count === 1 ? 'family' : 'families'}`].filter(Boolean).join(' · ');
}

/** List preview: "Priya: We can bring snacks." — or a helpful fallback when the server has no preview. */
export function threadPreview(thread: ChatThread, meId?: string) {
  const last = thread.lastMessage;
  if (last && (last.text || last.mediaType)) {
    const body = last.text?.trim() || (last.mediaType === 'video' ? 'Shared a video' : 'Shared a photo');
    const who = participantName(thread, last.senderId || '', meId);
    return thread.type === 'direct' && who !== 'You' ? body : `${who}: ${body}`;
  }
  if (thread.type === 'playdate') return chatThreadSchedule(thread) || 'Say hello and make the meetup easy.';
  return 'Say hello';
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return sameDay(date, yesterday);
}

/** Thread list time: "9:41 AM", "Yesterday", "Mon", "Oct 3". */
export function threadTime(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (sameDay(date, now)) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isYesterday(date, now)) return 'Yesterday';
  if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Day divider in a conversation: "Today", "Yesterday", "Mon, Oct 19". */
export function dayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (sameDay(date, now)) return 'Today';
  if (isYesterday(date, now)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function messageTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'message';
      key: string;
      message: ChatMessage;
      mine: boolean;
      /** First of a run from one sender: show their name (group chats). */
      startsGroup: boolean;
      /** Last of a run: show the avatar and time. */
      endsGroup: boolean;
    };

const GROUP_GAP_MS = 5 * 60 * 1000;

/** Day dividers plus sender grouping, oldest first. */
export function chatRows(messages: ChatMessage[], meId?: string): ChatRow[] {
  const rows: ChatRow[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const at = new Date(message.createdAt).getTime();
    const newDay = !previous || !sameDay(new Date(previous.createdAt), new Date(message.createdAt));
    if (newDay) rows.push({ kind: 'day', key: `day-${message.id}`, label: dayLabel(message.createdAt) });
    const continuesFrom = previous && !newDay && previous.senderId === message.senderId && at - new Date(previous.createdAt).getTime() < GROUP_GAP_MS;
    const continuesInto =
      next && next.senderId === message.senderId && sameDay(new Date(next.createdAt), new Date(message.createdAt)) && new Date(next.createdAt).getTime() - at < GROUP_GAP_MS;
    rows.push({
      kind: 'message',
      key: message.id,
      message,
      mine: Boolean(meId) && message.senderId === meId,
      startsGroup: !continuesFrom,
      endsGroup: !continuesInto,
    });
  });
  return rows;
}

/** Same suggestions as the web chat. */
export function quickReplies(thread: ChatThread | null) {
  return thread?.type === 'playdate'
    ? ['What time works best?', 'We can bring snacks.', 'See you at the playground!', 'We may be a few minutes late.']
    : ['How is your week going?', 'That sounds great!', 'What works for your family?', 'Talk soon!'];
}

/** Web chatThreadEmoji: a topic glyph for playdate threads. */
export function threadEmoji(thread: ChatThread, index = 0) {
  const title = String(thread.title || '').toLowerCase();
  if (/book|story|library|read/.test(title)) return '📚';
  if (/beach|island|water|lake|pool/.test(title)) return '🏝️';
  if (/bike|cycle|ride|trail/.test(title)) return '🚲';
  if (/park|playground|sandbox|garden/.test(title)) return '🛝';
  return ['🛝', '📚', '🏝️', '🚲', '🎨'][index % 5];
}
