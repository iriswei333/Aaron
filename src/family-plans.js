import { apiRequest } from './shared.js';

function planRequest(method, body, query = '') {
  return apiRequest(`/family-plans${query}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function loadFamilyPlans() {
  return apiRequest('/family-plans');
}

export async function saveRecurringItem(item) {
  const type = 'recurring';
  const body = { type, item };
  if (item.id && item.id.length > 20) {
    return planRequest('PATCH', { ...body, id: item.id });
  }
  return planRequest('POST', body);
}

export async function removeRecurringItem(id) {
  if (!id) return;
  await planRequest('DELETE', null, `?type=recurring&id=${encodeURIComponent(id)}`);
}

export async function savePlannedEvent(item) {
  const body = { type: 'event', item };
  if (item.id && item.id.length > 20) {
    return planRequest('PATCH', { ...body, id: item.id });
  }
  return planRequest('POST', body);
}

export async function removePlannedEvent(id) {
  if (!id) return;
  await planRequest('DELETE', null, `?type=event&id=${encodeURIComponent(id)}`);
}
