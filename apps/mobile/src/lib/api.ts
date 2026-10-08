import { createApiClient } from '@sproutcue/shared/api-client';
import { createDiscoverClient } from '@sproutcue/shared/discover-client';
import { createFamilyPlansClient } from '@sproutcue/shared/family-plans-client';

import { config } from './config';
import { getAccessToken } from './supabase';

// Same client the web app uses, pointed at the hosted API and sending the
// Supabase access token as `Authorization: Bearer …` on every request.
const client = createApiClient({
  baseUrl: config.apiBaseUrl,
  getAccessToken,
  timeoutMs: 15000,
});

export function apiRequest<T = any>(path: string, options: Record<string, any> = {}): Promise<T> {
  return client.request(path, options);
}

/** Absolute URL for a server-relative link from an API response (photos, picture-book pages…). */
export function apiUrl(path: string): string {
  return client.resolveUrl(path);
}

/**
 * Image source for protected files served by the API, e.g.
 * `<Image source={await authorizedSource(photo.contentUrl)} />`.
 * Those endpoints check the signed-in family, so the token goes along as a header.
 */
export async function authorizedSource(path: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  const token = await getAccessToken();
  return { uri: apiUrl(path), ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) };
}

// Shared data loaders, wired to this app's authenticated request function.
export const discover = createDiscoverClient(apiRequest);
export const familyPlans = createFamilyPlansClient(apiRequest);
