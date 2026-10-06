import { describe, expect, it } from 'vitest';
import { buildPracticeStoryPrompt, normalizePracticeStory, PLAYGROUND_PRACTICE_GOALS, PRACTICE_STORY_SCHEMA, PRACTICE_STORY_TOPICS } from '../lib/family-practice-stories.js';
import {
  PRACTICE_STORY_CHALLENGES, PRACTICE_STORY_LENGTHS, PRACTICE_STORY_PARENT_GOALS, PRACTICE_STORY_THEMES,
  challengeFromPracticingStep, practiceStoryChallenge, practiceStoryLength, practiceStoryParentGoals, practiceStoryTheme,
} from '../lib/practice-story-options.js';
import { FAVORITE_INTEREST_OPTIONS } from '../lib/profile-defaults.js';

describe('family practice stories', () => {
  it('offers age-banded birth-to-five routine topics', () => {
    expect(PRACTICE_STORY_TOPICS.some((topic) => topic.id === 'wash-hands')).toBe(true);
    expect(PRACTICE_STORY_TOPICS.some((topic) => topic.id === 'sleep-own-space')).toBe(true);
    expect(PRACTICE_STORY_TOPICS.every((topic) => topic.minMonths >= 0 && topic.maxMonths <= 71)).toBe(true);
  });

  it('requires a structured sequence and caregiver support', () => {
    expect(PRACTICE_STORY_SCHEMA.required).toContain('scenes');
    expect(PRACTICE_STORY_SCHEMA.required).toContain('caregiverTips');
    expect(PRACTICE_STORY_SCHEMA.required).toContain('mission');
    expect(PRACTICE_STORY_SCHEMA.required).toContain('reflectionQuestions');
    expect(PRACTICE_STORY_SCHEMA.properties.scenes.minItems).toBe(3);
    expect(PRACTICE_STORY_SCHEMA.properties.scenes.maxItems).toBe(10);
    expect(PRACTICE_STORY_SCHEMA.properties.scenes.items.required).toContain('sayTogether');
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
    expect(result.readAloudMinutes).toBe(10);
    expect(result.scenes[0].heading).toBe('Stop one');
  });

  it('keeps the story brief and new adventure fields when normalizing', () => {
    const result = normalizePracticeStory({ title: 'Rocket Brush', mission: ' Fly to Planet Sparkle. ', scenes: [{ heading: 'Countdown', storyText: 'Ready?', practiceCue: 'Count to three.', sayTogether: ' 3, 2, 1, brush! ' }], reflectionQuestions: ['What was brave?', ''], brief: { challenge: 'brushing-teeth', parentGoals: ['speech', 'nope'], storyTheme: 'space', adventureLength: 'giant' } });
    expect(result.mission).toBe('Fly to Planet Sparkle.');
    expect(result.scenes[0].sayTogether).toBe('3, 2, 1, brush!');
    expect(result.reflectionQuestions).toEqual(['What was brave?']);
    expect(result.brief).toEqual({ challenge: 'brushing-teeth', parentGoals: ['speech'], storyTheme: 'space', adventureLength: 'medium' });
  });
});

describe('practice story options', () => {
  it('offers the challenge, parent goal, theme, and favorite tags', () => {
    expect(PRACTICE_STORY_CHALLENGES.map((item) => item.label)).toEqual(['🌙 Bedtime', '🌅 Morning', '🪥 Brushing Teeth', '🛁 Bath', '🧸 Cleaning Toys', '🚽 Toilet Training', '🎒 School', '💛 Emotional Regulation']);
    expect(PRACTICE_STORY_PARENT_GOALS.map((item) => item.label)).toEqual(['🌟 Confidence', '💪 Independence', '✅ Responsibility', '🗣️ Speech', '🥗 Healthy Habits', '💛 Emotional Regulation']);
    expect(PRACTICE_STORY_THEMES.map((item) => item.label)).toEqual(['🗺️ Adventure', '🎯 Mission', '💎 Treasure Hunt', '✨ Magic', '🚀 Space', '🦁 Safari', '🏰 Fantasy']);
    const favorites = FAVORITE_INTEREST_OPTIONS.map(([, label]) => label);
    ['🚒 Fire Engines', '👑 Princess', '🏴‍☠️ Pirates', '🐬 Ocean', '🦄 Unicorn', '🚧 Construction', '🐾 Animals', '🚀 Space', '🎵 Music'].forEach((label) => expect(favorites).toContain(label));
  });

  it('maps adventure lengths to step ranges', () => {
    expect(PRACTICE_STORY_LENGTHS.map(({ id, minSteps, maxSteps }) => [id, minSteps, maxSteps])).toEqual([['short', 3, 4], ['medium', 5, 7], ['long', 8, 10]]);
    expect(practiceStoryLength('unknown').id).toBe('medium');
  });

  it('validates tag ids and limits parent goals to two', () => {
    expect(practiceStoryChallenge('bath')?.goal).toBeTruthy();
    expect(practiceStoryChallenge('juggling')).toBeNull();
    expect(practiceStoryTheme('safari')?.id).toBe('safari');
    expect(practiceStoryParentGoals('speech,confidence,independence').map((item) => item.id)).toEqual(['speech', 'confidence']);
    expect(challengeFromPracticingStep('potty learning')?.id).toBe('toilet-training');
  });

  it('builds a prompt that carries every story input', () => {
    const prompt = buildPracticeStoryPrompt({
      childName: 'Aaron', ageMonths: 36, goal: 'Brush teeth with a grown-up', challenge: practiceStoryChallenge('brushing-teeth'),
      interests: ['fire engines', 'pirates'], parentGoals: practiceStoryParentGoals(['speech', 'independence']),
      theme: practiceStoryTheme('treasure-hunt'), length: practiceStoryLength('long'), language: 'en',
    });
    expect(prompt).toContain('Brushing Teeth');
    expect(prompt).toContain('fire engines, pirates');
    expect(prompt).toContain('Support speech');
    expect(prompt).toContain('Build independence');
    expect(prompt).toContain('treasure hunt');
    expect(prompt).toContain('8–10 scenes');
    expect(prompt).toContain('readAloudMinutes: 6');
  });
});
