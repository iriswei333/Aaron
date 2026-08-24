import { createLocalChatMessage, createSupabaseChatMessage, listLocalChatThreads, listLocalChatMessages, listSupabaseChatThreads, listSupabaseChatMessages } from '../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const params = new URL(request.url).searchParams;
    const threadId = params.get('threadId') || params.get('contactId');
    if (current.mode === 'supabase') return Response.json({ threads: await listSupabaseChatThreads(current.supabase, current.authUser), messages: threadId ? await listSupabaseChatMessages(current.supabase, current.authUser, threadId) : [], authMode: current.mode });
    return Response.json({ threads: await listLocalChatThreads(current.localUserId), messages: threadId ? await listLocalChatMessages(current.localUserId, threadId) : [], authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    const message = current.mode === 'supabase' ? await createSupabaseChatMessage(current.supabase, current.authUser, body) : await createLocalChatMessage(current.localUserId, body);
    return Response.json({ message, authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
