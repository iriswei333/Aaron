import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from './config.js';

let browserClient;

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  browserClient = browserClient || createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
