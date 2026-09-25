import { apiRequest, downloadCalendar, escapeAttribute, escapeHtml, fetchWithTimeout, icon, readStoredValue, writeStoredValue } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile, normalizePlayPreferences } from '../../lib/profile-defaults.js';
import { removeFamilyPlan, saveFamilyPlan } from '../family-plans.js';
import { loadDiscover, loadPlaydatesForPlaygrounds } from '../discover/client.js';
import {
  normalizePlaydate,
  normalizePlayground,
  normalizeStoryTime,
  normalizeWeekendEvent,
  sourceRecord,
} from '../discover/normalizers.js';
import { hasGoogleMapsKey, renderGoogleDiscoverMap } from '../google-map.js';

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
let storyTimeRequestId = 0;

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
  state.discoverFilter = 'all';
  state.discoverView = 'map';
  state.discoverSelectedId = '';
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
  state.familyEventsLoading = false;
  state.familyEventsRequestKey = '';
  state.storyTimes = [];
  state.storyTimesStatus = 'Save a location to find nearby story times.';
  state.storyTimesMeta = null;
  state.storyTimesLoading = false;
  state.storyTimesRequestKey = '';
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
    const result = await loadDiscover({ location, radiusMiles: searchRadiusMiles, kinds: ['playground', 'playdate'] });
    const nearbyOptions = result.groups.playgrounds.map(sourceRecord);
    const payload = result.sources.playgrounds.payload;
    if (requestId !== nearbyRequestId) return;
    if (result.sources.playgrounds.status === 'error') throw new Error(result.sources.playgrounds.error);
    state.nearbyPlayDates = result.groups.playdates.map(sourceRecord);
    state.nearbyPlayDatesRequestKey = nearbyPlayDatesRequestKey(nearbyOptions);
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
    state.familyEventsLoading = false;
    state.familyEventsRequestKey = '';
    state.familyEventsStatus = 'Save a home city or location to find weekend events.';
    if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
    return;
  }

  const requestKey = familyEventRequestKey(state);
  if (!options.force && state.familyEventsRequestKey === requestKey && state.familyEventsMeta) {
    return;
  }

  const requestId = ++familyEventRequestId;
  state.familyEventsRequestKey = requestKey;
  state.familyEventsLoading = true;
  state.familyEventsStatus = `Checking weekend events around ${shortLocation(location)}...`;
  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();

  try {
    const result = await loadDiscover({ location, kinds: ['weekend_event'], forceRefresh: options.force });
    const payload = result.sources.weekendEvents.payload;
    if (requestId !== familyEventRequestId) return;
    if (result.sources.weekendEvents.status === 'error') throw new Error(result.sources.weekendEvents.error);
    state.familyEvents = result.groups.weekendEvents.map(sourceRecord);
    state.familyEventsMeta = payload;
    state.familyEventsLoading = false;
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
    state.familyEventsLoading = false;
    state.familyEventsStatus = `Could not load weekend events: ${error.message}`;
  }

  if (state.tab === 'play' || state.tab === 'home') ctx.renderCurrent();
}

function storyTimeRequestKey(state) {
  const location = getUserLocation(state);
  return `${state.user?.id || ''}|${shortLocation(location).toLowerCase()}`;
}

async function loadStoryTimes(ctx, options = {}) {
  const { state } = ctx;
  if (!state.user) return;
  const location = getUserLocation(state);
  if (!location) { state.storyTimes = []; state.storyTimesMeta = null; state.storyTimesStatus = 'Save a location to find nearby story times.'; if (state.tab === 'play') ctx.renderCurrent(); return; }
  const requestKey = storyTimeRequestKey(state);
  if (!options.force && state.storyTimesRequestKey === requestKey && state.storyTimesMeta) return;
  const requestId = ++storyTimeRequestId;
  state.storyTimesRequestKey = requestKey;
  state.storyTimesLoading = true;
  state.storyTimesStatus = `Finding story times near ${shortLocation(location)}...`;
  if (state.tab === 'play') ctx.renderCurrent();
  try {
    const coords = getLocationCoords(location);
    const { searchRadiusMiles } = normalizePlayPreferences(state.user?.playPreferences);
    const result = await loadDiscover({ location, radiusMiles: searchRadiusMiles, kinds: ['story_time'], forceRefresh: options.force });
    const payload = result.sources.storyTimes.payload;
    if (requestId !== storyTimeRequestId) return;
    if (result.sources.storyTimes.status === 'error') throw new Error(result.sources.storyTimes.error);
    state.storyTimes = result.groups.storyTimes.map(sourceRecord);
    state.storyTimesMeta = payload;
    state.storyTimesLoading = false;
    state.storyTimesStatus = state.storyTimes.length
      ? `Showing ${state.storyTimes.length} ${payload.cached ? 'cached' : 'updated'} story time${state.storyTimes.length === 1 ? '' : 's'} from ${payload.sourceLabel || 'library calendars'}${coords ? ` within ${searchRadiusMiles} miles` : ''}.`
      : `No story times found for the next week. Open the source calendar for the latest schedule.`;
  } catch (error) {
    if (requestId !== storyTimeRequestId) return;
    state.storyTimes = []; state.storyTimesMeta = null; state.storyTimesLoading = false;
    state.storyTimesStatus = `Could not load story times: ${error.message}`;
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
  loadStoryTimes(ctx);
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
    const result = await loadPlaydatesForPlaygrounds(playgrounds);
    state.nearbyPlayDates = result.items.map(sourceRecord);
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
  const eventMeta = [event.timeLabel || 'Time TBD', event.venue || event.sourceLabel || 'Family event'].filter(Boolean).join(' • ');
  return `<article class="${cardClass} event-card-with-thumb"><img class="resource-thumb" src="${escapeAttribute(image)}" alt="" loading="lazy" /><div class="event-card-main"><span>${escapeHtml(badgeParts.join(' • ') || 'Family event')}</span><h3>${escapeHtml(event.title || 'Family event')}</h3><small>${escapeHtml(eventMeta)}</small><div class="play-card-actions">${attendanceButton}</div></div><div class="event-card-date-pin-wrap">${eventDatePinMarkup(event)}</div></article>`;
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
  return Boolean(event.attended || state.savedFamilyPlans?.some((item) => item.kind === 'external_event' && item.externalId === id && item.status !== 'cancelled'));
}

async function toggleFamilyEventAttendance(ctx, event) {
  const id = familyEventId(event);
  if (!id) return;
  const existing = (ctx.state.savedFamilyPlans || []).find((item) => item.kind === 'external_event' && item.externalId === id && item.status !== 'cancelled');
  const previousPlans = ctx.state.savedFamilyPlans || [];
  const familyEvent = {
    kind: 'external_event',
    title: event.title || 'Family event',
    summary: event.summary || 'Family-friendly weekend option.',
    dueDate: event.date || null,
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
  ctx.state.savedFamilyPlans = existing
    ? previousPlans.filter((item) => item.id !== existing.id)
    : [...previousPlans, { ...familyEvent, externalId: id }];
  ctx.renderCurrent();
  try {
    if (existing) await removeFamilyPlan(existing.id);
    else {
      const response = await saveFamilyPlan(familyEvent);
      const saved = response.item;
      ctx.state.savedFamilyPlans = ctx.state.savedFamilyPlans.map((item) => item.kind === 'external_event' && item.externalId === id ? saved : item);
    }
  } catch (error) {
    ctx.state.savedFamilyPlans = previousPlans;
    ctx.state.apiMessage = 'Could not update event attendance.';
    ctx.renderCurrent();
  }
}

function renderFamilyEvents(state) {
  if (state.familyEventsLoading || (!state.familyEventsMeta && state.familyEventsStatus?.startsWith('Checking'))) {
    return '<p class="muted">Loading weekend event sources...</p>';
  }
  if (!state.familyEvents?.length) {
    return '<p class="muted">Weekend event sources will appear after your home city or location is available.</p>';
  }
  return state.familyEvents.slice(0, 5).map((event) => renderFamilyEventCard(event, state)).join('');
}

function storyTimeId(event) {
  return String(event.id || [event.title, event.date, event.timeLabel, event.venue, event.url].filter(Boolean).join('|'))
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180);
}

function isStoryTimeSaved(event, state) {
  const id = storyTimeId(event);
  return Boolean(state.savedFamilyPlans?.some((item) => item.kind === 'story_time' && item.externalId === id && item.status !== 'cancelled'));
}

async function toggleStoryTimeSaved(ctx, event) {
  const id = storyTimeId(event);
  if (!id) return;
  const existing = (ctx.state.savedFamilyPlans || []).find((item) => item.kind === 'story_time' && item.externalId === id && item.status !== 'cancelled');
  const previousPlans = ctx.state.savedFamilyPlans || [];
  const storyTime = {
    kind: 'story_time',
    title: event.title || 'Story time',
    summary: event.summary || 'Library story time.',
    dueDate: event.date || null,
    status: 'planned',
    source: event.source || 'library',
    externalId: id,
    venue: event.venue || '',
    url: event.url || event.sourceUrl || '',
    metadata: {
      date: event.date || '',
      dateLabel: event.dateLabel || '',
      timeLabel: event.timeLabel || '',
      imageUrl: event.imageUrl || '',
      tags: Array.isArray(event.tags) ? event.tags : [],
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      sourceLabel: event.sourceLabel || '',
    },
  };
  ctx.state.apiMessage = existing ? 'Removing story time from your family plans…' : 'Saving story time to your family plans…';
  ctx.state.savedFamilyPlans = existing
    ? previousPlans.filter((item) => item.id !== existing.id)
    : [...previousPlans, storyTime];
  ctx.renderCurrent();
  try {
    if (existing) await removeFamilyPlan(existing.id);
    else {
      const { item: saved } = await saveFamilyPlan(storyTime);
      ctx.state.savedFamilyPlans = ctx.state.savedFamilyPlans.map((item) => item.kind === 'story_time' && item.externalId === id ? saved : item);
    }
    ctx.state.apiMessage = existing ? 'Story time removed from your family plans.' : 'Story time saved to your family plans.';
  } catch (error) {
    ctx.state.savedFamilyPlans = previousPlans;
    ctx.state.apiMessage = `Could not update story time: ${error.message}`;
  }
  ctx.renderCurrent();
}

function renderStoryTimes(state) {
  if (state.storyTimesLoading) return '<p class="muted">Loading nearby story times...</p>';
  if (!state.storyTimes?.length) return `<p class="muted">${escapeHtml(state.storyTimesStatus || 'No story times found.')}</p>`;
  return state.storyTimes.slice(0, 8).map((event) => {
    const date = event.date ? new Date(`${event.date}T12:00:00`) : null;
    const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : event.dateLabel || 'Date pending';
    const distanceLabel = Number.isFinite(Number(event.distanceMiles)) ? ` · ${formatDistance(Number(event.distanceMiles))}` : '';
    const detailUrl = event.url || event.sourceUrl;
    const saved = isStoryTimeSaved(event, state);
    const saveButton = event.resultType === 'search-link' ? '' : `<button type="button" class="secondary-button small-button" data-save-story-time="${escapeAttribute(storyTimeId(event))}" aria-pressed="${saved ? 'true' : 'false'}">${saved ? 'Saved' : 'Save'}</button>`;
    return `<article class="mini-card story-time-card"><div class="story-time-icon" aria-hidden="true">📖</div><div class="story-time-content"><p class="eyebrow">${escapeHtml(dateLabel)}${event.timeLabel ? ` · ${escapeHtml(event.timeLabel)}` : ''}${distanceLabel}</p><h3>${escapeHtml(event.title || 'Story Time')}</h3><small>${escapeHtml(event.venue || event.sourceLabel || 'Library event')}</small></div><div class="story-time-actions">${detailUrl ? `<a class="secondary-button small-button" href="${escapeAttribute(detailUrl)}" target="_blank" rel="noreferrer">View details</a>` : ''}${saveButton}</div></article>`;
  }).join('');
}

function playgroundRecommendationReason(option, state) {
  const indoorWeather = isIndoorWeatherRecommended(state);
  const weatherFit = option.preference === (indoorWeather ? 'indoor' : 'outdoor')
    ? (indoorWeather ? 'an indoor weather backup' : 'outdoor play today')
    : (indoorWeather ? 'a weather-friendly outdoor option' : 'a backup if plans change');
  return `Recommended for ${weatherFit}; ${option.distance || 'nearby'} from your saved location.`;
}

const discoverCategories = [
  ['all', 'All'],
  ['playground', 'Playgrounds'],
  ['playdate', 'Playdates'],
  ['weekend_event', 'Weekend events'],
  ['story_time', 'Story times'],
];

function discoverKindLabel(kind) {
  if (kind === 'playground') return 'Playground';
  if (kind === 'playdate') return 'Playdate';
  if (kind === 'weekend_event') return 'Weekend event';
  return 'Story time';
}

function discoverKindIcon(kind) {
  if (kind === 'playground') return '🛝';
  if (kind === 'playdate') return '☺';
  if (kind === 'weekend_event') return '🎟️';
  return '📖';
}

function discoverScheduleLabel(item) {
  if (item.schedule?.startsAt) {
    const start = new Date(item.schedule.startsAt);
    if (!Number.isNaN(start.getTime())) {
      return `${start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  return [item.schedule?.dateLabel || item.schedule?.date, item.schedule?.timeLabel].filter(Boolean).join(' · ');
}

function discoverActionMarkup(item, state, { detail = false } = {}) {
  const data = item.detail || {};
  if (item.kind === 'playground') {
    return `<button type="button" class="secondary-button small-button" data-view-playground-detail="${escapeAttribute(item.sourceId)}">View details</button><button type="button" class="small-button" data-select-playground="${escapeAttribute(item.sourceId)}"${detail ? ' data-open-create-after-select' : ''}>${detail ? '+ New playdate' : 'Select'}</button>`;
  }
  if (item.kind === 'playdate') {
    if (data.isJoined) return data.participantCount > 1 ? `<button type="button" class="small-button" data-open-chat-playdate="${escapeAttribute(data.id)}">Open chat</button>` : '<span class="discover-saved-label">You’re going</span>';
    if (data.canJoin) return `<button type="button" class="small-button" data-join-playdate="${escapeAttribute(data.id)}">Join playdate</button>`;
    return '<span class="discover-saved-label">View details</span>';
  }
  if (item.kind === 'weekend_event') {
    const saved = isFamilyEventAttended(data, state);
    return `${item.href ? `<a class="secondary-button small-button" href="${escapeAttribute(item.href)}" target="_blank" rel="noreferrer">View details</a>` : ''}<button type="button" class="small-button" data-attend-family-event="${escapeAttribute(familyEventId(data))}" aria-pressed="${saved}">${saved ? 'Saved' : 'Save plan'}</button>`;
  }
  const saved = isStoryTimeSaved(data, state);
  return `${item.href ? `<a class="secondary-button small-button" href="${escapeAttribute(item.href)}" target="_blank" rel="noreferrer">View details</a>` : ''}${data.resultType === 'search-link' ? '' : `<button type="button" class="small-button" data-save-story-time="${escapeAttribute(storyTimeId(data))}" aria-pressed="${saved}">${saved ? 'Saved' : 'Save plan'}</button>`}`;
}

function renderDiscoverCard(item, state) {
  const schedule = discoverScheduleLabel(item);
  const location = item.location?.venue || item.location?.address || 'Nearby';
  const distance = item.distance?.label || '';
  const image = item.imageUrl || (item.kind === 'playground'
    ? '/backgrounds/parenting-playground-default.png'
    : item.kind === 'story_time' ? '/backgrounds/parenting-home-default.png' : '');
  return `<article class="discover-result-card kind-${item.kind}">${image ? `<img src="${escapeAttribute(image)}" alt="" loading="lazy" />` : `<span class="discover-result-icon" aria-hidden="true">${discoverKindIcon(item.kind)}</span>`}<div class="discover-result-copy"><small>${escapeHtml(discoverKindLabel(item.kind))}${schedule ? ` · ${escapeHtml(schedule)}` : ''}</small><button type="button" data-select-discover="${escapeAttribute(item.id)}"><strong>${escapeHtml(item.title)}</strong></button><p>${escapeHtml(item.summary || location)}</p><span>${escapeHtml([location, distance].filter(Boolean).join(' · '))}</span></div><div class="discover-result-actions">${discoverActionMarkup(item, state)}</div></article>`;
}

function renderDiscoverSelection(item, state) {
  if (!item) return '<div class="discover-map-empty"><span aria-hidden="true">⌖</span><strong>No matching adventures</strong><p>Try another category or update your search location.</p></div>';
  const schedule = discoverScheduleLabel(item);
  const location = item.location?.venue || item.location?.address || 'Nearby';
  return `<div class="discover-selection"><span class="discover-selection-icon" aria-hidden="true">${discoverKindIcon(item.kind)}</span><p class="eyebrow">Selected ${escapeHtml(discoverKindLabel(item.kind))}</p><h2>${escapeHtml(item.title)}</h2><p class="discover-selection-meta">${escapeHtml([schedule, location, item.distance?.label].filter(Boolean).join(' · '))}</p><p>${escapeHtml(item.summary || `A family-friendly ${discoverKindLabel(item.kind).toLowerCase()} near you.`)}</p><div class="discover-selection-actions">${discoverActionMarkup(item, state, { detail: true })}</div><small>Choose an item on the map or switch to the list for more details.</small></div>`;
}

function discoverMapMarkup(items, selectedId, searchRadiusMiles) {
  const fallback = `<div id="discover-map-fallback" class="discover-map discover-map-fallback" aria-label="Illustrative map of filtered Discover results"${hasGoogleMapsKey() ? ' hidden' : ''}><div class="map-grid"></div><div class="map-water"></div><div class="map-road road-one"></div><div class="map-road road-two"></div><div class="discover-map-label">Illustrative neighborhood · ${searchRadiusMiles} mile search</div>${items.slice(0, 20).map((item, index) => `<button type="button" class="discover-map-pin kind-${item.kind} ${item.id === selectedId ? 'selected' : ''}" style="--pin-x:${13 + ((index * 29) % 76)}%;--pin-y:${18 + ((index * 37) % 65)}%" data-select-discover="${escapeAttribute(item.id)}" aria-label="Select ${escapeAttribute(item.title)}"><span>${discoverKindIcon(item.kind)}</span><small>${escapeHtml(item.distance?.label || discoverKindLabel(item.kind))}</small></button>`).join('')}<div class="discover-you-marker"><span>⌖</span><small>You</small></div></div>`;
  if (!hasGoogleMapsKey()) return fallback;
  return `<div class="discover-map-shell"><div id="google-discover-map" class="discover-map google-discover-map" aria-label="Google map of filtered Discover results"></div>${fallback}</div>`;
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
      return `<article class="mini-card play-card compact-play-card ${isSelected ? 'selected' : ''}"><button type="button" class="playground-list-select" data-select-playground="${escapeAttribute(option.key)}" aria-label="Select ${escapeAttribute(option.name)}" aria-pressed="${isSelected}"></button><img class="resource-thumb" src="${escapeAttribute(image)}" alt="Thumbnail of ${escapeAttribute(option.name)}" loading="lazy" /><div class="play-card-body"><h3>${escapeHtml(option.name)}</h3><div class="play-card-meta-row"><div class="playground-highlights compact-playground-highlights"><span>${escapeHtml(highlight)}</span></div><button type="button" class="secondary-button small-button" data-view-playground-detail="${escapeAttribute(option.key)}">View detail</button><span class="playground-distance">${escapeHtml(option.distance || 'Nearby')}</span></div></div></article>`;
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
    ? `<div id="playground-detail-backdrop" class="modal-backdrop"><section class="modal-dialog playground-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="playground-detail-title"><div class="section-heading"><div><p class="eyebrow">Playground details</p><h2 id="playground-detail-title">${escapeHtml(detailPlayground.name)}</h2></div><button type="button" class="icon-button" data-close-playground-detail aria-label="Close playground details">×</button></div>${detailPlayground.imageUrl ? `<img class="playground-hero-thumb" src="${escapeAttribute(detailPlayground.imageUrl)}" alt="Thumbnail of ${escapeAttribute(detailPlayground.name)}" loading="lazy" />` : ''}<p>${escapeHtml(detailPlayground.type)} • ${escapeHtml(detailPlayground.distance)}</p><p class="playground-overview">${escapeHtml(detailPlayground.overview || `${detailPlayground.name} is a nearby ${detailPlayground.type.toLowerCase()} option.`)}</p>${Array.isArray(detailPlayground.highlights) && detailPlayground.highlights.length ? `<div class="playground-highlights">${detailPlayground.highlights.slice(0, 6).map((highlight) => `<span>${escapeHtml(highlight)}</span>`).join('')}</div>` : ''}<p class="playground-recommendation"><strong>Why it’s recommended</strong><br />${escapeHtml(playgroundRecommendationReason(detailPlayground, state))}</p><small>${escapeHtml(detailPlayground.best)} • Best: ${escapeHtml(detailPlayground.weather)}</small><div class="playground-summary-actions">${detailPlayground.href ? `<a class="secondary-button small-button" href="${escapeAttribute(detailPlayground.href)}" target="_blank" rel="noreferrer">Open map</a>` : ''}</div></section></div>`
    : '';

  const holidayMarkup = upcomingHolidays.length
    ? `<p class="muted">Based on today, ${escapeHtml(upcomingHolidays[0].name)} is next.</p>${upcomingHolidays.map((holiday, index) => `<article class="mini-card">${icon(holiday.personalized ? '🎂' : '🎁')}<div><h3>${escapeHtml(holiday.name)}</h3><p><strong>${escapeHtml(holiday.dateLabel)} · ${escapeHtml(holiday.countdown)}</strong></p><p>${escapeHtml(holiday.reminder)}</p>${index === 0 ? `<small>${escapeHtml(holiday.timing)}</small>` : ''}</div></article>`).join('')}`
    : '<p class="muted">No upcoming holidays found.</p>';
  const locationToolMarkup = `<div id="location-tool-backdrop" class="modal-backdrop" hidden><section class="modal-dialog location-tool location-tool-dialog" role="dialog" aria-modal="true" aria-labelledby="location-tool-title"><div class="section-heading"><div><p class="eyebrow">Set your home base</p><h2 id="location-tool-title">Enter an address</h2></div><button id="close-location-tool" type="button" class="icon-button" aria-label="Close location form">×</button></div><p>${escapeHtml(locationStatus)}</p><form id="location-form"><label class="input-label" for="location-address">Address or place</label><input id="location-address" value="${escapeAttribute(location?.address || '')}" placeholder="Home address, city, or favorite play area" /><button type="submit">Update location</button></form><div class="weather-grid"><strong>${escapeHtml(state.weather.label)}</strong><span>Rain: ${escapeHtml(state.weather.precipitation)}</span><span>Wind: ${escapeHtml(state.weather.wind)}</span></div></section></div>`;
  const discoverItems = [
    ...playOptions.map(normalizePlayground),
    ...(state.nearbyPlayDates || []).map(normalizePlaydate),
    ...(state.familyEvents || []).map(normalizeWeekendEvent),
    ...(state.storyTimes || []).map(normalizeStoryTime),
  ];
  const activeDiscoverFilter = state.discoverFilter || 'all';
  const filteredDiscoverItems = discoverItems.filter((item) => activeDiscoverFilter === 'all' || item.kind === activeDiscoverFilter);
  const selectedDiscoverItem = filteredDiscoverItems.find((item) => item.id === state.discoverSelectedId) || filteredDiscoverItems[0] || null;
  if (selectedDiscoverItem && state.discoverSelectedId !== selectedDiscoverItem.id) state.discoverSelectedId = selectedDiscoverItem.id;
  const discoverView = state.discoverView === 'list' ? 'list' : 'map';
  const discoverLocationLabel = location?.address || location?.label || childProfile?.homeCity || 'Choose a search location';
  const discoverResultsMarkup = filteredDiscoverItems.length
    ? filteredDiscoverItems.slice(0, 30).map((item) => renderDiscoverCard(item, state)).join('')
    : '<div class="discover-empty"><span aria-hidden="true">⌖</span><strong>No adventures in this category yet</strong><p>Try another category, refresh the providers, or update your location.</p></div>';
  const discoverContentMarkup = discoverView === 'map'
    ? `<div class="discover-map-layout">${discoverMapMarkup(filteredDiscoverItems, selectedDiscoverItem?.id || '', searchRadiusMiles)}<aside class="discover-map-selection">${renderDiscoverSelection(selectedDiscoverItem, state)}</aside></div>`
    : `<div class="discover-results-list">${discoverResultsMarkup}</div>`;

  ctx.layout(`<main class="discover-screen"><header class="discover-heading"><div><p class="eyebrow">Out in the world</p><h1>Find your next adventure</h1><p>Places, playmates, and little discoveries for ${escapeHtml(childName)}.</p></div><div class="home-weather"><span aria-hidden="true">${state.weather.label?.toLowerCase().includes('rain') ? '☔' : '☀️'}</span><strong>${escapeHtml(state.weather.temperature || '--')}</strong><small>${escapeHtml(state.weather.label || 'Weather loading')}</small></div></header><section class="discover-location-panel" aria-label="Discover search location"><div class="discover-location-copy"><span aria-hidden="true">⌖</span><div><p class="eyebrow">Your search location</p><h2>${escapeHtml(discoverLocationLabel)}</h2><p>${escapeHtml(state.nearbyStatus || locationStatus)}</p></div></div><div class="discover-location-buttons"><button id="use-current-location" type="button">⌖ Use my current location</button><button id="open-location-tool" type="button" class="secondary-button">Input address</button></div></section><section class="discover-controls" aria-label="Discover filters and view"><div class="discover-filter-scroll">${discoverCategories.map(([kind, label]) => `<button type="button" class="discover-filter ${activeDiscoverFilter === kind ? 'active' : ''}" data-discover-filter="${kind}" aria-pressed="${activeDiscoverFilter === kind}">${escapeHtml(label)}</button>`).join('')}</div><div class="discover-toolbar"><p><strong>${filteredDiscoverItems.length} ${filteredDiscoverItems.length === 1 ? 'idea' : 'ideas'}</strong> to explore</p><div class="discover-view-switch" role="group" aria-label="Discover view"><button type="button" data-discover-view="map" aria-pressed="${discoverView === 'map'}">◎ Map</button><button type="button" data-discover-view="list" aria-pressed="${discoverView === 'list'}">☷ List</button></div></div></section>${activeDiscoverFilter === 'playdate' && currentPlayground ? `<div class="discover-context-action"><span>Want to invite nearby families?</span><button type="button" data-open-create-playdate>＋ New playdate</button></div>` : ''}${discoverContentMarkup}<footer class="discover-provider-note"><span class="${state.familyEventsLoading || state.storyTimesLoading ? 'loading' : ''}"></span><p>${escapeHtml(state.familyEventsStatus || '')} ${escapeHtml(state.storyTimesStatus || '')}</p><button id="refresh-discover" type="button" class="text-button">Refresh results</button></footer>${locationToolMarkup}${createPlayDateFormMarkup}${editingPlayDate ? renderEditPlayDateForm(editingPlayDate, ageLabel) : ''}${playgroundDetailModalMarkup}</main>`);

  if (state.playFocus === 'family-events') {
    state.discoverFilter = 'weekend_event';
    state.discoverView = 'list';
    state.playFocus = '';
    globalThis.requestAnimationFrame?.(() => ctx.renderCurrent());
  }

  if (state.playFocus === 'story-times') {
    state.discoverFilter = 'story_time';
    state.discoverView = 'list';
    state.playFocus = '';
    globalThis.requestAnimationFrame?.(() => ctx.renderCurrent());
  }

  if (state.playdateFocus === 'playdates') {
    state.discoverFilter = 'playdate';
    state.discoverView = 'list';
    state.playdateFocus = '';
    globalThis.requestAnimationFrame?.(() => ctx.renderCurrent());
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
  document.getElementById('use-current-location')?.addEventListener('click', () => requestCurrentLocation(ctx));
  document.querySelectorAll('[data-discover-filter]').forEach((button) => button.addEventListener('click', () => {
    state.discoverFilter = button.dataset.discoverFilter || 'all';
    state.discoverSelectedId = '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-discover-view]').forEach((button) => button.addEventListener('click', () => {
    state.discoverView = button.dataset.discoverView === 'list' ? 'list' : 'map';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-select-discover]').forEach((button) => button.addEventListener('click', () => {
    const item = discoverItems.find((candidate) => candidate.id === button.dataset.selectDiscover);
    if (!item) return;
    state.discoverSelectedId = item.id;
    if (item.kind === 'playground' && item.sourceId !== state.selectedPlaygroundKey) selectPlayground(ctx, item.sourceId);
    else ctx.renderCurrent();
  }));
  document.getElementById('refresh-discover')?.addEventListener('click', () => refreshPlayPlanning(ctx));
  document.querySelectorAll('[data-playdate-filter]').forEach((button) => button.addEventListener('click', () => {
    state.nearbyPlayDateFilter = button.dataset.playdateFilter || 'all';
    ctx.renderCurrent();
  }));
  if (discoverView === 'map' && hasGoogleMapsKey() && document.getElementById('google-discover-map')) {
    const coords = getLocationCoords(location);
    const googleMapElement = document.getElementById('google-discover-map');
    const fallbackMapElement = document.getElementById('discover-map-fallback');
    if (!coords) {
      googleMapElement.hidden = true;
      if (fallbackMapElement) fallbackMapElement.hidden = false;
    } else {
      renderGoogleDiscoverMap({
        element: googleMapElement,
        center: { lat: coords.latitude, lng: coords.longitude },
        radiusMeters,
        items: filteredDiscoverItems,
        selectedId: selectedDiscoverItem?.id || '',
        searchLocationLabel: state.familyEventsMeta?.locationCity
          || state.storyTimesMeta?.locationCity
          || childProfile?.homeCity
          || location?.address
          || location?.label
          || '',
        onItemSelect: (item) => {
          state.discoverSelectedId = item.id;
          if (item.kind === 'playground' && item.sourceId !== state.selectedPlaygroundKey) selectPlayground(ctx, item.sourceId);
          else ctx.renderCurrent();
        },
      }).then((rendered) => {
        if (rendered) return;
        googleMapElement.hidden = true;
        if (fallbackMapElement) fallbackMapElement.hidden = false;
      });
    }
  }
  document.querySelectorAll('[data-map-zoom]').forEach((button) => button.addEventListener('click', () => {
    const direction = button.dataset.mapZoom === 'in' ? 0.15 : -0.15;
    state.mapZoom = Math.min(1.8, Math.max(0.85, Number((state.mapZoom + direction).toFixed(2))));
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-select-playground]').forEach((button) => {
    button.addEventListener('click', () => {
      const shouldOpenCreate = button.hasAttribute('data-open-create-after-select');
      selectPlayground(ctx, button.dataset.selectPlayground);
      if (shouldOpenCreate) globalThis.requestAnimationFrame?.(() => {
        const backdrop = document.getElementById('create-playdate-backdrop');
        if (backdrop) {
          backdrop.hidden = false;
          backdrop.querySelector('input, select, textarea')?.focus();
        }
      });
    });
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
  document.getElementById('refresh-story-times')?.addEventListener('click', () => loadStoryTimes(ctx, { force: true }));
  document.querySelectorAll('[data-join-playdate]').forEach((button) => {
    button.addEventListener('click', () => {
      const playDate = [...(state.nearbyPlayDates || []), ...(state.playDates || [])]
        .find((item) => item.id === button.dataset.joinPlaydate);
      const playground = playDate?.playgroundKey ? selectedPlayground(playOptions, playDate.playgroundKey) : currentPlayground;
      joinPlayDate(ctx, button.dataset.joinPlaydate, playground || currentPlayground);
    });
  });
  document.querySelectorAll('[data-open-chat-playdate]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingChatPlayDateId = button.dataset.openChatPlaydate;
      state.activeChatContactId = '';
      state.chatLoaded = false;
      state.tab = 'profile';
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
  document.querySelectorAll('[data-save-story-time]').forEach((button) => button.addEventListener('click', () => {
    const event = state.storyTimes.find((item) => storyTimeId(item) === button.dataset.saveStoryTime);
    if (event) toggleStoryTimeSaved(ctx, event);
  }));
}
