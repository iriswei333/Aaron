import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  LEGACY_LOCAL_USER_COOKIE,
  LOCAL_USER_COOKIE,
  ensureSupabaseProfile,
  mutateStore,
  readStore,
  updateSupabaseProfileField,
  updateUser,
  writeSupabasePost,
} from './backend.js';
import { getChildProfile, normalizeChildProfile } from './profile-defaults.js';
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
    || cookieStore.get(LEGACY_LOCAL_USER_COOKIE)?.value
    || request?.headers.get('x-sproutcue-local-user-id')
    || request?.headers.get('x-aaron-local-user-id')
    || '';
  if (!userId) {
    return { mode: 'local', status: 401, error: 'Choose a local family profile.' };
  }

  const store = await readStore();
  const storedUser = store.users[userId] || null;
  const user = storedUser
    ? {
      ...storedUser,
      displayName: storedUser.displayName || 'Family Profile',
      childProfile: normalizeChildProfile(storedUser.childProfile),
    }
    : null;
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

export async function updateCurrentProfileDetails(request, body = {}) {
  const trimmedDisplayName = String(body.displayName || '').trim();
  const childProfileInput = body.childProfile && typeof body.childProfile === 'object'
    ? body.childProfile
    : null;

  const current = await getCurrentProfile(request, { displayName: trimmedDisplayName });
  if (!current.user) return current;

  const patch = {};
  if (trimmedDisplayName) patch.displayName = trimmedDisplayName;
  if (childProfileInput) {
    patch.childProfile = normalizeChildProfile(childProfileInput, current.user.childProfile);
  }

  if (Object.keys(patch).length === 0) return current;

  if (current.mode === 'supabase') {
    const updates = { updated_at: new Date().toISOString() };
    if (patch.displayName) updates.display_name = patch.displayName;
    if (patch.childProfile) updates.child_profile = patch.childProfile;

    const { data, error } = await current.supabase
      .from('profiles')
      .update(updates)
      .eq('id', current.authUser.id)
      .select('id, email, display_name, child_profile, social_links, location, food_plan, amazon_errands, created_at, updated_at')
      .single();

    if (error) throw new Error(error.message || 'Could not update the profile.');

    return {
      ...current,
      user: {
        id: data.id,
        email: data.email || '',
        displayName: data.display_name || 'Family Profile',
        childProfile: normalizeChildProfile(data.child_profile),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        socialLinks: data.social_links || { icloudPhotosUrl: '', instagramUrl: '', tiktokUrl: '' },
        location: data.location,
        foodPlan: data.food_plan || { favorites: ['peas', 'broccoli', 'banana'], weeklyMenu: [] },
        amazonErrands: data.amazon_errands || { tasks: [], outfitIdeas: [] },
      },
    };
  }

  const user = await mutateStore((store) => {
    const target = store.users[current.localUserId];
    if (!target) return null;
    return updateUser(target, patch);
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
    const value = field === 'location'
      ? body
      : field === 'childProfile'
        ? normalizeChildProfile(body, target.childProfile)
        : { ...target[field], ...body };
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
      tone: payload.tone || getChildProfile(current.user).captionTone || '温柔可爱',
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
