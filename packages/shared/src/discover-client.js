// Discover data loader shared by apps/web and apps/mobile (no DOM or platform APIs).
import {
  normalizePlaydate,
  normalizePlayground,
  normalizeStoryTime,
  normalizeFamilyEvent,
  uniqueDiscoverItems,
} from './discover-normalizers.js';

const ALL_KINDS = ['playground', 'playdate', 'family_event', 'story_time'];

function queryString(values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const output = query.toString();
  return output ? `?${output}` : '';
}

function sourceState(status, payload = {}, error = null) {
  return {
    status,
    cached: Boolean(payload.cached),
    fallback: Boolean(payload.fallback),
    sourceLabel: payload.sourceLabel || '',
    fetchedAt: payload.fetchedAt || null,
    error: error ? error.message || String(error) : '',
    payload,
  };
}

function skippedState(reason) {
  return sourceState('skipped', {}, new Error(reason));
}

function uniquePlaydates(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (item.detail.visibility !== 'public' || item.detail.status === 'cancelled' || seen.has(item.sourceId)) return false;
    seen.add(item.sourceId);
    return true;
  }).sort((a, b) => new Date(a.schedule.startsAt || 0) - new Date(b.schedule.startsAt || 0));
}

function requestedKinds(kinds) {
  const requested = Array.isArray(kinds) && kinds.length ? kinds : ALL_KINDS;
  return new Set(requested.filter((kind) => ALL_KINDS.includes(kind)));
}

/**
 * Loads playgrounds, playdates, family events and story times for the Discover tab.
 * Pass the app's request function (web: apiRequest, mobile: apiRequest from src/lib/api).
 * @param {(path: string, options?: Record<string, any>) => Promise<any>} request
 */
export function createDiscoverClient(request) {
  if (typeof request !== 'function') throw new Error('createDiscoverClient needs a request function.');
  async function loadPlaydatesForPlaygrounds(playgrounds, { signal } = {}) {
    const normalized = (playgrounds || []).map((playground) => (
      playground?.kind === 'playground' ? playground : normalizePlayground(playground)
    ));
    if (!normalized.length) return { items: [], source: skippedState('Playgrounds are required to load nearby playdates.') };
    const playdateResults = await Promise.allSettled(normalized.slice(0, 12).map((playground) => (
      request(`/playdates?playgroundKey=${encodeURIComponent(playground.sourceId)}`, signal ? { signal } : {})
    )));
    const failures = playdateResults.filter((result) => result.status === 'rejected');
    const items = uniquePlaydates(playdateResults.flatMap((result) => (
      result.status === 'fulfilled' ? (result.value.playDates || []).map(normalizePlaydate) : []
    )));
    const source = failures.length === playdateResults.length
      ? sourceState('error', {}, failures[0]?.reason)
      : sourceState(items.length ? 'ready' : 'empty', { partialFailures: failures.length });
    return { items, source };
  }

  /**
   * @param {{ location?: any, radiusMiles?: number, startDate?: string, endDate?: string, kinds?: string[], forceRefresh?: boolean, signal?: AbortSignal }} [options]
   * @returns {Promise<{ groups: { playgrounds: any[], playdates: any[], familyEvents: any[], storyTimes: any[] }, sources: Record<string, any>, [key: string]: any }>}
   */
  async function loadDiscover({
    location = null,
    radiusMiles = 10,
    startDate,
    endDate,
    kinds,
    forceRefresh = false,
    signal,
  } = {}) {
    const requested = requestedKinds(kinds);
    const groups = { playgrounds: [], playdates: [], familyEvents: [], storyTimes: [] };
    const sources = {
      playgrounds: skippedState('Playgrounds were not requested.'),
      playdates: skippedState('Playdates were not requested.'),
      familyEvents: skippedState('Family events were not requested.'),
      storyTimes: skippedState('Story times were not requested.'),
    };
    const latitude = location?.latitude === null || location?.latitude === undefined || location?.latitude === ''
      ? null
      : Number(location.latitude);
    const longitude = location?.longitude === null || location?.longitude === undefined || location?.longitude === ''
      ? null
      : Number(location.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    const locationLabel = location?.address || location?.label || '';
    const options = { ...(forceRefresh ? { cache: 'no-store' } : {}), ...(signal ? { signal } : {}) };

    const tasks = [];
    if (requested.has('playground') || requested.has('playdate')) {
      if (hasCoordinates) {
        tasks.push({
          source: 'playgrounds',
          promise: request(`/playgrounds${queryString({ latitude, longitude, radiusMiles })}`, options),
        });
      } else {
        sources.playgrounds = skippedState('Coordinates are required to load playgrounds.');
        if (requested.has('playdate')) sources.playdates = skippedState('Playgrounds are required to load nearby playdates.');
      }
    }
    if (requested.has('family_event')) {
      if (locationLabel) {
        tasks.push({
          source: 'familyEvents',
          promise: request(`/family-events${queryString({ refresh: forceRefresh ? 1 : undefined, location: locationLabel, start: startDate, end: endDate })}`, options),
        });
      } else sources.familyEvents = skippedState('A location is required to load family events.');
    }
    if (requested.has('story_time')) {
      tasks.push({
        source: 'storyTimes',
        promise: request(`/story-times${queryString({ refresh: forceRefresh ? 1 : undefined, start: startDate, end: endDate })}`, options),
      });
    }

    const results = await Promise.allSettled(tasks.map((task) => task.promise));
    results.forEach((result, index) => {
      const { source } = tasks[index];
      if (result.status === 'rejected') {
        sources[source] = sourceState('error', {}, result.reason);
        return;
      }
      const payload = result.value || {};
      if (source === 'playgrounds') groups.playgrounds = uniqueDiscoverItems((payload.playgrounds || []).map(normalizePlayground));
      if (source === 'familyEvents') groups.familyEvents = uniqueDiscoverItems((payload.events || []).map(normalizeFamilyEvent));
      if (source === 'storyTimes') groups.storyTimes = uniqueDiscoverItems((payload.events || []).map(normalizeStoryTime));
      const group = groups[source];
      sources[source] = sourceState(group.length ? 'ready' : 'empty', payload);
    });

    if (requested.has('playdate') && groups.playgrounds.length) {
      const playdateResult = await loadPlaydatesForPlaygrounds(groups.playgrounds, { signal });
      groups.playdates = playdateResult.items;
      sources.playdates = playdateResult.source;
    } else if (requested.has('playdate') && sources.playgrounds.status === 'error') {
      sources.playdates = skippedState('Nearby playdates could not load because playground discovery failed.');
    }

    const items = [
      ...groups.playgrounds,
      ...groups.playdates,
      ...groups.familyEvents,
      ...groups.storyTimes,
    ];
    const activeSources = Object.entries(sources).filter(([key]) => {
      const kind = key === 'playgrounds' ? 'playground' : key === 'playdates' ? 'playdate' : key === 'familyEvents' ? 'family_event' : 'story_time';
      return requested.has(kind);
    });
    return {
      items,
      groups,
      sources,
      partial: activeSources.some(([, value]) => value.status === 'error' || value.status === 'skipped'),
      loadedAt: new Date().toISOString(),
    };
  }

  return { loadDiscover, loadPlaydatesForPlaygrounds };
}

