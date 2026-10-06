// Tag options for the practice story maker. Shared by the Play Studio form (browser)
// and the story generator (server) so labels, ids, and AI guidance never drift apart.

export const PRACTICE_STORY_CHALLENGES = [
  { id: 'bedtime', label: '🌙 Bedtime', goal: 'Follow the bedtime routine and settle down to sleep', aliases: ['bedtime', 'sleep-routine', 'sleep-own-space'] },
  { id: 'morning', label: '🌅 Morning', goal: 'Get ready step by step in the morning routine', aliases: ['morning', 'get-dressed', 'follow-routine'] },
  { id: 'brushing-teeth', label: '🪥 Brushing Teeth', goal: 'Brush teeth with a grown-up', aliases: ['brushing teeth', 'brush-teeth'] },
  { id: 'bath', label: '🛁 Bath', goal: 'Take a bath calmly with a grown-up', aliases: ['bath', 'bath-shower'] },
  { id: 'cleaning-toys', label: '🧸 Cleaning Toys', goal: 'Put toys away after play', aliases: ['cleaning toys', 'clean-up'] },
  { id: 'toilet-training', label: '🚽 Toilet Training', goal: 'Practice the potty routine', aliases: ['potty learning', 'toilet training', 'potty-routine'] },
  { id: 'school', label: '🎒 School', goal: 'Say goodbye and settle in at school or childcare', aliases: ['school', 'separation'] },
  { id: 'emotional-regulation', label: '💛 Emotional Regulation', goal: 'Notice a big feeling and use a calming strategy', aliases: ['emotional regulation', 'feelings', 'transition'] },
];

export const PRACTICE_STORY_PARENT_GOALS = [
  { id: 'confidence', label: '🌟 Confidence', guidance: 'Build confidence: let the child try, wobble, and try again, and name their brave effort in specific words.' },
  { id: 'independence', label: '💪 Independence', guidance: 'Build independence: show the child doing more of each step on their own, with the grown-up stepping back as they succeed.' },
  { id: 'responsibility', label: '✅ Responsibility', guidance: 'Build responsibility: show the child owning a small job that helps the family or team, and seeing why it matters.' },
  { id: 'speech', label: '🗣️ Speech', guidance: 'Support speech: use short repeatable phrases, simple sound play, and “say it together” lines the child can echo aloud.' },
  { id: 'healthy-habits', label: '🥗 Healthy Habits', guidance: 'Support healthy habits: connect each step to how the body feels good (clean, rested, strong, nourished) without fear or lecturing.' },
  { id: 'emotional-regulation', label: '💛 Emotional Regulation', guidance: 'Support emotional regulation: name the feeling, model one calming tool (belly breaths, a squeeze, counting), then show the feeling getting smaller.' },
];

export const PRACTICE_STORY_THEMES = [
  { id: 'adventure', label: '🗺️ Adventure', guidance: 'an adventure journey with a map, landmarks, and a friendly guide' },
  { id: 'mission', label: '🎯 Mission', guidance: 'a special mission where the child is the hero with an important job to complete' },
  { id: 'treasure-hunt', label: '💎 Treasure Hunt', guidance: 'a treasure hunt where each completed step reveals a clue toward a cozy treasure' },
  { id: 'magic', label: '✨ Magic', guidance: 'gentle everyday magic where each step makes something sparkle or glow' },
  { id: 'space', label: '🚀 Space', guidance: 'a space voyage with a countdown, planets as stops, and a mission control grown-up' },
  { id: 'safari', label: '🦁 Safari', guidance: 'a safari where friendly animals cheer the child on at each stop' },
  { id: 'fantasy', label: '🏰 Fantasy', guidance: 'a kind fantasy kingdom with castles, friendly creatures, and a happy quest' },
];

export const PRACTICE_STORY_LENGTHS = [
  { id: 'short', label: 'Short', detail: '3–4 steps', minSteps: 3, maxSteps: 4, readAloudMinutes: 2 },
  { id: 'medium', label: 'Medium', detail: '5–7 steps', minSteps: 5, maxSteps: 7, readAloudMinutes: 4 },
  { id: 'long', label: 'Long', detail: '8–10 steps', minSteps: 8, maxSteps: 10, readAloudMinutes: 6 },
];

export const DEFAULT_PRACTICE_STORY_LENGTH = 'medium';
export const MAX_PRACTICE_STORY_PARENT_GOALS = 2;

const byId = (options, id) => options.find((option) => option.id === String(id || '').trim()) || null;
export const practiceStoryChallenge = (id) => byId(PRACTICE_STORY_CHALLENGES, id);
export const practiceStoryTheme = (id) => byId(PRACTICE_STORY_THEMES, id);
export const practiceStoryLength = (id) => byId(PRACTICE_STORY_LENGTHS, id) || byId(PRACTICE_STORY_LENGTHS, DEFAULT_PRACTICE_STORY_LENGTH);
export function practiceStoryParentGoals(ids) {
  const values = Array.isArray(ids) ? ids : String(ids || '').split(',');
  return [...new Set(values.map((value) => String(value).trim()))].map((id) => byId(PRACTICE_STORY_PARENT_GOALS, id)).filter(Boolean).slice(0, MAX_PRACTICE_STORY_PARENT_GOALS);
}

// Match a profile "practicing now" value (e.g. "brushing teeth") to a challenge tag.
export function challengeFromPracticingStep(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return PRACTICE_STORY_CHALLENGES.find((option) => option.id === key || option.aliases.includes(key)) || null;
}

// Strip emoji from a tag label, for plain-text use in prompts and summaries.
export const plainTagLabel = (label) => String(label || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
