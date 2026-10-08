// Pure date and playdate helpers shared by the web app and the mobile app.
// No DOM, React, or platform APIs here — only plain JavaScript.

export function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function dateInputValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function timeInputValue(date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function defaultPlayDateWindow() {
  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const minutes = startsAt.getMinutes();
  startsAt.setMinutes(minutes < 30 ? 30 : 0, 0, 0);
  if (minutes >= 30) startsAt.setHours(startsAt.getHours() + 1);
  if (startsAt.getHours() * 60 + startsAt.getMinutes() + 90 >= 24 * 60) {
    startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(15, 0, 0, 0);
  }
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  return {
    date: dateInputValue(startsAt),
    startTime: timeInputValue(startsAt),
    endTime: timeInputValue(endsAt),
  };
}

export function combineDateAndTime(date, time) {
  if (!date || !time) throw new Error('Choose a date, start time, and end time.');
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new Error('Choose a valid play date time.');
  return value;
}

export function playDateWindowFromForm(date, startTime, endTime) {
  const startsAt = combineDateAndTime(date, startTime);
  const endsAt = combineDateAndTime(date, endTime);
  if (endsAt <= startsAt) throw new Error('End time must be after the start time.');
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export function timeValueToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTimeValue(minutes) {
  return `${padDatePart(Math.floor(minutes / 60))}:${padDatePart(minutes % 60)}`;
}

export function nextEndTimeValue(startTime) {
  const startMinutes = timeValueToMinutes(startTime);
  if (startMinutes === null || startMinutes >= 23 * 60 + 59) return '';
  return minutesToTimeValue(Math.min(startMinutes + 30, 23 * 60 + 59));
}

export function formatPlayDateWindow(playDate) {
  const startsAt = new Date(playDate.startsAt);
  const endsAt = new Date(playDate.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return 'Time pending';
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${start} - ${end}`;
}

export function playDateFilterRange(filter, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') {
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (filter === 'weekend') {
    const weekendStart = new Date(start);
    if (start.getDay() === 0) weekendStart.setDate(start.getDate() - 1);
    else if (start.getDay() !== 6) weekendStart.setDate(start.getDate() + (6 - start.getDay()));
    const weekendEnd = new Date(weekendStart);
    weekendEnd.setDate(weekendStart.getDate() + 2);
    return { start: weekendStart, end: weekendEnd };
  }
  return null;
}

export function filterNearbyPlayDates(playDates, filter = 'all', now = new Date()) {
  if (!Array.isArray(playDates) || filter === 'all') return Array.isArray(playDates) ? playDates : [];
  const range = playDateFilterRange(filter, now);
  if (!range) return Array.isArray(playDates) ? playDates : [];
  return playDates.filter((playDate) => {
    const startsAt = new Date(playDate.startsAt);
    return !Number.isNaN(startsAt.getTime()) && startsAt >= range.start && startsAt < range.end;
  });
}

export function playDateCapacity(playDate) {
  const count = Number(playDate.participantCount) || 0;
  return playDate.maxFamilies ? `${count}/${playDate.maxFamilies} families` : `${count} ${count === 1 ? 'family' : 'families'}`;
}

export function localDatePart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function localTimePart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(11, 16);
}

export function chatThreadSchedule(thread) {
  if (thread?.type !== 'playdate' || !thread.startsAt) return '';
  const startsAt = new Date(thread.startsAt);
  const endsAt = thread.endsAt ? new Date(thread.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) return '';
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = endsAt && !Number.isNaN(endsAt.getTime())
    ? endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  return `${date} · ${start}${end ? `–${end}` : ''}`;
}

// ── Playdate detail, sharing and calendar (web renderPlayDateCard / renderSharedPlayDate) ──

/**
 * What the signed-in family can do with a playdate, in the web's order of precedence.
 * @param {any} playDate
 * @returns {'cancelled' | 'host-public' | 'host-private' | 'joined' | 'declined' | 'can-join' | 'full'}
 */
export function playDateRole(playDate) {
  if (playDate?.status === 'cancelled') return 'cancelled';
  if (playDate?.isHost) return playDate.visibility === 'public' ? 'host-public' : 'host-private';
  if (playDate?.isJoined) return 'joined';
  if (playDate?.isDeclined) return 'declined';
  if (playDate?.canJoin) return 'can-join';
  return 'full';
}

/** "Saturday, October 10" / "10:00 AM–11:30 AM" (web sharedPlayDateDate). @param {any} playDate */
export function sharedPlayDateWhen(playDate) {
  const start = new Date(playDate?.startsAt);
  const end = new Date(playDate?.endsAt);
  if (Number.isNaN(start.getTime())) return { date: 'Date to be confirmed', time: '' };
  const time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = Number.isNaN(end.getTime()) ? '' : end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return {
    date: start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
    time: endTime ? `${time}–${endTime}` : time,
  };
}

/** "2 of 6 families" / "3 families joined" (web shared page). @param {any} playDate */
export function sharedPlayDateCapacity(playDate) {
  const count = Number(playDate?.participantCount) || 0;
  return playDate?.maxFamilies ? `${count} of ${playDate.maxFamilies} families` : `${count} ${count === 1 ? 'family' : 'families'} joined`;
}

/** Public invitation page on the web app: {site}/share/playdate/{id}. */
export function playDateShareUrl(siteUrl, playDateId) {
  const base = String(siteUrl || '').replace(/\/+$/, '');
  return `${base}/share/playdate/${encodeURIComponent(playDateId)}`;
}

/** Text for the system share sheet (same words as the web navigator.share call). */
export function playDateShareContent(playDate, siteUrl) {
  const url = playDateShareUrl(siteUrl, playDate?.id);
  const when = sharedPlayDateWhen(playDate);
  const title = 'Your kid’s next friend could be closer than you think';
  const message = `Come join this family playdate on SproutCue: ${playDate?.playgroundName || 'a nearby playground'}, ${when.date}${when.time ? ` · ${when.time}` : ''}.`;
  return { title, message, url };
}

/** Key for "seen this update" (web playDateUpdateKey). @param {any} playDate */
export function playDateUpdateKey(playDate) {
  return `${playDate?.id}|${playDate?.lastChangeSummary || ''}`;
}

/**
 * The change summary a joined family should still see, or ''.
 * @param {any} playDate
 * @param {Iterable<string>} [acknowledged]
 */
export function pendingPlayDateUpdate(playDate, acknowledged = []) {
  if (!playDate?.isJoined || playDate.isHost || !playDate.lastChangeSummary) return '';
  const seen = new Set(acknowledged);
  return seen.has(playDateUpdateKey(playDate)) ? '' : playDate.lastChangeSummary;
}

/**
 * PATCH /playdates body for the host's edit form (web saveEditedPlayDate). Public playdates only.
 * @param {any} playDate
 * @param {{ startsAt: string, endsAt: string, ageRange?: string, maxFamilies?: string | number, notes?: string }} form
 */
export function editPlayDatePayload(playDate, form) {
  if (!playDate?.id) throw new Error('Choose a play date.');
  return {
    playDateId: playDate.id,
    playgroundKey: playDate.playgroundKey,
    playgroundName: playDate.playgroundName,
    playgroundType: playDate.playgroundType,
    playgroundAddress: playDate.playgroundAddress || '',
    playgroundLatitude: playDate.playgroundLatitude ?? null,
    playgroundLongitude: playDate.playgroundLongitude ?? null,
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    visibility: 'public',
    ageRange: String(form.ageRange || '').trim(),
    maxFamilies: form.maxFamilies === undefined || form.maxFamilies === null ? '' : String(form.maxFamilies),
    notes: String(form.notes || '').trim(),
  };
}

function icsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

/**
 * A standard iCalendar (.ics) event for "Add to calendar" (RFC 5545, UTC times, CRLF lines).
 * @param {any} playDate
 * @param {{ url?: string, now?: Date }} [options]
 */
export function playDateCalendarIcs(playDate, { url = '', now = new Date() } = {}) {
  const location = [playDate?.playgroundName, playDate?.playgroundAddress].filter(Boolean).join(', ');
  const description = [playDate?.notes || 'SproutCue playdate', url].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SproutCue//Playdates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:playdate-${playDate?.id || 'sproutcue'}@sproutcue`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(playDate?.startsAt)}`,
    `DTEND:${icsDate(playDate?.endsAt)}`,
    `SUMMARY:${icsText(`Playdate at ${playDate?.playgroundName || 'the playground'}`)}`,
    location ? `LOCATION:${icsText(location)}` : '',
    `DESCRIPTION:${icsText(description)}`,
    url ? `URL:${url}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/** File name for the calendar invite. @param {any} playDate */
export function playDateCalendarFileName(playDate) {
  const slug = String(playDate?.playgroundName || 'playdate').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `playdate-${slug || 'sproutcue'}.ics`;
}
