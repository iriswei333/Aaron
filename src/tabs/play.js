import { escapeAttribute, escapeHtml, fetchWithTimeout, icon } from '../shared.js';

const nearbyPlaces = [
  ['Seattle Center Artists at Play', 'Outdoor playground', '0.6 mi', 'climbing, slides, car/streetcar watching nearby', 'dry or light drizzle'],
  ['Denny Park', 'Outdoor park', '0.4 mi', 'short stroller walk, open grass, toddler run time', 'dry afternoons'],
  ['Seattle Children’s Museum', 'Indoor play', '0.7 mi', 'rainy-day pretend play and sensory exploration', 'rain, wind, cold'],
  ['PlayDate SEA', 'Indoor play space', '0.7 mi', 'big energy days when outside is wet', 'rainy days'],
  ['Myrtle Edwards Park', 'Outdoor waterfront', '0.7 mi', 'stroller views, boats, trains, and easy snack stop', 'clear and low wind'],
];

const playSearchTemplates = [
  ['Indoor play spaces', 'Indoor play', 'rainy-day movement, climbing, and pretend play', 'rain, wind, cold', 'indoor play'],
  ['Children’s museums', 'Indoor museum', 'hands-on toddler exhibits and sensory exploration', 'rain, wind, cold'],
  ['Public library story times', 'Indoor library', 'quiet backup with books and toddler programs', 'rainy days'],
  ['Outdoor playgrounds', 'Outdoor playground', 'slides, climbing, and short stroller transitions', 'dry or light drizzle'],
  ['Parks with toddler paths', 'Outdoor park', 'open space, stroller loops, and snack breaks', 'clear afternoons'],
];

const weekendEvents = [
  ['Cars & Coffee toddler stroll', 'Car theme', 'Pick a nearby Saturday morning cars-and-coffee meetup, arrive early, bring ear protection, and leave before nap time.', 'Thursday 9:00 AM: confirm meetup, invite one family, pack toy cars.'],
  ['Seattle Center seasonal festival + playground', 'Seasonal', 'Pair any Seattle Center seasonal event with Artists at Play and an easy lunch nearby.', 'Thursday 9:15 AM: choose festival slot, text playdate options, check stroller route.'],
  ['Waterfront boats, trucks, and market treats', 'Vehicle + seasonal walk', 'Do a short waterfront walk to spot boats/trucks, then pick one seasonal snack at Pike Place Market.', 'Thursday 9:30 AM: check weather, invite friends, choose indoor backup.'],
];

const holidays = [
  ['Thanksgiving', 'One month before: choose menu, book travel or host plan, start toddler-friendly activity basket.'],
  ['Christmas / winter holidays', 'One month before: family photos, gift list, outfits, childcare calendar, shipping deadlines.'],
  ['Lunar New Year', 'One month before: outfit, family calls, red envelopes, toddler craft, celebratory meal.'],
  ['Aaron’s birthday', 'One month before: theme, guest list, cake, gift ideas, nap-friendly party time.'],
];

let weatherRequestId = 0;
let nearbyRequestId = 0;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getLocationCoords(location) {
  const latitude = toNumber(location?.latitude);
  const longitude = toNumber(location?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function getUserLocation(state) {
  return state.user?.location || null;
}

function shortLocation(location) {
  if (!location) return 'saved location';
  const address = location.address || location.label || '';
  if (address) return address.split(',').slice(0, 2).join(', ');
  const coords = getLocationCoords(location);
  if (coords) return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  return 'saved location';
}

function mapsSearchUrl(query, coords) {
  if (coords) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${coords.latitude},${coords.longitude},14z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function defaultPlayOptions() {
  return nearbyPlaces.map(([name, type, distance, best, weather]) => ({
    name,
    type,
    distance,
    best,
    weather,
    preference: type.toLowerCase().includes('indoor') ? 'indoor' : 'outdoor',
    href: mapsSearchUrl(name),
    source: 'starter',
  }));
}

function fallbackPlayOptions(location) {
  const coords = getLocationCoords(location);
  if (!location) return defaultPlayOptions();

  const place = shortLocation(location);
  return playSearchTemplates.map(([name, type, best, weather, queryOverride]) => {
    const query = queryOverride || name;
    return {
      name: `${name} near ${place}`,
      type,
      distance: 'Nearby search',
      best,
      weather,
      preference: type.toLowerCase().includes('indoor') ? 'indoor' : 'outdoor',
      href: mapsSearchUrl(`${query} near ${place}`, coords),
      source: 'map-search',
    };
  });
}

function distanceMiles(origin, destination) {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(miles) {
  if (!Number.isFinite(miles)) return 'Nearby';
  if (miles < 0.1) return '<0.1 mi';
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

function isIndoorWeatherRecommended(state) {
  const label = state.weather.label.toLowerCase();
  const precipitation = parseFloat(state.weather.precipitation);
  const wind = parseFloat(state.weather.wind);
  return label.includes('rainy')
    || label.includes('indoor')
    || label.includes('unavailable')
    || (Number.isFinite(precipitation) && precipitation > 0)
    || (Number.isFinite(wind) && wind >= 18);
}

function getRecommendedPlayOptions(state) {
  const indoorFirst = isIndoorWeatherRecommended(state);
  const options = state.nearbyPlayOptions.length > 0 ? state.nearbyPlayOptions : fallbackPlayOptions(getUserLocation(state));
  return [...options].sort((a, b) => {
    const aPreferred = a.preference === (indoorFirst ? 'indoor' : 'outdoor') ? 0 : 1;
    const bPreferred = b.preference === (indoorFirst ? 'indoor' : 'outdoor') ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return (a.sortDistance ?? 999) - (b.sortDistance ?? 999);
  }).slice(0, 5);
}

function weatherCodeSuggestsRain(weatherCode) {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
    .includes(Number(weatherCode));
}

async function geocodeWithNominatim(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', address);
  const response = await fetchWithTimeout(url.toString(), { headers: { accept: 'application/json' } }, 8000);
  if (!response.ok) throw new Error('Address lookup failed.');
  const [result] = await response.json();
  if (!result) throw new Error('No matching place found.');
  const latitude = toNumber(result.lat);
  const longitude = toNumber(result.lon);
  if (latitude === null || longitude === null) throw new Error('Address lookup did not return coordinates.');
  return {
    label: result.name || 'Manual location',
    address: result.display_name || address,
    latitude,
    longitude,
    source: 'nominatim-geocoding',
  };
}

async function geocodeWithOpenMeteo(address) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', address);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const response = await fetchWithTimeout(url.toString(), {}, 8000);
  if (!response.ok) throw new Error('Place lookup failed.');
  const data = await response.json();
  const result = data.results?.[0];
  if (!result) throw new Error('No matching place found.');
  const latitude = toNumber(result.latitude);
  const longitude = toNumber(result.longitude);
  if (latitude === null || longitude === null) throw new Error('Place lookup did not return coordinates.');
  const parts = [result.name, result.admin1, result.country].filter(Boolean);
  return {
    label: result.name || 'Manual location',
    address: parts.join(', ') || address,
    latitude,
    longitude,
    source: 'open-meteo-geocoding',
  };
}

async function geocodeAddress(address) {
  try {
    return await geocodeWithNominatim(address);
  } catch {
    return geocodeWithOpenMeteo(address);
  }
}

function playOptionType(tags = {}) {
  const name = tags.name || '';
  const indoorish = tags.indoor === 'yes'
    || tags.amenity === 'library'
    || tags.tourism === 'museum'
    || /indoor|kids|children|museum|library|gym|play/i.test(name) && tags.leisure !== 'park';
  if (indoorish) {
    if (tags.amenity === 'library') return 'Indoor library';
    if (tags.tourism === 'museum') return 'Indoor museum';
    return 'Indoor play';
  }
  if (tags.leisure === 'park') return 'Outdoor park';
  return 'Outdoor playground';
}

function playOptionBest(type) {
  if (type === 'Indoor library') return 'books, story time, and a quiet weather backup';
  if (type === 'Indoor museum') return 'hands-on exhibits and rainy-day exploration';
  if (type.includes('Indoor')) return 'big-energy play when outside is wet or cold';
  if (type === 'Outdoor park') return 'open space, stroller loops, and snack breaks';
  return 'slides, climbing, and toddler gross-motor play';
}

function playOptionWeather(type) {
  if (type.includes('Indoor')) return 'rain, wind, cold';
  if (type === 'Outdoor park') return 'dry afternoons';
  return 'dry or light drizzle';
}

function overpassQuery({ latitude, longitude }) {
  const radius = 4500;
  const selectors = [
    '["leisure"="playground"]',
    '["leisure"="park"]',
    '["amenity"="library"]',
    '["tourism"="museum"]',
  ];
  const clauses = selectors.flatMap((selector) => [
    `node${selector}(around:${radius},${latitude},${longitude});`,
    `way${selector}(around:${radius},${latitude},${longitude});`,
    `relation${selector}(around:${radius},${latitude},${longitude});`,
  ]).join('\n');
  return `[out:json][timeout:12];(${clauses});out center tags 40;`;
}

async function fetchNearbyPlayOptions(coords) {
  const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=UTF-8' },
    body: overpassQuery(coords),
  }, 12000);
  if (!response.ok) throw new Error('Nearby place lookup failed.');
  const data = await response.json();
  const seen = new Set();
  return (data.elements || [])
    .map((element) => {
      const latitude = toNumber(element.lat ?? element.center?.lat);
      const longitude = toNumber(element.lon ?? element.center?.lon);
      const name = element.tags?.name?.trim();
      if (!name || latitude === null || longitude === null || element.tags?.access === 'private') return null;
      const key = name.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      const type = playOptionType(element.tags);
      const miles = distanceMiles(coords, { latitude, longitude });
      return {
        name,
        type,
        distance: formatDistance(miles),
        sortDistance: miles,
        best: playOptionBest(type),
        weather: playOptionWeather(type),
        preference: type.includes('Indoor') ? 'indoor' : 'outdoor',
        href: mapsSearchUrl(name, { latitude, longitude }),
        source: 'nearby',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortDistance - b.sortDistance)
    .slice(0, 12);
}

export function resetPlayState(state) {
  state.locationStatus = '';
  state.weather = { label: 'Location needed for weather', temperature: '--', precipitation: '--', wind: '--', updated: 'Sign in and save a location' };
  state.nearbyPlayOptions = [];
  state.nearbyStatus = 'Save a location to personalize nearby play options.';
}

export function formatLocation(location) {
  if (!location) return 'No location saved';
  if (location.address) return location.address;
  const coords = getLocationCoords(location);
  if (coords) {
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
  return location.label || 'Saved location';
}

async function loadWeather(ctx) {
  const { state } = ctx;
  const requestId = ++weatherRequestId;
  const coords = getLocationCoords(getUserLocation(state));
  if (!coords) {
    state.weather = { label: 'Location needed for weather', temperature: '--', precipitation: '--', wind: '--', updated: 'Use current location to enable weather' };
    if (state.tab === 'play') ctx.renderCurrent();
    return;
  }

  state.weather = { label: 'Updating forecast...', temperature: '--', precipitation: '--', wind: '--', updated: `Checking ${shortLocation(getUserLocation(state))}` };
  if (state.tab === 'play') ctx.renderCurrent();

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles`;
    const response = await fetchWithTimeout(url, {}, 10000);
    if (!response.ok) throw new Error('Weather lookup failed.');
    const data = await response.json();
    const current = data.current;
    if (requestId !== weatherRequestId) return;
    if (!current) throw new Error('Weather data missing.');
    const rainy = Number(current.precipitation) > 0 || weatherCodeSuggestsRain(current.weather_code);
    state.weather = {
      label: rainy ? 'Rainy backup recommended' : 'Outdoor play looks possible',
      temperature: `${Math.round(current.temperature_2m)}°F`,
      precipitation: `${current.precipitation} mm`,
      wind: `${Math.round(current.wind_speed_10m)} mph`,
      updated: new Date(current.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
    };
  } catch {
    if (requestId !== weatherRequestId) return;
    state.weather = { label: 'Weather unavailable — use indoor backup', temperature: '--', precipitation: '--', wind: '--', updated: 'Could not reach Open-Meteo' };
  }
  if (state.tab === 'play') ctx.renderCurrent();
}

async function loadNearbyPlayOptions(ctx) {
  const { state } = ctx;
  const requestId = ++nearbyRequestId;
  const location = getUserLocation(state);
  const coords = getLocationCoords(location);
  const fallbackOptions = fallbackPlayOptions(location);

  state.nearbyPlayOptions = fallbackOptions;

  if (!location) {
    state.nearbyStatus = 'Using Seattle starter ideas until a location is saved.';
    if (state.tab === 'play') ctx.renderCurrent();
    return;
  }

  if (!coords) {
    state.nearbyStatus = `Showing map searches for ${shortLocation(location)}. Use current location or a recognized place for live nearby results.`;
    if (state.tab === 'play') ctx.renderCurrent();
    return;
  }

  state.nearbyStatus = `Finding indoor and outdoor options near ${shortLocation(location)}...`;
  if (state.tab === 'play') ctx.renderCurrent();

  try {
    const nearbyOptions = await fetchNearbyPlayOptions(coords);
    if (requestId !== nearbyRequestId) return;
    if (nearbyOptions.length > 0) {
      state.nearbyPlayOptions = nearbyOptions;
      state.nearbyStatus = `Found ${nearbyOptions.length} nearby options around ${shortLocation(location)}.`;
    } else {
      state.nearbyPlayOptions = fallbackOptions;
      state.nearbyStatus = `No live nearby places found around ${shortLocation(location)}; showing map searches.`;
    }
  } catch {
    if (requestId !== nearbyRequestId) return;
    state.nearbyPlayOptions = fallbackOptions;
    state.nearbyStatus = `Showing map searches for ${shortLocation(location)}; live nearby lookup is unavailable.`;
  }

  if (state.tab === 'play') ctx.renderCurrent();
}

export function refreshPlayPlanning(ctx) {
  loadWeather(ctx);
  loadNearbyPlayOptions(ctx);
}

function requestCurrentLocation(ctx) {
  const { state } = ctx;
  if (!globalThis.navigator?.geolocation) {
    state.locationStatus = 'This browser does not support location permission.';
    ctx.renderCurrent();
    return;
  }

  state.locationStatus = 'Requesting browser location permission…';
  ctx.renderCurrent();
  globalThis.navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      ctx.saveUserSection('location', {
        label: 'Current location',
        address: '',
        latitude,
        longitude,
        accuracy: Math.round(accuracy || 0),
        source: 'browser-geolocation',
      });
    },
    (error) => {
      state.locationStatus = error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Enter an address manually instead.'
        : `Could not read browser location: ${error.message}`;
      ctx.renderCurrent();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

async function saveResolvedManualLocation(ctx, address) {
  const { state } = ctx;
  state.locationStatus = 'Looking up address for weather and nearby play options...';
  ctx.renderCurrent();

  let payload = {
    label: 'Manual location',
    address,
    latitude: null,
    longitude: null,
    source: 'manual',
  };

  try {
    payload = await geocodeAddress(address);
    state.locationStatus = `Matched ${payload.address}. Saving location...`;
    ctx.renderCurrent();
  } catch {
    state.locationStatus = `Could not find coordinates for "${address}". Saving the address only.`;
  }

  await ctx.saveUserSection('location', payload);
}

function saveManualLocation(ctx, event) {
  const { state } = ctx;
  event.preventDefault();
  const address = document.getElementById('location-address').value.trim();
  if (!address) {
    state.locationStatus = 'Enter an address or use current location.';
    ctx.renderCurrent();
    return;
  }
  saveResolvedManualLocation(ctx, address);
}

export function renderPlay(ctx) {
  const { state } = ctx;
  const rainy = isIndoorWeatherRecommended(state);
  const playOptions = getRecommendedPlayOptions(state);
  const preferredPlayOption = playOptions.find((option) => option.preference === (rainy ? 'indoor' : 'outdoor')) || playOptions[0];
  const destinationDetail = preferredPlayOption
    ? `${preferredPlayOption.name}. ${preferredPlayOption.best}.`
    : rainy
      ? 'Choose an indoor backup near the saved location.'
      : 'Choose an outdoor option near the saved location.';
  const dailyPlan = [
    ['3:00 PM', 'Snack + diaper + shoes', 'Offer banana/strawberries, water, and pick weather-appropriate layers.'],
    ['3:30 PM', rainy ? 'Indoor destination' : 'Outdoor destination', destinationDetail],
    ['4:30 PM', 'Transition activity', 'Toy cars, bubbles, or stroller ride toward home.'],
    ['5:15 PM', 'Calm-down block', 'Books, bath prep, or family helper task.'],
    ['6:00 PM', 'Dinner handoff', 'Switch to food tab meal plan.'],
  ];
  const location = getUserLocation(state);
  const locationText = formatLocation(location);
  const locationStatus = state.locationStatus || (location ? 'This location is saved only for the signed-in user.' : 'No location saved. Use current location to allow browser permission.');
  const playOptionsMarkup = playOptions.length > 0
    ? playOptions.map((option) => `<article class="mini-card play-card ${option === preferredPlayOption ? 'recommended' : ''}">${icon(option.preference === 'indoor' ? '🏠' : '🌳')}<div><h3>${escapeHtml(option.name)}</h3><p>${escapeHtml(option.type)} • ${escapeHtml(option.distance)}</p><small>${escapeHtml(option.best)} • Best: ${escapeHtml(option.weather)}</small>${option.href ? `<a class="mini-link" href="${escapeAttribute(option.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div></article>`).join('')
    : '<p class="muted">Save a location to generate nearby indoor and outdoor play options.</p>';

  ctx.layout(`<main class="stack"><section class="dashboard-row"><div class="panel weather-panel"><p class="eyebrow">🌤 Live planning tool</p><h2>3:00–6:00 PM activity plan</h2><p class="muted">Home base: ${escapeHtml(locationText)}</p><div class="weather-grid"><strong>${escapeHtml(state.weather.label)}</strong><span>${escapeHtml(state.weather.temperature)}</span><span>Rain: ${escapeHtml(state.weather.precipitation)}</span><span>Wind: ${escapeHtml(state.weather.wind)}</span></div><small>Updated: ${escapeHtml(state.weather.updated)}. Daily automation: refresh weather and nearby options at 5:00 AM.</small><button onclick="downloadCalendar('Aaron daily 3-6 PM plan','20260514T150000','20260514T180000','Daily play plan using weather and nearby indoor/outdoor options')">Download today’s calendar block</button></div><div class="panel location-tool">${icon('📍')}<h3>User location</h3><p>${escapeHtml(locationStatus)}</p><form id="location-form"><label class="input-label" for="location-address">Address or place</label><input id="location-address" value="${escapeAttribute(location?.address || '')}" placeholder="Home address, city, or favorite play area" /><button type="submit">Save address</button></form><button id="use-current-location" class="secondary-button">Use current location</button></div></section><section class="timeline panel">${dailyPlan.map(([time, title, detail]) => `<article><time>${time}</time><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Nearby indoor/outdoor play options</h2><p class="muted">${escapeHtml(state.nearbyStatus)}</p><div class="cards-list">${playOptionsMarkup}</div></div><div class="panel"><h2>Weekend family events</h2><p class="muted">Every Thursday: choose one, create a reminder, and organize a playdate.</p>${weekendEvents.map(([title, theme, plan, reminder]) => `<article class="event-card"><span>${theme}</span><h3>${title}</h3><p>${plan}</p><small>${reminder}</small></article>`).join('')}</div></section><section class="grid two-cols"><div class="panel action-panel">${icon('☎️')}<h2>Saturday night family phone call</h2><p>Recurring reminder: Saturday 7:30 PM, after dinner and before bedtime wind-down.</p><button onclick="downloadCalendar('Family phone call','20260516T193000','20260516T200000','Weekly Saturday night family call with Aaron')">Download family-call event</button></div><div class="panel"><h2>Holiday planning reminders</h2>${holidays.map(([holiday, reminder]) => `<article class="mini-card">${icon('🎁')}<div><h3>${holiday}</h3><p>${reminder}</p></div></article>`).join('')}</div></section></main>`);

  document.getElementById('location-form').addEventListener('submit', (event) => saveManualLocation(ctx, event));
  document.getElementById('use-current-location').addEventListener('click', () => requestCurrentLocation(ctx));
}
