import { describe, expect, it, vi } from 'vitest';
import { createDiscoverClient } from '../src/discover/client.js';
import { discoverGeocodeQuery, discoverMapUrl } from '../src/google-map.js';
import {
  discoverItemOccursOnDate,
  filterDiscoverItems,
  nextDiscoverFilterState,
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
    expect(normalizeWeekendEvent({ id: 'event-address', venueAddress: '123 Main St, Seattle, WA' }).location.address)
      .toBe('123 Main St, Seattle, WA');
  });

  it('does not make a search link saveable', () => {
    expect(normalizeWeekendEvent({ id: 'search-1', resultType: 'search-link' }).actions).toEqual(['open_external']);
  });

  it('matches only scheduled playdates, events, and story times for the local day', () => {
    const today = new Date(2026, 9, 2, 12, 0, 0);
    const todayPlaydate = normalizePlaydate({
      id: 'today-playdate',
      startsAt: new Date(2026, 9, 2, 10, 30, 0).toISOString(),
    });
    const tomorrowPlaydate = normalizePlaydate({
      id: 'tomorrow-playdate',
      startsAt: new Date(2026, 9, 3, 10, 30, 0).toISOString(),
    });

    expect(discoverItemOccursOnDate(todayPlaydate, today)).toBe(true);
    expect(discoverItemOccursOnDate(normalizeWeekendEvent({ id: 'today-event', date: '2026-10-02' }), today)).toBe(true);
    expect(discoverItemOccursOnDate(normalizeStoryTime({ id: 'today-story', date: '2026-10-02' }), today)).toBe(true);
    expect(discoverItemOccursOnDate(tomorrowPlaydate, today)).toBe(false);
    expect(discoverItemOccursOnDate(normalizePlayground({ key: 'park' }), today)).toBe(false);
    expect(discoverItemOccursOnDate(normalizeWeekendEvent({ id: 'undated' }), today)).toBe(false);
    expect(discoverItemOccursOnDate(normalizeWeekendEvent({ id: 'search', date: '2026-10-02', resultType: 'search-link' }), today)).toBe(false);
  });

  it('combines the Today toggle with each Discover category', () => {
    const today = new Date(2026, 9, 2, 12, 0, 0);
    const items = [
      normalizePlaydate({ id: 'today-playdate', startsAt: new Date(2026, 9, 2, 9, 0, 0).toISOString() }),
      normalizePlaydate({ id: 'tomorrow-playdate', startsAt: new Date(2026, 9, 3, 9, 0, 0).toISOString() }),
      normalizeStoryTime({ id: 'today-story', date: '2026-10-02' }),
      normalizeWeekendEvent({ id: 'today-event', date: '2026-10-02' }),
      normalizePlayground({ key: 'park' }),
    ];

    expect(filterDiscoverItems(items, { kind: 'all', todayOnly: true, date: today })).toHaveLength(3);
    expect(filterDiscoverItems(items, { kind: 'playdate', todayOnly: true, date: today }).map((item) => item.id))
      .toEqual(['playdate:today-playdate']);
    expect(filterDiscoverItems(items, { kind: 'story_time', todayOnly: true, date: today }).map((item) => item.id))
      .toEqual(['story_time:today-story']);
    expect(filterDiscoverItems(items, { kind: 'weekend_event', todayOnly: true, date: today }).map((item) => item.id))
      .toEqual(['weekend_event:today-event']);
    expect(filterDiscoverItems(items, {
      kinds: ['playdate', 'story_time'],
      todayOnly: true,
      date: today,
    }).map((item) => item.id)).toEqual(['playdate:today-playdate', 'story_time:today-story']);
    expect(filterDiscoverItems(items, { playgroundOnly: true }).map((item) => item.id))
      .toEqual(['playground:park']);
  });

  it('applies the six Discover filter selection rules', () => {
    const initial = { todayOnly: false, playgroundOnly: false, kinds: [] };
    const allPlaydates = nextDiscoverFilterState(initial, 'playdate');
    expect(allPlaydates).toEqual({ todayOnly: false, playgroundOnly: false, kinds: ['playdate'] });

    const todayPlaydates = nextDiscoverFilterState(allPlaydates, 'today');
    expect(todayPlaydates).toEqual({ todayOnly: true, playgroundOnly: false, kinds: ['playdate'] });

    const todayTwoTypes = nextDiscoverFilterState(todayPlaydates, 'story_time');
    expect(todayTwoTypes).toEqual({
      todayOnly: true,
      playgroundOnly: false,
      kinds: ['playdate', 'story_time'],
    });

    const allTwoTypes = nextDiscoverFilterState(todayTwoTypes, 'all');
    expect(allTwoTypes).toEqual({
      todayOnly: false,
      playgroundOnly: false,
      kinds: ['playdate', 'story_time'],
    });

    const playground = nextDiscoverFilterState(allTwoTypes, 'playground');
    expect(playground).toEqual({ todayOnly: false, playgroundOnly: true, kinds: [] });
    expect(nextDiscoverFilterState(playground, 'playground'))
      .toEqual({ todayOnly: false, playgroundOnly: false, kinds: [] });
  });
});

describe('Discover map geocoding', () => {
  it('anchors KCLS venue-only story times to King County, Washington', () => {
    const item = normalizeStoryTime({
      id: 'kidsquest-skyway',
      title: 'KidsQuest Little Labs: Stories That Count',
      venue: 'Skyway',
      source: 'kcls',
      sourceLabel: 'King County Library System',
    });

    expect(discoverGeocodeQuery(item, 'Seattle'))
      .toBe('Skyway, King County Library System, WA, USA');
  });

  it('uses a structured story-time address without adding provider context', () => {
    const item = normalizeStoryTime({
      id: 'kidsquest-skyway-addressed',
      venue: 'Skyway',
      address: '12601 76th Avenue S, Seattle, WA 98178, US',
      source: 'kcls',
    });

    expect(discoverGeocodeQuery(item, 'Bellevue'))
      .toBe('12601 76th Avenue S, Seattle, WA 98178, US');
  });

  it('creates a Google Maps link from coordinates or a provider-aware venue query', () => {
    const positioned = normalizeWeekendEvent({
      id: 'festival',
      latitude: 47.61,
      longitude: -122.2,
    });
    const kcls = normalizeStoryTime({
      id: 'kcls-story',
      venue: 'Skyway',
      source: 'kcls',
    });

    expect(discoverMapUrl(positioned)).toContain('query=47.61%2C-122.2');
    expect(discoverMapUrl(kcls)).toContain('query=Skyway%2C+King+County+Library+System%2C+WA%2C+USA');
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

  it('loads story times without a saved location', async () => {
    const request = vi.fn(async (path) => {
      if (path.startsWith('/story-times')) return { events: [{ id: 'story-1', title: 'Library Story Time' }] };
      throw new Error(`Unexpected request: ${path}`);
    });
    const { loadDiscover } = createDiscoverClient(request);

    const result = await loadDiscover({ kinds: ['story_time'] });

    expect(result.groups.storyTimes.map((item) => item.title)).toEqual(['Library Story Time']);
    expect(result.sources.storyTimes.status).toBe('ready');
    expect(request).toHaveBeenCalledWith('/story-times', {});
  });

  it('passes an explicit date range when loading same-day family events', async () => {
    const request = vi.fn(async () => ({ events: [] }));
    const { loadDiscover } = createDiscoverClient(request);

    await loadDiscover({
      location: { address: 'Seattle, WA' },
      kinds: ['weekend_event'],
      startDate: '2026-10-02',
      endDate: '2026-10-02',
    });

    expect(request).toHaveBeenCalledWith(
      '/family-events?location=Seattle%2C+WA&start=2026-10-02&end=2026-10-02',
      {},
    );
  });
});
