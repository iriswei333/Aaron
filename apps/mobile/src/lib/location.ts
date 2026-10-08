import { formatReverseGeocode, geocodeAddress } from '@sproutcue/shared/discover-view';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { apiRequest } from './api';
import type { SproutCueUser } from './session';

// Device location for Discover (web: navigator.geolocation + Nominatim / Open-Meteo lookups).

export type SavedLocation = {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number;
  source: string;
};

export class LocationPermissionError extends Error {
  canAskAgain: boolean;
  constructor(message: string, canAskAgain: boolean) {
    super(message);
    this.canAskAgain = canAskAgain;
  }
}

/**
 * Asks for "while using the app" permission, reads one position fix, and names the place.
 * Uses the last known fix when it is recent so the button feels instant.
 */
export async function readCurrentLocation(): Promise<SavedLocation> {
  if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) {
    throw new Error('Location services are turned off. Turn them on in Settings, or enter an address instead.');
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationPermissionError(
      permission.canAskAgain
        ? 'Location permission was not granted. Enter an address instead.'
        : 'Location is turned off for SproutCue. Allow it in Settings, or enter an address instead.',
      permission.canAskAgain,
    );
  }
  const recent = Platform.OS === 'web' ? null : await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 500 });
  const position = recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude, accuracy } = position.coords;
  let address = '';
  try {
    // Uses the platform geocoder on iOS / Android (not available on web without a Google key).
    if (Platform.OS !== 'web') address = formatReverseGeocode((await Location.reverseGeocodeAsync({ latitude, longitude }))[0]);
  } catch {
    address = '';
  }
  return {
    label: 'Current location',
    address,
    latitude,
    longitude,
    accuracy: Math.round(accuracy || 0),
    source: Platform.OS === 'web' ? 'browser-geolocation' : 'device-geolocation',
  };
}

/** Typed address → coordinates: the OS geocoder first (iOS / Android), then Nominatim / Open-Meteo. */
export async function lookUpAddress(address: string): Promise<SavedLocation> {
  if (Platform.OS !== 'web') {
    try {
      const [match] = await Location.geocodeAsync(address);
      if (match) {
        let label = address;
        try {
          label = formatReverseGeocode((await Location.reverseGeocodeAsync(match))[0]) || address;
        } catch {}
        return { label: 'Manual location', address: label, latitude: match.latitude, longitude: match.longitude, source: 'device-geocoding' };
      }
    } catch {}
  }
  return geocodeAddress(address);
}

/** Saves the search location to the family profile (PUT /location, same as the web). */
export async function saveLocation(location: SavedLocation) {
  const result = await apiRequest<{ user: SproutCueUser }>('/location', { method: 'PUT', body: location });
  return result.user;
}

/** Best-effort coordinates for an event venue without them (native only; cached per query). */
const geocodeCache = new Map<string, Promise<{ latitude: number; longitude: number } | null>>();
export function geocodeVenue(query: string) {
  if (Platform.OS === 'web' || !query) return Promise.resolve(null);
  const key = query.toLocaleLowerCase();
  let pending = geocodeCache.get(key);
  if (!pending) {
    pending = Location.geocodeAsync(query)
      .then(([match]) => (match ? { latitude: match.latitude, longitude: match.longitude } : null))
      .catch(() => null);
    geocodeCache.set(key, pending);
  }
  return pending;
}
