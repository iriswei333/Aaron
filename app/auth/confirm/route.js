import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';

export const runtime = 'nodejs';

function safeRedirectPath(value, fallback = '/?auth=confirmed') {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'));
  const supabase = await createSupabaseServerClient();

  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  if (supabase && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) redirect(next);
  }

  redirect('/?auth=error');
}
