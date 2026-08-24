import { createLocalChatMessage, createSupabaseChatMessage, listLocalChatThreads, listLocalChatMessages, listSupabaseChatThreads, listSupabaseChatMessages, markLocalChatThreadRead, markSupabaseChatThreadRead } from '../../../lib/backend.js';
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

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    const threadId = String(body.threadId || '').trim();
    if (body.action !== 'markRead' || !threadId) return Response.json({ error: 'Choose a chat thread.' }, { status: 400 });
    if (current.mode === 'supabase') await markSupabaseChatThreadRead(current.supabase, threadId);
    else await markLocalChatThreadRead(current.localUserId, threadId);
    return Response.json({ ok: true, authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}
