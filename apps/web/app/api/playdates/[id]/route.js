import { getLocalPublicPlayDate, getSupabasePublicPlayDate } from '../../../../lib/backend.js';
import { createSupabaseServerClient } from '../../../../lib/supabase/server.js';
import { isSupabaseConfigured } from '../../../../lib/supabase/config.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const playDate = isSupabaseConfigured()
      ? await getSupabasePublicPlayDate(await createSupabaseServerClient(), id)
      : await getLocalPublicPlayDate(id);
    if (!playDate) return Response.json({ error: 'This public playdate is no longer available.' }, { status: 404 });
    return Response.json({ playDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
