import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchStoryTimes,
  parseParentMapStoryTimeEventPage,
  parseParentMapStoryTimeResults,
  storyTimeCacheKey,
  storyTimeExpiresAt,
} from '../lib/story-times.js';

afterEach(() => vi.unstubAllGlobals());

describe('ParentMap story times', () => {
  it('parses physical story-time cards and excludes virtual and unrelated search results', () => {
    const card = ({ classes = '', href, title, image, venue = '' }) => `
      <li class="wp-block-post ${classes}">
        <figure class="wp-block-post-featured-image"><a href="${href}"><img src="${image}" /></a></figure>
        <p class="wp-block-paragraph">Wednesday, Sept. 30</p>
        <p class="wp-block-paragraph">9 a.m.–5 p.m.</p>
        <h3 class="wp-block-post-title"><a href="${href}">${title}</a></h3>
        <p class="wp-block-paragraph">${venue}</p>
      </li>`;
    const html = `<ul class="wp-block-post-template">
      ${card({
        classes: 'post-1 tribe_events status-publish has-post-thumbnail tribe-events-virtual-event',
        href: 'https://www.parentmap.com/calendar/virtual-story-time/2026-09-30/',
        title: 'Virtual Story Time',
        image: 'https://images.example/virtual.jpg',
        venue: 'Virtual',
      })}
      ${card({
        classes: 'post-2 tribe_events status-publish has-post-thumbnail event_region-south-sound',
        href: 'https://www.parentmap.com/calendar/storywalk/2026-09-30/',
        title: 'StoryWalk at the Arboretum',
        image: 'https://images.example/storywalk.jpg',
        venue: 'Lake Wilderness Arboretum',
      })}
      ${card({
        classes: 'post-3 tribe_events status-publish has-post-thumbnail',
        href: 'https://www.parentmap.com/calendar/museum/2026-09-30/',
        title: 'Museum Free Day',
        image: 'https://images.example/museum.jpg',
      })}
    </ul>`;

    expect(parseParentMapStoryTimeResults(html, '2026-09-30')).toEqual([
      expect.objectContaining({
        id: 'parentmap-2-2026-09-30',
        title: 'StoryWalk at the Arboretum',
        date: '2026-09-30',
        timeLabel: '9 a.m.–5 p.m.',
        venue: 'Lake Wilderness Arboretum',
        imageUrl: 'https://images.example/storywalk.jpg',
        source: 'parentmap',
        sourceLabel: 'ParentMap',
      }),
    ]);
  });

  it('parses the authoritative date, time, address, and attendance mode from an event page', () => {
    const event = {
      '@type': 'Event',
      name: 'StoryWalk at Lake Wilderness Arboretum',
      image: { url: 'https://images.example/full.jpg' },
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      startDate: '2026-09-30T09:00:00-07:00',
      endDate: '2026-09-30T17:00:00-07:00',
      location: {
        name: 'Lake Wilderness Arboretum',
        address: {
          streetAddress: '22520 SE 248th St',
          addressLocality: 'Maple Valley',
          addressRegion: 'WA',
          postalCode: '98038-6008',
          addressCountry: 'United States',
        },
      },
    };
    const html = `
      <script type="application/ld+json">${JSON.stringify({ '@graph': [event] })}</script>
      <div class="tribe-block__venue__meta">
        <div class="tribe-block__venue__name"><h3>Lake Wilderness Arboretum</h3></div>
        <span class="tribe-street-address">22520 SE 248th St</span>
        <span class="tribe-locality">Maple Valley</span>
        <abbr class="tribe-region">WA</abbr>
        <span class="tribe-postal-code">98038-6008</span>
        <span class="tribe-country-name">United States</span>
      </div>`;

    expect(parseParentMapStoryTimeEventPage(html)).toEqual({
      virtual: false,
      date: '2026-09-30',
      dateLabel: 'Wednesday, Sep 30',
      timeLabel: '9:00 a.m.–5:00 p.m.',
      venue: 'Lake Wilderness Arboretum',
      address: '22520 SE 248th St, Maple Valley, WA, 98038-6008, United States',
      imageUrl: 'https://images.example/full.jpg',
      websiteUrl: '',
    });
  });

  it('uses a versioned cache key and expires cached results after one day', () => {
    expect(storyTimeCacheKey({ locationCity: 'Seattle', startDate: '2026-09-30', endDate: '2026-10-06' }))
      .toBe('story-times-v9:all-libraries:2026-09-30:2026-10-06');
    expect(storyTimeExpiresAt(new Date('2026-09-30T12:00:00.000Z'))).toBe('2026-10-01T12:00:00.000Z');
  });

  it('merges enriched ParentMap cards into the story-time API result', async () => {
    const eventUrl = 'https://www.parentmap.com/calendar/storywalk/2026-09-30/';
    const listing = `<ul class="wp-block-post-template"><li class="wp-block-post post-2 tribe_events status-publish has-post-thumbnail">
      <figure class="wp-block-post-featured-image"><img src="https://images.example/card.jpg" /></figure>
      <p class="wp-block-paragraph">Wednesday, Sept. 30</p><p class="wp-block-paragraph">9 a.m.–5 p.m.</p>
      <h3 class="wp-block-post-title"><a href="${eventUrl}">StoryWalk at the Arboretum</a></h3>
      <p class="wp-block-paragraph">Lake Wilderness Arboretum</p></li></ul>`;
    const detail = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      startDate: '2026-09-30T09:00:00-07:00',
      endDate: '2026-09-30T17:00:00-07:00',
      location: { name: 'Lake Wilderness Arboretum', address: { streetAddress: '22520 SE 248th St', addressLocality: 'Maple Valley', addressRegion: 'WA', postalCode: '98038' } },
    })}</script><div class="wp-block-button"><a href="https://example.org/official-storywalk">Event Website</a></div>`;
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      text: async () => String(url).includes('parentmap.com/calendar/?') ? listing
        : String(url) === eventUrl ? detail
          : '',
    })));

    const result = await fetchStoryTimes({ locationCity: 'Seattle', startDate: '2026-09-30', endDate: '2026-09-30' });

    expect(result.sourceLabel).toBe('Seattle Public Library + King County Library System + ParentMap');
    expect(result.events).toEqual([expect.objectContaining({
      title: 'StoryWalk at the Arboretum',
      source: 'parentmap',
      date: '2026-09-30',
      timeLabel: '9:00 a.m.–5:00 p.m.',
      address: '22520 SE 248th St, Maple Valley, WA 98038',
      imageUrl: 'https://images.example/card.jpg',
      listingUrl: eventUrl,
      url: 'https://example.org/official-storywalk',
    })]);
  });

  it('extracts the Event Website link from a ParentMap event detail page', () => {
    const listingUrl = 'https://www.parentmap.com/calendar/celebrating-culturas-hispaniclatinx-heritage-month/';
    const html = `<main>
      <div class="wp-block-button"><a href="${listingUrl}?ical=1">Add to calendar</a></div>
      <div class="wp-block-button"><a href="https://kcls.bibliocommons.com/v2/events/6a5a998c0e562e28009a98ec" target="_blank">
        Event Website
      </a></div>
    </main>`;

    expect(parseParentMapStoryTimeEventPage(html, listingUrl).websiteUrl)
      .toBe('https://kcls.bibliocommons.com/v2/events/6a5a998c0e562e28009a98ec');
  });

  it('returns SPL and KCLS events together without applying the caller location or radius', async () => {
    const spl = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:spl-all-1
SUMMARY:Central Library Story Time
DTSTART:20260930T100000
LOCATION:Central Library
END:VEVENT
END:VCALENDAR`;
    const kcls = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      identifier: 'kcls-all-1',
      name: 'Kent Library Story Time',
      description: 'Stories and songs for children.',
      startDate: '2026-09-30T11:00:00-07:00',
      location: { name: 'Kent Library', address: { addressLocality: 'Kent' } },
      url: 'https://kcls.bibliocommons.com/events/kcls-all-1',
    })}</script>`;
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      text: async () => String(url).includes('trumba.com') ? spl
        : String(url).includes('kcls.bibliocommons.com/v2/events') ? kcls
          : '<ul class="wp-block-post-template"></ul>',
    })));

    const result = await fetchStoryTimes({
      locationCity: 'Tacoma',
      startDate: '2026-09-30',
      endDate: '2026-09-30',
      latitude: 47.25,
      longitude: -122.44,
      radiusMiles: 1,
    });

    expect(result.events.map((event) => event.source)).toEqual(['spl', 'kcls']);
    expect(result.events.map((event) => event.title)).toEqual([
      'Central Library Story Time',
      'Kent Library Story Time',
    ]);
  });

  it('loads every KCLS results page in the requested date range', async () => {
    const eventHtml = (id, title) => `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      identifier: id,
      name: title,
      startDate: '2026-09-30T11:00:00-07:00',
      location: { name: `${title} Branch` },
      url: `https://kcls.bibliocommons.com/events/${id}`,
    })}</script>`;
    const request = vi.fn(async (url) => ({
      ok: true,
      text: async () => {
        const value = String(url);
        if (value.includes('trumba.com')) return '';
        if (value.includes('parentmap.com')) return '<ul class="wp-block-post-template"></ul>';
        if (value.includes('page=2')) return eventHtml('second', 'Second Story Time');
        return `${eventHtml('first', 'First Story Time')}<a href="?types=story&amp;page=2">2</a>`;
      },
    }));
    vi.stubGlobal('fetch', request);

    const result = await fetchStoryTimes({ startDate: '2026-09-30', endDate: '2026-10-06' });

    expect(result.events.map((event) => event.title)).toEqual(['First Story Time', 'Second Story Time']);
    expect(request.mock.calls.some(([url]) => String(url).includes('startDate=2026-09-30') && String(url).includes('endDate=2026-10-06'))).toBe(true);
    expect(request.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true);
  });
});

describe('withUniqueStoryTimeIds', () => {
  it('keeps the first id and adds time + branch to repeats', async () => {
    const { withUniqueStoryTimeIds } = await import('../lib/story-times.js');
    const base = { id: 'kcls-Pajama Story Time-2026-10-07', title: 'Pajama Story Time', date: '2026-10-07' };
    const events = withUniqueStoryTimeIds([
      { ...base, venue: 'Bothell Library', timeLabel: '6:30 PM' },
      { ...base, venue: 'Kirkland Library', timeLabel: '6:30 PM' },
      { ...base, venue: 'Kirkland Library', timeLabel: '6:30 PM' },
    ]);
    expect(events.map((event) => event.id)).toEqual([
      'kcls-Pajama Story Time-2026-10-07',
      'kcls-Pajama Story Time-2026-10-07-6:30 PM-Kirkland Library',
      'kcls-Pajama Story Time-2026-10-07-6:30 PM-Kirkland Library-2',
    ]);
  });
});
