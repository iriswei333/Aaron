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
  {
    "city": "Kirkland",
    "date": "2026-10-10",
    "title": "Bigfoot Kids’ Book Festival",
    "summary": "The Bigfoot Kids&#8217; Book Festival is an annual event in Redmond, Washington, that brings together children&#8217;s and young adult authors and illustrators to connect with readers through book signings, panels [&hellip;]",
    "theme": "Community event",
    "dateLabel": "Saturday, Oct 10",
    "timeLabel": "10–4 p.m.",
    "venue": "Redmond Senior &#038; Community Center",
    "venueAddress": "8703 160th Ave NE, Redmond, WA, 98052-7510, United States",
    "url": "https://www.parentmap.com/calendar/bigfoot-kids-book-festival",
    "sourceUrl": "https://www.parentmap.com/calendar/bigfoot-kids-book-festival",
    "imageUrl": "https://www.parentmap.com/wp-content/uploads/2026/04/1775188840604-9eb169_2efcbb61714d4af8aaf04e7e3b851867mv2-4c3ea617b54b.jpg",
    "source": "partnership",
    "sourceLabel": "Parentmap official website",
    "tags": [
      "Community event"
    ],
    "ageSlugs": [],
    "free": true,
    "resultType": "event",
    "forcedRecommendation": true,
    "recommendationType": "partnership"
  },
  {
    "city": "TAacoma",
    "date": "2026-10-11",
    "title": "Oktoberfest Northwest",
    "summary": "Join the always-entertaining 6&#8217;7&#8243; (in heels!) Austrian host Manuela Horn for three days of authentic German food, ice-cold German beer served in traditional steins, lively oompah music and dance, family [&hellip;]",
    "theme": "Community event",
    "dateLabel": "Sunday, Oct 11",
    "timeLabel": "11–6 p.m.",
    "venue": "MattressFIRM Showplex",
    "venueAddress": "110 9th Ave SW, Puyallup, WA, 98371-6811, United States",
    "url": "https://www.parentmap.com/calendar/oktoberfest-northwest-0/2026-10-11/",
    "sourceUrl": "https://www.parentmap.com/calendar/oktoberfest-northwest-0/2026-10-11/",
    "imageUrl": "https://www.parentmap.com/wp-content/uploads/2026/04/1775187303084-screenshot-2022-09-09-1145312-86b6c4760fcf.png",
    "source": "partnership",
    "sourceLabel": "Parentmap official website",
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
