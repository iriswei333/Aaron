import { createLocalChatMessage, createSupabaseChatMessage, listLocalChatThreads, listLocalChatMessages, listSupabaseChatThreads, listSupabaseChatMessages, markLocalChatThreadRead, markSupabaseChatThreadRead } from '../../../lib/backend.js';
import { after } from 'next/server';
import { pushChatMessageToMembers } from '../../../lib/push-tokens.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';
import { createSupabaseAdminClient } from '../../../lib/supabase/server.js';

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
    // Push to the other members' phones after the response, so sending stays fast.
    if (current.mode === 'supabase') after(() => pushChatMessageToMembers(createSupabaseAdminClient(), { senderId: current.authUser.id, message }));
    return Response.json({ message, authMode: current.mode });
  } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
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
