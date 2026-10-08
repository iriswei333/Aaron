// Email sign-in helpers (magic link + one-time code) shared by web and mobile.

/** Loose check before calling Supabase; the server does the real validation. */
export function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

/** Supabase email codes are 6 digits by default (configurable up to 10). */
export function normalizeEmailCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export function isEmailCodeComplete(value) {
  return /^\d{6,10}$/.test(normalizeEmailCode(value));
}

/** Seconds to wait before another email can be sent, parsed from Supabase's rate-limit message. */
export function emailRetryAfterSeconds(message, fallback = 60) {
  const match = String(message || '').match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : fallback;
}

/** Friendly text for errors from signInWithOtp / verifyOtp. */
export function emailSignInErrorMessage(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || '');
  if (code === 'over_email_send_rate_limit' || /only request this after|rate limit/i.test(message)) {
    return `Please wait ${emailRetryAfterSeconds(message)} seconds before asking for another email.`;
  }
  if (code === 'otp_expired' || /expired|invalid/i.test(message)) {
    return 'That link or code has expired or was already used. Ask for a new one.';
  }
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(message)) {
    return 'Check the email address and try again.';
  }
  if (/fetch|network/i.test(message)) return 'Couldn’t reach the sign-in service. Check your connection and try again.';
  return message || 'Something went wrong. Please try again.';
}
