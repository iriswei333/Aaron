import { describe, expect, it } from 'vitest';
import { childAgeLabel, normalizeChild, normalizeChildProfile } from '../lib/profile-defaults.js';

describe('single-child family profiles', () => {
  it('normalizes structured personalization fields', () => {
    const child = normalizeChild({
      name: 'Milo',
      ageMonths: 28,
      storyLanguage: 'es',
      favorites: ['Trucks', 'Music'],
      practicingSteps: ['Brushing teeth'],
    });
    expect(child).toMatchObject({
      name: 'Milo',
      ageMonths: 28,
      ageLabel: '28m',
      storyLanguage: 'es',
      favoriteActivities: ['Trucks', 'Music'],
      practicingSteps: ['Brushing teeth'],
    });
    expect(childAgeLabel(child)).toBe('28m');
  });

  it('keeps only the active child from a legacy multi-child profile', () => {
    const profile = normalizeChildProfile({
      activeChildId: 'child-two',
      children: [
        { id: 'child-one', name: 'One', ageMonths: 20 },
        { id: 'child-two', name: 'Two', ageMonths: 32 },
      ],
    });
    expect(profile.children).toHaveLength(1);
    expect(profile.children[0].id).toBe('child-two');
    expect(profile.activeChildId).toBe('child-two');
  });
});
