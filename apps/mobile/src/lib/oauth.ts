import { authCallbackErrorMessage, parseAuthCallbackUrl } from '@sproutcue/shared/auth-callback';
import { emailRetryAfterSeconds, emailSignInErrorMessage, normalizeEmailCode } from '@sproutcue/shared/auth-email';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Google sign-in and email magic links through Supabase.
//
// Google sign-in through Supabase (the same Google setup the web app uses):
// 1. Ask Supabase for the Google sign-in URL (PKCE, so the result is a one-time code).
// 2. Open it in a secure in-app browser (ASWebAuthenticationSession / Custom Tabs).
// 3. Google → Supabase → back to the app at sproutcue://auth/callback?code=…
// 4. Exchange the code for a session; it's saved in secure storage automatically.

// Browser preview only: Google sign-in runs in a popup. When the popup lands on
// /auth/callback, this posts the URL back to the main window, which finishes sign-in
// and closes the popup. (It throws if Google cut the link to the main window.)
try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // No main window to hand back to; the callback screen finishes sign-in itself.
}

/** True inside the browser sign-in popup, whose main window will finish sign-in. */
export function isAuthPopup() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.opener) && window.opener !== window;
}

function networkMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error || '');
  if (/code verifier/i.test(text)) return 'This sign-in was started somewhere else. Tap Continue with Google again on this device.';
  return /fetch|network/i.test(text)
    ? 'Couldn’t reach the sign-in service. Check your connection and try again.'
    : text || 'Sign-in didn’t finish. Please try again.';
}

/**
 * Where Supabase sends the user back to. Add these to Supabase → Authentication →
 * URL Configuration → Redirect URLs:
 *   sproutcue://auth/callback                 development and store builds
 *   exp://**                                  Expo Go while developing
 *   http://localhost:8081/auth/callback       browser preview
 */
export function authRedirectUrl() {
  return Linking.createURL('auth/callback');
}

export type OAuthResult = { status: 'signed-in' } | { status: 'cancelled' } | { status: 'error'; message: string };

// The same code can arrive twice (browser result + deep link on Android); exchange it once.
const handledCodes = new Set<string>();

/** Finishes sign-in from a redirect URL. Safe to call more than once for the same URL. */
export async function completeSignInFromUrl(url: string): Promise<OAuthResult> {
  if (!supabase) return { status: 'error', message: 'Sign-in is not configured for this build.' };
  const parsed = parseAuthCallbackUrl(url);
  const errorMessage = authCallbackErrorMessage(parsed);
  if (errorMessage) return parsed.error === 'access_denied' ? { status: 'cancelled' } : { status: 'error', message: errorMessage };

  try {
    if (parsed.code) {
      if (handledCodes.has(parsed.code)) return { status: 'signed-in' };
      handledCodes.add(parsed.code);
      const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
      if (error) {
        // Another window/path may have already exchanged it; a session means we're fine.
        const { data } = await supabase.auth.getSession();
        if (data.session) return { status: 'signed-in' };
        return { status: 'error', message: networkMessage(error) };
      }
      return { status: 'signed-in' };
    }

    if (parsed.accessToken && parsed.refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
      return error ? { status: 'error', message: networkMessage(error) } : { status: 'signed-in' };
    }
  } catch (error) {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (data.session) return { status: 'signed-in' };
    return { status: 'error', message: networkMessage(error) };
  }

  return { status: 'error', message: 'Sign-in didn’t finish. Please try again.' };
}

export async function signInWithGoogle(): Promise<OAuthResult> {
  if (!supabase) return { status: 'error', message: 'Sign-in is not configured for this build.' };
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) return { status: 'error', message: error?.message || 'Could not start Google sign-in.' };

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  } catch (error) {
    // e.g. the browser blocked the popup in the web preview.
    return { status: 'error', message: error instanceof Error ? error.message : 'Google sign-in didn’t open.' };
  }
  if (result.type === 'success') return completeSignInFromUrl(result.url);
  if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
  return { status: 'error', message: 'Google sign-in didn’t open. Please try again.' };
}

// ── Email magic link ─────────────────────────────────────────────────────────
// Supabase emails a link → it opens sproutcue://auth/callback?code=… on this phone →
// src/app/auth/callback.tsx exchanges the code (PKCE, so it must be the same device).
// If the email also shows a one-time code (Supabase email template {{ .Token }}),
// it can be typed in instead, which works even if the email was opened elsewhere.

export type EmailResult = { status: 'sent' } | { status: 'signed-in' } | { status: 'error'; message: string; retryAfter?: number };

export async function sendMagicLink(email: string): Promise<EmailResult> {
  if (!supabase) return { status: 'error', message: 'Sign-in is not configured for this build.' };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: authRedirectUrl(),
        // Same as the web app: a new email address gets a new SproutCue account.
        shouldCreateUser: true,
      },
    });
    if (error) {
      const message = emailSignInErrorMessage(error);
      return { status: 'error', message, retryAfter: /wait \d+/.test(message) ? emailRetryAfterSeconds(error.message) : undefined };
    }
    return { status: 'sent' };
  } catch (error) {
    return { status: 'error', message: emailSignInErrorMessage(error) };
  }
}

export async function verifyEmailCode(email: string, code: string): Promise<EmailResult> {
  if (!supabase) return { status: 'error', message: 'Sign-in is not configured for this build.' };
  try {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: normalizeEmailCode(code), type: 'email' });
    return error ? { status: 'error', message: emailSignInErrorMessage(error) } : { status: 'signed-in' };
  } catch (error) {
    return { status: 'error', message: emailSignInErrorMessage(error) };
  }
}
