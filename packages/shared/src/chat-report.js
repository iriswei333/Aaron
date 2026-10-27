// Chat safety — reporting a message (Apple Guideline 1.2 / Play UGC policy).
// Shared by the web chat, the mobile app and POST /api/chat/report so the reason
// list and limits stay identical everywhere. The ids are stored in
// public.chat_reports.reason; keep them in sync with that table's check constraint.

export const CHAT_REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate or sexual content' },
  { id: 'child_safety', label: 'A child’s safety' },
  { id: 'other', label: 'Something else' },
];

export const CHAT_REPORT_DETAILS_MAX = 500;

const REASON_IDS = new Set(CHAT_REPORT_REASONS.map((reason) => reason.id));

export function isChatReportReason(value) {
  return REASON_IDS.has(value);
}

export function chatReportReasonLabel(id) {
  return CHAT_REPORT_REASONS.find((reason) => reason.id === id)?.label || 'Something else';
}

/**
 * Validates a report request body. Returns { messageId, reason, details } or
 * { error } with a message that is safe to show the person reporting.
 */
export function normalizeChatReport(body = {}) {
  const messageId = String(body?.messageId || '').trim().slice(0, 80);
  const reason = String(body?.reason || '').trim();
  const details = String(body?.details || '').trim().replace(/\s+/g, ' ').slice(0, CHAT_REPORT_DETAILS_MAX);
  if (!messageId) return { error: 'Choose a message to report.' };
  if (!isChatReportReason(reason)) return { error: 'Choose a reason for the report.' };
  if (reason === 'other' && !details) return { error: 'Tell us a little about what’s wrong.' };
  return { messageId, reason, details };
}
