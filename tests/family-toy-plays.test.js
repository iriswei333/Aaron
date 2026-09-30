import { describe, expect, it } from 'vitest';
import { normalizeToyPlayAnalysis, normalizeToyPlayLanguage, TOY_PLAY_SCHEMA } from '../lib/family-toy-plays.js';

describe('family toy play assets', () => {
  it('defines ready, not-a-toy, and uncertain structured outcomes', () => {
    expect(TOY_PLAY_SCHEMA.properties.status.enum).toEqual(['ready', 'not_a_toy', 'uncertain']);
    expect(TOY_PLAY_SCHEMA.required).toEqual(['status', 'message', 'toy', 'play']);
  });

  it('normalizes generated plans before persistence', () => {
    const result = normalizeToyPlayAnalysis({
      status: 'ready',
      message: '',
      toy: { name: ' Stacking cups ', category: 'stacking', description: 'Colorful cups', confidence: 'high' },
      play: {
        title: 'Cup delivery', summary: 'Move and stack.', ageRange: '24–36 months', durationMinutes: 99,
        developmentalGoals: ['fine motor', 'color words', 'turn taking', 'extra'],
        materials: ['cups'], steps: ['Place the cups.', 'Stack the cups.'], parentPrompts: ['Where does it go?'],
        easierVariation: 'Use two cups.', harderVariation: 'Sort by color.', safetyNotes: ['Check for cracks.'], supervision: 'Stay within reach.',
      },
    });
    expect(result.toy.name).toBe('Stacking cups');
    expect(result.play.durationMinutes).toBe(45);
    expect(result.play.developmentalGoals).toHaveLength(3);
  });

  it('supports English and Mandarin while defaulting unknown languages to English', () => {
    expect(normalizeToyPlayLanguage('en')).toBe('en');
    expect(normalizeToyPlayLanguage('zh-CN')).toBe('zh-CN');
    expect(normalizeToyPlayLanguage('fr')).toBe('en');
  });
});
