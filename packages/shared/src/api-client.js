// Small fetch wrapper shared by the web app and the mobile app.
//
// Web:    createApiClient({ baseUrl: '/api' })                 → cookies carry the session
// Mobile: createApiClient({ baseUrl: 'https://…/api',
//                           getAccessToken: () => session?.access_token })
//         → sends `Authorization: Bearer <token>` because native apps have no browser cookies.

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function isFormData(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

export function joinApiUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const suffix = String(path || '');
  if (/^https?:\/\//i.test(suffix)) return suffix;
  return `${base}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
}

/**
 * Turns a server-relative link from an API response (e.g. a photo's
 * `/api/family-assets/photos/content?photoId=…`) into a URL the app can open.
 * Web (baseUrl '/api') keeps the path as-is; mobile (baseUrl 'https://host/api')
 * gets 'https://host/api/family-assets/…'.
 * @param {string} baseUrl
 * @param {string} path
 */
export function resolveServerUrl(baseUrl, path) {
  const value = String(path || '');
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value; // already absolute (https:, data:, file:…)
  if (!value.startsWith('/')) return joinApiUrl(baseUrl, value);
  const match = String(baseUrl || '').match(/^(https?:\/\/[^/]+)/i);
  return match ? `${match[1]}${value}` : value;
}

/**
 * @typedef {object} ApiClientOptions
 * @property {string} [baseUrl] API root, e.g. '/api' on web or 'https://…/api' on mobile.
 * @property {(() => string | null | undefined | Promise<string | null | undefined>) | null} [getAccessToken]
 *   Returns the Supabase access token; sent as `Authorization: Bearer …` when present.
 * @property {(() => Record<string, string> | null | undefined | Promise<Record<string, string> | null | undefined>) | null} [getHeaders]
 *   Extra headers added to every request.
 * @property {typeof fetch | null} [fetchImpl] Custom fetch (tests).
 * @property {number} [timeoutMs] Abort requests after this many milliseconds (0 = no timeout).
 */

/**
 * @param {ApiClientOptions} [options]
 * @returns {{ baseUrl: string, request: (path: string, options?: Record<string, any>) => Promise<any>, resolveUrl: (path: string) => string }}
 */
export function createApiClient({
  baseUrl = '/api',
  getAccessToken = null,
  getHeaders = null,
  fetchImpl = null,
  timeoutMs = 0,
} = {}) {
  async function request(path, options = {}) {
    const doFetch = fetchImpl || globalThis.fetch;
    if (typeof doFetch !== 'function') throw new ApiError('fetch is not available in this environment.');

    const { body: rawBody, headers: extraHeaders, timeoutMs: requestTimeout, ...rest } = options;
    const body = isPlainObject(rawBody) || Array.isArray(rawBody) ? JSON.stringify(rawBody) : rawBody;
    const token = typeof getAccessToken === 'function' ? await getAccessToken() : '';
    const headers = {
      ...(isFormData(body) ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(typeof getHeaders === 'function' ? (await getHeaders()) || {} : {}),
      ...(extraHeaders || {}),
    };

    const limit = requestTimeout ?? timeoutMs;
    const controller = limit > 0 && typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), limit) : null;
    let response;
    try {
      response = await doFetch(joinApiUrl(baseUrl, path), {
        ...rest,
        ...(body === undefined ? {} : { body }),
        headers,
        ...(controller && !rest.signal ? { signal: controller.signal } : {}),
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new ApiError('The request timed out. Please try again.', { status: 0 });
      throw new ApiError(error?.message || 'Network request failed.', { status: 0 });
    } finally {
      if (timer) clearTimeout(timer);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(data?.error || `Request failed with ${response.status}`, { status: response.status, data });
    }
    return data;
  }

  return { baseUrl, request, resolveUrl: (path) => resolveServerUrl(baseUrl, path) };
}
