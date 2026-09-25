import { describe, expect, it, vi } from 'vitest';
import { createDiscoverClient } from '../src/discover/client.js';
import {
  normalizePlaydate,
  normalizePlayground,
  normalizeStoryTime,
  normalizeWeekendEvent,
} from '../src/discover/normalizers.js';

describe('Discover normalizers', () => {
  it('normalizes each supported source into a namespaced DiscoverItem', () => {
    expect(normalizePlayground({ key: 'park-1', name: 'Tiny Park', latitude: 47.6, longitude: -122.3 }).id).toBe('playground:park-1');
    expect(normalizePlaydate({ id: 'date-1', playgroundName: 'Tiny Park', visibility: 'public' }).kind).toBe('playdate');
    expect(normalizeWeekendEvent({ id: 'event-1', title: 'Festival' }).actions).toContain('save');
    expect(normalizeStoryTime({ id: 'story-1', title: 'Toddler Stories', distanceMiles: 1.25 }).distance.miles).toBe(1.25);
    expect(normalizeWeekendEvent({ id: 'event-without-location' }).location).toMatchObject({
      latitude: null,
      longitude: null,
    });
  });

  it('does not make a search link saveable', () => {
    expect(normalizeWeekendEvent({ id: 'search-1', resultType: 'search-link' }).actions).toEqual(['open_external']);
  });
});

describe('Discover client', () => {
  it('returns successful sources when another provider fails', async () => {
    const request = vi.fn(async (path) => {
      if (path.startsWith('/playgrounds')) return { playgrounds: [{ key: 'park-1', name: 'Tiny Park' }] };
      if (path.startsWith('/playdates')) return { playDates: [{ id: 'date-1', playgroundKey: 'park-1', visibility: 'public', status: 'upcoming', startsAt: '2026-09-24T10:00:00Z' }] };
      if (path.startsWith('/family-events')) throw new Error('provider unavailable');
      if (path.startsWith('/story-times')) return { events: [{ id: 'story-1', title: 'Stories' }] };
      throw new Error(`Unexpected request: ${path}`);
    });
    const { loadDiscover } = createDiscoverClient(request);
    const result = await loadDiscover({ location: { address: 'Seattle', latitude: 47.6, longitude: -122.3 } });

    expect(result.groups.playgrounds).toHaveLength(1);
    expect(result.groups.playdates).toHaveLength(1);
    expect(result.groups.storyTimes).toHaveLength(1);
    expect(result.sources.weekendEvents.status).toBe('error');
    expect(result.partial).toBe(true);
  });

  it('deduplicates public playdates and excludes cancelled or private records', async () => {
    const request = vi.fn(async (path) => {
      if (path.startsWith('/playgrounds')) return { playgrounds: [{ key: 'one' }, { key: 'two' }] };
      if (path.includes('playgroundKey=one')) return { playDates: [{ id: 'shared', visibility: 'public', status: 'upcoming', startsAt: '2026-09-24T11:00:00Z' }] };
      if (path.includes('playgroundKey=two')) return { playDates: [
        { id: 'shared', visibility: 'public', status: 'upcoming', startsAt: '2026-09-24T11:00:00Z' },
        { id: 'private', visibility: 'private', status: 'upcoming' },
        { id: 'cancelled', visibility: 'public', status: 'cancelled' },
      ] };
      throw new Error(`Unexpected request: ${path}`);
    });
    const { loadDiscover } = createDiscoverClient(request);
    const result = await loadDiscover({
      location: { latitude: 47.6, longitude: -122.3 },
      kinds: ['playground', 'playdate'],
    });
    expect(result.groups.playdates.map((item) => item.sourceId)).toEqual(['shared']);
  });
});
