import { describe, expect, it, vi } from 'vitest';
import { addVenueCoordinates, venueQuery, venueQueryKey } from '../lib/venue-geocoder.js';

function fakeSupabase(rows = {}) {
  const written = [];
  return {
    written,
    from: () => ({
      select: () => ({ in: async (_column, keys) => ({ data: keys.filter((key) => rows[key]).map((key) => ({ query_key: key, ...rows[key] })), error: null }) }),
      upsert: async (values) => { written.push(...values); return { error: null }; },
    }),
  };
}

describe('venueQuery', () => {
  it('builds a regional query and skips placed events and search links', () => {
    expect(venueQuery({ venue: 'Seattle Center' })).toBe('Seattle Center, WA');
    expect(venueQuery({ address: '305 Harrison St, Seattle, WA 98109', venue: 'Seattle Center' })).toBe('305 Harrison St, Seattle, WA 98109');
    expect(venueQuery({ venue: 'Bellevue Library', source: 'kcls' })).toBe('Bellevue Library, King County Library System, WA');
    expect(venueQuery({ venue: 'Somewhere', latitude: 47.6, longitude: -122.3 })).toBe('');
    expect(venueQuery({ venue: 'ParentMap', resultType: 'search-link' })).toBe('');
    expect(venueQuery({ title: 'No venue' })).toBe('');
  });
});

describe('addVenueCoordinates', () => {
  it('uses cached points, looks up the rest once per venue, and caches the results', async () => {
    const cachedKey = venueQueryKey('Seattle Center, WA');
    const supabase = fakeSupabase({ [cachedKey]: { latitude: 47.62, longitude: -122.35, found: true, checked_at: new Date().toISOString() } });
    const lookup = vi.fn(async () => ({ found: true, latitude: 47.67, longitude: -122.38, formattedAddress: 'Ballard' }));
    const events = [
      { id: 1, venue: 'Seattle Center' },
      { id: 2, venue: 'Ballard Commons Park' },
      { id: 3, venue: 'Ballard Commons Park' },
      { id: 4, venue: 'Already placed', latitude: 1, longitude: 2 },
    ];
    const result = await addVenueCoordinates({ mode: 'supabase', supabase }, events, { lookup });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(result.map((event) => [event.latitude, event.longitude])).toEqual([[47.62, -122.35], [47.67, -122.38], [47.67, -122.38], [1, 2]]);
    expect(supabase.written).toHaveLength(1);
    expect(supabase.written[0]).toMatchObject({ query: 'Ballard Commons Park, WA', found: true });
  });

  it('remembers venues Google cannot find and skips them until the retry window', async () => {
    const key = venueQueryKey('Mystery Hall, WA');
    const supabase = fakeSupabase({ [key]: { latitude: null, longitude: null, found: false, checked_at: new Date().toISOString() } });
    const lookup = vi.fn();
    const [event] = await addVenueCoordinates({ mode: 'supabase', supabase }, [{ venue: 'Mystery Hall' }], { lookup });
    expect(lookup).not.toHaveBeenCalled();
    expect(event.latitude).toBeUndefined();
  });

  it('returns events unchanged when look-ups fail or no API key is set', async () => {
    const events = [{ venue: 'Green Lake Park' }];
    const failing = vi.fn(async () => { throw new Error('quota'); });
    expect(await addVenueCoordinates({ mode: 'supabase', supabase: fakeSupabase() }, events, { lookup: failing })).toEqual(events);
    const noKey = vi.fn(async () => null);
    const supabase = fakeSupabase();
    expect(await addVenueCoordinates({ mode: 'supabase', supabase }, events, { lookup: noKey })).toEqual(events);
    expect(supabase.written).toHaveLength(0);
  });
});
