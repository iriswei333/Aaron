import { apiRequest } from './shared.js';

function eventRequest(method, body, query = '') {
  return apiRequest(`/family-plans${query}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function loadFamilyPlans() {
  return apiRequest('/family-plans');
}

export async function savePlannedEvent(item) {
  const body = { type: 'event', item };
  if (item.id && item.id.length > 20) {
    return eventRequest('PATCH', { ...body, id: item.id });
  }
  return eventRequest('POST', body);
}

export async function removePlannedEvent(id) {
  if (!id) return;
  await eventRequest('DELETE', null, `?id=${encodeURIComponent(id)}`);
}
