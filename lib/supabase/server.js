import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config.js';

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

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
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { configured: false, supabase: null, user: null, error: null };
  }

  const { data, error } = await supabase.auth.getClaims();
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
