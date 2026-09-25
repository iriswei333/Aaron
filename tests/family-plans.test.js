import { describe, expect, it } from 'vitest';
import { normalizeFamilyPlan, sortFamilyPlans } from '../app/api/family-plans/route.js';

describe('family plans contract', () => {
  it('accepts weekend events and story times', () => {
    expect(normalizeFamilyPlan({ kind: 'external_event', title: 'Festival' }).kind).toBe('external_event');
    expect(normalizeFamilyPlan({ kind: 'story_time', title: 'Toddler Stories', dueDate: '2026-09-24' })).toMatchObject({
      kind: 'story_time',
      due_date: '2026-09-24',
    });
  });

  it('rejects unsupported plan kinds', () => {
    expect(() => normalizeFamilyPlan({ kind: 'grocery', title: 'Milk' })).toThrow(/external_event or story_time/);
  });

  it('sorts startsAt first, then dueDate, with undated plans last', () => {
    const plans = sortFamilyPlans([
      { id: 'undated' },
      { id: 'due', dueDate: '2026-09-25' },
      { id: 'starts', startsAt: '2026-09-24T10:00:00Z' },
    ]);
    expect(plans.map((plan) => plan.id)).toEqual(['starts', 'due', 'undated']);
  });
});
