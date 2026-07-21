import {
  createLocalPlayDate,
  createSupabasePlayDate,
  joinLocalPlayDate,
  joinSupabasePlayDate,
  listLocalPlayDates,
  listSupabasePlayDates,
} from '../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const url = new URL(request.url);
    const playgroundKey = url.searchParams.get('playgroundKey') || '';
    const playDates = current.mode === 'supabase'
      ? await listSupabasePlayDates(current.supabase, current.authUser, playgroundKey)
      : await listLocalPlayDates(current.localUserId, playgroundKey);

    return Response.json({ playDates, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const playDate = current.mode === 'supabase'
      ? await createSupabasePlayDate(current.supabase, current.authUser, body)
      : await createLocalPlayDate(current.localUserId, body);

    return Response.json({ playDate, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const playDateId = String(body.playDateId || '').trim();
    if (!playDateId) {
      return Response.json({ error: 'Choose a play date to join.' }, { status: 400 });
    }

    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);

    const playDate = current.mode === 'supabase'
      ? await joinSupabasePlayDate(current.supabase, current.authUser, playDateId)
      : await joinLocalPlayDate(current.localUserId, playDateId);

    return Response.json({ playDate, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
