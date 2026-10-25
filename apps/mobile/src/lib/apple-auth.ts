import * as AppleAuthentication from 'expo-apple-authentication';

import type { OAuthResult } from './oauth';
import { supabase } from './supabase';

// Sign in with Apple (iOS only — imported only by apple-button.ios.tsx).
// 1. Apple's native sheet returns an identity token (a JWT signed by Apple).
// 2. Supabase verifies it and signs the parent in: signInWithIdToken({ provider: 'apple' }).
// 3. Apple sends the parent's name ONLY on the very first sign-in, and never in the token,
//    so it's saved to the Supabase user's metadata right away (full_name, like Google).
//
// Supabase → Authentication → Providers → Apple: enable it and add the app's bundle ID
// (com.sproutcue.app) under Client IDs so tokens issued to the app are accepted.

export function isAppleSignInAvailable() {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

function nameParts(name: AppleAuthentication.AppleAuthenticationFullName | null) {
  const given = name?.givenName?.trim() || '';
  const family = name?.familyName?.trim() || '';
  const full = [given, name?.middleName?.trim(), family].filter(Boolean).join(' ');
  return full ? { full_name: full, name: full, given_name: given || undefined, family_name: family || undefined } : null;
}

export async function signInWithApple(): Promise<OAuthResult> {
  if (!supabase) return { status: 'error', message: 'Sign-in is not configured for this build.' };

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (error) {
    if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return { status: 'error', message: error instanceof Error ? error.message : 'Sign in with Apple didn’t finish. Please try again.' };
  }
  if (!credential.identityToken) return { status: 'error', message: 'Apple didn’t return a sign-in token. Please try again.' };

  try {
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) {
      const text = error.message || '';
      return {
        status: 'error',
        message: /fetch|network/i.test(text) ? 'Couldn’t reach the sign-in service. Check your connection and try again.' : text || 'Sign in with Apple didn’t finish. Please try again.',
      };
    }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Sign in with Apple didn’t finish. Please try again.' };
  }

  // First sign-in only: keep the name Apple shared now — it won't be sent again.
  const name = nameParts(credential.fullName);
  if (name) {
    try {
      const { error } = await supabase.auth.updateUser({ data: name });
      if (error) console.warn('[apple-auth] Could not save name from Apple:', error.message);
    } catch (error) {
      console.warn('[apple-auth] Could not save name from Apple:', error);
    }
  }
  return { status: 'signed-in' };
}
