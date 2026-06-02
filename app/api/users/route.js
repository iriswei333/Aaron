import { createUser, mutateStore, publicUserSummary, readStore } from '../../../lib/backend.js';

export const runtime = 'nodejs';

export async function GET() {
  const store = await readStore();
  return Response.json({ users: Object.values(store.users).map(publicUserSummary) });
}

export async function POST(request) {
  const body = await request.json();
  const user = await mutateStore((store) => {
    const created = createUser({ displayName: body.displayName, email: body.email });
    store.users[created.id] = created;
    return created;
  });
  return Response.json({ user }, { status: 201 });
}
