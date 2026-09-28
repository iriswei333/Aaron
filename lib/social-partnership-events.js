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
  {
    "city": "Bellevue",
    "date": "2026-10-03",
    "title": "Autumn Moon Night Market",
    "summary": "🏮🌙 AUTUMN MOON NIGHT MARKET IS COMING TO BELLEVUE! Enjoy local food & bites, local vendors, and a Mak Fai lion dance at 5pm. 🌙🏮Join us Saturday, October 3 from 2–7 PM at The Spring District for an unforgettable evening of local shopping, great food, culture and community!✨ 50+ local artisans & makers🍜 Delicious food & bites🛍️ One-of-a-kind finds🦁 Mak Fai Lion Dance LIVE at 5 PM!👨‍👩‍👧‍👦 FREE + all ages welcome!",
    "theme": "Community event",
    "dateLabel": "Saturday, Oct 3",
    "timeLabel": "2–7 p.m.",
    "venue": "Bellevue",
    "venueAddress": "450 110th Avenue NE Bellevue, WA 98004",
    "url": "https://bellevuewa.gov/events/autumn-moon-night-market",
    "sourceUrl": "https://bellevuewa.gov/events/autumn-moon-night-market",
    "source": "partnership",
    "sourceLabel": "Bellevuewa official website",
    "tags": [
      "Community event"
    ],
    "ageSlugs": [],
    "free": null,
    "resultType": "event",
    "forcedRecommendation": true,
    "recommendationType": "partnership"
  },
];

export function getForcedPartnershipEvents({ city, date } = {}) {
  return PARTNERSHIP_EVENTS.filter((event) => event.city.toLowerCase() === String(city || '').trim().toLowerCase()
    && event.date === date).map((event) => ({ ...event }));
}
