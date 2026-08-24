import { apiRequest, downloadCalendar, escapeAttribute, escapeHtml, fetchWithTimeout, icon, readStoredValue, writeStoredValue } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile, normalizePlayPreferences } from '../../lib/profile-defaults.js';
import { removePlannedEvent, savePlannedEvent } from '../family-plans.js';
import { hasGoogleMapsKey, renderGooglePlayMap } from '../google-map.js';

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

const holidayDefinitions = [
  ['New Year’s Day', (year) => [year, 1, 1], 'Reset routines, update the family calendar, and plan an easy first-week activity.'],
  ['Valentine’s Day', (year) => [year, 2, 14], 'Pick a simple toddler craft, family treat, or low-key kindness activity.'],
  ['Easter', easterDate, 'Plan an egg hunt or weather-friendly spring activity.'],
  ['Memorial Day', (year) => lastWeekdayOfMonth(year, 5, 1), 'Check travel plans and find a relaxed outdoor activity for the long weekend.'],
  ['Independence Day', (year) => [year, 7, 4], 'Plan around naps, heat, crowds, and a quieter alternative to fireworks.'],
  ['Labor Day', (year) => firstWeekdayOfMonth(year, 9, 1, 1), 'Plan the last summer outing, a park day, or an easy long-weekend reset.'],
  ['Halloween', (year) => [year, 10, 31], 'Choose a comfortable costume, practice trick-or-treating, and plan a calm wind-down.'],
  ['Veterans Day', (year) => [year, 11, 11], 'Look for a community event or a simple family gratitude activity.'],
  ['Thanksgiving', (year) => nthWeekdayOfMonth(year, 11, 4, 4), 'Choose a menu, confirm travel or hosting plans, and start a toddler-friendly activity basket.'],
  ['Christmas / winter holidays', (year) => [year, 12, 25], 'Start the gift list, outfits, childcare calendar, and shipping deadline check.'],
];

function dateFromParts([year, month, day]) {
  return new Date(year, month - 1, day);
}

function firstWeekdayOfMonth(year, month, weekday) {
  const date = new Date(year, month - 1, 1);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

function lastWeekdayOfMonth(year, month, weekday) {
  const date = new Date(year, month, 0);
  date.setDate(date.getDate() - ((date.getDay() - weekday + 7) % 7));
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

function nthWeekdayOfMonth(year, month, nth, weekday) {
  const date = dateFromParts(firstWeekdayOfMonth(year, month, weekday));
  date.setDate(date.getDate() + (nth - 1) * 7);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [year, month, day];
}

function dateOnlyValue(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatHolidayDate(date) {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(date, now) {
  return Math.round((dateOnlyValue(date) - dateOnlyValue(now)) / 86400000);
}

function holidayTiming(days) {
  if (days <= 14) return 'This is coming up soon—keep plans simple and flexible.';
  if (days <= 45) return 'A good time to make the first plan and check the family calendar.';
  return 'A gentle early reminder so there is time to plan without a last-minute rush.';
}

export function getUpcomingHolidayPlanning(now = new Date(), childProfile = null, limit = 3) {
  const candidates = [];
  for (const [name, getDate, reminder] of holidayDefinitions) {
    const year = now.getFullYear();
    for (const candidateYear of [year, year + 1]) {
      const date = dateFromParts(getDate(candidateYear));
      if (date >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        candidates.push({ name, date, reminder, daysUntil: daysUntil(date, now) });
      }
    }
  }
  const birthday = childProfile?.birthday ? new Date(`${childProfile.birthday}T00:00:00`) : null;
  if (birthday && !Number.isNaN(birthday.getTime())) {
    birthday.setFullYear(now.getFullYear());
    if (birthday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) birthday.setFullYear(now.getFullYear() + 1);
    candidates.push({ name: `${childDisplayName(childProfile, 'Child')}'s birthday`, date: birthday, reminder: 'Choose a theme, guest list, cake, gift ideas, and nap-friendly party time.', daysUntil: daysUntil(birthday, now), personalized: true });
  }
  return candidates.sort((a, b) => a.date - b.date).slice(0, limit).map((holiday, index) => ({
    ...holiday,
    dateLabel: formatHolidayDate(holiday.date),
    countdown: holiday.daysUntil === 0 ? 'Today' : holiday.daysUntil === 1 ? 'Tomorrow' : `In ${holiday.daysUntil} days`,
    timing: index === 0 ? holidayTiming(holiday.daysUntil) : '',
  }));
}

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
    const aTypePriority = indoorFirst
      ? (a.type === 'Indoor play' ? 0 : a.type === 'Indoor library' ? 1 : 2)
      : (a.type === 'Outdoor playground' ? 0 : a.type === 'Outdoor park' ? 1 : 2);
    const bTypePriority = indoorFirst
      ? (b.type === 'Indoor play' ? 0 : b.type === 'Indoor library' ? 1 : 2)
      : (b.type === 'Outdoor playground' ? 0 : b.type === 'Outdoor park' ? 1 : 2);
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    if (aTypePriority !== bTypePriority) return aTypePriority - bTypePriority;
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

export function resetPlayState(state) {
  state.locationStatus = '';
  state.weather = { label: 'Location needed for weather', temperature: '--', precipitation: '--', wind: '--', updated: 'Sign in and save a location' };
  state.nearbyPlayOptions = [];
  state.nearbyPlayDates = [];
  state.nearbyPlayDatesRequestKey = '';
  state.mapZoom = 1;
  state.nearbyStatus = 'Save a location to personalize nearby play options.';
  state.selectedPlaygroundKey = '';
  state.playgroundDetailKey = '';
  state.playDatePlaygroundKey = '';
  state.playDates = [];
  state.profilePlayDates = [];
  state.playdateFocus = '';
  state.playFocus = '';
  state.playDateStatus = 'Choose a playground to view public play dates.';
  state.playDateFormStatus = '';
  state.playDateShareStatus = '';
  state.editingPlayDateId = '';
  state.sharedPlayDateId = '';
  state.sharedPlayDate = null;
  state.sharedPlayDateStatus = '';
  state.familyEvents = [];
  state.familyEventsStatus = 'Save a home city or location to find weekend events.';
  state.familyEventsMeta = null;
  state.familyEventsRequestKey = '';
}

async function loadSharedPlayDate(ctx) {
  const { state } = ctx;
  if (!state.sharedPlayDateId || state.sharedPlayDateStatus === 'loading') return;
  state.sharedPlayDateStatus = 'loading';
  ctx.renderCurrent();
  try {
    const { playDate } = await apiRequest(`/playdates/${encodeURIComponent(state.sharedPlayDateId)}`);
    state.sharedPlayDate = playDate || null;
    state.sharedPlayDateStatus = playDate ? 'ready' : 'This playdate is no longer available.';
  } catch (error) {
    state.sharedPlayDate = null;
    state.sharedPlayDateStatus = error.message || 'Could not load this playdate.';
  }
  ctx.renderCurrent();
}

function sharedPlayDateDate(playDate) {
  const start = new Date(playDate.startsAt);
  const end = new Date(playDate.endsAt);
  return {
    date: start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
    time: `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
  };
}

async function manageSharedPlayDate(ctx, action) {
  const { state } = ctx;
  if (!state.sharedPlayDateId) return;
  state.sharedPlayDateStatus = action === 'join' ? 'joining' : 'updating';
  ctx.renderCurrent();
  try {
    const payload = action === 'join'
      ? { method: 'PUT', body: JSON.stringify({ playDateId: state.sharedPlayDateId }) }
      : { method: 'PATCH', body: JSON.stringify({ playDateId: state.sharedPlayDateId, action: 'respond', response: 'declined' }) };
    const { playDate } = await apiRequest('/playdates', payload);
    state.sharedPlayDate = playDate || state.sharedPlayDate;
    state.sharedPlayDateStatus = action === 'join' ? 'joined' : 'declined';
    await loadUserPlayDates(ctx);
  } catch (error) {
    state.sharedPlayDateStatus = error.message || 'Could not update this playdate.';
  }
  ctx.renderCurrent();
}

export function renderSharedPlayDate(ctx) {
  const { state } = ctx;
  const playDate = state.sharedPlayDate;
  const isJoined = Boolean(playDate?.isJoined) || state.sharedPlayDateStatus === 'joined';
  const isDeclined = Boolean(playDate?.isDeclined) || state.sharedPlayDateStatus === 'declined';
  const date = playDate ? sharedPlayDateDate(playDate) : null;
  const capacity = playDate?.maxFamilies ? `${playDate.participantCount || 0} of ${playDate.maxFamilies} families` : `${playDate?.participantCount || 0} families joined`;
  const actionMarkup = !playDate
    ? ''
    : isJoined
      ? `<button type="button" class="secondary-button" data-shared-playdate-action="decline">Can’t attend</button><span class="shared-join-confirmation">✓ You’re on the guest list</span>`
      : isDeclined
        ? `<button type="button" data-shared-playdate-action="join">Keep attending</button>`
        : playDate.canJoin
          ? `<button type="button" data-shared-playdate-action="join">Join this playdate <span>→</span></button>`
          : '<button type="button" class="secondary-button" disabled>This playdate is full</button>';

  ctx.layout(`<main class="shared-playdate-page"><div class="shared-playdate-back"><button type="button" class="text-button" id="close-shared-playdate">← Back to playdates</button></div>${state.sharedPlayDateStatus === 'loading' ? '<section class="panel shared-playdate-loading"><p class="eyebrow">Shared invitation</p><h1>Loading the playdate…</h1><p class="muted">Getting the details so your family can decide if it feels like a good fit.</p></section>' : playDate ? `<section class="shared-playdate-grid"><section class="panel shared-playdate-main"><div class="shared-playdate-kicker"><span class="share-live-dot" /> Shared by a nearby family</div><p class="eyebrow">Your kid’s next friend could be closer than you think</p><h1>Make room for an easy hello.</h1><p class="shared-playdate-lede">A family is planning a low-key meetup at <strong>${escapeHtml(playDate.playgroundName)}</strong>. Join if it fits your day.</p><div class="shared-playdate-details"><div class="shared-detail-icon">✦</div><div><strong>${escapeHtml(date.date)}</strong><span>${escapeHtml(date.time)}</span></div></div><div class="shared-detail-location"><span>⌖</span><div><strong>${escapeHtml(playDate.playgroundName)}</strong><small>${escapeHtml(playDate.playgroundAddress || playDate.playgroundType || 'Neighborhood playground')}</small></div></div>${playDate.notes ? `<p class="shared-playdate-note">“${escapeHtml(playDate.notes)}”</p>` : ''}<div class="shared-playdate-actions">${actionMarkup}</div>${state.sharedPlayDateStatus !== 'ready' && !['joined', 'declined'].includes(state.sharedPlayDateStatus) ? `<p class="form-status">${escapeHtml(state.sharedPlayDateStatus)}</p>` : ''}<p class="shared-privacy-note">Only your family profile is shared with the host after you join.</p></section><aside class="shared-playdate-side"><div class="shared-side-art"><img src="/illustrations/playdates.png" alt="Families meeting at a neighborhood playground" /></div><p class="eyebrow">A simple plan</p><h2>Less coordination. More play.</h2><p class="muted">SproutCue keeps the time, place, and family connection together so you can show up without a long group chat.</p><div class="shared-playdate-stats"><div><strong>${escapeHtml(capacity)}</strong><span>community momentum</span></div><div><strong>${escapeHtml(playDate.ageRange || 'Family-friendly')}</strong><span>suggested fit</span></div></div><button type="button" class="secondary-button shared-calendar-button" id="add-shared-calendar">＋ Add to calendar</button></aside></section>` : `<section class="panel shared-playdate-loading"><p class="eyebrow">Shared invitation</p><h1>We couldn’t find that playdate.</h1><p class="muted">It may have ended, been cancelled, or filled up. Browse nearby playdates to find another easy plan.</p><button type="button" id="close-shared-playdate">Explore playdates</button></section>`}</main>`);

  document.getElementById('close-shared-playdate')?.addEventListener('click', () => {
    state.sharedPlayDateId = '';
    state.sharedPlayDate = null;
    state.sharedPlayDateStatus = '';
    state.tab = 'play';
    const url = new URL(globalThis.location.href);
    url.searchParams.delete('playdate');
    globalThis.history.replaceState({}, '', `${url.pathname}${url.search}`);
    ctx.renderCurrent();
  });
  document.querySelectorAll('[data-shared-playdate-action]').forEach((button) => button.addEventListener('click', () => manageSharedPlayDate(ctx, button.dataset.sharedPlaydateAction)));
  document.getElementById('add-shared-calendar')?.addEventListener('click', () => downloadCalendar(`Playdate at ${playDate.playgroundName}`, playDate.startsAt, playDate.endsAt, playDate.notes || 'SproutCue playdate'));
  if (!playDate && state.sharedPlayDateStatus === '') loadSharedPlayDate(ctx);
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
    if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
    return;
  }

  state.weather = { label: 'Updating forecast...', temperature: '--', precipitation: '--', wind: '--', updated: `Checking ${shortLocation(getUserLocation(state))}` };
  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();

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
  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
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
    if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
    return;
  }

  if (!coords) {
    state.nearbyStatus = `Showing map searches for ${shortLocation(location)}. Use current location or a recognized place for live nearby results.`;
    if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
    return;
  }

  state.nearbyStatus = `Finding indoor and outdoor options near ${shortLocation(location)}...`;
  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();

  try {
    const { searchRadiusMiles } = normalizePlayPreferences(state.user?.playPreferences);
    const payload = await apiRequest(`/playgrounds?latitude=${coords.latitude}&longitude=${coords.longitude}&radiusMiles=${searchRadiusMiles}`);
    const nearbyOptions = Array.isArray(payload.playgrounds) ? payload.playgrounds : [];
    if (requestId !== nearbyRequestId) return;
    if (nearbyOptions.length > 0) {
      state.nearbyPlayOptions = nearbyOptions;
      const cacheLabel = payload.cached ? 'cached' : 'updated';
      state.nearbyStatus = `Showing ${nearbyOptions.length} ${cacheLabel} options within ${searchRadiusMiles} mile${searchRadiusMiles === 1 ? '' : 's'} of ${shortLocation(location)}.`;
    } else {
      state.nearbyPlayOptions = fallbackOptions;
      state.nearbyStatus = `No live nearby places found around ${shortLocation(location)}; showing map searches.`;
    }
  } catch (error) {
    if (requestId !== nearbyRequestId) return;
    state.nearbyPlayOptions = fallbackOptions;
    state.nearbyStatus = `Could not load nearby playgrounds: ${error.message}. Showing map searches for ${shortLocation(location)} instead.`;
  }

  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
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
  loadUserPlayDates(ctx);
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
      : '';
  } catch (error) {
    if (requestId !== playDateRequestId) return;
    state.playDates = [];
    state.playDateStatus = `Could not load play dates: ${error.message}`;
  }

  if (state.tab === 'play') ctx.renderCurrent();
}

function nearbyPlayDatesRequestKey(playgrounds) {
  return playgrounds.map((playground) => playground.key).filter(Boolean).join('|');
}

function playDateFilterRange(filter, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'today') {
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (filter === 'weekend') {
    const weekendStart = new Date(start);
    if (start.getDay() === 0) weekendStart.setDate(start.getDate() - 1);
    else if (start.getDay() !== 6) weekendStart.setDate(start.getDate() + (6 - start.getDay()));
    const weekendEnd = new Date(weekendStart);
    weekendEnd.setDate(weekendStart.getDate() + 2);
    return { start: weekendStart, end: weekendEnd };
  }
  return null;
}

export function filterNearbyPlayDates(playDates, filter = 'all', now = new Date()) {
  if (!Array.isArray(playDates) || filter === 'all') return Array.isArray(playDates) ? playDates : [];
  const range = playDateFilterRange(filter, now);
  if (!range) return Array.isArray(playDates) ? playDates : [];
  return playDates.filter((playDate) => {
    const startsAt = new Date(playDate.startsAt);
    return !Number.isNaN(startsAt.getTime()) && startsAt >= range.start && startsAt < range.end;
  });
}

async function loadNearbyPlayDates(ctx, playgrounds) {
  const { state } = ctx;
  const requestKey = nearbyPlayDatesRequestKey(playgrounds);
  if (!requestKey || state.nearbyPlayDatesRequestKey === requestKey) return;
  state.nearbyPlayDatesRequestKey = requestKey;
  try {
    const responses = await Promise.all(playgrounds.slice(0, 12).map(async (playground) => {
      const payload = await apiRequest(`/playdates?playgroundKey=${encodeURIComponent(playground.key)}`);
      return Array.isArray(payload.playDates) ? payload.playDates : [];
    }));
    const seen = new Set();
    state.nearbyPlayDates = responses.flat().filter((playDate) => {
      if (playDate.visibility !== 'public' || playDate.status === 'cancelled' || seen.has(playDate.id)) return false;
      seen.add(playDate.id);
      return true;
    }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  } catch {
    state.nearbyPlayDates = [];
  }
  if (state.tab === 'play') ctx.renderCurrent();
}

function playDateMapLabel(playDate) {
  const startsAt = new Date(playDate.startsAt);
  const time = Number.isNaN(startsAt.getTime()) ? 'Time set' : startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const count = Number(playDate.participantCount) || 0;
  return `${time} · ${count} ${count === 1 ? 'family' : 'families'}`;
}

function groupNearbyPlayDates(playDates) {
  const groups = new Map();
  playDates.forEach((playDate) => {
    const coordinateKey = `${playDate.playgroundLatitude || ''}|${playDate.playgroundLongitude || ''}`;
    const key = playDate.playgroundKey || coordinateKey || playDate.playgroundName || playDate.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(playDate);
  });
  return [...groups.values()];
}

async function loadUserPlayDates(ctx) {
  const { state } = ctx;
  if (!state.user) return;
  try {
    const { playDates } = await apiRequest('/playdates?mine=1');
    state.profilePlayDates = Array.isArray(playDates) ? playDates : [];
  } catch {
    state.profilePlayDates = [];
  }
  if (state.tab === 'home') ctx.renderCurrent();
}

function selectPlayground(ctx, key) {
  const { state } = ctx;
  const playground = selectedPlayground(getRecommendedPlayOptions(state), key);
  if (!playground) return;

  state.selectedPlaygroundKey = playground.key;
  state.playgroundDetailKey = '';
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
    state.nearbyPlayDatesRequestKey = '';
    await loadNearbyPlayDates(ctx, getRecommendedPlayOptions(state));
    await loadUserPlayDates(ctx);
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
    await loadUserPlayDates(ctx);
  } catch (error) {
    state.playDateFormStatus = `Could not join play date: ${error.message}`;
    ctx.renderCurrent();
  }
}

async function respondToPlayDate(ctx, playDateId, response, playground) {
  ctx.state.playDateFormStatus = response === 'joined' ? 'Keeping you on the playdate…' : 'Updating your attendance…';
  ctx.renderCurrent();
  try {
    await apiRequest('/playdates', { method: 'PATCH', body: JSON.stringify({ playDateId, action: 'respond', response }) });
    ctx.state.playDateFormStatus = response === 'joined' ? 'You are still attending.' : 'You are marked as unable to attend.';
    await loadPlayDates(ctx, playground);
    await loadUserPlayDates(ctx);
  } catch (error) {
    ctx.state.playDateFormStatus = `Could not update attendance: ${error.message}`;
    ctx.renderCurrent();
  }
}

function beginEditPlayDate(ctx, playDateId) {
  const playDate = ctx.state.playDates.find((item) => item.id === playDateId);
  if (!playDate || !playDate.isHost || playDate.visibility !== 'public') return;
  ctx.state.editingPlayDateId = playDateId;
  ctx.state.playDateFormStatus = '';
  ctx.renderCurrent();
}

function stopEditPlayDate(ctx) {
  ctx.state.editingPlayDateId = '';
  ctx.state.playDateFormStatus = '';
  ctx.renderCurrent();
}

async function saveEditedPlayDate(ctx, event, playground, playDate) {
  event.preventDefault();
  if (!updatePlayDateTimeConstraints(event.currentTarget)) {
    event.currentTarget.reportValidity?.();
    return;
  }
  const form = new FormData(event.currentTarget);
  const date = form.get('playdate-date');
  const window = playDateWindowFromForm(date, form.get('playdate-start'), form.get('playdate-end'));
  const payload = {
    playDateId: playDate.id,
    playgroundKey: playground.key,
    playgroundName: playground.name,
    playgroundType: playground.type,
    playgroundAddress: playground.address || '',
    playgroundLatitude: playground.latitude ?? null,
    playgroundLongitude: playground.longitude ?? null,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    visibility: 'public',
    ageRange: form.get('playdate-age-range'),
    maxFamilies: form.get('playdate-max-families'),
    notes: form.get('playdate-notes'),
  };
  ctx.state.playDateFormStatus = 'Saving play date changes…';
  ctx.renderCurrent();
  try {
    await apiRequest('/playdates', { method: 'PATCH', body: JSON.stringify(payload) });
    ctx.state.editingPlayDateId = '';
    ctx.state.playDateFormStatus = 'Updated. Attending families will see the change.';
    await loadPlayDates(ctx, playground);
    await loadUserPlayDates(ctx);
  } catch (error) {
    ctx.state.playDateFormStatus = `Could not update play date: ${error.message}`;
    ctx.renderCurrent();
  }
}

async function cancelPlayDate(ctx, playDateId, playground) {
  if (!globalThis.confirm?.('Cancel this public play date? Attending families will be notified.')) return;
  ctx.state.playDateFormStatus = 'Cancelling play date…';
  ctx.renderCurrent();
  try {
    await apiRequest('/playdates', { method: 'DELETE', body: JSON.stringify({ playDateId }) });
    ctx.state.editingPlayDateId = '';
    ctx.state.playDateFormStatus = 'Play date cancelled. Attending families will see the cancellation.';
    await loadPlayDates(ctx, playground);
    await loadUserPlayDates(ctx);
  } catch (error) {
    ctx.state.playDateFormStatus = `Could not cancel play date: ${error.message}`;
    ctx.renderCurrent();
  }
}

function playDateCapacity(playDate) {
  const count = Number(playDate.participantCount) || 0;
  return playDate.maxFamilies ? `${count}/${playDate.maxFamilies} families` : `${count} ${count === 1 ? 'family' : 'families'}`;
}

async function sharePlayDate(ctx, playDateId) {
  const shareUrl = `${globalThis.location.origin}/share/playdate/${encodeURIComponent(playDateId)}`;
  const shareData = { title: 'Your kid’s next friend could be closer than you think', text: 'Come join this family playdate on SproutCue.', url: shareUrl };
  try {
    if (typeof navigator.share === 'function') await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(shareUrl);
      ctx.state.playDateShareStatus = 'Share link copied to your clipboard.';
    }
  } catch (error) {
    if (error?.name !== 'AbortError') ctx.state.playDateShareStatus = 'Could not share the playdate link.';
  }
  ctx.renderCurrent();
}

function playDateUpdateKey(playDate) {
  return `${playDate.id}|${playDate.lastChangeSummary || ''}`;
}

function acknowledgedPlayDateUpdates(state) {
  const profileKey = state.user?.id || state.user?.email || 'family';
  try {
    return new Set(JSON.parse(readStoredValue(`sproutCuePlayDateUpdates:${profileKey}`, '[]')));
  } catch {
    return new Set();
  }
}

function acknowledgePlayDateUpdate(ctx, playDateId) {
  const playDate = ctx.state.playDates.find((item) => item.id === playDateId);
  if (!playDate?.lastChangeSummary) return;
  const profileKey = ctx.state.user?.id || ctx.state.user?.email || 'family';
  const acknowledged = acknowledgedPlayDateUpdates(ctx.state);
  acknowledged.add(playDateUpdateKey(playDate));
  writeStoredValue(`sproutCuePlayDateUpdates:${profileKey}`, JSON.stringify([...acknowledged].slice(-100)));
  ctx.renderCurrent();
}

function renderPlayDateCard(playDate, state) {
  const visibility = playDate.visibility === 'private' ? 'Private' : 'Public';
  const cancelled = playDate.status === 'cancelled';
  const acknowledged = acknowledgedPlayDateUpdates(state);
  const update = playDate.isJoined && playDate.lastChangeSummary && !acknowledged.has(playDateUpdateKey(playDate))
    ? `<p class="playdate-update"><strong>Updated:</strong> ${escapeHtml(playDate.lastChangeSummary)}</p>`
    : '';
  const action = cancelled
    ? '<span class="muted">Cancelled</span>'
    : playDate.isHost && playDate.visibility === 'public'
    ? `<button type="button" class="secondary-button small-button" data-edit-playdate="${escapeAttribute(playDate.id)}">Edit</button><button type="button" class="secondary-button small-button" data-share-playdate="${escapeAttribute(playDate.id)}">Share</button><button type="button" class="secondary-button small-button" data-cancel-playdate="${escapeAttribute(playDate.id)}">Cancel</button>`
    : playDate.isHost
      ? '<button type="button" class="secondary-button small-button" disabled>Hosting</button>'
    : playDate.isJoined
      ? `<button type="button" class="secondary-button small-button" data-decline-playdate="${escapeAttribute(playDate.id)}">Can’t attend</button>`
      : playDate.isDeclined
        ? `<button type="button" class="small-button" data-respond-playdate="${escapeAttribute(playDate.id)}">Keep attending</button>`
      : playDate.canJoin
        ? `<button type="button" class="small-button" data-join-playdate="${escapeAttribute(playDate.id)}">Join</button>`
        : '<button type="button" class="secondary-button small-button" disabled>Full</button>';
  const openChat = !cancelled && playDate.isJoined && playDate.participantCount > 1
    ? `<button type="button" class="play-card-chat-button" data-open-chat-playdate="${escapeAttribute(playDate.id)}"><span aria-hidden="true">◌</span> Open chat</button>`
    : '';

  return `<article class="event-card playdate-card ${escapeAttribute(playDate.visibility)} ${cancelled ? 'cancelled' : ''}"><span>${escapeHtml(cancelled ? 'Cancelled' : visibility)} • ${escapeHtml(playDateCapacity(playDate))}</span><h3>${escapeHtml(formatPlayDateWindow(playDate))}</h3><p>${escapeHtml(playDate.ageRange || 'Family-friendly play')}</p>${playDate.notes ? `<small>${escapeHtml(playDate.notes)}</small>` : ''}${cancelled ? `<p class="playdate-update">${escapeHtml(playDate.lastChangeSummary || 'This play date was cancelled by the host.')}</p>` : update}<div class="playdate-card-footer"><small>Host: ${escapeHtml(playDate.hostLabel || 'Another family')}</small><div class="play-card-actions">${openChat}${action}</div></div></article>`;
}

function renderPlayDateList(state, playground) {
  if (!playground) return '<p class="muted">Choose a playground to view play dates.</p>';
  if (state.playDatePlaygroundKey !== playground.key) return '<p class="muted">Loading play dates for the selected playground...</p>';
  if (!state.playDates?.length) return '';
  const acknowledged = acknowledgedPlayDateUpdates(state);
  const updates = state.playDates
    .filter((playDate) => playDate.isJoined && playDate.lastChangeSummary && !acknowledged.has(playDateUpdateKey(playDate)))
    .map((playDate) => `<div class="playdate-update-banner"><div><strong>Playdate update</strong><span>${escapeHtml(playDate.lastChangeSummary)}</span><small>${escapeHtml(formatPlayDateWindow(playDate))}</small></div><button type="button" class="icon-button" data-ack-playdate-update="${escapeAttribute(playDate.id)}" aria-label="Acknowledge playdate update" title="Acknowledge update">×</button></div>`)
    .join('');
  return `${updates}${state.playDateShareStatus ? `<p class="muted">${escapeHtml(state.playDateShareStatus)}</p>` : ''}${state.playDates.map((playDate) => renderPlayDateCard(playDate, state)).join('')}`;
}

function localDatePart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function localTimePart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(11, 16);
}

function renderEditPlayDateForm(playDate, ageLabel) {
  return `<div id="playdate-edit-backdrop" class="modal-backdrop"><section class="modal-dialog playdate-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="playdate-edit-title"><div class="section-heading"><div><p class="eyebrow">Public play date</p><h2 id="playdate-edit-title">Edit play date</h2><p class="muted">Attending families will see a summary of the change.</p></div><button type="button" class="icon-button" data-cancel-edit-playdate aria-label="Close edit play date dialog">×</button></div><form id="edit-playdate-form" class="playdate-form"><div class="form-grid"><label><span>Date</span><input name="playdate-date" type="date" value="${escapeAttribute(localDatePart(playDate.startsAt))}" required /></label><label><span>Start</span><input name="playdate-start" type="time" value="${escapeAttribute(localTimePart(playDate.startsAt))}" required /></label><label><span>End</span><input name="playdate-end" type="time" value="${escapeAttribute(localTimePart(playDate.endsAt))}" required /></label><label><span>Visibility</span><input value="Public — visible to nearby families" disabled /></label><label><span>Age range</span><input name="playdate-age-range" value="${escapeAttribute(playDate.ageRange || '')}" placeholder="${ageLabel ? `Around ${escapeAttribute(ageLabel)}` : 'Ages 2-4'}" maxlength="40" /></label><label><span>Max families</span><input name="playdate-max-families" type="number" min="2" max="20" value="${escapeAttribute(playDate.maxFamilies || '')}" placeholder="No limit" /></label></div><label class="input-label" for="edit-playdate-notes">Notes</label><textarea id="edit-playdate-notes" name="playdate-notes" maxlength="240">${escapeHtml(playDate.notes || '')}</textarea><div class="form-actions"><button type="submit">Save changes</button><button type="button" class="secondary-button" data-cancel-edit-playdate>Cancel</button></div></form></section></div>`;
}

function renderFamilyEventCard(event, state) {
  const badgeParts = [
    event.theme || (event.resultType === 'search-link' ? 'Search source' : 'Family event'),
    event.free === true ? 'Free' : '',
    event.sourceLabel || '',
  ].filter(Boolean);
  const cardClass = event.resultType === 'search-link' ? 'event-card search-link-card' : 'event-card';
  const image = event.imageUrl || 'https://images.unsplash.com/photo-1504150558240-0b4d9e5c0d87?auto=format&fit=crop&w=640&q=80';
  const attended = isFamilyEventAttended(event, state);
  const attendanceButton = `<button type="button" class="secondary-button small-button" data-attend-family-event="${escapeAttribute(familyEventId(event))}" aria-pressed="${attended ? 'true' : 'false'}">${attended ? 'Going' : 'Join'}</button>`;
  const eventMeta = [event.timeLabel || 'Time TBD', event.venue || 'ParentMap event'].filter(Boolean).join(' • ');
  return `<article class="${cardClass} event-card-with-thumb"><img class="resource-thumb" src="${escapeAttribute(image)}" alt="" loading="lazy" /><div class="event-card-main"><span>${escapeHtml(badgeParts[0] || 'Family event')}</span><h3>${escapeHtml(event.title || 'Family event')}</h3><small>${escapeHtml(eventMeta)}</small><div class="play-card-actions">${attendanceButton}</div></div><div class="event-card-date-pin-wrap">${eventDatePinMarkup(event)}</div></article>`;
}

function eventDatePinMarkup(event) {
  const date = event.date ? new Date(`${event.date}T12:00:00`) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const shortDate = validDate
    ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : event.dateLabel || 'Date';
  const weekday = validDate ? date.toLocaleDateString([], { weekday: 'short' }).toUpperCase() : 'DATE';
  const accessibleDate = validDate
    ? `${shortDate} • ${date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`
    : shortDate;
  const pinContent = `<strong>${escapeHtml(shortDate)}</strong><span>${escapeHtml(weekday)}</span>`;
  return event.url
    ? `<a class="event-date-pin" href="${escapeAttribute(event.url)}" target="_blank" rel="noreferrer" aria-label="View ${escapeAttribute(event.title || 'event')} details on ParentMap" title="${escapeAttribute(accessibleDate)}">${pinContent}</a>`
    : `<span class="event-date-pin" title="${escapeAttribute(accessibleDate)}">${pinContent}</span>`;
}

function familyEventId(event) {
  return [event.title, event.dateLabel, event.timeLabel, event.venue, event.url].filter(Boolean).join('|').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

function isFamilyEventAttended(event, state) {
  const id = familyEventId(event);
  return Boolean(event.attended || state.savedFamilyEvents?.some((item) => item.externalId === id && item.status !== 'cancelled'));
}

async function toggleFamilyEventAttendance(ctx, event) {
  const id = familyEventId(event);
  if (!id) return;
  const existing = (ctx.state.savedFamilyEvents || []).find((item) => item.externalId === id && item.status !== 'cancelled');
  const previousPlanEvents = ctx.state.savedFamilyEvents || [];
  const familyEvent = {
    kind: 'external_event',
    title: event.title || 'Family event',
    summary: event.summary || 'Family-friendly weekend option.',
    status: 'attending',
    source: event.source || 'parentmap',
    externalId: id,
    venue: event.venue || '',
    url: event.url || '',
    metadata: {
      dateLabel: event.dateLabel || '',
      date: event.date || '',
      timeLabel: event.timeLabel || '',
      imageUrl: event.imageUrl || '',
    },
  };
  ctx.state.apiMessage = existing ? 'Removing event from your family plans…' : 'Saving event to your family plans…';
  ctx.state.savedFamilyEvents = existing
    ? previousPlanEvents.filter((item) => item.id !== existing.id)
    : [...previousPlanEvents, { ...familyEvent, externalId: id }];
  ctx.renderCurrent();
  try {
    if (existing) await removePlannedEvent(existing.id);
    else {
      const response = await savePlannedEvent(familyEvent);
      const saved = response.item;
      ctx.state.savedFamilyEvents = ctx.state.savedFamilyEvents.map((item) => item.externalId === id ? saved : item);
    }
  } catch (error) {
    ctx.state.savedFamilyEvents = previousPlanEvents;
    ctx.state.apiMessage = 'Could not update event attendance.';
    ctx.renderCurrent();
  }
}

function renderFamilyEvents(state) {
  if (!state.familyEventsMeta && state.familyEventsStatus?.startsWith('Checking')) {
    return '<p class="muted">Loading weekend event sources...</p>';
  }
  if (!state.familyEvents?.length) {
    return '<p class="muted">Weekend event sources will appear after your home city or location is available.</p>';
  }
  return state.familyEvents.slice(0, 2).map((event) => renderFamilyEventCard(event, state)).join('');
}

function playgroundRecommendationReason(option, state) {
  const indoorWeather = isIndoorWeatherRecommended(state);
  const weatherFit = option.preference === (indoorWeather ? 'indoor' : 'outdoor')
    ? (indoorWeather ? 'an indoor weather backup' : 'outdoor play today')
    : (indoorWeather ? 'a weather-friendly outdoor option' : 'a backup if plans change');
  return `Recommended for ${weatherFit}; ${option.distance || 'nearby'} from your saved location.`;
}

export function renderPlay(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const ageLabel = childAgeLabel(childProfile);
  const upcomingHolidays = getUpcomingHolidayPlanning(new Date(), childProfile);
  const playOptions = getRecommendedPlayOptions(state);
  const currentPlayground = selectedPlayground(playOptions, state.selectedPlaygroundKey);
  if (playOptions.length > 0 && nearbyPlayDatesRequestKey(playOptions) !== state.nearbyPlayDatesRequestKey) {
    globalThis.queueMicrotask?.(() => loadNearbyPlayDates(ctx, playOptions));
  }
  const editingPlayDate = state.editingPlayDateId ? state.playDates.find((item) => item.id === state.editingPlayDateId) : null;
  const defaults = defaultPlayDateWindow();
  const location = getUserLocation(state);
  const { searchRadiusMiles } = normalizePlayPreferences(state.user?.playPreferences);
  const radiusMeters = searchRadiusMiles * 1609.344;
  const nearbyPlayDateFilter = state.nearbyPlayDateFilter || 'all';
  const filteredNearbyPlayDates = filterNearbyPlayDates(state.nearbyPlayDates, nearbyPlayDateFilter);
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
      const image = option.imageUrl || (option.preference === 'indoor' ? 'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=480&q=80' : 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=480&q=80');
      const highlight = Array.isArray(option.highlights) && option.highlights[0]
        ? option.highlights[0]
        : option.best || option.type;
      return `<article class="mini-card play-card compact-play-card ${isSelected ? 'selected' : ''}"><img class="resource-thumb" src="${escapeAttribute(image)}" alt="Thumbnail of ${escapeAttribute(option.name)}" loading="lazy" /><div class="play-card-body"><h3>${escapeHtml(option.name)}</h3><div class="play-card-meta-row"><div class="playground-highlights compact-playground-highlights"><span>${escapeHtml(highlight)}</span></div><button type="button" class="secondary-button small-button" data-view-playground-detail="${escapeAttribute(option.key)}">View detail</button><span class="playground-distance">${escapeHtml(option.distance || 'Nearby')}</span></div></div></article>`;
    }).join('')
    : '<p class="muted">Save a location to generate nearby indoor and outdoor play options.</p>';
  const mapZoom = Number(state.mapZoom) || 1;
  const groupedNearbyPlayDates = groupNearbyPlayDates(filteredNearbyPlayDates);
  const mapMarkup = hasGoogleMapsKey()
    ? `<div id="google-play-map" class="google-play-map" aria-label="Nearby play map"></div>`
    : `<div class="neighborhood-map" aria-label="Nearby play map"><div class="map-canvas" style="transform:scale(${mapZoom})"><div class="map-grid"></div><div class="map-water"></div><div class="map-road road-one"></div><div class="map-road road-two"></div><div class="map-label map-label-home">You are here</div><div class="map-label map-label-radius">${searchRadiusMiles} mi view</div>${playOptions.slice(0, 12).map((option, index) => `<button type="button" class="map-pin ${currentPlayground?.key === option.key ? 'selected' : ''}" style="--pin-x:${12 + ((index * 29) % 78)}%;--pin-y:${17 + ((index * 37) % 68)}%" data-select-playground="${escapeAttribute(option.key)}" aria-label="Select ${escapeAttribute(option.name)}"><span>${index + 1}</span><small>${escapeHtml(option.distance || 'Nearby')}</small></button>`).join('')}${groupedNearbyPlayDates.slice(0, 20).map((playDateGroup, index) => { const playDate = playDateGroup[0]; const playgroundIndex = Math.max(0, playOptions.findIndex((option) => option.key === playDate.playgroundKey)); const label = playDateGroup.length > 1 ? `${playDateGroup.length} playdates` : playDateMapLabel(playDate); const accessibleLabel = playDateGroup.length > 1 ? `${playDateGroup.length} playdates at ${playDate.playgroundName || 'nearby playground'}` : `View playdate at ${playDate.playgroundName || 'nearby playground'}: ${playDateMapLabel(playDate)}`; return `<button type="button" class="map-playdate-pill${playDateGroup.length > 1 ? ' clustered' : ''}" style="--pin-x:${8 + ((playgroundIndex * 29 + index * 11) % 84)}%;--pin-y:${12 + ((playgroundIndex * 37 + index * 17) % 74)}%" data-select-playground="${escapeAttribute(playDate.playgroundKey)}" aria-label="${escapeAttribute(accessibleLabel)}">${escapeHtml(label)}</button>`; }).join('')}${!playOptions.length ? '<div class="map-empty">Save a location to see nearby play</div>' : ''}</div><div class="map-controls" aria-label="Map zoom controls"><button type="button" data-map-zoom="out" aria-label="Zoom out">−</button><span>${Math.round(mapZoom * 100)}%</span><button type="button" data-map-zoom="in" aria-label="Zoom in">+</button></div></div>`;
  const playMapChipsMarkup = `<div class="play-map-chips" aria-label="Nearby playdate filters">${[['all', 'All'], ['today', 'Today'], ['weekend', 'Weekend']].map(([filter, label]) => `<button type="button" class="${nearbyPlayDateFilter === filter ? 'active' : ''}" data-playdate-filter="${filter}" aria-pressed="${nearbyPlayDateFilter === filter}">${label}</button>`).join('')}</div>`;
  const createPlayDateFormMarkup = currentPlayground
    ? `<div id="create-playdate-backdrop" class="modal-backdrop" hidden><section class="modal-dialog create-playdate-dialog" role="dialog" aria-modal="true" aria-labelledby="create-playdate-title"><div class="section-heading"><div><p class="eyebrow">New public playdate</p><h2 id="create-playdate-title">Plan at ${escapeHtml(currentPlayground.name)}</h2><p class="muted">Invite nearby families or keep this meetup private.</p></div><button type="button" class="icon-button" data-cancel-create-playdate aria-label="Close create playdate dialog">×</button></div><form id="playdate-form" class="playdate-form"><div class="form-grid"><label><span>Date</span><input name="playdate-date" type="date" value="${escapeAttribute(defaults.date)}" required /></label><label><span>Start</span><input name="playdate-start" type="time" value="${escapeAttribute(defaults.startTime)}" required /></label><label><span>End</span><input name="playdate-end" type="time" min="${escapeAttribute(defaults.startTime)}" value="${escapeAttribute(defaults.endTime)}" required /></label><label><span>Status</span><select name="playdate-visibility"><option value="public" selected>Public — visible to nearby families</option><option value="private">Private — only this family</option></select></label><label><span>Age range</span><input name="playdate-age-range" placeholder="${ageLabel ? `Around ${escapeAttribute(ageLabel)}` : 'Ages 2-4'}" maxlength="40" /></label><label><span>Max families</span><input name="playdate-max-families" type="number" min="2" max="20" placeholder="No limit" /></label></div><label class="input-label" for="playdate-notes">Notes</label><textarea id="playdate-notes" name="playdate-notes" maxlength="240" placeholder="Splash pad, snacks, stroller-friendly meetup spot"></textarea><div class="form-actions"><button type="submit">Create play date</button><button type="button" class="secondary-button" data-cancel-create-playdate>Cancel</button></div>${state.playDateFormStatus ? `<p class="muted">${escapeHtml(state.playDateFormStatus)}</p>` : ''}</form></section></div>`
    : '';
  const currentPlaygroundMarkup = currentPlayground
    ? `<div class="playground-summary">${currentPlayground.imageUrl ? `<img class="playground-hero-thumb" src="${escapeAttribute(currentPlayground.imageUrl)}" alt="Thumbnail of ${escapeAttribute(currentPlayground.name)}" loading="lazy" />` : ''}<p class="eyebrow">${currentPlayground.preference === 'indoor' ? 'Indoor backup' : 'Selected playground'}</p><h2>${escapeHtml(currentPlayground.name)}</h2><p>${escapeHtml(currentPlayground.type)} • ${escapeHtml(currentPlayground.distance)}</p><p class="playground-overview">${escapeHtml(currentPlayground.overview || `${currentPlayground.name} is a nearby ${currentPlayground.type.toLowerCase()} option.`)}</p>${Array.isArray(currentPlayground.highlights) && currentPlayground.highlights.length ? `<div class="playground-highlights">${currentPlayground.highlights.slice(0, 4).map((highlight) => `<span>${escapeHtml(highlight)}</span>`).join('')}</div>` : ''}<p class="playground-recommendation"><strong>Why it’s recommended</strong><br />${escapeHtml(playgroundRecommendationReason(currentPlayground, state))}</p><small>${escapeHtml(currentPlayground.best)} • Best: ${escapeHtml(currentPlayground.weather)}</small><div class="playground-summary-actions"><button id="open-create-playdate" data-open-create-playdate type="button">＋ Play date</button>${currentPlayground.href ? `<a class="secondary-button small-button" href="${escapeAttribute(currentPlayground.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div></div>${createPlayDateFormMarkup}`
    : '<p class="muted">Save a location or choose a starter place to create a play date.</p>';
  const detailPlayground = playOptions.find((option) => option.key === state.playgroundDetailKey);
  const playgroundDetailModalMarkup = detailPlayground
    ? `<div id="playground-detail-backdrop" class="modal-backdrop"><section class="modal-dialog playground-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="playground-detail-title"><div class="section-heading"><div><p class="eyebrow">Playground details</p><h2 id="playground-detail-title">${escapeHtml(detailPlayground.name)}</h2></div><button type="button" class="icon-button" data-close-playground-detail aria-label="Close playground details">×</button></div>${detailPlayground.imageUrl ? `<img class="playground-hero-thumb" src="${escapeAttribute(detailPlayground.imageUrl)}" alt="Thumbnail of ${escapeAttribute(detailPlayground.name)}" loading="lazy" />` : ''}<p>${escapeHtml(detailPlayground.type)} • ${escapeHtml(detailPlayground.distance)}</p><p class="playground-overview">${escapeHtml(detailPlayground.overview || `${detailPlayground.name} is a nearby ${detailPlayground.type.toLowerCase()} option.`)}</p>${Array.isArray(detailPlayground.highlights) && detailPlayground.highlights.length ? `<div class="playground-highlights">${detailPlayground.highlights.slice(0, 6).map((highlight) => `<span>${escapeHtml(highlight)}</span>`).join('')}</div>` : ''}<p class="playground-recommendation"><strong>Why it’s recommended</strong><br />${escapeHtml(playgroundRecommendationReason(detailPlayground, state))}</p><small>${escapeHtml(detailPlayground.best)} • Best: ${escapeHtml(detailPlayground.weather)}</small><div class="playground-summary-actions"><button type="button" data-select-playground="${escapeAttribute(detailPlayground.key)}">Select playground</button>${detailPlayground.href ? `<a class="secondary-button small-button" href="${escapeAttribute(detailPlayground.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div></section></div>`
    : '';

  const holidayMarkup = upcomingHolidays.length
    ? `<p class="muted">Based on today, ${escapeHtml(upcomingHolidays[0].name)} is next.</p>${upcomingHolidays.map((holiday, index) => `<article class="mini-card">${icon(holiday.personalized ? '🎂' : '🎁')}<div><h3>${escapeHtml(holiday.name)}</h3><p><strong>${escapeHtml(holiday.dateLabel)} · ${escapeHtml(holiday.countdown)}</strong></p><p>${escapeHtml(holiday.reminder)}</p>${index === 0 ? `<small>${escapeHtml(holiday.timing)}</small>` : ''}</div></article>`).join('')}`
    : '<p class="muted">No upcoming holidays found.</p>';
  const locationToolMarkup = `<div id="location-tool-backdrop" class="modal-backdrop" hidden><section class="modal-dialog location-tool location-tool-dialog" role="dialog" aria-modal="true" aria-labelledby="location-tool-title"><div class="section-heading"><div><p class="eyebrow">Set your home base</p><h2 id="location-tool-title">Enter an address</h2></div><button id="close-location-tool" type="button" class="icon-button" aria-label="Close location form">×</button></div><p>${escapeHtml(locationStatus)}</p><form id="location-form"><label class="input-label" for="location-address">Address or place</label><input id="location-address" value="${escapeAttribute(location?.address || '')}" placeholder="Home address, city, or favorite play area" /><button type="submit">Update location</button></form><div class="weather-grid"><strong>${escapeHtml(state.weather.label)}</strong><span>Rain: ${escapeHtml(state.weather.precipitation)}</span><span>Wind: ${escapeHtml(state.weather.wind)}</span></div></section></div>`;
  ctx.layout(`<main class="play-screen playdates-workspace"><aside class="playdates-list-pane"><div class="playdates-list-heading"><div><p class="eyebrow">Playground finder</p><h2>Playdates</h2></div><div class="weather-chip compact-weather"><strong>${escapeHtml(state.weather.temperature)}</strong><span>${escapeHtml(state.weather.label)}</span></div></div><section id="upcoming-playdates" class="play-list-section"><div class="section-heading"><div><p class="eyebrow">Selected playground</p><h3>${escapeHtml(currentPlayground?.name || 'Choose a playground')}</h3><p class="muted">${escapeHtml(state.playDateStatus)}</p></div><div class="playdate-section-actions"><button id="refresh-playdates" type="button" class="secondary-button small-button" ${currentPlayground ? '' : 'disabled'}>Refresh</button><button type="button" class="rail-create playdate-create-button" data-open-create-playdate ${currentPlayground ? '' : 'disabled'}>＋ New playdate</button></div></div><div class="cards-list">${renderPlayDateList(state, currentPlayground)}</div></section><section class="play-list-section"><div class="section-heading"><div><p class="eyebrow">Nearby places</p><h3>Playgrounds nearby</h3></div><span class="result-count">${playOptions.length} found</span></div><div class="cards-list">${playOptionsMarkup}</div></section><section id="weekend-family-events" class="play-list-section"><div class="section-heading"><div><p class="eyebrow">This weekend</p><h3>Family events</h3></div><button id="refresh-family-events" type="button" class="secondary-button small-button">Refresh</button></div>${renderFamilyEvents(state)}</section><section class="play-list-section holiday-list-section"><h3>Holiday planning</h3>${holidayMarkup}</section></aside><section class="playdates-map-pane"><div class="panel map-panel"><div class="section-heading"><div><p class="eyebrow">Around your family</p><h2>Nearby play map</h2><p class="muted">Showing a ${searchRadiusMiles}-mile square around your family.</p></div><div class="map-location-actions"><button id="use-current-location" type="button" class="secondary-button small-button">Use current location</button><button id="open-location-tool" type="button" class="secondary-button small-button">Enter an address</button></div></div><div class="play-map-visual">${playMapChipsMarkup}${mapMarkup}</div><div class="map-legend"><span><i class="legend-dot home-dot"></i>You</span><span><i class="legend-dot play-dot"></i>Playground</span><span><i class="legend-dot indoor-dot"></i>Indoor backup</span><span><i class="legend-dot playdate-dot"></i>Playdate</span></div></div></section>${locationToolMarkup}${createPlayDateFormMarkup}${editingPlayDate ? renderEditPlayDateForm(editingPlayDate, ageLabel) : ''}${playgroundDetailModalMarkup}</main>`);

  if (state.playFocus === 'family-events') {
    state.playFocus = '';
    globalThis.requestAnimationFrame?.(() => document.getElementById('weekend-family-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  if (state.playdateFocus === 'playdates') {
    state.playdateFocus = '';
    globalThis.requestAnimationFrame?.(() => document.getElementById('upcoming-playdates')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const locationToolBackdrop = document.getElementById('location-tool-backdrop');
  document.getElementById('open-location-tool')?.addEventListener('click', () => {
    if (!locationToolBackdrop) return;
    locationToolBackdrop.hidden = false;
    document.getElementById('location-address')?.focus();
  });
  document.getElementById('close-location-tool')?.addEventListener('click', () => {
    if (locationToolBackdrop) locationToolBackdrop.hidden = true;
  });
  locationToolBackdrop?.addEventListener('click', (event) => {
    if (event.target === locationToolBackdrop) locationToolBackdrop.hidden = true;
  });
  document.getElementById('location-form')?.addEventListener('submit', (event) => saveManualLocation(ctx, event));
  document.getElementById('use-current-location').addEventListener('click', () => requestCurrentLocation(ctx));
  document.querySelectorAll('[data-playdate-filter]').forEach((button) => button.addEventListener('click', () => {
    state.nearbyPlayDateFilter = button.dataset.playdateFilter || 'all';
    ctx.renderCurrent();
  }));
  if (hasGoogleMapsKey()) {
    const coords = getLocationCoords(location);
    renderGooglePlayMap({
      element: document.getElementById('google-play-map'),
      center: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
      radiusMeters,
      playgrounds: playOptions,
      playdates: filteredNearbyPlayDates,
      selectedPlaygroundKey: currentPlayground?.key || '',
      onPlaygroundSelect: (key) => selectPlayground(ctx, key),
      onPlaydateSelect: (playDate) => selectPlayground(ctx, playDate.playgroundKey),
    });
  }
  document.querySelectorAll('[data-map-zoom]').forEach((button) => button.addEventListener('click', () => {
    const direction = button.dataset.mapZoom === 'in' ? 0.15 : -0.15;
    state.mapZoom = Math.min(1.8, Math.max(0.85, Number((state.mapZoom + direction).toFixed(2))));
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-select-playground]').forEach((button) => {
    button.addEventListener('click', () => selectPlayground(ctx, button.dataset.selectPlayground));
  });
  document.querySelectorAll('[data-view-playground-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      state.playgroundDetailKey = button.dataset.viewPlaygroundDetail;
      ctx.renderCurrent();
    });
  });
  const playgroundDetailBackdrop = document.getElementById('playground-detail-backdrop');
  document.querySelectorAll('[data-close-playground-detail]').forEach((button) => {
    button.addEventListener('click', () => {
      state.playgroundDetailKey = '';
      ctx.renderCurrent();
    });
  });
  playgroundDetailBackdrop?.addEventListener('click', (event) => {
    if (event.target !== playgroundDetailBackdrop) return;
    state.playgroundDetailKey = '';
    ctx.renderCurrent();
  });
  const createPlayDateBackdrop = document.getElementById('create-playdate-backdrop');
  document.querySelectorAll('[data-open-create-playdate]').forEach((button) => button.addEventListener('click', () => {
    if (!createPlayDateBackdrop) return;
    createPlayDateBackdrop.hidden = false;
    createPlayDateBackdrop.querySelector('input, select, textarea')?.focus();
  }));
  document.querySelectorAll('[data-cancel-create-playdate]').forEach((button) => {
    button.addEventListener('click', () => {
      if (createPlayDateBackdrop) createPlayDateBackdrop.hidden = true;
    });
  });
  createPlayDateBackdrop?.addEventListener('click', (event) => {
    if (event.target === createPlayDateBackdrop) createPlayDateBackdrop.hidden = true;
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
  document.querySelectorAll('[data-open-chat-playdate]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingChatPlayDateId = button.dataset.openChatPlaydate;
      state.activeChatContactId = '';
      state.chatLoaded = false;
      state.tab = 'chat';
      ctx.renderCurrent();
    });
  });
  document.querySelectorAll('[data-edit-playdate]').forEach((button) => {
    button.addEventListener('click', () => beginEditPlayDate(ctx, button.dataset.editPlaydate));
  });
  document.querySelectorAll('[data-share-playdate]').forEach((button) => {
    button.addEventListener('click', () => sharePlayDate(ctx, button.dataset.sharePlaydate));
  });
  document.querySelectorAll('[data-cancel-playdate]').forEach((button) => {
    button.addEventListener('click', () => cancelPlayDate(ctx, button.dataset.cancelPlaydate, currentPlayground));
  });
  document.querySelectorAll('[data-decline-playdate]').forEach((button) => {
    button.addEventListener('click', () => respondToPlayDate(ctx, button.dataset.declinePlaydate, 'declined', currentPlayground));
  });
  document.querySelectorAll('[data-respond-playdate]').forEach((button) => {
    button.addEventListener('click', () => respondToPlayDate(ctx, button.dataset.respondPlaydate, 'joined', currentPlayground));
  });
  document.querySelectorAll('[data-ack-playdate-update]').forEach((button) => {
    button.addEventListener('click', () => acknowledgePlayDateUpdate(ctx, button.dataset.ackPlaydateUpdate));
  });
  document.querySelectorAll('[data-cancel-edit-playdate]').forEach((button) => {
    button.addEventListener('click', () => stopEditPlayDate(ctx));
  });
  document.getElementById('playdate-edit-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'playdate-edit-backdrop') stopEditPlayDate(ctx);
  });
  const editPlayDateForm = document.getElementById('edit-playdate-form');
  if (editPlayDateForm && editingPlayDate && currentPlayground) {
    const startInput = getPlayDateFormControl(editPlayDateForm, 'playdate-start');
    const endInput = getPlayDateFormControl(editPlayDateForm, 'playdate-end');
    updatePlayDateTimeConstraints(editPlayDateForm);
    startInput?.addEventListener('input', () => updatePlayDateTimeConstraints(editPlayDateForm, { adjustEnd: true }));
    endInput?.addEventListener('input', () => updatePlayDateTimeConstraints(editPlayDateForm));
    editPlayDateForm.addEventListener('submit', (event) => saveEditedPlayDate(ctx, event, currentPlayground, editingPlayDate));
  }
  document.querySelectorAll('[data-attend-family-event]').forEach((button) => button.addEventListener('click', () => {
    const event = state.familyEvents.find((item) => familyEventId(item) === button.dataset.attendFamilyEvent);
    if (event) toggleFamilyEventAttendance(ctx, event);
  }));
}
