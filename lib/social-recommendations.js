const FALL_MONTHS = new Set([8, 9, 10]);

const LOCAL_GEOGRAPHY = {
  Seattle: ['seattle', 'king county', 'puyallup', 'washington'],
  Bellevue: ['bellevue', 'eastside', 'king county', 'puyallup', 'washington'],
  Tacoma: ['tacoma', 'puyallup', 'pierce county', 'washington'],
  Kirkland: ['kirkland', 'eastside', 'king county', 'puyallup', 'washington'],
  Lynnwood: ['lynnwood', 'snohomish county', 'everett', 'puyallup', 'washington'],
  Edmonds: ['edmonds', 'snohomish county', 'everett', 'puyallup', 'washington'],
};

export const WEEKEND_EVENT_RECOMMENDATIONS = [
  {
    keyword: 'state fair',
    terms: ['state fair', 'washington state fair'],
    boost: 18,
    geographyBoost: 8,
    reason: 'high-priority regional fair',
  },
  {
    keyword: 'fall festival',
    terms: ['fall festival', 'autumn festival', 'fall celebration'],
    months: FALL_MONTHS,
    boost: 16,
    reason: 'seasonal fall trend',
  },
  {
    keyword: 'pumpkin',
    terms: ['pumpkin patch', 'pumpkin farm', 'pumpkin festival', 'pumpkins'],
    months: FALL_MONTHS,
    boost: 12,
    reason: 'seasonal fall trend',
  },
  {
    keyword: 'harvest',
    terms: ['harvest festival', 'harvest celebration', 'apple festival'],
    months: FALL_MONTHS,
    boost: 10,
    reason: 'seasonal fall trend',
  },
  {
    keyword: 'Mid-Autumn Moon Festival',
    terms: [
      'mid-autumn moon festival',
      'mid autumn moon festival',
      'mid-autumn festival',
      'mid autumn festival',
      'moon festival',
      'mooncake festival',
      'mooncake',
      '中秋',
    ],
    months: FALL_MONTHS,
    boost: 22,
    reason: 'seasonal cultural celebration for the Mandarin community',
  },
];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function eventText(event) {
  return [event.title, event.theme, event.summary, event.description, event.venue, event.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isActiveSeason(recommendation, date) {
  if (!recommendation.months) return true;
  const month = new Date(`${date}T12:00:00`).getMonth();
  return recommendation.months.has(month);
}

export function recommendWeekendEvent(event, { city = '', date = '' } = {}) {
  const text = eventText(event);
  const localTerms = LOCAL_GEOGRAPHY[city] || [normalize(city)];
  const matchingKeywords = [];
  const reasons = [];
  let score = 0;

  for (const recommendation of WEEKEND_EVENT_RECOMMENDATIONS) {
    if (!isActiveSeason(recommendation, date)) continue;
    if (!recommendation.terms.some((term) => text.includes(term))) continue;
    matchingKeywords.push(recommendation.keyword);
    score += recommendation.boost;
    reasons.push(recommendation.reason);
    if (recommendation.geographyBoost && localTerms.some((term) => text.includes(term))) {
      score += recommendation.geographyBoost;
      reasons.push(`geographically relevant to ${city}`);
    }
  }

  return { score, matchingKeywords, reasons: [...new Set(reasons)] };
}
