// Today tab logic shared by apps/web (src/tabs/home.js) and apps/mobile (Today tab):
// upcoming family plans, the "next little adventure" recommendation, weather, and
// the getting-ready story goals. No DOM or platform APIs.

export const TODAY_STORY_GOALS = [
  { id: 'making-friends', icon: '☺', label: 'Making friends', detail: 'Practice saying hello and joining play.' },
  { id: 'washing-hands', icon: '🫧', label: 'Washing hands', detail: 'Practice the after-playground clean-up routine.' },
  { id: 'leaving-playground', icon: '👋', label: 'Leaving the playground', detail: 'Practice one more turn, goodbye, and going home.' },
];

/** @param {string | undefined | null} value @param {string} [fallback] */
export function firstName(value, fallback = 'there') {
  return String(value || '').trim().split(/\s+/)[0] || fallback;
}

// ── Location ─────────────────────────────────────────────────────────────────

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** @param {any} location @returns {{ latitude: number, longitude: number } | null} */
export function locationCoords(location) {
  const latitude = toNumber(location?.latitude);
  const longitude = toNumber(location?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

/** The family's saved location, or the child's home city as a fallback. @param {any} user @param {string} [homeCity] */
export function userLocation(user, homeCity = '') {
  if (user?.location) return user.location;
  if (!homeCity) return null;
  return { label: homeCity, address: homeCity, latitude: null, longitude: null, source: 'child-profile' };
}

/** @param {any} location */
export function shortLocation(location) {
  if (!location) return 'saved location';
  const address = location.address || location.label || '';
  if (address) return address.split(',').map((part) => part.trim()).filter(Boolean).slice(0, 2).join(', ');
  const coords = locationCoords(location);
  if (coords) return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  return 'saved location';
}

// ── Weather (Open-Meteo, same request as the web Discover tab) ───────────────

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

/** @param {number | string} code */
export function weatherCodeSuggestsRain(code) {
  return RAIN_CODES.includes(Number(code));
}

/** @param {{ latitude: number, longitude: number }} coords */
export function weatherUrl(coords) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
}

export const WEATHER_NEEDS_LOCATION = { label: 'Location needed for weather', temperature: '--', precipitation: '--', wind: '--' };
export const WEATHER_UNAVAILABLE = { label: 'Weather unavailable — use indoor backup', temperature: '--', precipitation: '--', wind: '--' };

/** Turns an Open-Meteo response into the weather summary the Today tab shows. @param {any} data */
export function summarizeWeather(data) {
  const current = data?.current;
  if (!current) return WEATHER_UNAVAILABLE;
  const rainy = Number(current.precipitation) > 0 || weatherCodeSuggestsRain(current.weather_code);
  return {
    label: rainy ? 'Rainy backup recommended' : 'Outdoor play looks possible',
    temperature: `${Math.round(current.temperature_2m)}°F`,
    precipitation: `${current.precipitation} mm`,
    wind: `${Math.round(current.wind_speed_10m)} mph`,
  };
}

/**
 * @param {{ latitude: number, longitude: number } | null} coords
 * @param {typeof fetch} [fetchImpl]
 */
export async function loadTodayWeather(coords, fetchImpl) {
  if (!coords) return WEATHER_NEEDS_LOCATION;
  const doFetch = fetchImpl || globalThis.fetch;
  try {
    const response = await doFetch(weatherUrl(coords));
    if (!response.ok) return WEATHER_UNAVAILABLE;
    return summarizeWeather(await response.json());
  } catch {
    return WEATHER_UNAVAILABLE;
  }
}

/** @param {{ label?: string, precipitation?: string | number } | null | undefined} weather */
export function weatherIsIndoorDay(weather) {
  const label = String(weather?.label || '').toLowerCase();
  return label.includes('rain') || label.includes('indoor') || parseFloat(String(weather?.precipitation ?? '')) > 0;
}

/** @param {{ label?: string } | null | undefined} weather */
export function weatherIcon(weather) {
  return String(weather?.label || '').toLowerCase().includes('rain') ? '☔' : '☀️';
}

// ── Nearby play options when live results aren't available ───────────────────

const DEFAULT_NEARBY_PLACES = [
  ['Seattle Center Artists at Play', 'Outdoor playground', '0.6 mi', 'climbing, slides, car/streetcar watching nearby', 'dry or light drizzle'],
  ['Denny Park', 'Outdoor park', '0.4 mi', 'short stroller walk, open grass, toddler run time', 'dry afternoons'],
  ['Seattle Children’s Museum', 'Indoor play', '0.7 mi', 'rainy-day pretend play and sensory exploration', 'rain, wind, cold'],
  ['PlayDate SEA', 'Indoor play space', '0.7 mi', 'big energy days when outside is wet', 'rainy days'],
  ['Myrtle Edwards Park', 'Outdoor waterfront', '0.7 mi', 'stroller views, boats, trains, and easy snack stop', 'clear and low wind'],
];

const PLAY_SEARCH_TEMPLATES = [
  ['Indoor play spaces', 'Indoor play', 'rainy-day movement, climbing, and pretend play', 'rain, wind, cold', 'indoor play'],
  ['Children’s museums', 'Indoor museum', 'hands-on toddler exhibits and sensory exploration', 'rain, wind, cold'],
  ['Public library story times', 'Indoor library', 'quiet backup with books and toddler programs', 'rainy days'],
  ['Outdoor playgrounds', 'Outdoor playground', 'slides, climbing, and short stroller transitions', 'dry or light drizzle'],
];

const preferenceFor = (type) => (String(type).toLowerCase().includes('indoor') ? 'indoor' : 'outdoor');
const mapsSearch = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Starter ideas: map searches near the saved place, or Seattle examples without one. @param {any} location */
export function fallbackPlayOptions(location) {
  if (!location) {
    return DEFAULT_NEARBY_PLACES.map(([name, type, distance, best, weather]) => ({
      key: `starter-${name}`, name, type, distance, best, weather, preference: preferenceFor(type), href: mapsSearch(name), source: 'starter',
    }));
  }
  const place = shortLocation(location);
  return PLAY_SEARCH_TEMPLATES.map(([name, type, best, weather, queryOverride]) => {
    const query = `${queryOverride || name} near ${place}`;
    return { key: `search-${query}`, name: `${name} near ${place}`, type, distance: 'Nearby search', best, weather, preference: preferenceFor(type), href: mapsSearch(query), source: 'map-search' };
  });
}

// ── Recommendation ───────────────────────────────────────────────────────────

/**
 * The "Your next little adventure" card. `imageKey` picks a bundled background:
 * 'home' (cozy indoor) or 'playground' (outdoor).
 * @param {{ weather?: any, options?: any[], childName: string }} input
 */
export function todayRecommendation({ weather = {}, options = [], childName }) {
  const isIndoor = weatherIsIndoorDay(weather);
  const recommendation = options.find((item) => item.preference === (isIndoor ? 'indoor' : 'outdoor')) || options[0];
  return {
    title: recommendation?.name || (isIndoor ? 'A cozy story-time outing' : 'Fresh air and big little discoveries'),
    description: recommendation?.best || (isIndoor
      ? `A weather-friendly place for ${childName} to move, read, and explore.`
      : `A playground morning made for ${childName}’s curious pace.`),
    detail: recommendation
      ? `${recommendation.type || 'Nearby place'} · ${recommendation.distance || 'Close to home'}`
      : `${weather?.label || 'Weather-friendly'} · Near your family`,
    focus: isIndoor ? 'story-times' : '',
    imageKey: isIndoor ? 'home' : 'playground',
    href: recommendation?.href || '',
  };
}

// ── Family plans ─────────────────────────────────────────────────────────────

/** @param {any} item @param {Date} [now] */
export function isFutureFamilyEvent(item, now = new Date()) {
  const timestamp = item.endsAt || item.startsAt;
  if (timestamp) {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  const dateValue = item.dueDate || item.date || item.metadata?.date;
  if (dateValue) {
    const date = new Date(`${dateValue}T23:59:59`);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  return false;
}

/** @param {any} item */
export function familyPlanTimestamp(item) {
  if (item.startsAt) {
    const value = new Date(item.startsAt).getTime();
    if (Number.isFinite(value)) return value;
  }
  const date = item.dueDate || item.date || item.metadata?.date;
  const value = date ? new Date(`${date}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/** @param {any} a @param {any} b */
export function compareFamilyPlans(a, b) {
  return familyPlanTimestamp(a) - familyPlanTimestamp(b);
}

/** Saved family events and story times that are still ahead (or undated). @param {any[]} plans @param {Date} [now] */
export function selectedFamilyPlans(plans, now = new Date()) {
  return (Array.isArray(plans) ? plans : [])
    .filter((item) => {
      const hasSchedule = item.endsAt || item.startsAt || item.dueDate || item.date || item.metadata?.date;
      return ['external_event', 'story_time'].includes(item.kind)
        && item.status !== 'cancelled'
        && (!hasSchedule || isFutureFamilyEvent(item, now));
    })
    .map((item) => ({
      ...item,
      date: item.dueDate || item.metadata?.date || item.date || '',
      dateLabel: item.metadata?.dateLabel || item.dateLabel || '',
      timeLabel: item.metadata?.timeLabel || item.timeLabel || '',
      imageUrl: item.metadata?.imageUrl || item.imageUrl || '',
    }))
    .sort(compareFamilyPlans);
}

/**
 * Upcoming playdates plus saved events/story times, soonest first.
 * @param {{ playDates?: any[], familyPlans?: any[], playgrounds?: any[], now?: number }} input
 */
export function upcomingTodayPlans({ playDates = [], familyPlans = [], playgrounds = [], now = Date.now() } = {}) {
  const dated = (playDates || [])
    .filter((item) => item.status !== 'cancelled' && new Date(item.endsAt || item.startsAt).getTime() >= now)
    .map((item) => {
      const playground = playgrounds.find((option) => option.key === item.playgroundKey)
        || playgrounds.find((option) => option.name === item.playgroundName);
      return { ...item, homeKind: 'playdate', imageUrl: item.playgroundImageUrl || item.imageUrl || playground?.imageUrl || '' };
    });
  const saved = selectedFamilyPlans(familyPlans, new Date(now)).map((item) => ({ ...item, homeKind: item.kind }));
  return [...dated, ...saved].sort((a, b) => familyPlanTimestamp(a) - familyPlanTimestamp(b));
}

/** @param {any} playDate */
export function formatTodayPlayDate(playDate) {
  const startsAt = new Date(playDate.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { date: 'Upcoming playdate', time: 'Time pending' };
  return {
    date: startsAt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
    time: startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

/**
 * How a plan is shown on the Today tab. `image` is the plan's own picture ('' if none);
 * `imageKey` names the bundled fallback ('playground' or 'home').
 * @param {any} plan
 */
export function todayPlanView(plan) {
  if (plan.homeKind === 'playdate') {
    const timing = formatTodayPlayDate(plan);
    return {
      icon: '☺',
      type: plan.isHost ? 'Your playdate' : 'Playdate',
      title: plan.playgroundName || 'Neighborhood playdate',
      when: `${timing.date} · ${timing.time}`,
      where: plan.playgroundAddress || 'Nearby playground',
      detail: [plan.playgroundType, plan.ageRange, plan.notes].filter(Boolean).join(' · '),
      image: plan.imageUrl || '',
      imageKey: 'playground',
      focus: 'playdates',
    };
  }
  const isStoryTime = plan.homeKind === 'story_time';
  const date = plan.dueDate || plan.date || plan.metadata?.date;
  const parsedDate = date ? new Date(`${date}T12:00:00`) : null;
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    : plan.metadata?.dateLabel || plan.dateLabel || 'Date to be decided';
  return {
    icon: isStoryTime ? '📖' : '🎟️',
    type: isStoryTime ? 'Story time' : 'Family event',
    title: plan.title || (isStoryTime ? 'Story time' : 'Family event'),
    when: `${dateLabel} · ${plan.metadata?.timeLabel || plan.timeLabel || 'Time TBD'}`,
    where: plan.venue || plan.summary || 'Family-friendly place nearby',
    detail: plan.summary || plan.metadata?.sourceLabel || plan.source || '',
    image: plan.imageUrl || '',
    imageKey: 'home',
    focus: isStoryTime ? 'story-times' : 'family-events',
  };
}
