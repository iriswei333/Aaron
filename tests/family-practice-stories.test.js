import { describe, expect, it } from 'vitest';
import { normalizePracticeStory, PLAYGROUND_PRACTICE_GOALS, PRACTICE_STORY_SCHEMA, PRACTICE_STORY_TOPICS } from '../lib/family-practice-stories.js';

describe('family practice stories', () => {
  it('offers age-banded birth-to-five routine topics', () => {
    expect(PRACTICE_STORY_TOPICS.some((topic) => topic.id === 'wash-hands')).toBe(true);
    expect(PRACTICE_STORY_TOPICS.some((topic) => topic.id === 'sleep-own-space')).toBe(true);
    expect(PRACTICE_STORY_TOPICS.every((topic) => topic.minMonths >= 0 && topic.maxMonths <= 71)).toBe(true);
  });

  it('requires a structured sequence and caregiver support', () => {
    expect(PRACTICE_STORY_SCHEMA.required).toContain('scenes');
    expect(PRACTICE_STORY_SCHEMA.required).toContain('caregiverTips');
    expect(PRACTICE_STORY_SCHEMA.properties.scenes.minItems).toBe(4);
  });

  it('offers the three fixed playground practice goals', () => {
    expect(PLAYGROUND_PRACTICE_GOALS.map((goal) => goal.id)).toEqual([
      'making-friends',
      'washing-hands',
      'leaving-playground',
    ]);
  });

  it('normalizes generated story content before saving', () => {
    const result = normalizePracticeStory({ title: '  Bubble Bus ', summary: ' Wash together. ', goal: 'Wash hands', ageRange: '2–3', theme: 'Bus', readAloudMinutes: 99, scenes: [{ heading: 'Stop one', storyText: 'Turn on water.', practiceCue: 'Point to the tap.' }], celebration: 'We tried!', caregiverTips: ['Model it.', 'Keep it playful.'] });
    expect(result.title).toBe('Bubble Bus');
    expect(result.readAloudMinutes).toBe(8);
    expect(result.scenes[0].heading).toBe('Stop one');
  });
});
