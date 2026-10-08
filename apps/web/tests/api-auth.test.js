import { describe, expect, it } from 'vitest';
import { allowedOrigins, corsHeadersFor } from '../lib/cors.js';
import { bearerTokenFromHeader } from '../lib/supabase/server.js';

describe('mobile API auth helpers', () => {
  it('reads a bearer token from the Authorization header', () => {
    expect(bearerTokenFromHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerTokenFromHeader('bearer xyz')).toBe('xyz');
    expect(bearerTokenFromHeader('Basic abc')).toBe('');
    expect(bearerTokenFromHeader('')).toBe('');
    expect(bearerTokenFromHeader(null)).toBe('');
  });

  it('allows the Expo web dev origin only outside production', () => {
    expect(allowedOrigins({ NODE_ENV: 'development' })).toContain('http://localhost:8081');
    expect(allowedOrigins({ NODE_ENV: 'production' })).toEqual([]);
    expect(allowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://a.example, https://b.example' }))
      .toEqual(['https://a.example', 'https://b.example']);
  });

  it('returns CORS headers only for allowed origins', () => {
    const env = { NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://a.example' };
    expect(corsHeadersFor('https://a.example', env)['Access-Control-Allow-Origin']).toBe('https://a.example');
    expect(corsHeadersFor('https://evil.example', env)).toBeNull();
    expect(corsHeadersFor(null, env)).toBeNull();
  });
});
