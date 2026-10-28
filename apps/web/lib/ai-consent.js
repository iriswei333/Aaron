// Server side of AI consent. No request reaches OpenAI until the parent has agreed to the
// current AI_CONSENT_VERSION (see packages/shared/src/ai-consent.js and the migration
// 202610280001_ai_consent.sql). Checked in three places:
//   1. each AI API route, before anything is saved (aiConsentResponse);
//   2. every library function that calls OpenAI for a family (requireAiConsent), so a new
//      route can't skip it by accident;
//   3. the database: enqueue_ai_generation_job refuses to queue a job without consent.
// A queued job is checked again when it starts, so turning consent off stops it.
import { AI_CONSENT_REQUIRED, AI_CONSENT_VERSION, hasAiConsent } from '@sproutcue/shared/ai-consent';
import { mutateStore, PROFILE_COLUMNS, profileRowToUser, updateUser } from './backend.js';

export const AI_CONSENT_MESSAGE = 'Allow AI features before making an AI creation.';

/** Photo library source kinds that are only ever used to make an AI creation. */
export const AI_PHOTO_SOURCE_KINDS = new Set(['picture_book', 'practice_story', 'toy_play']);

export function aiConsentError() {
  const error = new Error(AI_CONSENT_MESSAGE);
  error.code = AI_CONSENT_REQUIRED;
  error.status = 403;
  return error;
}

/** Throws AI_CONSENT_REQUIRED unless the signed-in parent agreed to the current version. */
export function requireAiConsent(current) {
  if (!hasAiConsent(current?.user)) throw aiConsentError();
}

function consentRequiredJson() {
  return Response.json({ error: AI_CONSENT_MESSAGE, code: AI_CONSENT_REQUIRED, version: AI_CONSENT_VERSION }, { status: 403 });
}

/** For routes: a 403 response when consent is missing, otherwise null. */
export function aiConsentResponse(current) {
  return hasAiConsent(current?.user) ? null : consentRequiredJson();
}

/** For route catch blocks: a 403 response when `error` is a consent error, otherwise null. */
export function aiConsentErrorResponse(error) {
  return error?.code === AI_CONSENT_REQUIRED || String(error?.message || '').includes(AI_CONSENT_REQUIRED) ? consentRequiredJson() : null;
}

/**
 * Grants (granted = true, for AI_CONSENT_VERSION) or withdraws consent for the signed-in parent.
 * Withdrawing also cancels AI jobs that haven't started yet. Returns the updated user.
 */
export async function setAiConsent(current, granted) {
  const grantedAt = granted ? new Date().toISOString() : null;
  const version = granted ? AI_CONSENT_VERSION : null;
  let user;
  if (current.mode === 'supabase') {
    const { data, error } = await current.supabase
      .from('profiles')
      .update({ ai_consent_at: grantedAt, ai_consent_version: version, updated_at: new Date().toISOString() })
      .eq('id', current.authUser.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message || 'Could not save your AI choice.');
    user = profileRowToUser(data);
  } else {
    user = await mutateStore((store) => {
      const target = store.users[current.localUserId];
      return target ? updateUser(target, { aiConsent: granted ? { grantedAt, version } : null }) : null;
    });
    if (!user) throw new Error('Choose a local family profile.');
  }
  if (!granted) {
    const { cancelQueuedAiJobs } = await import('./ai-jobs.js');
    await cancelQueuedAiJobs({ ...current, user });
  }
  return user;
}
