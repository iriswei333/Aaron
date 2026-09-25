import { profileErrorResponse, getCurrentProfile } from '../../../lib/profile-session.js';
import { mutateStore, readStore } from '../../../lib/backend.js';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
const FAMILY_PLAN_KINDS = ['external_event', 'story_time'];

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

export function normalizeFamilyPlan(input = {}) {
  const kind = cleanText(input.kind, 'external_event');
  if (!FAMILY_PLAN_KINDS.includes(kind)) throw new Error('Family plan kind must be external_event or story_time.');
  const status = cleanText(input.status, 'planned');
  if (!['planned', 'attending', 'completed', 'cancelled'].includes(status)) throw new Error('Invalid family plan status.');
  const title = cleanText(input.title);
  if (!title) throw new Error('Family plan title is required.');
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

function planTimestamp(item) {
  const value = item.startsAt || item.dueDate || item.metadata?.date;
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(item.startsAt || `${item.dueDate || item.metadata.date}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export function sortFamilyPlans(plans) {
  return [...plans].sort((a, b) => planTimestamp(a) - planTimestamp(b));
}

export function serializeFamilyPlan(row) {
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

async function readPlans(current) {
  if (current.mode !== 'supabase') {
    const store = await readStore();
    return sortFamilyPlans(store.familyEvents
      .filter((item) => item.profile_id === current.localUserId && FAMILY_PLAN_KINDS.includes(item.kind))
      .map(serializeFamilyPlan));
  }
  const { data, error } = await current.supabase
    .from('family_events')
    .select('*')
    .in('kind', FAMILY_PLAN_KINDS);
  if (error) throw new Error(error.message);
  return sortFamilyPlans((data || []).map(serializeFamilyPlan));
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const plans = await readPlans(current);
    return Response.json({ plans, events: plans, authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const value = normalizeFamilyPlan((await request.json()).item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      const data = { ...value, id: randomUUID(), profile_id: current.localUserId, created_at: now, updated_at: now };
      await mutateStore((store) => {
        const duplicate = value.external_id && store.familyEvents.some((item) => (
          item.profile_id === current.localUserId
          && item.source === value.source
          && item.external_id === value.external_id
        ));
        if (duplicate) throw new Error('This family plan is already saved.');
        store.familyEvents.push(data);
      });
      return Response.json({ item: serializeFamilyPlan(data) }, { status: 201 });
    }
    const { data, error } = await current.supabase
      .from('family_events')
      .insert({ ...value, profile_id: current.authUser.id })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ item: serializeFamilyPlan(data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    if (!body.id) throw new Error('Family plan id is required.');
    const value = normalizeFamilyPlan(body.item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      let data = null;
      await mutateStore((store) => {
        const index = store.familyEvents.findIndex((item) => item.id === body.id && item.profile_id === current.localUserId);
        if (index < 0) return;
        store.familyEvents[index] = { ...store.familyEvents[index], ...value, updated_at: now };
        data = store.familyEvents[index];
      });
      if (!data) throw new Error('Family plan not found.');
      return Response.json({ item: serializeFamilyPlan(data) });
    }
    const { data, error } = await current.supabase
      .from('family_events')
      .update(value)
      .eq('id', body.id)
      .eq('profile_id', current.authUser.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ item: serializeFamilyPlan(data) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new Error('Family plan id is required.');
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
      .eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
