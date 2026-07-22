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

export async function apiRequest(path, options = {}) {
  const localUserId = readFirstStoredValue(['sproutCueUserId', 'aaronUserId'], '');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(localUserId ? { 'x-sproutcue-local-user-id': localUserId } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
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
}
