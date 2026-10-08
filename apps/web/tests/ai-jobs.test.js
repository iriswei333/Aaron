import { describe, expect, it } from 'vitest';
import { DAILY_LIMIT, isUnlimitedAiEmail } from '../lib/ai-jobs.js';

describe('AI generation limits', () => {
  it('limits regular accounts to ten requests per day', () => {
    expect(DAILY_LIMIT).toBe(10);
  });

  it('recognizes only the configured unlimited admin emails', () => {
    expect(isUnlimitedAiEmail('iris333wei@gmail.com')).toBe(true);
    expect(isUnlimitedAiEmail(' 1111IRIS.IRIS@gmail.com ')).toBe(true);
    expect(isUnlimitedAiEmail('parent@example.com')).toBe(false);
  });
});
