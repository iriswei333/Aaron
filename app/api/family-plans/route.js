import { profileErrorResponse, getCurrentProfile } from '../../../lib/profile-session.js';
import { mutateStore, readStore } from '../../../lib/backend.js';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeEvent(input = {}) {
  const kind = cleanText(input.kind, 'external_event');
  if (kind !== 'external_event') throw new Error('Only weekend events can be saved in family plans.');
  const status = cleanText(input.status, 'planned');
  if (!['planned', 'attending', 'completed', 'cancelled'].includes(status)) throw new Error('Invalid family event status.');
  const title = cleanText(input.title);
  if (!title) throw new Error('Family event title is required.');
  return {
    child_id: input.childId ? cleanText(input.childId) : null,
    kind,
    title,
    summary: cleanText(input.summary),
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    due_date: input.dueDate || null,
    status,
    source: cleanText(input.source, 'parentmap'),
    external_id: input.externalId ? cleanText(input.externalId) : null,
    venue: cleanText(input.venue),
    url: cleanText(input.url),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
}

function serializeEvent(row) {
  return {
    id: row.id,
    childId: row.child_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    dueDate: row.due_date,
    status: row.status,
    source: row.source,
    externalId: row.external_id,
    venue: row.venue || '',
    url: row.url || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readEvents(current) {
  if (current.mode !== 'supabase') {
    const store = await readStore();
    return store.familyEvents
      .filter((item) => item.profile_id === current.localUserId && item.kind === 'external_event')
      .map(serializeEvent);
  }
  const { data, error } = await current.supabase
    .from('family_events')
    .select('*')
    .eq('kind', 'external_event')
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data || []).map(serializeEvent);
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ events: await readEvents(current), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const value = normalizeEvent((await request.json()).item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      const data = { ...value, id: randomUUID(), profile_id: current.localUserId, created_at: now, updated_at: now };
      await mutateStore((store) => { store.familyEvents.push(data); });
      return Response.json({ item: serializeEvent(data) }, { status: 201 });
    }
    const { data, error } = await current.supabase
      .from('family_events')
      .insert({ ...value, profile_id: current.authUser.id })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ item: serializeEvent(data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    if (!body.id) throw new Error('Family event id is required.');
    const value = normalizeEvent(body.item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      let data = null;
      await mutateStore((store) => {
        const index = store.familyEvents.findIndex((item) => item.id === body.id && item.profile_id === current.localUserId);
        if (index < 0) return;
        store.familyEvents[index] = { ...store.familyEvents[index], ...value, updated_at: now };
        data = store.familyEvents[index];
      });
      if (!data) throw new Error('Family event not found.');
      return Response.json({ item: serializeEvent(data) });
    }
    const { data, error } = await current.supabase
      .from('family_events')
      .update(value)
      .eq('id', body.id)
      .eq('profile_id', current.authUser.id)
      .eq('kind', 'external_event')
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ item: serializeEvent(data) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('Family event id is required.');
    if (current.mode !== 'supabase') {
      await mutateStore((store) => {
        const index = store.familyEvents.findIndex((item) => item.id === id && item.profile_id === current.localUserId);
        if (index >= 0) store.familyEvents.splice(index, 1);
      });
      return Response.json({ ok: true });
    }
    const { error } = await current.supabase
      .from('family_events')
      .delete()
      .eq('id', id)
      .eq('profile_id', current.authUser.id)
      .eq('kind', 'external_event');
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
