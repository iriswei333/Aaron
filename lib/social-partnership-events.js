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
  {
    "city": "Kirkland",
    "date": "2026-10-03",
    "title": "Redmond Town Center Exotics Car Show",
    "summary": "Exotics at Redmond Town Center &#8211; Opening Day April 4th! Spring-Fall: Saturdays 9-11 AM Weather Dependent Join us for the largest weekly car gathering in the US, comprised of the [&hellip;]",
    "theme": "Community event",
    "dateLabel": "Saturday, Oct 3",
    "timeLabel": "9–11 a.m.",
    "venue": "Redmond Town Center",
    "venueAddress": "7525 166th Ave NE, Redmond, Washington, 98052",
    "url": "https://experienceredmond.com/event/exotics-at-rtc/2026-10-03",
    "sourceUrl": "https://experienceredmond.com/event/exotics-at-rtc/2026-10-03",
    "imageUrl": "https://experienceredmond.com/wp-content/uploads/2023/07/279055135_10159180313102639_1443726874718971461_n.jpeg",
    "source": "partnership",
    "sourceLabel": "Experienceredmond official website",
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
