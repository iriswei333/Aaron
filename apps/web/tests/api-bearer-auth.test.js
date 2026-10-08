import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simulate a request from the mobile app: no cookies, Authorization header only.
const requestHeaders = new Map();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name) => requestHeaders.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

const createdClients = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: (url, key, options) => {
    const client = {
      options,
      auth: {
        getClaims: vi.fn(async (jwt) => (jwt === 'good-token'
          ? { data: { claims: { sub: 'user-1', email: 'parent@example.com', user_metadata: { display_name: 'Nick' } } }, error: null }
          : { data: null, error: new Error('invalid JWT') })),
      },
    };
    createdClients.push(client);
    return client;
  },
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: new Error('no cookie session') }) } }),
}));

vi.mock('../lib/supabase/config.js', () => ({
  supabaseUrl: 'https://project.supabase.co',
  supabasePublishableKey: 'sb_publishable_test',
  isSupabaseConfigured: () => true,
}));

const { getAuthenticatedSupabaseUser, createSupabaseServerClient } = await import('../lib/supabase/server.js');

describe('bearer-token auth for the mobile app', () => {
  beforeEach(() => {
    requestHeaders.clear();
    createdClients.length = 0;
  });

  it('verifies the bearer token and returns the user', async () => {
    requestHeaders.set('authorization', 'Bearer good-token');
    const auth = await getAuthenticatedSupabaseUser();
    expect(auth.user).toEqual({ id: 'user-1', email: 'parent@example.com', displayName: 'Nick' });
    const client = createdClients.at(-1);
    expect(client.auth.getClaims).toHaveBeenCalledWith('good-token');
    // Database queries run as that user, so row-level security applies.
    expect(client.options.global.headers.Authorization).toBe('Bearer good-token');
    expect(client.options.auth.persistSession).toBe(false);
  });

  it('rejects an invalid bearer token', async () => {
    requestHeaders.set('authorization', 'Bearer forged-token');
    const auth = await getAuthenticatedSupabaseUser();
    expect(auth.configured).toBe(true);
    expect(auth.user).toBeNull();
  });

  it('falls back to the cookie session when there is no bearer token', async () => {
    const auth = await getAuthenticatedSupabaseUser();
    expect(auth.user).toBeNull();
    expect(createdClients).toHaveLength(0);
  });

  it('gives token-scoped clients to routes that build their own Supabase client', async () => {
    requestHeaders.set('authorization', 'Bearer good-token');
    const client = await createSupabaseServerClient();
    expect(client.options.global.headers.Authorization).toBe('Bearer good-token');
  });
});
