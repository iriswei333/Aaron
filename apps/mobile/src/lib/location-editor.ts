import { shortLocation } from '@sproutcue/shared/today';
import { useCallback, useState } from 'react';

import { lookUpAddress, readCurrentLocation, saveLocation, type SavedLocation } from './location';
import { useSession } from './session';

// Changing the family's search location: "Use my current location" (expo-location) or a typed
// address, saved to the profile with PUT /location. Used by the Today location chip and by
// Discover before a location is set; every tab reads the result from the session user.
export function useLocationEditor() {
  const { session, previewMode, setUser } = useSession();
  const signedIn = Boolean(session) && !previewMode;
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);

  const apply = useCallback(
    async (next: SavedLocation) => {
      if (!signedIn) throw new Error('Sign in to save a search location.');
      setStatus('Saving location…');
      setUser(await saveLocation(next));
      setStatus(next.address ? `Searching near ${shortLocation(next)}.` : 'Searching near your current location.');
    },
    [setUser, signedIn],
  );

  /** Returns an error message, or '' when the location was saved. */
  const locateMe = useCallback(async () => {
    setLocating(true);
    setStatus('Requesting location permission…');
    try {
      await apply(await readCurrentLocation());
      return '';
    } catch (error: any) {
      const text = error?.message || 'Could not read your location. Enter an address instead.';
      setStatus(text);
      return text;
    } finally {
      setLocating(false);
    }
  }, [apply]);

  /** Returns an error message, or '' when the location was saved. */
  const searchAddress = useCallback(
    async (address: string) => {
      const trimmed = address.trim();
      if (!trimmed) return 'Enter an address or use current location.';
      setStatus('Looking up address for weather and nearby play options…');
      let next: SavedLocation = { label: 'Manual location', address: trimmed, latitude: null, longitude: null, source: 'manual' };
      try {
        next = await lookUpAddress(trimmed);
      } catch {
        setStatus(`Could not find coordinates for "${trimmed}". Saving the address only.`);
      }
      try {
        await apply(next);
        return '';
      } catch (error: any) {
        const text = `Could not save location: ${error?.message || error}`;
        setStatus(text);
        return text;
      }
    },
    [apply],
  );

  return { status, setStatus, locating, locateMe, searchAddress };
}
