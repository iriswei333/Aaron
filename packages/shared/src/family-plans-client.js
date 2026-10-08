// Saved family plans (events the family chose to attend), shared by web and mobile.

/**
 * @param {(path: string, options?: Record<string, any>) => Promise<any>} request
 */
export function createFamilyPlansClient(request) {
  if (typeof request !== 'function') throw new Error('createFamilyPlansClient needs a request function.');

  function eventRequest(method, body, query = '') {
    return request(`/family-plans${query}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function loadFamilyPlans() {
    return request('/family-plans');
  }

  async function saveFamilyPlan(item) {
    const body = { item };
    if (item.id && item.id.length > 20) {
      return eventRequest('PATCH', { ...body, id: item.id });
    }
    return eventRequest('POST', body);
  }

  async function removeFamilyPlan(id) {
    if (!id) return;
    await eventRequest('DELETE', null, `?id=${encodeURIComponent(id)}`);
  }

  return { loadFamilyPlans, saveFamilyPlan, removeFamilyPlan };
}
