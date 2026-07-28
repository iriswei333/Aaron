import { createLocalChatMessage, createSupabaseChatMessage, listLocalChatContacts, listLocalChatMessages, listSupabaseChatContacts, listSupabaseChatMessages } from '../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const contactId = new URL(request.url).searchParams.get('contactId');
    if (current.mode === 'supabase') return Response.json({ contacts: await listSupabaseChatContacts(current.supabase, current.authUser), messages: contactId ? await listSupabaseChatMessages(current.supabase, current.authUser, contactId) : [], authMode: current.mode });
    return Response.json({ contacts: await listLocalChatContacts(current.localUserId), messages: contactId ? await listLocalChatMessages(current.localUserId, contactId) : [], authMode: current.mode });
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
