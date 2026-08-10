import { profileErrorResponse, getCurrentProfile } from '../../../lib/profile-session.js';
import { mutateStore, readStore } from '../../../lib/backend.js';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

const EVENT_KINDS = new Set(['grocery', 'logistics', 'external_event', 'playdate']);
const RECURRING_KINDS = new Set(['grocery', 'logistics']);

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeEvent(input = {}) {
  const kind = cleanText(input.kind, 'external_event');
  if (!EVENT_KINDS.has(kind)) throw new Error('Invalid family event kind.');
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
    source: cleanText(input.source, 'user'),
    external_id: input.externalId ? cleanText(input.externalId) : null,
    venue: cleanText(input.venue),
    url: cleanText(input.url),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  };
}

function normalizeRecurring(input = {}) {
  const kind = cleanText(input.kind);
  if (!RECURRING_KINDS.has(kind)) throw new Error('Invalid recurring item kind.');
  const title = cleanText(input.title);
  if (!title) throw new Error('Recurring item title is required.');
  return {
    child_id: input.childId ? cleanText(input.childId) : null,
    kind,
    title,
    recurrence_rule: input.recurrenceRule && typeof input.recurrenceRule === 'object' ? input.recurrenceRule : {},
    next_due_date: input.nextDueDate || null,
    last_completed_at: input.lastCompletedAt || null,
    active: input.active !== false,
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

function serializeRecurring(row) {
  return {
    id: row.id,
    childId: row.child_id,
    kind: row.kind,
    title: row.title,
    recurrenceRule: row.recurrence_rule || {},
    nextDueDate: row.next_due_date,
    lastCompletedAt: row.last_completed_at,
    active: row.active,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readPlans(current) {
  if (current.mode !== 'supabase') {
    const store = await readStore();
    return {
      events: store.familyEvents.filter((item) => item.profile_id === current.localUserId).map(serializeEvent),
      recurringItems: store.familyRecurringItems.filter((item) => item.profile_id === current.localUserId).map(serializeRecurring),
    };
  }
  const [events, recurring] = await Promise.all([
    current.supabase.from('family_events').select('*').order('starts_at', { ascending: true, nullsFirst: false }).order('due_date', { ascending: true, nullsFirst: false }),
    current.supabase.from('family_recurring_items').select('*').order('next_due_date', { ascending: true, nullsFirst: false }),
  ]);
  if (events.error) throw new Error(events.error.message);
  if (recurring.error) throw new Error(recurring.error.message);
  return {
    events: (events.data || []).map(serializeEvent),
    recurringItems: (recurring.data || []).map(serializeRecurring),
  };
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    return Response.json({ ...(await readPlans(current)), authMode: current.mode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    const table = body.type === 'recurring' ? 'family_recurring_items' : 'family_events';
    const value = body.type === 'recurring' ? normalizeRecurring(body.item) : normalizeEvent(body.item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      const data = { ...value, id: randomUUID(), profile_id: current.localUserId, created_at: now, updated_at: now };
      await mutateStore((store) => { (body.type === 'recurring' ? store.familyRecurringItems : store.familyEvents).push(data); });
      return Response.json({ item: body.type === 'recurring' ? serializeRecurring(data) : serializeEvent(data) }, { status: 201 });
    }
    const { data, error } = await current.supabase.from(table).insert({ ...value, profile_id: current.authUser.id }).select('*').single();
    if (error) throw new Error(error.message);
    return Response.json({ item: body.type === 'recurring' ? serializeRecurring(data) : serializeEvent(data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json();
    if (!body.id) throw new Error('Family plan item id is required.');
    const recurring = body.type === 'recurring';
    const table = recurring ? 'family_recurring_items' : 'family_events';
    const value = recurring ? normalizeRecurring(body.item) : normalizeEvent(body.item);
    if (current.mode !== 'supabase') {
      const now = new Date().toISOString();
      let data = null;
      await mutateStore((store) => {
        const rows = recurring ? store.familyRecurringItems : store.familyEvents;
        const index = rows.findIndex((item) => item.id === body.id && item.profile_id === current.localUserId);
        if (index < 0) return;
        rows[index] = { ...rows[index], ...value, updated_at: now };
        data = rows[index];
      });
      if (!data) throw new Error('Family plan item not found.');
      return Response.json({ item: recurring ? serializeRecurring(data) : serializeEvent(data) });
    }
    const { data, error } = await current.supabase.from(table).update(value).eq('id', body.id).eq('profile_id', current.authUser.id).select('*').single();
    if (error) throw new Error(error.message);
    return Response.json({ item: recurring ? serializeRecurring(data) : serializeEvent(data) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const url = new URL(request.url);
    const table = url.searchParams.get('type') === 'recurring' ? 'family_recurring_items' : 'family_events';
    const id = url.searchParams.get('id');
    if (!id) throw new Error('Family plan item id is required.');
    if (current.mode !== 'supabase') {
      await mutateStore((store) => {
        const rows = table === 'family_recurring_items' ? store.familyRecurringItems : store.familyEvents;
        const index = rows.findIndex((item) => item.id === id && item.profile_id === current.localUserId);
        if (index >= 0) rows.splice(index, 1);
      });
      return Response.json({ ok: true });
    }
    const { error } = await current.supabase.from(table).delete().eq('id', id).eq('profile_id', current.authUser.id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
