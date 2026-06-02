import { randomUUID } from 'node:crypto';
import { generateAiCaption, mutateStore, readStore, updateUser } from '../../../../../lib/backend.js';

export const runtime = 'nodejs';

function actionPath(params) {
  return (params.action || []).join('/');
}

async function findUser(params) {
  const store = await readStore();
  return store.users[params.userId] || null;
}

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const user = await findUser(resolvedParams);
  if (!user) return Response.json({ error: 'User not found.' }, { status: 404 });

  if (actionPath(resolvedParams) === 'profile') {
    return Response.json({ user });
  }

  return Response.json({ error: 'User route not found.' }, { status: 404 });
}

export async function PUT(request, { params }) {
  const resolvedParams = await params;
  const body = await request.json();
  const actionToField = {
    'social-links': 'socialLinks',
    location: 'location',
    'food-plan': 'foodPlan',
    'amazon-errands': 'amazonErrands',
  };
  const field = actionToField[actionPath(resolvedParams)];
  if (!field) return Response.json({ error: 'User update route not found.' }, { status: 404 });

  const updated = await mutateStore((draft) => {
    const target = draft.users[resolvedParams.userId];
    if (!target) return null;
    updateUser(target, { [field]: field === 'location' ? body : { ...target[field], ...body } });
    return target;
  });

  if (!updated) return Response.json({ error: 'User not found.' }, { status: 404 });
  return Response.json({ user: updated });
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  if (actionPath(resolvedParams) !== 'social-media/caption') {
    return Response.json({ error: 'User route not found.' }, { status: 404 });
  }

  const user = await findUser(resolvedParams);
  if (!user) return Response.json({ error: 'User not found.' }, { status: 404 });

  const body = await request.json();
  const result = await generateAiCaption(body);
  await mutateStore((draft) => {
    draft.posts.unshift({
      id: randomUUID(),
      userId: resolvedParams.userId,
      fileName: body.fileName || 'media',
      mediaType: body.mediaType || 'video',
      tone: body.tone || '温柔可爱',
      caption: result.caption,
      source: result.source,
      createdAt: new Date().toISOString(),
    });
    draft.posts = draft.posts.slice(0, 100);
  });

  return Response.json(result);
}
