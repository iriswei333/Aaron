import { createApiClient } from '@sproutcue/shared/api-client';

export const API_BASE = '/api';

export function readStoredValue(key, fallback) {
  try {
    return globalThis.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function readFirstStoredValue(keys, fallback) {
  for (const key of keys) {
    const value = readStoredValue(key, '');
    if (value) return value;
  }
  return fallback;
}

export function writeStoredValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

export function removeStoredValue(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

export function icon(name) {
  return `<span class="icon" aria-hidden="true">${name}</span>`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

function clean(value) {
  return String(value).replace(/[,;]/g, ' ');
}

const webApiClient = createApiClient({
  baseUrl: API_BASE,
  // Local (non-Supabase) mode identifies the family profile with a header.
  getHeaders: () => {
    const localUserId = readFirstStoredValue(['sproutCueUserId', 'aaronUserId'], '');
    return localUserId ? { 'x-sproutcue-local-user-id': localUserId } : {};
  },
});

export function apiRequest(path, options = {}) {
  return webApiClient.request(path, options);
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function downloadCalendar(title, start, end, description) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SproutCue//Daily Life//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${clean(title)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DESCRIPTION:${clean(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
  const key = 'sproutCueCalendarItems';
  try {
    const current = JSON.parse(globalThis.localStorage?.getItem(key) || '[]');
    current.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, start, end, description, downloadedAt: new Date().toISOString() });
    globalThis.localStorage?.setItem(key, JSON.stringify(current.slice(0, 20)));
  } catch {
    // Calendar downloads still work when browser storage is unavailable.
  }
}
