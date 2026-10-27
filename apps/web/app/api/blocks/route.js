import {
  blockLocalUser,
  blockSupabaseUser,
  listLocalBlocks,
  listSupabaseBlocks,
  unblockLocalUser,
  unblockSupabaseUser,
} from '../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

// Chat safety — blocking another family.
//   GET    /api/blocks                      → { blocks: [{ userId, displayName, createdAt }] }
//   POST   /api/blocks    { userId }        → { block: { userId, blocked: true } }   (repeat-safe)
//   DELETE /api/blocks    { userId } or ?userId=  → { block: { userId, blocked: false } }
// What a block hides is enforced in the database (202610270001_user_blocks.sql).

function errorResponse(error) {
  return Response.json({ error: error.message }, { status: error.status || 500 });
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const blocks = current.mode === 'supabase' ? await listSupabaseBlocks(current.supabase) : await listLocalBlocks(current.localUserId);
    return Response.json({ blocks, authMode: current.mode });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    const block = current.mode === 'supabase' ? await blockSupabaseUser(current.supabase, current.authUser, body) : await blockLocalUser(current.localUserId, body);
    return Response.json({ block, authMode: current.mode });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    const userId = body.userId || new URL(request.url).searchParams.get('userId') || '';
    const block = current.mode === 'supabase' ? await unblockSupabaseUser(current.supabase, current.authUser, { userId }) : await unblockLocalUser(current.localUserId, { userId });
    return Response.json({ block, authMode: current.mode });
  } catch (error) { return errorResponse(error); }
}
