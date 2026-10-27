import { createLocalChatReport, createSupabaseChatReport } from '../../../../lib/backend.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';

// POST /api/chat/report  { messageId, reason, details? }
//   → { report: { id, createdAt, alreadyReported } }
// Reasons come from @sproutcue/shared/chat-report. Reporting the same message
// twice is not an error: the first report comes back with alreadyReported: true.
export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    const report = current.mode === 'supabase'
      ? await createSupabaseChatReport(current.supabase, body)
      : await createLocalChatReport(current.localUserId, body);
    return Response.json({ report, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
