import { createUser, findUserByEmail, mutateStore, normalizeEmail, updateUser } from '../../../../lib/backend.js';

export const runtime = 'nodejs';

export async function POST(request) {
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

  return Response.json({ user });
}
