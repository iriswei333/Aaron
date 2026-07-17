import {
  LOCAL_USER_COOKIE,
  createUser,
  findUserByEmail,
  mutateStore,
  normalizeEmail,
  updateUser,
} from '../../../../lib/backend.js';
import { isSupabaseConfigured } from '../../../../lib/supabase/config.js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request) {
  if (isSupabaseConfigured()) {
    return Response.json({ error: 'Supabase auth is enabled. Use the email verification code flow.' }, { status: 400 });
  }

  const body = await request.json();
  const email = normalizeEmail(body.email);
  const displayName = String(body.displayName || '').trim() || 'Aaron Family';

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const user = await mutateStore((store) => {
    const existing = findUserByEmail(store, email);
    if (existing) {
      return updateUser(existing, { displayName: body.displayName ? displayName : existing.displayName, email });
    }

    const created = createUser({ displayName, email });
    store.users[created.id] = created;
    return created;
  });

  const response = NextResponse.json({ user, authMode: 'local' });
  response.cookies.set(LOCAL_USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
