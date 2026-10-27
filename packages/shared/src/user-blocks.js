// Chat safety — blocking another family (Apple Guideline 1.2 / Play UGC policy).
// Shared wording for the web chat and the mobile app so both say exactly the same thing.
//
// What a block does (enforced on the server, see 202610270001_user_blocks.sql):
//   - the blocker no longer sees the blocked family's messages, in any chat;
//   - their direct chat disappears from the blocker's list;
//   - neither family can send the other a direct message;
//   - the blocked family is not told.

export const BLOCKED_MESSAGE_ERROR = 'You can’t message this family.';

export function blockConfirmCopy(name) {
  const who = String(name || '').trim() || 'this family';
  return {
    title: `Block ${who}?`,
    message: `You won’t see ${who}’s messages, and you won’t be able to message each other directly. ${who} won’t be told. You can unblock anytime in Family → Blocked families.`,
    confirm: 'Block',
  };
}

export function blockActionLabel(name) {
  const who = String(name || '').trim();
  return who && who !== 'Parent' ? `Block ${who}` : 'Block this family';
}

export function unblockConfirmCopy(name) {
  const who = String(name || '').trim() || 'this family';
  return {
    title: `Unblock ${who}?`,
    message: `You’ll see ${who}’s messages again, and you’ll be able to message each other.`,
    confirm: 'Unblock',
  };
}
