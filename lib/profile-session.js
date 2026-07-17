import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  LOCAL_USER_COOKIE,
  ensureSupabaseProfile,
  mutateStore,
  readStore,
  updateSupabaseProfileField,
  updateUser,
  writeSupabasePost,
} from './backend.js';
import { getAuthenticatedSupabaseUser } from './supabase/server.js';

export async function getCurrentProfile(request, options = {}) {
  const auth = await getAuthenticatedSupabaseUser();
  if (auth.configured) {
    if (!auth.user) {
      return { mode: 'supabase', status: 401, error: 'Sign in to access this profile.' };
    }

    const user = await ensureSupabaseProfile(auth.supabase, auth.user, options);
    return { mode: 'supabase', supabase: auth.supabase, authUser: auth.user, user };
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(LOCAL_USER_COOKIE)?.value
    || request?.headers.get('x-aaron-local-user-id')
    || '';
  if (!userId) {
    return { mode: 'local', status: 401, error: 'Choose a local family profile.' };
  }

  const store = await readStore();
  const user = store.users[userId] || null;
  if (!user) {
    return { mode: 'local', status: 401, error: 'Choose a local family profile.' };
  }

  return { mode: 'local', localUserId: userId, user };
}

export async function updateCurrentProfileDisplayName(request, displayName) {
  const trimmed = String(displayName || '').trim();
  const current = await getCurrentProfile(request, { displayName: trimmed });
  if (!current.user) return current;
  if (!trimmed) return current;

  if (current.mode === 'supabase') {
    return current;
  }

  const user = await mutateStore((store) => {
    const target = store.users[current.localUserId];
    if (!target) return null;
    return updateUser(target, { displayName: trimmed });
  });

  if (!user) return { ...current, user: null, status: 401, error: 'Choose a local family profile.' };
  return { ...current, user };
}

export async function updateCurrentProfileField(request, field, body) {
  const current = await getCurrentProfile(request);
  if (!current.user) return current;

  if (current.mode === 'supabase') {
    const user = await updateSupabaseProfileField(current.supabase, current.authUser, field, body);
    return { ...current, user };
  }

  const user = await mutateStore((store) => {
    const target = store.users[current.localUserId];
    if (!target) return null;
    const value = field === 'location' ? body : { ...target[field], ...body };
    return updateUser(target, { [field]: value });
  });

  if (!user) return { ...current, user: null, status: 401, error: 'Choose a local family profile.' };
  return { ...current, user };
}

export async function writeCurrentPost(request, payload, result) {
  const current = await getCurrentProfile(request);
  if (!current.user) return current;

  if (current.mode === 'supabase') {
    await writeSupabasePost(current.supabase, current.authUser, payload, result);
    return current;
  }

  await mutateStore((store) => {
    store.posts.unshift({
      id: randomUUID(),
      userId: current.localUserId,
      fileName: payload.fileName || 'media',
      mediaType: payload.mediaType || 'video',
      tone: payload.tone || '温柔可爱',
      caption: result.caption,
      source: result.source,
      createdAt: new Date().toISOString(),
    });
    store.posts = store.posts.slice(0, 100);
  });

  return current;
}

export function profileErrorResponse(current) {
  return Response.json({ error: current.error || 'Profile unavailable.' }, { status: current.status || 500 });
}
