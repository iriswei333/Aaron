function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return value == null ? '' : String(value);
}

function sourceId(value, fallback) {
  return text(value || fallback).trim();
}

function discoverId(kind, id) {
  return `${kind}:${sourceId(id, 'unknown')}`;
}

function distance(value, label = '') {
  const miles = finiteNumber(value);
  return {
    miles,
    label: text(label || (miles == null ? '' : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`)),
  };
}

export function normalizePlayground(playground = {}) {
  const id = sourceId(playground.key, playground.name);
  return {
    id: discoverId('playground', id),
    sourceId: id,
    kind: 'playground',
    title: text(playground.name || 'Playground'),
    summary: text(playground.overview || playground.best),
    location: {
      venue: text(playground.name),
      address: text(playground.address),
      latitude: finiteNumber(playground.latitude),
      longitude: finiteNumber(playground.longitude),
    },
    schedule: { date: '', startsAt: null, endsAt: null, dateLabel: '', timeLabel: '' },
    distance: distance(playground.sortDistance, playground.distance),
    ageRange: text(playground.ageRange),
    imageUrl: text(playground.imageUrl),
    href: text(playground.href),
    source: { id: text(playground.source), label: text(playground.source), url: '', resultType: 'place' },
    status: 'available',
    actions: ['view', 'open_map', 'create_playdate'],
    detail: { ...playground },
  };
}

export function normalizePlaydate(playdate = {}) {
  const id = sourceId(playdate.id, `${playdate.playgroundKey}-${playdate.startsAt}`);
  const actions = ['view'];
  if (playdate.isHost) actions.push('manage');
  else if (playdate.canJoin) actions.push('join');
  if (playdate.isJoined && Number(playdate.participantCount) > 1) actions.push('chat');
  return {
    id: discoverId('playdate', id),
    sourceId: id,
    kind: 'playdate',
    title: text(playdate.playgroundName || 'Playdate'),
    summary: text(playdate.notes),
    location: {
      venue: text(playdate.playgroundName),
      address: text(playdate.playgroundAddress),
      latitude: finiteNumber(playdate.playgroundLatitude),
      longitude: finiteNumber(playdate.playgroundLongitude),
    },
    schedule: {
      date: text(playdate.startsAt).slice(0, 10),
      startsAt: playdate.startsAt || null,
      endsAt: playdate.endsAt || null,
      dateLabel: '',
      timeLabel: '',
    },
    distance: distance(playdate.distanceMiles, playdate.distance),
    ageRange: text(playdate.ageRange),
    imageUrl: '',
    href: '',
    source: { id: 'sproutcue', label: 'SproutCue', url: '', resultType: 'playdate' },
    status: text(playdate.status || 'upcoming'),
    actions,
    detail: { ...playdate },
  };
}

function normalizeScheduledEvent(event, kind) {
  const fallbackId = [event.title, event.date, event.timeLabel, event.venue, event.url].filter(Boolean).join('|');
  const id = sourceId(event.id, fallbackId);
  const resultType = text(event.resultType || 'event');
  return {
    id: discoverId(kind, id),
    sourceId: id,
    kind,
    title: text(event.title || (kind === 'story_time' ? 'Story time' : 'Family event')),
    summary: text(event.summary),
    location: {
      venue: text(event.venue),
      address: text(event.address),
      latitude: finiteNumber(event.latitude),
      longitude: finiteNumber(event.longitude),
    },
    schedule: {
      date: text(event.date),
      startsAt: event.startsAt || null,
      endsAt: event.endsAt || null,
      dateLabel: text(event.dateLabel),
      timeLabel: text(event.timeLabel),
    },
    distance: distance(event.distanceMiles, event.distance),
    ageRange: text(event.ageRange),
    imageUrl: text(event.imageUrl),
    href: text(event.url || event.sourceUrl),
    source: {
      id: text(event.source),
      label: text(event.sourceLabel || event.source),
      url: text(event.sourceUrl),
      resultType,
    },
    status: 'available',
    actions: resultType === 'search-link' ? ['open_external'] : ['view', 'open_external', 'save'],
    detail: { ...event },
  };
}

export function normalizeWeekendEvent(event = {}) {
  return normalizeScheduledEvent(event, 'weekend_event');
}

export function normalizeStoryTime(event = {}) {
  return normalizeScheduledEvent(event, 'story_time');
}

export function sourceRecord(item) {
  return item?.detail ? { ...item.detail } : {};
}
