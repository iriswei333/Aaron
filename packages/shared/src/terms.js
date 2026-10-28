// Terms of Use — shared by the web sign-in, the mobile sign-in and the /terms page.
//
// TERMS_VERSION is the date of the current terms. When the terms change in a way
// families must re-accept, bump it here AND add a migration that changes the
// default of public.profiles.terms_version (see 202610270002_terms_acceptance.sql).

export const TERMS_VERSION = '2026-10-28';
/** TERMS_VERSION written out for the /terms page. */
export const TERMS_EFFECTIVE_DATE = 'October 28, 2026';
export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';

/** General help, account and privacy requests. */
export const SUPPORT_EMAIL = 'support@sproutcue.com';
/** Reports, safety concerns, objectionable content. */
export const SAFETY_EMAIL = 'safety@sproutcue.com';

/** Web origin from the API base URL ("https://app.sproutcue.com/api" → "https://app.sproutcue.com"). */
export function siteUrlFromApiBase(apiBaseUrl) {
  return String(apiBaseUrl || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export function termsUrl(apiBaseUrl) {
  const site = siteUrlFromApiBase(apiBaseUrl);
  return site ? `${site}${TERMS_PATH}` : '';
}

export function privacyUrl(apiBaseUrl) {
  const site = siteUrlFromApiBase(apiBaseUrl);
  return site ? `${site}${PRIVACY_PATH}` : '';
}
