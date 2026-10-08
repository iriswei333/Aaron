import { isSupabaseConfigured } from '../../../lib/supabase/config.js';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    ok: true,
    authMode: isSupabaseConfigured() ? 'supabase' : 'local',
  });
}
