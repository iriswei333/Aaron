// CORS for the JSON API. Native iOS/Android requests carry no Origin header and
// are not subject to CORS; this only matters for the Expo web preview and other
// browser origins you explicitly allow via CORS_ALLOWED_ORIGINS (comma-separated).
const DEFAULT_DEV_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081'];

export function allowedOrigins(env = process.env) {
  const configured = String(env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return env.NODE_ENV === 'production' ? configured : [...DEFAULT_DEV_ORIGINS, ...configured];
}

export function corsHeadersFor(origin, env = process.env) {
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-sproutcue-local-user-id',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
