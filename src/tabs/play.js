import { apiRequest, escapeAttribute, escapeHtml, fetchWithTimeout, icon } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

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

const holidays = [
  ['Thanksgiving', 'One month before: choose menu, book travel or host plan, start toddler-friendly activity basket.'],
  ['Christmas / winter holidays', 'One month before: family photos, gift list, outfits, childcare calendar, shipping deadlines.'],
  ['Lunar New Year', 'One month before: outfit, family calls, red envelopes, toddler craft, celebratory meal.'],
  ['Birthday', 'One month before: theme, guest list, cake, gift ideas, nap-friendly party time.'],
];

let weatherRequestId = 0;
let nearbyRequestId = 0;
let playDateRequestId = 0;
let familyEventRequestId = 0;

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
  if (state.user?.location) return state.user.location;
  const homeCity = getChildProfile(state.user).homeCity;
  if (!homeCity) return null;
  return {
    label: homeCity,
    address: homeCity,
    latitude: null,
    longitude: null,
    source: 'child-profile',
  };
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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function playgroundKey(name, coords, sourceId = '') {
  const coordPart = coords ? `${Number(coords.latitude).toFixed(4)}-${Number(coords.longitude).toFixed(4)}` : '';
  return slugify([sourceId, name, coordPart].filter(Boolean).join(' ')) || slugify(name);
}

function defaultPlayOptions() {
  return nearbyPlaces.map(([name, type, distance, best, weather]) => ({
    key: playgroundKey(name),
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
      key: playgroundKey(`${query} near ${place}`, coords),
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
        key: playgroundKey(name, { latitude, longitude }, element.id ? `osm-${element.type}-${element.id}` : ''),
        name,
        type,
        distance: formatDistance(miles),
        sortDistance: miles,
        latitude,
        longitude,
        address: element.tags?.['addr:full'] || element.tags?.['addr:street'] || '',
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
  state.selectedPlaygroundKey = '';
  state.playDatePlaygroundKey = '';
  state.playDates = [];
  state.playDateStatus = 'Choose a playground to view public play dates.';
  state.playDateFormStatus = '';
  state.familyEvents = [];
  state.familyEventsStatus = 'Save a home city or location to find weekend events.';
  state.familyEventsMeta = null;
  state.familyEventsRequestKey = '';
}

export function formatLocation(location) {
  if (!location) return 'No location saved';
  if (location.source === 'child-profile' && location.address) return `Home city: ${location.address}`;
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
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
    state.nearbyStatus = 'Using starter ideas until a home city or location is saved.';
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

function familyEventRequestKey(state) {
  const location = getUserLocation(state);
  const childProfile = getChildProfile(state.user);
  return [
    state.user?.id || '',
    shortLocation(location).toLowerCase(),
    childProfile.id || '',
    childProfile.birthday || '',
    childProfile.ageLabel || '',
  ].join('|');
}

async function loadFamilyEvents(ctx, options = {}) {
  const { state } = ctx;
  if (!state.user) return;

  const location = getUserLocation(state);
  if (!location) {
    state.familyEvents = [];
    state.familyEventsMeta = null;
    state.familyEventsRequestKey = '';
    state.familyEventsStatus = 'Save a home city or location to find weekend events.';
    if (state.tab === 'play') ctx.renderCurrent();
    return;
  }

  const requestKey = familyEventRequestKey(state);
  if (!options.force && state.familyEventsRequestKey === requestKey && state.familyEventsMeta) {
    return;
  }

  const requestId = ++familyEventRequestId;
  state.familyEventsRequestKey = requestKey;
  state.familyEventsStatus = `Checking weekend events around ${shortLocation(location)}...`;
  if (state.tab === 'play') ctx.renderCurrent();

  try {
    const payload = await apiRequest(`/family-events${options.force ? '?refresh=1' : ''}`);
    if (requestId !== familyEventRequestId) return;
    state.familyEvents = Array.isArray(payload.events) ? payload.events : [];
    state.familyEventsMeta = payload;
    const locationCity = payload.locationCity || shortLocation(location);
    const sourceLabel = payload.sourceLabel || 'family event sources';
    const dateLabel = payload.dateRangeLabel ? ` for ${payload.dateRangeLabel}` : '';
    if (payload.fallback) {
      state.familyEventsStatus = `No parsed event cards matched ${locationCity}${dateLabel}; showing live search sources.`;
    } else {
      const cacheLabel = payload.cached ? 'cached' : 'updated';
      state.familyEventsStatus = `Showing ${state.familyEvents.length} ${cacheLabel} ${sourceLabel} event${state.familyEvents.length === 1 ? '' : 's'} near ${locationCity}${dateLabel}.`;
    }
  } catch (error) {
    if (requestId !== familyEventRequestId) return;
    state.familyEvents = [];
    state.familyEventsMeta = null;
    state.familyEventsStatus = `Could not load weekend events: ${error.message}`;
  }

  if (state.tab === 'play') ctx.renderCurrent();
}

export function refreshFamilyEvents(ctx) {
  loadFamilyEvents(ctx, { force: true });
}

export function refreshPlayPlanning(ctx) {
  loadWeather(ctx);
  loadNearbyPlayOptions(ctx);
  loadFamilyEvents(ctx);
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

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function timeInputValue(date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function defaultPlayDateWindow() {
  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const minutes = startsAt.getMinutes();
  startsAt.setMinutes(minutes < 30 ? 30 : 0, 0, 0);
  if (minutes >= 30) startsAt.setHours(startsAt.getHours() + 1);
  if (startsAt.getHours() * 60 + startsAt.getMinutes() + 90 >= 24 * 60) {
    startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(15, 0, 0, 0);
  }
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
  return {
    date: dateInputValue(startsAt),
    startTime: timeInputValue(startsAt),
    endTime: timeInputValue(endsAt),
  };
}

function combineDateAndTime(date, time) {
  if (!date || !time) throw new Error('Choose a date, start time, and end time.');
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new Error('Choose a valid play date time.');
  return value;
}

function playDateWindowFromForm(date, startTime, endTime) {
  const startsAt = combineDateAndTime(date, startTime);
  const endsAt = combineDateAndTime(date, endTime);
  if (endsAt <= startsAt) throw new Error('End time must be after the start time.');
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function timeValueToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTimeValue(minutes) {
  return `${padDatePart(Math.floor(minutes / 60))}:${padDatePart(minutes % 60)}`;
}

function nextEndTimeValue(startTime) {
  const startMinutes = timeValueToMinutes(startTime);
  if (startMinutes === null || startMinutes >= 23 * 60 + 59) return '';
  return minutesToTimeValue(Math.min(startMinutes + 30, 23 * 60 + 59));
}

function getPlayDateFormControl(form, name) {
  return form.elements.namedItem(name);
}

function updatePlayDateTimeConstraints(form, options = {}) {
  const startInput = getPlayDateFormControl(form, 'playdate-start');
  const endInput = getPlayDateFormControl(form, 'playdate-end');
  const startMinutes = timeValueToMinutes(startInput?.value);
  const endMinutes = timeValueToMinutes(endInput?.value);

  if (!startInput || !endInput) return true;
  if (startInput.value) {
    endInput.min = startInput.value;
  } else {
    endInput.removeAttribute('min');
  }

  if (options.adjustEnd && startMinutes !== null && (endMinutes === null || endMinutes <= startMinutes)) {
    endInput.value = nextEndTimeValue(startInput.value);
  }

  const nextEndMinutes = timeValueToMinutes(endInput.value);
  const valid = startMinutes === null || nextEndMinutes === null || nextEndMinutes > startMinutes;
  endInput.setCustomValidity(valid ? '' : 'End time must be after the start time.');
  return valid;
}

function formatPlayDateWindow(playDate) {
  const startsAt = new Date(playDate.startsAt);
  const endsAt = new Date(playDate.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return 'Time pending';
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${start} - ${end}`;
}

function selectedPlayground(playOptions, selectedKey) {
  return playOptions.find((option) => option.key === selectedKey) || playOptions[0] || null;
}

async function loadPlayDates(ctx, playground) {
  const { state } = ctx;
  if (!playground?.key) return;

  const requestId = ++playDateRequestId;
  state.playDatePlaygroundKey = playground.key;
  state.playDates = [];
  state.playDateStatus = `Loading play dates at ${playground.name}...`;
  if (state.tab === 'play') ctx.renderCurrent();

  try {
    const { playDates } = await apiRequest(`/playdates?playgroundKey=${encodeURIComponent(playground.key)}`);
    if (requestId !== playDateRequestId) return;
    state.playDates = Array.isArray(playDates) ? playDates : [];
    state.playDateStatus = state.playDates.length > 0
      ? `Showing ${state.playDates.length} upcoming play date${state.playDates.length === 1 ? '' : 's'} at ${playground.name}.`
      : `No play dates yet at ${playground.name}. Create one to invite nearby families.`;
  } catch (error) {
    if (requestId !== playDateRequestId) return;
    state.playDates = [];
    state.playDateStatus = `Could not load play dates: ${error.message}`;
  }

  if (state.tab === 'play') ctx.renderCurrent();
}

function selectPlayground(ctx, key) {
  const { state } = ctx;
  const playground = selectedPlayground(getRecommendedPlayOptions(state), key);
  if (!playground) return;

  state.selectedPlaygroundKey = playground.key;
  state.playDatePlaygroundKey = '';
  state.playDates = [];
  state.playDateFormStatus = '';
  ctx.renderCurrent();
  loadPlayDates(ctx, playground);
}

async function createPlayDate(ctx, event, playground) {
  const { state } = ctx;
  event.preventDefault();
  if (!playground?.key) return;
  if (!updatePlayDateTimeConstraints(event.currentTarget)) {
    state.playDateFormStatus = 'End time must be after the start time.';
    event.currentTarget.reportValidity?.();
    ctx.renderCurrent();
    return;
  }

  const form = new FormData(event.currentTarget);
  let payload;
  try {
    const date = form.get('playdate-date');
    const playDateWindow = playDateWindowFromForm(date, form.get('playdate-start'), form.get('playdate-end'));
    payload = {
      playgroundKey: playground.key,
      playgroundName: playground.name,
      playgroundType: playground.type,
      playgroundAddress: playground.address || '',
      playgroundLatitude: playground.latitude ?? null,
      playgroundLongitude: playground.longitude ?? null,
      startsAt: playDateWindow.startsAt,
      endsAt: playDateWindow.endsAt,
      visibility: form.get('playdate-visibility'),
      ageRange: form.get('playdate-age-range'),
      maxFamilies: form.get('playdate-max-families'),
      notes: form.get('playdate-notes'),
    };
  } catch (error) {
    state.playDateFormStatus = error.message;
    ctx.renderCurrent();
    return;
  }

  state.playDateFormStatus = 'Creating play date...';
  ctx.renderCurrent();

  try {
    await apiRequest('/playdates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.playDateFormStatus = payload.visibility === 'private'
      ? 'Private play date created. Only this family profile can see it.'
      : 'Public play date created. Other signed-in families can find it from this playground.';
    await loadPlayDates(ctx, playground);
  } catch (error) {
    state.playDateFormStatus = `Could not create play date: ${error.message}`;
    ctx.renderCurrent();
  }
}

async function joinPlayDate(ctx, playDateId, playground) {
  const { state } = ctx;
  if (!playDateId || !playground?.key) return;

  state.playDateFormStatus = 'Joining play date...';
  ctx.renderCurrent();

  try {
    await apiRequest('/playdates', {
      method: 'PUT',
      body: JSON.stringify({ playDateId }),
    });
    state.playDateFormStatus = 'Joined. This play date is now on your family profile.';
    await loadPlayDates(ctx, playground);
  } catch (error) {
    state.playDateFormStatus = `Could not join play date: ${error.message}`;
    ctx.renderCurrent();
  }
}

function playDateCapacity(playDate) {
  const count = Number(playDate.participantCount) || 0;
  return playDate.maxFamilies ? `${count}/${playDate.maxFamilies} families` : `${count} ${count === 1 ? 'family' : 'families'}`;
}

function renderPlayDateCard(playDate) {
  const visibility = playDate.visibility === 'private' ? 'Private' : 'Public';
  const action = playDate.isHost
    ? '<button type="button" class="secondary-button small-button" disabled>Hosting</button>'
    : playDate.isJoined
      ? '<button type="button" class="secondary-button small-button" disabled>Joined</button>'
      : playDate.canJoin
        ? `<button type="button" class="small-button" data-join-playdate="${escapeAttribute(playDate.id)}">Join</button>`
        : '<button type="button" class="secondary-button small-button" disabled>Full</button>';

  return `<article class="event-card playdate-card ${escapeAttribute(playDate.visibility)}"><span>${escapeHtml(visibility)} • ${escapeHtml(playDateCapacity(playDate))}</span><h3>${escapeHtml(formatPlayDateWindow(playDate))}</h3><p>${escapeHtml(playDate.ageRange || 'Family-friendly play')}</p>${playDate.notes ? `<small>${escapeHtml(playDate.notes)}</small>` : ''}<div class="playdate-card-footer"><small>Host: ${escapeHtml(playDate.hostLabel || 'Another family')}</small>${action}</div></article>`;
}

function renderPlayDateList(state, playground) {
  if (!playground) return '<p class="muted">Choose a playground to view play dates.</p>';
  if (state.playDatePlaygroundKey !== playground.key) return '<p class="muted">Loading play dates for the selected playground...</p>';
  if (!state.playDates?.length) return '<p class="muted">No upcoming public play dates here yet. Create a public one for nearby families, or keep it private for your own plan.</p>';
  return state.playDates.map(renderPlayDateCard).join('');
}

function renderFamilyEventCard(event) {
  const badgeParts = [
    event.theme || (event.resultType === 'search-link' ? 'Search source' : 'Family event'),
    event.free === true ? 'Free' : '',
    event.sourceLabel || '',
  ].filter(Boolean);
  const detailParts = [
    event.dateLabel || '',
    event.timeLabel || '',
    event.venue || '',
  ].filter(Boolean);
  const actionLabel = event.resultType === 'search-link' ? 'Open source' : 'Open event';
  const cardClass = event.resultType === 'search-link' ? 'event-card search-link-card' : 'event-card';
  return `<article class="${cardClass}"><span>${escapeHtml(badgeParts.join(' • '))}</span><h3>${escapeHtml(event.title || 'Family event')}</h3><p>${escapeHtml(event.summary || 'Family-friendly weekend option.')}</p>${detailParts.length ? `<small>${escapeHtml(detailParts.join(' • '))}</small>` : ''}${event.url ? `<div class="play-card-actions"><a class="mini-link" href="${escapeAttribute(event.url)}" target="_blank" rel="noreferrer">${actionLabel}</a></div>` : ''}</article>`;
}

function renderFamilyEvents(state) {
  if (!state.familyEventsMeta && state.familyEventsStatus?.startsWith('Checking')) {
    return '<p class="muted">Loading weekend event sources...</p>';
  }
  if (!state.familyEvents?.length) {
    return '<p class="muted">Weekend event sources will appear after your home city or location is available.</p>';
  }
  return state.familyEvents.map(renderFamilyEventCard).join('');
}

export function renderPlay(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const ageLabel = childAgeLabel(childProfile);
  const playOptions = getRecommendedPlayOptions(state);
  const currentPlayground = selectedPlayground(playOptions, state.selectedPlaygroundKey);
  const defaults = defaultPlayDateWindow();
  const location = getUserLocation(state);
  const locationText = formatLocation(location);
  const locationStatus = state.locationStatus || (location?.source === 'child-profile'
    ? 'Using the home city from the child profile. Save a precise place for live weather.'
    : location
      ? 'This location is saved only for the signed-in user.'
      : 'No location saved. Use current location to allow browser permission.');
  if (currentPlayground && state.selectedPlaygroundKey !== currentPlayground.key) {
    state.selectedPlaygroundKey = currentPlayground.key;
  }
  if (currentPlayground && state.playDatePlaygroundKey !== currentPlayground.key) {
    const selectedKey = currentPlayground.key;
    const loadSelected = () => {
      if (state.tab === 'play' && state.selectedPlaygroundKey === selectedKey && state.playDatePlaygroundKey !== selectedKey) {
        loadPlayDates(ctx, currentPlayground);
      }
    };
    if (globalThis.queueMicrotask) {
      globalThis.queueMicrotask(loadSelected);
    } else {
      Promise.resolve().then(loadSelected);
    }
  }
  const playOptionsMarkup = playOptions.length > 0
    ? playOptions.map((option) => {
      const isSelected = currentPlayground?.key === option.key;
      return `<article class="mini-card play-card ${isSelected ? 'selected' : ''}">${icon(option.preference === 'indoor' ? '🏠' : '🌳')}<div class="play-card-body"><h3>${escapeHtml(option.name)}</h3><p>${escapeHtml(option.type)} • ${escapeHtml(option.distance)}</p><small>${escapeHtml(option.best)} • Best: ${escapeHtml(option.weather)}</small><div class="play-card-actions"><button type="button" class="secondary-button small-button" data-select-playground="${escapeAttribute(option.key)}" aria-pressed="${isSelected ? 'true' : 'false'}">${isSelected ? 'Selected' : 'View play dates'}</button>${option.href ? `<a class="mini-link" href="${escapeAttribute(option.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div></div></article>`;
    }).join('')
    : '<p class="muted">Save a location to generate nearby indoor and outdoor play options.</p>';
  const currentPlaygroundMarkup = currentPlayground
    ? `<div class="playground-summary"><p class="eyebrow">${currentPlayground.preference === 'indoor' ? 'Indoor backup' : 'Selected playground'}</p><h2>${escapeHtml(currentPlayground.name)}</h2><p>${escapeHtml(currentPlayground.type)} • ${escapeHtml(currentPlayground.distance)}</p><small>${escapeHtml(currentPlayground.best)} • Best: ${escapeHtml(currentPlayground.weather)}</small>${currentPlayground.href ? `<a class="primary-link" href="${escapeAttribute(currentPlayground.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div><form id="playdate-form" class="playdate-form"><div class="form-grid"><label><span>Date</span><input name="playdate-date" type="date" value="${escapeAttribute(defaults.date)}" required /></label><label><span>Start</span><input name="playdate-start" type="time" value="${escapeAttribute(defaults.startTime)}" required /></label><label><span>End</span><input name="playdate-end" type="time" min="${escapeAttribute(defaults.startTime)}" value="${escapeAttribute(defaults.endTime)}" required /></label><label><span>Status</span><select name="playdate-visibility"><option value="private">Private</option><option value="public">Public</option></select></label><label><span>Age range</span><input name="playdate-age-range" placeholder="${ageLabel ? `Around ${escapeAttribute(ageLabel)}` : 'Ages 2-4'}" maxlength="40" /></label><label><span>Max families</span><input name="playdate-max-families" type="number" min="2" max="20" placeholder="No limit" /></label></div><label class="input-label" for="playdate-notes">Notes</label><textarea id="playdate-notes" name="playdate-notes" maxlength="240" placeholder="Splash pad, snacks, stroller-friendly meetup spot"></textarea><button type="submit">Create play date</button></form>${state.playDateFormStatus ? `<p class="muted">${escapeHtml(state.playDateFormStatus)}</p>` : ''}`
    : '<p class="muted">Save a location or choose a starter place to create a play date.</p>';

  ctx.layout(`<main class="stack"><section class="dashboard-row"><div class="panel weather-panel"><p class="eyebrow">🌤 Live play planning</p><h2>Find a nearby place for ${escapeHtml(childName)}</h2><p class="muted">Home base: ${escapeHtml(locationText)}</p><p>Pick a playground, create a private or public play date, or join a public play date already planned there.</p><div class="weather-grid"><strong>${escapeHtml(state.weather.label)}</strong><span>${escapeHtml(state.weather.temperature)}</span><span>Rain: ${escapeHtml(state.weather.precipitation)}</span><span>Wind: ${escapeHtml(state.weather.wind)}</span></div><small>Updated: ${escapeHtml(state.weather.updated)}. Weather still helps decide whether to choose an outdoor spot or an indoor backup.</small></div><div class="panel location-tool">${icon('📍')}<h3>Planning location</h3><p>${escapeHtml(locationStatus)}</p><form id="location-form"><label class="input-label" for="location-address">Address or place</label><input id="location-address" value="${escapeAttribute(location?.address || '')}" placeholder="Home address, city, or favorite play area" /><button type="submit">Save address</button></form><button id="use-current-location" class="secondary-button">Use current location</button></div></section><section class="grid playdate-layout"><div class="panel"><h2>Nearby play options</h2><p class="muted">${escapeHtml(state.nearbyStatus)}</p><div class="cards-list">${playOptionsMarkup}</div></div><div class="panel playdate-detail">${currentPlaygroundMarkup}</div></section><section class="panel"><div class="section-heading"><div><h2>Upcoming play dates</h2><p class="muted">${escapeHtml(state.playDateStatus)}</p></div><button id="refresh-playdates" type="button" class="secondary-button small-button" ${currentPlayground ? '' : 'disabled'}>Refresh</button></div><div class="cards-list">${renderPlayDateList(state, currentPlayground)}</div></section><section class="grid two-cols"><div class="panel"><div class="section-heading"><div><h2>Weekend family events</h2><p class="muted">${escapeHtml(state.familyEventsStatus || 'Checking weekend event sources...')}</p></div><button id="refresh-family-events" type="button" class="secondary-button small-button">Refresh</button></div>${renderFamilyEvents(state)}</div><div class="panel"><h2>Holiday planning reminders</h2>${holidays.map(([holiday, reminder]) => `<article class="mini-card">${icon('🎁')}<div><h3>${holiday === 'Birthday' ? `${escapeHtml(childDisplayName(childProfile, 'Child'))}'s birthday` : holiday}</h3><p>${reminder}</p></div></article>`).join('')}</div></section></main>`);

  document.getElementById('location-form').addEventListener('submit', (event) => saveManualLocation(ctx, event));
  document.getElementById('use-current-location').addEventListener('click', () => requestCurrentLocation(ctx));
  document.querySelectorAll('[data-select-playground]').forEach((button) => {
    button.addEventListener('click', () => selectPlayground(ctx, button.dataset.selectPlayground));
  });
  const playDateForm = document.getElementById('playdate-form');
  if (playDateForm) {
    const startInput = getPlayDateFormControl(playDateForm, 'playdate-start');
    const endInput = getPlayDateFormControl(playDateForm, 'playdate-end');
    updatePlayDateTimeConstraints(playDateForm);
    startInput?.addEventListener('input', () => updatePlayDateTimeConstraints(playDateForm, { adjustEnd: true }));
    endInput?.addEventListener('input', () => updatePlayDateTimeConstraints(playDateForm));
    playDateForm.addEventListener('submit', (event) => createPlayDate(ctx, event, currentPlayground));
  }
  document.getElementById('refresh-playdates')?.addEventListener('click', () => loadPlayDates(ctx, currentPlayground));
  document.getElementById('refresh-family-events')?.addEventListener('click', () => loadFamilyEvents(ctx, { force: true }));
  document.querySelectorAll('[data-join-playdate]').forEach((button) => {
    button.addEventListener('click', () => joinPlayDate(ctx, button.dataset.joinPlaydate, currentPlayground));
  });
}
