// Runtime configuration. Expo inlines EXPO_PUBLIC_* variables at build time;
// copy apps/mobile/.env.example to apps/mobile/.env.local and fill these in.
//
// EXPO_PUBLIC_API_BASE_URL must point at the deployed (or LAN-reachable) Next.js app,
// e.g. https://sproutcue.example.com/api — a phone cannot reach your Mac's 127.0.0.1.
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  // Public web address used in playdate share links (…/share/playdate/:id).
  // Optional: defaults to the API address without its trailing /api.
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL || (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/api\/?$/, ''),
};

export const isApiConfigured = Boolean(config.apiBaseUrl);
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
