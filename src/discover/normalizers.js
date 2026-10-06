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

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function distance(value, label = '') {
  const miles = finiteNumber(value);
  return {
    miles,
    label: text(label || (miles == null ? '' : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`)),
  };
}

function coordinates(value) {
  const latitude = finiteNumber(value?.latitude);
  const longitude = finiteNumber(value?.longitude);
  if (latitude == null || longitude == null || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude };
}

export function discoverItemHasCoordinates(item) {
  return Boolean(coordinates(item?.location));
}

function distanceMilesBetween(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceLabel(miles) {
  if (miles < 0.1) return '<0.1 mi';
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

// Keep proximity ordering in the Discover domain model so web and future mobile
// views do not each invent their own rendering-time sort behavior.
export function sortDiscoverItemsByDistance(items = [], origin = null) {
  const originCoordinates = coordinates(origin);
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const venueCoordinates = coordinates(item?.location);
    const suppliedMiles = finiteNumber(item?.distance?.miles);
    const miles = originCoordinates && venueCoordinates
      ? distanceMilesBetween(originCoordinates, venueCoordinates)
      : suppliedMiles;
    return {
      item: miles == null ? item : {
        ...item,
        distance: { miles, label: distanceLabel(miles) },
      },
      index,
      miles: miles ?? Number.POSITIVE_INFINITY,
    };
  }).sort((a, b) => a.miles - b.miles || a.index - b.index).map(({ item }) => item);
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
      address: text(event.address || event.venueAddress),
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

export function normalizeFamilyEvent(event = {}) {
  return normalizeScheduledEvent(event, 'family_event');
}

export function normalizeStoryTime(event = {}) {
  return normalizeScheduledEvent(event, 'story_time');
}

export function discoverItemOccursOnDate(item, date = new Date()) {
  if (!['playdate', 'family_event', 'story_time'].includes(item?.kind)) return false;
  if (item.source?.resultType === 'search-link') return false;
  const targetDate = localDateKey(date);
  if (!targetDate) return false;
  if (item.schedule?.startsAt) {
    const scheduledDate = localDateKey(item.schedule.startsAt);
    if (scheduledDate) return scheduledDate === targetDate;
  }
  return text(item.schedule?.date).slice(0, 10) === targetDate;
}

const scheduledDiscoverKinds = ['playdate', 'family_event', 'story_time'];

function normalizedDiscoverKinds(kinds, kind) {
  if (Array.isArray(kinds)) return [...new Set(kinds.filter((value) => scheduledDiscoverKinds.includes(value)))];
  return scheduledDiscoverKinds.includes(kind) ? [kind] : [];
}

export function nextDiscoverFilterState(current = {}, selection = 'all') {
  const kinds = normalizedDiscoverKinds(current.kinds);
  const todayOnly = Boolean(current.todayOnly);
  const playgroundOnly = Boolean(current.playgroundOnly);

  if (selection === 'all') return { todayOnly: false, playgroundOnly: false, kinds };
  if (selection === 'today') return { todayOnly: true, playgroundOnly: false, kinds };
  if (selection === 'playground') {
    return playgroundOnly
      ? { todayOnly: false, playgroundOnly: false, kinds: [] }
      : { todayOnly: false, playgroundOnly: true, kinds: [] };
  }
  if (!scheduledDiscoverKinds.includes(selection)) return { todayOnly, playgroundOnly, kinds };
  const baseKinds = playgroundOnly ? [] : kinds;
  return {
    todayOnly: playgroundOnly ? false : todayOnly,
    playgroundOnly: false,
    kinds: baseKinds.includes(selection)
      ? baseKinds.filter((kindValue) => kindValue !== selection)
      : [...baseKinds, selection],
  };
}

export function filterDiscoverItems(items = [], {
  kind = 'all',
  kinds,
  todayOnly = false,
  playgroundOnly = false,
  date = new Date(),
} = {}) {
  const selectedKinds = normalizedDiscoverKinds(kinds, kind);
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (playgroundOnly) return item?.kind === 'playground';
    const matchesCategory = selectedKinds.length === 0 || selectedKinds.includes(item?.kind);
    return matchesCategory && (!todayOnly || discoverItemOccursOnDate(item, date));
  });
}

export function sourceRecord(item) {
  return item?.detail ? { ...item.detail } : {};
}
