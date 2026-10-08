import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  editPlayDatePayload,
  playDateCalendarFileName,
  playDateCalendarIcs,
  playDateShareContent,
  playDateShareUrl,
  playDateUpdateKey,
} from '@sproutcue/shared/playdates';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share } from 'react-native';

import { apiRequest } from './api';
import { config } from './config';
import type { PlayDate } from './family-data';
import { useSession } from './session';

// Playdates: load one, join / decline / keep attending, edit, cancel, share the invite link,
// and send a calendar invite (expo-sharing). Same API calls as the web app (apps/web/src/tabs/play.js).

export type PlayDateForm = { startsAt: string; endsAt: string; visibility?: 'public' | 'private'; ageRange: string; maxFamilies: string; notes: string };

// ── Small in-memory cache + change signal ────────────────────────────────────
// Lists (Discover, Family) remember the record they opened so the detail screen shows
// the right buttons at once, and screens reload their lists after a change.

const cache = new Map<string, PlayDate>();
const listeners = new Set<() => void>();

export function rememberPlaydate(playDate: PlayDate | null | undefined) {
  if (playDate?.id) cache.set(playDate.id, playDate);
}

/** Calls `listener` whenever a playdate is created, joined, edited or cancelled. */
export function onPlaydatesChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPlaydatesChanged() {
  listeners.forEach((listener) => listener());
}

// ── Requests used by lists ───────────────────────────────────────────────────

export async function createPlaydateRequest(payload: Record<string, unknown>) {
  const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'POST', body: payload });
  rememberPlaydate(result.playDate ? { ...result.playDate, isHost: true, isJoined: true } : null);
  notifyPlaydatesChanged();
  return result.playDate ?? null;
}

export async function joinPlaydateRequest(playDateId: string) {
  const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'PUT', body: { playDateId } });
  notifyPlaydatesChanged();
  return result.playDate ?? null;
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export function playdateLink(playDate: PlayDate) {
  return playDateShareUrl(config.siteUrl, playDate.id);
}

/** System share sheet with the public invitation link (web navigator.share). Returns false if dismissed. */
export async function sharePlaydateLink(playDate: PlayDate) {
  const { title, message, url } = playDateShareContent(playDate, config.siteUrl);
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as any;
    if (typeof nav?.share === 'function') {
      await nav.share({ title, text: message, url });
      return true;
    }
    await nav?.clipboard?.writeText(url);
    return true;
  }
  // iOS shows `url` as a rich link next to the message; Android only reads `message`.
  const result = await Share.share(
    Platform.OS === 'ios' ? { title, message, url } : { title, message: `${message}\n${url}` },
    { dialogTitle: 'Share this playdate', subject: title },
  );
  return result.action !== Share.dismissedAction;
}

/**
 * Writes an .ics calendar invite and opens the share sheet for it (expo-sharing),
 * so it can go to Calendar, Messages, Mail, AirDrop or Files.
 */
export async function sharePlaydateCalendar(playDate: PlayDate) {
  const ics = playDateCalendarIcs(playDate, { url: playdateLink(playDate) });
  const name = playDateCalendarFileName(playDate);
  if (Platform.OS === 'web') {
    const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(ics);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: 'Add playdate to calendar' });
}

// ── "Seen this update" (web localStorage sproutCuePlayDateUpdates:<profile>) ─────

async function readAcknowledged(key: string) {
  try {
    return new Set<string>(JSON.parse((await AsyncStorage.getItem(key)) || '[]'));
  } catch {
    return new Set<string>();
  }
}

// ── One playdate ─────────────────────────────────────────────────────────────

export type PlaydateStatus = 'loading' | 'ready' | 'missing';

/**
 * Loads a playdate for the detail / invitation screen.
 * Your own playdates (hosted or joined) come from /playdates?mine=1 so the buttons know your role;
 * anyone else's public playdate comes from /playdates/:id, the same endpoint behind the web share page.
 */
export function usePlaydate(id: string) {
  const { user } = useSession();
  const [playDate, setPlayDate] = useState<PlayDate | null>(() => cache.get(id) ?? null);
  const [status, setStatus] = useState<PlaydateStatus>(cache.has(id) ? 'ready' : 'loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const ackKey = `sproutCuePlayDateUpdates:${user?.id || user?.email || 'family'}`;
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    readAcknowledged(ackKey).then((set) => active.current && setAcknowledged(set));
    return () => {
      active.current = false;
    };
  }, [ackKey]);

  const load = useCallback(async () => {
    const [mine, shared] = await Promise.allSettled([
      apiRequest<{ playDates?: PlayDate[] }>('/playdates?mine=1'),
      apiRequest<{ playDate?: PlayDate }>(`/playdates/${encodeURIComponent(id)}`),
    ]);
    if (!active.current) return;
    const own = mine.status === 'fulfilled' ? (mine.value.playDates || []).find((item) => item.id === id) : undefined;
    const publicRecord = shared.status === 'fulfilled' ? shared.value.playDate : undefined;
    const known = cache.get(id);
    // The public endpoint doesn't know who's asking, so keep role flags from your own list or the list you came from.
    const next: PlayDate | null = own
      ? { ...publicRecord, ...own }
      : publicRecord
        ? {
            ...publicRecord,
            ...(known ? { isJoined: known.isJoined, isDeclined: known.isDeclined, isHost: known.isHost, canJoin: known.canJoin ?? publicRecord.canJoin } : {}),
          }
        : known?.status === 'cancelled'
          ? known
          : null;
    if (next) {
      rememberPlaydate(next);
      setPlayDate(next);
      setStatus('ready');
    } else {
      setPlayDate(null);
      setStatus('missing');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs a change, shows its result line, refreshes this playdate and tells the lists. */
  const run = useCallback(
    async (pending: string, done: string, action: () => Promise<PlayDate | null | undefined>) => {
      setBusy(true);
      setMessage(pending);
      try {
        const updated = await action();
        if (updated && active.current) {
          setPlayDate((current) => {
            const merged = { ...current, ...updated } as PlayDate;
            rememberPlaydate(merged);
            return merged;
          });
        }
        setMessage(done);
        notifyPlaydatesChanged();
        await load();
        return true;
      } catch (error: any) {
        setMessage(error?.message || 'Could not update this playdate.');
        return false;
      } finally {
        if (active.current) setBusy(false);
      }
    },
    [load],
  );

  const join = () =>
    run('Joining play date…', 'Joined. This play date is now on your family profile.', async () => {
      const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'PUT', body: { playDateId: id } });
      return { ...result.playDate, isJoined: true, isDeclined: false, canJoin: false } as PlayDate;
    });

  /** Guest attendance (web respondToPlayDate): 'declined' = can't attend, 'joined' = keep attending. */
  const respond = (response: 'declined' | 'joined') =>
    run(
      response === 'joined' ? 'Keeping you on the playdate…' : 'Updating your attendance…',
      response === 'joined' ? 'You are still attending.' : 'You are marked as unable to attend.',
      async () => {
        const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'PATCH', body: { playDateId: id, action: 'respond', response } });
        return { ...result.playDate, isJoined: response === 'joined', isDeclined: response === 'declined' } as PlayDate;
      },
    );

  const save = (form: PlayDateForm) =>
    run('Saving play date changes…', 'Updated. Attending families will see the change.', async () => {
      if (!playDate) throw new Error('Choose a play date.');
      const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'PATCH', body: editPlayDatePayload(playDate, form) });
      return result.playDate;
    });

  const cancel = () =>
    run('Cancelling play date…', 'Play date cancelled. Attending families will see the cancellation.', async () => {
      const result = await apiRequest<{ playDate?: PlayDate }>('/playdates', { method: 'DELETE', body: { playDateId: id } });
      return { ...result.playDate, status: 'cancelled' } as PlayDate;
    });

  const acknowledgeUpdate = useCallback(async () => {
    if (!playDate) return;
    const next = new Set(acknowledged);
    next.add(playDateUpdateKey(playDate));
    setAcknowledged(next);
    try {
      await AsyncStorage.setItem(ackKey, JSON.stringify([...next].slice(-100)));
    } catch {}
  }, [ackKey, acknowledged, playDate]);

  return { playDate, status, message, setMessage, busy, refresh: load, join, respond, save, cancel, acknowledged, acknowledgeUpdate };
}
