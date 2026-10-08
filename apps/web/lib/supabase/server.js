import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config.js';

// Native apps (apps/mobile) have no browser cookies, so they send the Supabase
// access token as `Authorization: Bearer <token>`. Browsers keep using cookies.
export function bearerTokenFromHeader(value) {
  const match = String(value || '').match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : '';
}

async function requestBearerToken() {
  try {
    const headerStore = await headers();
    return bearerTokenFromHeader(headerStore.get('authorization'));
  } catch {
    // Outside a request scope (scripts, tests) there are no headers.
    return '';
  }
}

export function createSupabaseTokenClient(accessToken) {
  if (!isSupabaseConfigured() || !accessToken) return null;
  // Every query runs as the signed-in user, so row-level security still applies.
  return createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

  const accessToken = await requestBearerToken();
  if (accessToken) return createSupabaseTokenClient(accessToken);

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Some server-only contexts cannot write cookies. Middleware refreshes them.
        }
      },
    },
  });
}

export async function getAuthenticatedSupabaseUser() {
  if (!isSupabaseConfigured()) {
    return { configured: false, supabase: null, user: null, error: null };
  }

  const accessToken = await requestBearerToken();
  const supabase = accessToken ? createSupabaseTokenClient(accessToken) : await createSupabaseServerClient();
  // With a bearer token, verify that token explicitly; otherwise read the cookie session.
  const { data, error } = accessToken ? await supabase.auth.getClaims(accessToken) : await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return { configured: true, supabase, user: null, error };
  }

  return {
    configured: true,
    supabase,
    user: {
      id: claims.sub,
      email: claims.email || '',
      displayName: claims.user_metadata?.display_name || claims.name || '',
    },
    error: null,
  };
}

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
