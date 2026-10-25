import { createSupabaseAdminClient } from './supabase/server.js';

// Buckets whose objects live under `<userId>/...`. Database rows are removed by
// `on delete cascade` from auth.users -> profiles -> every user table, but
// Storage files are not rows we own, so they are removed here explicitly.
export const ACCOUNT_STORAGE_BUCKETS = ['family-assets'];

const LIST_PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

function deletionError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Storage `list` is one folder deep; folders come back with `id: null`.
export async function listStoragePaths(storage, bucket, prefix) {
  const paths = [];
  const folders = [prefix];
  while (folders.length) {
    const folder = folders.pop();
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await storage.from(bucket).list(folder, { limit: LIST_PAGE_SIZE, offset });
      if (error) throw deletionError(`Could not list ${bucket}/${folder}: ${error.message}`);
      for (const entry of data || []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) paths.push(path);
        else folders.push(path);
      }
      if (!data || data.length < LIST_PAGE_SIZE) break;
    }
  }
  return paths;
}

export async function removeUserStorage(storage, userId, buckets = ACCOUNT_STORAGE_BUCKETS) {
  let removed = 0;
  for (const bucket of buckets) {
    const paths = await listStoragePaths(storage, bucket, userId);
    for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
      const batch = paths.slice(index, index + REMOVE_BATCH_SIZE);
      const { error } = await storage.from(bucket).remove(batch);
      if (error) throw deletionError(`Could not delete files in ${bucket}: ${error.message}`);
      removed += batch.length;
    }
  }
  return removed;
}

// Permanently deletes the Supabase account. Files go first so that, if that step
// fails, the account still exists and the user can simply try again. Deleting the
// auth user then cascades to profiles and every table that references it.
export async function deleteSupabaseAccount(authUser, { admin = createSupabaseAdminClient() } = {}) {
  const userId = authUser?.id;
  if (!userId) throw deletionError('No signed-in account to delete.', 401);
  if (!admin) throw deletionError('Account deletion is not configured on the server (SUPABASE_SERVICE_ROLE_KEY is missing).', 503);

  const removedFiles = await removeUserStorage(admin.storage, userId);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw deletionError(`Could not delete the account: ${error.message}`);

  return { removedFiles };
}
