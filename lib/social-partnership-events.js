const PARTNERSHIP_EVENTS = [
  {
    city: 'Seattle',
    date: '2026-09-26',
    title: 'Mid-Autumn Festival',
    summary: 'An afternoon of cultural performances, fun activities, and family-friendly festivities celebrating tradition, togetherness, and community.',
    theme: 'Culture + Community',
    dateLabel: 'Saturday, Sept. 26',
    timeLabel: '12 p.m.–4 p.m.',
    venue: 'Seattle Chinese Garden',
    url: 'https://www.seattlechinesegarden.org/news/2026-mid-autumn-festival-saturday-september-26-1',
    sourceUrl: 'https://www.seattlechinesegarden.org/news/2026-mid-autumn-festival-saturday-september-26-1',
    source: 'partnership',
    sourceLabel: 'Seattle Chinese Garden official website',
    tags: ['Mid-Autumn Moon Festival', 'Moon Festival', 'Chinese culture', 'Family event'],
    ageSlugs: ['all-ages'],
    free: null,
    resultType: 'event',
    forcedRecommendation: true,
    recommendationType: 'partnership',
  },
];

export function getForcedPartnershipEvents({ city, date } = {}) {
  return PARTNERSHIP_EVENTS.filter((event) => event.city.toLowerCase() === String(city || '').trim().toLowerCase()
    && event.date === date).map((event) => ({ ...event }));
}
