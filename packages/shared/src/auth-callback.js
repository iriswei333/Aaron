// Reads the redirect URL Supabase sends back after Google (or any OAuth) sign-in.
// Works for app deep links (sproutcue://auth/callback?code=…), Expo Go links
// (exp://192.168.1.20:8081/--/auth/callback?code=…) and web URLs.
//
// PKCE flow:     ?code=…                         → exchangeCodeForSession(code)
// Implicit flow: #access_token=…&refresh_token=… → setSession(tokens)
// Errors:        ?error=…&error_description=…   (query or hash)

function paramsFrom(text) {
  const params = {};
  if (!text) return params;
  for (const pair of text.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    const decode = (value) => {
      try {
        return decodeURIComponent(value.replace(/\+/g, ' '));
      } catch {
        return value;
      }
    };
    params[decode(rawKey)] = decode(rest.join('='));
  }
  return params;
}

/**
 * @param {string} url
 * @returns {{ code: string, accessToken: string, refreshToken: string, error: string, errorDescription: string }}
 */
export function parseAuthCallbackUrl(url) {
  const value = String(url || '');
  const hashIndex = value.indexOf('#');
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  const params = { ...paramsFrom(query), ...paramsFrom(hash) };
  return {
    code: params.code || '',
    accessToken: params.access_token || '',
    refreshToken: params.refresh_token || '',
    error: params.error || params.error_code || '',
    errorDescription: params.error_description || '',
  };
}

/** A friendly message for an OAuth error, or '' when there is none. */
export function authCallbackErrorMessage(parsed) {
  if (!parsed?.error && !parsed?.errorDescription) return '';
  if (parsed.error === 'access_denied') return 'Google sign-in was cancelled.';
  return parsed.errorDescription || 'Sign-in didn’t finish. Please try again.';
}
