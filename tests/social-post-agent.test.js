import { describe, expect, it, vi } from 'vitest';
import { parseParentMapEventVenue } from '../lib/family-events.js';
import { getForcedPartnershipEvents } from '../lib/social-partnership-events.js';
import { appendPartnershipEventSource, partnershipEventRecord } from '../lib/social-partnership-events-file.js';
import {
  DEFAULT_EVENT_DISTANCE_MILES,
  distanceMiles,
  filterParentMapEventsByDistance,
  generateWeeklySocialPosts,
  makeWeeklyRoundup,
  parseForcedEventPage,
  rankLocationFallbackCandidates,
} from '../lib/social-post-agent.js';

describe('ParentMap venue distance filtering', () => {
  it('defaults the social-agent venue radius to 15 miles', () => {
    expect(DEFAULT_EVENT_DISTANCE_MILES).toBe(15);
  });

  it('parses the venue name and full address from the ParentMap venue block', () => {
    const html = `
      <div class="tribe-block__venue__meta">
        <div class="tribe-block__venue__name"><h3><a href="/venue/9359/">Seattle Aquarium</a></h3></div>
        <address class="tribe-block__venue__address">
          <span class="tribe-address">
            <span class="tribe-street-address">1483 Alaskan Way Pier 59</span>
            <span class="tribe-locality">Seattle</span>
            <abbr class="tribe-region tribe-events-abbr" title="Washington">WA</abbr>
            <span class="tribe-postal-code">98101-2015</span>
            <span class="tribe-country-name">United States</span>
          </span>
        </address>
      </div>`;

    expect(parseParentMapEventVenue(html)).toEqual({
      name: 'Seattle Aquarium',
      address: '1483 Alaskan Way Pier 59, Seattle, WA, 98101-2015, United States',
      streetAddress: '1483 Alaskan Way Pier 59',
      locality: 'Seattle',
      region: 'WA',
      postalCode: '98101-2015',
      country: 'United States',
    });
  });

  it('returns no venue when the ParentMap detail page has no venue metadata block', () => {
    expect(parseParentMapEventVenue('<main><h1>Online event</h1></main>')).toBeNull();
  });

  it('keeps only geocodable ParentMap venues inside the configured radius', async () => {
    const events = [
      { title: 'Nearby event', source: 'parentmap', url: 'https://www.parentmap.com/calendar/nearby/' },
      { title: 'Far event', source: 'parentmap', url: 'https://www.parentmap.com/calendar/far/' },
      { title: 'Missing venue', source: 'parentmap', url: 'https://www.parentmap.com/calendar/missing/' },
      { title: 'Other provider', source: 'seattles-child', url: 'https://example.com/event' },
    ];
    const fetchDetails = vi.fn(async (url) => {
      if (url.endsWith('/missing/')) return { description: '', venue: null };
      const nearby = url.endsWith('/nearby/');
      return {
        description: nearby ? 'Aquarium fun.' : 'A distant activity.',
        venue: { name: nearby ? 'Seattle Aquarium' : 'Olympia Center', address: nearby ? 'Seattle address' : 'Olympia address' },
      };
    });
    const geocode = vi.fn(async (address) => address === 'Seattle address'
      ? { latitude: 47.607, longitude: -122.342 }
      : { latitude: 47.0379, longitude: -122.9007 });

    const result = await filterParentMapEventsByDistance(events, {
      city: 'Seattle',
      maxDistanceMiles: 20,
      fetchDetails,
      geocode,
    });

    expect(result.skipped).toBe(2);
    expect(result.events).toHaveLength(1);
    expect(result.candidates).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      title: 'Nearby event',
      venue: 'Seattle Aquarium',
      venueAddress: 'Seattle address',
      parentMapDescription: 'Aquarium fun.',
    });
    expect(result.events[0].distanceMiles).toBeLessThan(1);
    expect(fetchDetails).toHaveBeenCalledTimes(3);
  });

  it('ranks out-of-radius fallbacks by recommendation score and then nearest distance', () => {
    const ranked = rankLocationFallbackCandidates([
      { title: 'Ordinary Family Event', date: '2026-09-26', distanceMiles: 22 },
      { title: 'Fall Festival at the Farm', date: '2026-09-26', distanceMiles: 45 },
      { title: 'Another Ordinary Event', date: '2026-09-26', distanceMiles: 27 },
    ], { city: 'Seattle', date: '2026-09-26' });

    expect(ranked.map((event) => event.title)).toEqual([
      'Fall Festival at the Farm',
      'Ordinary Family Event',
      'Another Ordinary Event',
    ]);
    expect(ranked.every((event) => event.locationFilterFallback)).toBe(true);
  });

  it('calculates great-circle distance in miles', () => {
    expect(distanceMiles(
      { latitude: 47.6062, longitude: -122.3321 },
      { latitude: 47.6101, longitude: -122.2015 },
    )).toBeCloseTo(6.1, 0);
  });

  it('includes each event venue and detailed address in the weekly roundup', () => {
    const roundup = makeWeeklyRoundup([{
      city: 'Seattle',
      title: 'Aquarium Family Day',
      venue: 'Seattle Aquarium',
      venueAddress: '1483 Alaskan Way Pier 59, Seattle, WA, 98101-2015, United States',
      highlights: ['适合全家一起探索。'],
    }], '2026-09-26', '2026-09-27');

    expect(roundup.caption).toContain('地点：Seattle Aquarium · 1483 Alaskan Way Pier 59, Seattle, WA, 98101-2015, United States');
    expect(roundup.posts[0].venueAddress).toBe('1483 Alaskan Way Pier 59, Seattle, WA, 98101-2015, United States');
  });
});

describe('Forced partnership events', () => {
  it('returns configured events only for their exact city and date', () => {
    expect(getForcedPartnershipEvents({ city: 'Seattle', date: '2026-09-26' })).toEqual([
      expect.objectContaining({
        title: 'Mid-Autumn Festival',
        forcedRecommendation: true,
      }),
    ]);
    expect(getForcedPartnershipEvents({ city: 'Bellevue', date: '2026-09-26' })).toEqual([]);
  });
});

describe('Command-line forced URL events', () => {
  const forcedUrl = 'https://redmondtowncenter.com/events/917-exotics-car-show';
  const pageHtml = `
    <html><body>
      <h2>Exotics Car Show</h2>
      <h3>Details</h3>
      <p>When</p><p>Saturdays, 9-11am</p>
      <p>Where</p><p>Redmond Town Center</p>
      <p>Spring-Fall: Saturdays 9-11AM</p>
      <p>Weather Dependent</p>
      <p>Join us for a weekly gathering of exotic and rare cars for owners and spectators.</p>
      <h3>Specialty Shows</h3>
      <p>Redmond Town Center 7345 164th Avenue NE, Suite I115 Redmond, WA 98052</p>
    </body></html>`;

  it('extracts forced event facts from a generic official event page', () => {
    expect(parseForcedEventPage(pageHtml, {
      url: forcedUrl,
      city: 'Bellevue',
      date: '2026-10-03',
    })).toMatchObject({
      city: 'Bellevue',
      date: '2026-10-03',
      title: 'Exotics Car Show',
      timeLabel: '9–11 a.m.',
      venue: 'Redmond Town Center',
      venueAddress: '7345 164th Avenue NE, Suite I115 Redmond, WA 98052',
      url: forcedUrl,
      forcedRecommendation: true,
      cliForcedEvent: true,
    });
  });

  it('generates only the requested city and date without running normal event search', async () => {
    const forcedEvent = parseForcedEventPage(pageHtml, {
      url: forcedUrl,
      city: 'Bellevue',
      date: '2026-10-03',
    });
    const run = await generateWeeklySocialPosts({
      regions: [{ city: 'Bellevue', label: 'Bellevue' }],
      dates: ['2026-10-03'],
      forcedInputEvents: [forcedEvent],
    });

    expect(run).toMatchObject({
      startDate: '2026-10-03',
      endDate: '2026-10-03',
      searchMode: 'forced-url',
      slotCount: 1,
    });
    expect(run.posts).toHaveLength(1);
    expect(run.posts[0]).toMatchObject({
      city: 'Bellevue',
      date: '2026-10-03',
      title: 'Exotics Car Show',
      eventUrl: forcedUrl,
    });
  });

  it('serializes a forced URL event into the partnership configuration safely', () => {
    const event = parseForcedEventPage(pageHtml, {
      url: forcedUrl,
      city: 'Bellevue',
      date: '2026-10-03',
    });
    const record = partnershipEventRecord(event);
    const updated = appendPartnershipEventSource('const PARTNERSHIP_EVENTS = [\n];\n', event);

    expect(record).toMatchObject({
      city: 'Bellevue',
      source: 'partnership',
      recommendationType: 'partnership',
      forcedRecommendation: true,
    });
    expect(record).not.toHaveProperty('cliForcedEvent');
    expect(updated).toContain('"title": "Exotics Car Show"');
    expect(updated).toContain('"url": "https://redmondtowncenter.com/events/917-exotics-car-show"');
    expect(updated.trimEnd()).toMatch(/},\n\];$/);
  });
});
