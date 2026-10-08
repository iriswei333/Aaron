import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config, isSupabaseConfigured } from './config';
import { sessionStorage } from './secure-storage';

// The web preview is also rendered once in Node (no `window`), where browser storage
// doesn't exist. There, use a throwaway in-memory session instead.
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

// One Supabase client for the whole app. On iOS/Android the session lives in the
// Keychain / Keystore via expo-secure-store (see secure-storage.ts).
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        ...(isServerRender ? {} : { storage: sessionStorage }),
        autoRefreshToken: !isServerRender,
        persistSession: !isServerRender,
        detectSessionInUrl: false,
        // PKCE: Google sign-in returns a one-time code that only this device can exchange.
        flowType: 'pkce',
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  // Only refresh tokens while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function getAccessToken(): Promise<string> {
  if (!supabase) return '';
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}
