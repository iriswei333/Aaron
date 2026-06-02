let root = document.getElementById('root');
const DEFAULT_ALBUM_LINK = 'photos-redirect://';
const API_BASE = '/api';

function readStoredValue(key, fallback) {
  try {
    return globalThis.localStorage?.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

function removeStoredValue(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
}

const state = {
  tab: 'home',
  slide: 0,
  user: null,
  apiReady: false,
  apiMessage: 'Connecting family profile…',
  loginEmail: readStoredValue('aaronLoginEmail', ''),
  loginName: '',
  authStatus: '',
  locationStatus: '',
  foodStatus: '',
  shoppingList: [],
  newFood: '',
  amazonStatus: '',
  amazonTasks: [],
  newAmazonTask: '',
  outfitIdeas: [],
  albumLink: readStoredValue('aaronApplePhotosLink', DEFAULT_ALBUM_LINK),
  homePhotos: [],
  weather: { label: 'Loading Seattle weather…', temperature: '--', precipitation: '--', wind: '--', updated: 'Fetching from Open-Meteo' },
  media: [],
  captionTone: '温柔可爱',
  generatedCaption: '',
  captionStatus: '',
};

const slides = [
  ['Morning giggles', 'Connect this slide to an Apple Photos shared album of Aaron waking up happy.', 'peach'],
  ['Park explorer', 'Add a favorite Apple Photos memory from Seattle playground adventures.', 'mint'],
  ['Dinner helper', 'Link a clip of Aaron tasting peas, broccoli, banana, or dumplings.', 'sky'],
];
const photoConnectionOptions = [
  ['Shared iCloud Photos link', 'Recommended', 'Create an iCloud Shared Album or Shared Library link and paste it here. This keeps Apple authentication inside Apple and avoids storing credentials in this app.'],
  ['Import from this device', 'Private preview', 'Choose recent Aaron photos from the local device. They render immediately on the home page and are not uploaded anywhere.'],
  ['Apple Shortcuts sync', 'Automation-friendly', 'Use a daily Shortcut to export favorites to a local folder or JSON feed that this app can read in a future hosted version.'],
  ['Direct iCloud login', 'Not recommended here', 'A static front-end should not collect an iCloud username, password, or 2FA code. Use Apple-owned login pages or a secure backend only.'],
];
const defaultToddlerFoods = ['peas', 'broccoli', 'banana', 'strawberry', 'sweet corn', 'sweet potato', 'dumplings', 'baby waffle', 'baby smoothie', 'yogurt bites'];
const defaultAmazonTasks = [
  { title: 'Amazon monthly subscribe-and-save: diapers and wipes on the 1st at 8:00 AM.', source: 'amazon', status: 'planned' },
  { title: 'Order status check: every Friday at 4:00 PM until delivered.', source: 'amazon', status: 'planned' },
  { title: 'Low-stock alert: when fewer than 20 diapers or one unopened wipe pack remains.', source: 'amazon', status: 'planned' },
];
const defaultOutfitIdeas = [
  {
    item: 'Waterproof toddler sneakers',
    reason: 'Seattle drizzle + playground traction',
    source: 'Promotion email keyword: toddler shoes, waterproof, 20% off',
    linkLabel: 'Shop toddler waterproof shoes',
    href: 'https://www.amazon.com/s?k=toddler+waterproof+sneakers',
    photoUrl: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=600&q=80',
  },
  {
    item: 'Layered fleece hoodie',
    reason: 'Warm stroller layer for 3-6 PM outings',
    source: 'Promotion email keyword: fleece, outerwear, seasonal sale',
    linkLabel: 'Shop toddler fleece hoodies',
    href: 'https://www.target.com/s?searchTerm=toddler+fleece+hoodie',
    photoUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=600&q=80',
  },
  {
    item: 'Soft jogger set',
    reason: 'Easy diaper changes and indoor-play comfort',
    source: 'Promotion email keyword: toddler set, bundle, clearance',
    linkLabel: 'Shop toddler jogger sets',
    href: 'https://www.carters.com/search?q=toddler%20jogger%20set',
    photoUrl: 'https://images.unsplash.com/photo-1525171254930-643fc658b64e?auto=format&fit=crop&w=600&q=80',
  },
];
const menu = [
  ['Monday', 'Banana baby waffle + yogurt bites', 'Mini veggie dumplings + peas', 'Strawberry smoothie', 'Sweet potato mash + broccoli florets'],
  ['Tuesday', 'Yogurt bowl with banana coins', 'Sweet corn veggie fried rice', 'Baby smoothie pouch', 'Chicken dumpling soup with peas'],
  ['Wednesday', 'Mini waffle sticks + strawberries', 'Broccoli mac bites', 'Yogurt bites + banana', 'Sweet potato salmon cakes + corn'],
  ['Thursday', 'Smoothie cup + waffle', 'Pea and corn quesadilla triangles', 'Strawberries', 'Dumplings + soft broccoli'],
  ['Friday', 'Banana oatmeal + yogurt bites', 'Sweet potato veggie patties', 'Broccoli cheddar mini muffin', 'Family dumpling night with peas'],
  ['Weekend', 'Toddler brunch plate', 'Picnic bento with fruit', 'Smoothie after outing', 'Simple bowl: grain + veggie + protein'],
];
const nearbyPlaces = [
  ['Seattle Center Artists at Play', 'Outdoor playground', '0.6 mi', 'climbing, slides, car/streetcar watching nearby', 'dry or light drizzle'],
  ['Denny Park', 'Outdoor park', '0.4 mi', 'short stroller walk, open grass, toddler run time', 'dry afternoons'],
  ['Seattle Children’s Museum', 'Indoor play', '0.7 mi', 'rainy-day pretend play and sensory exploration', 'rain, wind, cold'],
  ['PlayDate SEA', 'Indoor play space', '0.7 mi', 'big energy days when outside is wet', 'rainy days'],
  ['Myrtle Edwards Park', 'Outdoor waterfront', '0.7 mi', 'stroller views, boats, trains, and easy snack stop', 'clear and low wind'],
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

function icon(name) { return `<span class="icon" aria-hidden="true">${name}</span>`; }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttribute(value) { return escapeHtml(value); }
function clean(value) { return String(value).replace(/[,;]/g, ' '); }
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

async function ensureBackendUser() {
  try {
    const health = await apiRequest('/health');
    let userId = readStoredValue('aaronUserId', '');
    let user;
    if (userId) {
      try {
        ({ user } = await apiRequest(`/users/${encodeURIComponent(userId)}/profile`));
      } catch {
        userId = '';
      }
    }
    state.user = user;
    state.apiReady = true;
    state.apiMessage = health.aiConfigured ? 'Backend online. AI captions enabled.' : 'Backend online. Add OPENAI_API_KEY for AI captions.';
    if (user) {
      applyUserProfile(user);
      state.apiMessage = health.aiConfigured ? 'Family profile synced. AI captions enabled.' : 'Family profile synced. Add OPENAI_API_KEY for AI captions.';
    }
  } catch (error) {
    state.apiReady = false;
    state.user = null;
    state.apiMessage = `Backend unavailable: ${error.message}`;
  }
  render();
}

function applyUserProfile(user) {
  state.user = user;
  state.loginEmail = user.email || state.loginEmail;
  state.loginName = user.displayName || '';
  state.albumLink = user.socialLinks?.icloudPhotosUrl || DEFAULT_ALBUM_LINK;
  state.shoppingList = Array.isArray(user.foodPlan?.favorites) && user.foodPlan.favorites.length > 0
    ? [...user.foodPlan.favorites]
    : [...defaultToddlerFoods];
  state.foodStatus = '';
  state.amazonTasks = Array.isArray(user.amazonErrands?.tasks) && user.amazonErrands.tasks.length > 0
    ? user.amazonErrands.tasks.map((task) => (typeof task === 'string' ? { title: task, source: 'amazon', status: 'planned' } : task))
    : defaultAmazonTasks.map((task) => ({ ...task }));
  state.outfitIdeas = Array.isArray(user.amazonErrands?.outfitIdeas) && user.amazonErrands.outfitIdeas.length > 0
    ? user.amazonErrands.outfitIdeas.map((idea, index) => ({ ...defaultOutfitIdeas[index % defaultOutfitIdeas.length], ...idea }))
    : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.amazonStatus = '';
  state.generatedCaption = '';
  state.captionStatus = '';
  state.locationStatus = user.location ? '' : 'No location saved yet. Share current location or enter one below.';
  writeStoredValue('aaronUserId', user.id);
  if (user.email) writeStoredValue('aaronLoginEmail', user.email);
  writeStoredValue('aaronApplePhotosLink', state.albumLink);
}

async function loginUser(event) {
  event?.preventDefault();
  state.authStatus = 'Signing in…';
  renderLogin();
  try {
    const { user } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: state.loginEmail,
        displayName: state.loginName,
      }),
    });
    applyUserProfile(user);
    state.authStatus = '';
    state.apiReady = true;
    state.apiMessage = 'Family profile synced.';
  } catch (error) {
    state.authStatus = error.message;
  }
  render();
}

function logoutUser() {
  state.user = null;
  state.albumLink = DEFAULT_ALBUM_LINK;
  state.media = [];
  state.homePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.homePhotos = [];
  state.shoppingList = [...defaultToddlerFoods];
  state.foodStatus = '';
  state.amazonTasks = defaultAmazonTasks.map((task) => ({ ...task }));
  state.outfitIdeas = defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.amazonStatus = '';
  state.generatedCaption = '';
  state.captionStatus = '';
  state.locationStatus = '';
  state.authStatus = 'Signed out. Choose another family profile.';
  removeStoredValue('aaronUserId');
  removeStoredValue('aaronApplePhotosLink');
  render();
}

async function saveUserSection(section, payload) {
  if (!state.user) return;
  try {
    const { user } = await apiRequest(`/users/${encodeURIComponent(state.user.id)}/${section}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.user = user;
    state.apiMessage = 'Family profile saved.';
    if (section === 'social-links') {
      state.albumLink = user.socialLinks?.icloudPhotosUrl || state.albumLink;
      writeStoredValue('aaronApplePhotosLink', state.albumLink);
    }
    if (section === 'location') {
      state.locationStatus = 'Location saved for this user.';
      loadWeather();
    }
    if (section === 'food-plan') {
      state.shoppingList = Array.isArray(user.foodPlan?.favorites) ? [...user.foodPlan.favorites] : state.shoppingList;
      state.foodStatus = 'Shopping list saved for this user.';
    }
    if (section === 'amazon-errands') {
      state.amazonTasks = Array.isArray(user.amazonErrands?.tasks) ? [...user.amazonErrands.tasks] : state.amazonTasks;
      state.outfitIdeas = Array.isArray(user.amazonErrands?.outfitIdeas) ? [...user.amazonErrands.outfitIdeas] : state.outfitIdeas;
      state.amazonStatus = 'Amazon automation saved for this user.';
    }
  } catch (error) {
    state.apiMessage = `Save failed: ${error.message}`;
  }
  render();
}

function getUserLocation() {
  return state.user?.location || null;
}

function getWeatherCoords() {
  const location = getUserLocation();
  if (typeof location?.latitude === 'number' && typeof location?.longitude === 'number') {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return null;
}

function formatLocation(location) {
  if (!location) return 'No location saved';
  if (location.address) return location.address;
  if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }
  return location.label || 'Saved location';
}

function requestCurrentLocation() {
  if (!globalThis.navigator?.geolocation) {
    state.locationStatus = 'This browser does not support location permission.';
    renderPlay();
    return;
  }

  state.locationStatus = 'Requesting browser location permission…';
  renderPlay();
  globalThis.navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      saveUserSection('location', {
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
      renderPlay();
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

function saveManualLocation(event) {
  event.preventDefault();
  const address = document.getElementById('location-address').value.trim();
  if (!address) {
    state.locationStatus = 'Enter an address or use current location.';
    renderPlay();
    return;
  }
  saveUserSection('location', {
    label: 'Manual location',
    address,
    latitude: null,
    longitude: null,
    source: 'manual',
  });
}

function saveFoodPlan(favorites = state.shoppingList) {
  return saveUserSection('food-plan', { favorites, weeklyMenu: menu });
}

function addShoppingItem(event) {
  event.preventDefault();
  const value = state.newFood.trim();
  if (!value) {
    state.foodStatus = 'Enter a food to add.';
    renderFood();
    return;
  }

  const exists = state.shoppingList.some((food) => food.toLowerCase() === value.toLowerCase());
  if (exists) {
    state.foodStatus = `${value} is already on the list.`;
    renderFood();
    return;
  }

  state.shoppingList = [...state.shoppingList, value];
  state.newFood = '';
  state.foodStatus = `${value} added. Save when ready.`;
  renderFood();
}

function removeShoppingItem(index) {
  const removed = state.shoppingList[index];
  state.shoppingList = state.shoppingList.filter((_, itemIndex) => itemIndex !== index);
  state.foodStatus = `${removed} removed. Save when ready.`;
  renderFood();
}

function saveAmazonErrands(tasks = state.amazonTasks, outfitIdeas = state.outfitIdeas) {
  return saveUserSection('amazon-errands', { tasks, outfitIdeas });
}

function addAmazonTask(event) {
  event.preventDefault();
  const value = state.newAmazonTask.trim();
  if (!value) {
    state.amazonStatus = 'Enter an automation item to add.';
    renderErrands();
    return;
  }

  state.amazonTasks = [...state.amazonTasks, { title: value, source: 'amazon', status: 'planned' }];
  state.newAmazonTask = '';
  state.amazonStatus = 'Automation item added. Save when ready.';
  renderErrands();
}

function removeAmazonTask(index) {
  const removed = state.amazonTasks[index]?.title || 'Automation item';
  state.amazonTasks = state.amazonTasks.filter((_, taskIndex) => taskIndex !== index);
  state.amazonStatus = `${removed} removed. Save when ready.`;
  renderErrands();
}

function downloadCalendar(title, start, end, description) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aaron Planner//Daily Life//EN', 'BEGIN:VEVENT', `SUMMARY:${clean(title)}`, `DTSTART:${start}`, `DTEND:${end}`, `DESCRIPTION:${clean(description)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
globalThis.downloadCalendar = downloadCalendar;

function ensureRoot() {
  root = root || document.getElementById('root');
  if (!root) {
    throw new Error('Aaron planner could not find the #root mount element.');
  }
}

function layout(content) {
  ensureRoot();
  const tabs = [['home', '🏠', 'Home'], ['play', '🛝', 'Play'], ['food', '🥣', 'Food'], ['errands', '🛒', 'Errands'], ['social', '📷', 'Social']];
  root.innerHTML = `<div class="app-shell"><header class="app-header"><div class="brand"><span class="brand-mark">👶</span><div><p class="eyebrow">Aaron • 2 years old • Seattle</p><h1>Daily Life Planner</h1></div></div><nav class="tabs" aria-label="Planner sections">${tabs.map(([key, emoji, label]) => `<button class="${state.tab === key ? 'active' : ''}" data-tab="${key}"><span>${emoji}</span>${label}</button>`).join('')}</nav></header><div class="sync-banner ${state.apiReady ? 'ready' : ''}"><div><strong>${escapeHtml(state.user.displayName)}</strong><small>${escapeHtml(state.user.email || 'Local family profile')}</small></div><span>${escapeHtml(state.apiMessage)}</span><button id="logout-user" class="secondary-button">Sign out</button></div>${content}</div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; render(); }));
  document.getElementById('logout-user').addEventListener('click', logoutUser);
}

function renderLogin() {
  ensureRoot();
  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><span class="brand-mark">👶</span><div><p class="eyebrow">Aaron • family profiles</p><h1>Daily Life Planner</h1></div></div></header><main class="auth-layout"><section class="panel auth-panel"><p class="eyebrow">Sign in</p><h2>Choose your family profile</h2><p>Use an email to keep each family member’s iCloud link, location, food plan, Amazon errands, and social captions separate.</p><form id="login-form"><label class="input-label" for="login-email">Email</label><input id="login-email" type="email" autocomplete="email" value="${escapeAttribute(state.loginEmail)}" placeholder="parent@example.com" required /><label class="input-label" for="login-name">Display name</label><input id="login-name" autocomplete="name" value="${escapeAttribute(state.loginName)}" placeholder="Aaron Family" /><button type="submit" ${state.apiReady ? '' : 'disabled'}>Continue</button></form><p class="muted">${escapeHtml(state.authStatus || state.apiMessage)}</p></section><section class="panel auth-note"><h2>Multi-user backend</h2><p>Each login maps to a separate backend user record. Existing emails open the same profile; new emails create a fresh one.</p><div class="profile-facts"><span>Social links</span><span>Location</span><span>Food plan</span><span>Amazon errands</span><span>AI captions</span></div></section></main></div>`;
  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('login-email').addEventListener('input', (event) => { state.loginEmail = event.target.value; });
  document.getElementById('login-name').addEventListener('input', (event) => { state.loginName = event.target.value; });
}

function renderHome() {
  const [title, note, color] = slides[state.slide];
  const activePhoto = state.homePhotos[state.slide % Math.max(state.homePhotos.length, 1)];
  const photoMarkup = activePhoto
    ? `<figure class="home-photo-frame"><img src="${activePhoto.url}" alt="Local preview of ${escapeHtml(activePhoto.name)}" /><figcaption>${escapeHtml(activePhoto.name)}</figcaption></figure>`
    : '';
  layout(`<main class="home-layout"><section class="hero-card ${color} ${activePhoto ? 'with-photo' : ''}"><div class="hero-copy"><div class="slide-meta">${icon('✨')}<span>${activePhoto ? 'Local photo preview' : 'Apple Photos linked slideshow'}</span></div><h2>${title}</h2><p>${activePhoto ? 'This photo is displayed only in this browser session and scaled to fit the home card.' : note}</p><a class="primary-link" href="${escapeAttribute(state.albumLink)}" target="_blank" rel="noreferrer">Open Aaron’s Apple Photos</a></div>${photoMarkup}<div class="slide-dots">${slides.map((item, index) => `<button class="${index === state.slide ? 'selected' : ''}" data-slide="${index}" aria-label="Show ${item[0]}"></button>`).join('')}</div></section><section class="panel"><p class="eyebrow">Photo setup</p><h2>Safer ways to show Aaron’s photos</h2><p>Direct iCloud account login should not be built into this static front page. The safer pattern is to let Apple handle authentication, then display a shared album link or local photo previews.</p><label class="input-label" for="album">Shared iCloud Photos link</label><input id="album" value="${escapeAttribute(state.albumLink)}" placeholder="https://www.icloud.com/sharedalbum/..." /><button id="save-social-links">Save social links</button><label class="upload-box compact" for="home-photo-input">${icon('🖼️')}<span>Preview photos from this device</span><input id="home-photo-input" type="file" accept="image/*" multiple /></label><div class="photo-options">${photoConnectionOptions.map(([name, badge, detail]) => `<article><strong>${name}</strong><span>${badge}</span><p>${detail}</p></article>`).join('')}</div></section></main>`);
  document.getElementById('album').addEventListener('input', (event) => { state.albumLink = event.target.value; writeStoredValue('aaronApplePhotosLink', state.albumLink); });
  document.getElementById('save-social-links').addEventListener('click', () => saveUserSection('social-links', { icloudPhotosUrl: state.albumLink }));
  document.getElementById('home-photo-input').addEventListener('change', (event) => handleHomePhotos(event.target.files));
  document.querySelectorAll('[data-slide]').forEach((button) => button.addEventListener('click', () => { state.slide = Number(button.dataset.slide); renderHome(); }));
}

function handleHomePhotos(files) {
  state.homePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.homePhotos = Array.from(files || []).slice(0, 6).map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
  state.slide = 0;
  renderHome();
}

function renderPlay() {
  const rainy = state.weather.label.includes('Rainy') || state.weather.label.includes('indoor');
  const dailyPlan = [['3:00 PM', 'Snack + diaper + shoes', 'Offer banana/strawberries, water, and pick weather-appropriate layers.'], ['3:30 PM', rainy ? 'Indoor destination' : 'Outdoor destination', rainy ? 'Seattle Children’s Museum or PlayDate SEA.' : 'Artists at Play, Denny Park, or Myrtle Edwards Park.'], ['4:30 PM', 'Transition activity', 'Toy cars, bubbles, or stroller ride toward home.'], ['5:15 PM', 'Calm-down block', 'Books, bath prep, or family helper task.'], ['6:00 PM', 'Dinner handoff', 'Switch to food tab meal plan.']];
  const location = getUserLocation();
  const locationText = formatLocation(location);
  const locationStatus = state.locationStatus || (location ? 'This location is saved only for the signed-in user.' : 'No location saved. Use current location to allow browser permission.');
  layout(`<main class="stack"><section class="dashboard-row"><div class="panel weather-panel"><p class="eyebrow">🌤 Live planning tool</p><h2>3:00–6:00 PM activity plan</h2><p class="muted">Home base: ${escapeHtml(locationText)}</p><div class="weather-grid"><strong>${state.weather.label}</strong><span>${state.weather.temperature}</span><span>Rain: ${state.weather.precipitation}</span><span>Wind: ${state.weather.wind}</span></div><small>Updated: ${state.weather.updated}. Daily automation: refresh weather and nearby options at 5:00 AM.</small><button onclick="downloadCalendar('Aaron daily 3-6 PM plan','20260514T150000','20260514T180000','Daily play plan using weather and nearby indoor/outdoor options')">Download today’s calendar block</button></div><div class="panel location-tool">${icon('📍')}<h3>User location</h3><p>${escapeHtml(locationStatus)}</p><form id="location-form"><label class="input-label" for="location-address">Address or place</label><input id="location-address" value="${escapeAttribute(location?.address || '')}" placeholder="Home address, city, or favorite play area" /><button type="submit">Save address</button></form><button id="use-current-location" class="secondary-button">Use current location</button></div></section><section class="timeline panel">${dailyPlan.map(([time, title, detail]) => `<article><time>${time}</time><div><h3>${title}</h3><p>${detail}</p></div></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Nearby indoor/outdoor play options</h2><div class="cards-list">${nearbyPlaces.map(([name, type, distance, best, weather]) => `<article class="mini-card">${icon('📍')}<div><h3>${name}</h3><p>${type} • ${distance}</p><small>${best} • Best: ${weather}</small></div></article>`).join('')}</div></div><div class="panel"><h2>Weekend family events</h2><p class="muted">Every Thursday: choose one, create a reminder, and organize a playdate.</p>${weekendEvents.map(([title, theme, plan, reminder]) => `<article class="event-card"><span>${theme}</span><h3>${title}</h3><p>${plan}</p><small>${reminder}</small></article>`).join('')}</div></section><section class="grid two-cols"><div class="panel action-panel">${icon('☎️')}<h2>Saturday night family phone call</h2><p>Recurring reminder: Saturday 7:30 PM, after dinner and before bedtime wind-down.</p><button onclick="downloadCalendar('Family phone call','20260516T193000','20260516T200000','Weekly Saturday night family call with Aaron')">Download family-call event</button></div><div class="panel"><h2>Holiday planning reminders</h2>${holidays.map(([holiday, reminder]) => `<article class="mini-card">${icon('🎁')}<div><h3>${holiday}</h3><p>${reminder}</p></div></article>`).join('')}</div></section></main>`);
  document.getElementById('location-form').addEventListener('submit', saveManualLocation);
  document.getElementById('use-current-location').addEventListener('click', requestCurrentLocation);
}

function renderFood() {
  const shoppingList = state.shoppingList.length > 0 ? state.shoppingList : [...defaultToddlerFoods];
  const shoppingText = shoppingList.join(' ');
  layout(`<main class="stack"><section class="panel title-panel">${icon('👨‍🍳')}<div><p class="eyebrow">Weekly refresh</p><h2>Menu recommendations for a 2-year-old toddler</h2><p>Rotates around Aaron’s favorites while balancing fruit, vegetables, protein, and simple family meals.</p><button id="save-food-plan">Save food plan</button></div></section><section class="menu-grid">${menu.map(([day, b, l, s, d]) => `<article class="panel meal-card"><h3>${day}</h3><p><strong>Breakfast:</strong> ${b}</p><p><strong>Lunch:</strong> ${l}</p><p><strong>Snack:</strong> ${s}</p><p><strong>Dinner:</strong> ${d}</p></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Whole Foods weekday shopping events</h2><article class="event-card"><span>Tuesday 10:00 AM</span><h3>Fresh produce + snacks</h3><p>Avoids the 3–6 PM weekday play block. Buy fruit, vegetables, yogurt bites, smoothie ingredients, and waffles.</p></article><article class="event-card"><span>Thursday 10:30 AM</span><h3>Freezer + pantry restock</h3><p>Avoids weekday play and leaves time before Thursday weekend playdate planning.</p></article></div><div class="panel"><h2>Shopping list</h2><div class="shopping-list">${shoppingList.map((food, index) => `<div class="shopping-item"><label><input type="checkbox" /> ${escapeHtml(food)}</label><button class="icon-button danger" data-remove-food="${index}" aria-label="Remove ${escapeAttribute(food)}">×</button></div>`).join('')}</div><form id="shopping-form" class="shopping-edit"><label class="input-label" for="new-food">Add food</label><div class="inline-form"><input id="new-food" value="${escapeAttribute(state.newFood)}" placeholder="e.g. blueberries" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.foodStatus || 'Edit this list for the signed-in user, then save the food plan.')}</p><button id="save-shopping-list">Save shopping list</button><button id="download-shopping-event">🛒 Download shopping event</button></div></section></main>`);
  document.getElementById('save-food-plan').addEventListener('click', () => saveFoodPlan(shoppingList));
  document.getElementById('save-shopping-list').addEventListener('click', () => saveFoodPlan(shoppingList));
  document.getElementById('download-shopping-event').addEventListener('click', () => downloadCalendar('Whole Foods toddler shop', '20260519T100000', '20260519T110000', `Buy ${shoppingText}`));
  document.getElementById('shopping-form').addEventListener('submit', addShoppingItem);
  document.getElementById('new-food').addEventListener('input', (event) => { state.newFood = event.target.value; });
  document.querySelectorAll('[data-remove-food]').forEach((button) => button.addEventListener('click', () => removeShoppingItem(Number(button.dataset.removeFood))));
}

function renderErrands() {
  const amazonTasks = state.amazonTasks.length > 0 ? state.amazonTasks : defaultAmazonTasks.map((task) => ({ ...task }));
  const outfitIdeas = state.outfitIdeas.length > 0 ? state.outfitIdeas : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  const reminderText = amazonTasks.map((task) => task.title).join(' ');
  layout(`<main class="grid two-cols"><section class="panel"><p class="eyebrow">Amazon automation</p><h2>Diapers + wipes monthly order</h2><p>Use this checklist to keep the subscription visible and avoid surprise low-stock mornings.</p><div class="automation-list">${amazonTasks.map((task, index) => `<article class="mini-card editable-card">${icon('🔄')}<p>${escapeHtml(task.title)}</p><button class="icon-button danger" data-remove-amazon="${index}" aria-label="Remove ${escapeAttribute(task.title)}">×</button></article>`).join('')}</div><form id="amazon-task-form" class="shopping-edit"><label class="input-label" for="new-amazon-task">Add Amazon or grocery automation</label><div class="inline-form"><input id="new-amazon-task" value="${escapeAttribute(state.newAmazonTask)}" placeholder="e.g. Grocery delivery every Tuesday at 10 AM" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.amazonStatus || 'Edit Amazon and grocery errands for the signed-in user, then save.')}</p><button id="download-amazon-reminder">Download monthly reminder</button><button id="save-amazon-errands">Save Amazon errands</button></section><section class="panel"><p class="eyebrow">Email promotion scanner</p><h2>New outfit recommendations</h2><p>Connect promotion emails by searching for toddler shoe/clothing keywords, then choose comfortable pieces for Seattle play.</p>${outfitIdeas.map((idea) => `<article class="event-card outfit-card"><img class="outfit-preview" src="${escapeAttribute(idea.photoUrl)}" alt="Photo preview for ${escapeAttribute(idea.item)}" loading="lazy" /><div><span>👕 ${escapeHtml(idea.source)}</span><h3>${escapeHtml(idea.item)}</h3><p>${escapeHtml(idea.reason)}</p><a class="shopping-link" href="${escapeAttribute(idea.href)}" target="_blank" rel="noreferrer">${escapeHtml(idea.linkLabel)} ↗</a></div></article>`).join('')}</section></main>`);
  document.getElementById('download-amazon-reminder').addEventListener('click', () => downloadCalendar('Order diapers and wipes', '20260601T080000', '20260601T081500', reminderText || 'Monthly Amazon and grocery errand reminder'));
  document.getElementById('save-amazon-errands').addEventListener('click', () => saveAmazonErrands(amazonTasks, outfitIdeas));
  document.getElementById('amazon-task-form').addEventListener('submit', addAmazonTask);
  document.getElementById('new-amazon-task').addEventListener('input', (event) => { state.newAmazonTask = event.target.value; });
  document.querySelectorAll('[data-remove-amazon]').forEach((button) => button.addEventListener('click', () => removeAmazonTask(Number(button.dataset.removeAmazon))));
}

async function copyText(value) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Fall through to the textarea copy fallback.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand?.('copy');
  textarea.remove();
}

function renderSocial() {
  const caption = state.generatedCaption || (state.media.length === 1 && state.media[0].kind === 'video'
    ? `今日份Aaron小电影🎬：两岁的小小探险家，把平凡的一天玩成了冒险。${state.captionTone}，每一秒都想珍藏。`
    : '今日份Aaron三连拍📷：小手忙着探索，笑容负责发光。两岁的快乐很简单，有爱、有玩具，也有一点点甜甜的惊喜。#Aaron成长日记');
  layout(`<main class="grid two-cols"><section class="panel upload-panel"><p class="eyebrow">Today’s best post</p><h2>Pick best 3 photos or 1 video</h2><p>Upload today’s Apple Photos exports. The app selects one video if present; otherwise it picks the top three photos and drafts a Chinese caption.</p><label class="upload-box">${icon('⬆️')}<span>Choose photos or video</span><input id="media-input" type="file" accept="image/*,video/*" multiple /></label><label class="input-label" for="tone">Caption tone</label><select id="tone"><option>温柔可爱</option><option>俏皮活泼</option><option>季节感</option><option>车车主题</option></select><button id="generate-caption" ${state.media.length > 0 ? '' : 'disabled'}>Generate AI caption</button><p class="muted">${escapeHtml(state.captionStatus || 'Photo captions use selected images; video captions use a thumbnail frame and the backend AI service.')}</p></section><section class="panel"><h2>Selected media</h2><div class="media-grid">${state.media.length === 0 ? '<p class="muted">No media selected yet. Upload today’s photos or a video.</p>' : state.media.map((pick) => `<article class="media-card">${pick.kind === 'video' ? `<video src="${pick.url}" controls></video>` : `<img src="${pick.url}" alt="${pick.name}" />`}<h3>${pick.name}</h3><p>Score ${pick.score}/100 • ${pick.reason}</p></article>`).join('')}</div><div class="caption-box"><h3>Chinese caption</h3><p id="caption">${escapeHtml(caption)}</p><button id="copy-caption">➕ Copy caption</button></div></section></main>`);
  document.getElementById('tone').value = state.captionTone;
  document.getElementById('tone').addEventListener('change', (event) => { state.captionTone = event.target.value; state.generatedCaption = ''; renderSocial(); });
  document.getElementById('media-input').addEventListener('change', (event) => handleFiles(event.target.files));
  document.getElementById('generate-caption').addEventListener('click', () => generateMediaCaption());
  document.getElementById('copy-caption').addEventListener('click', () => copyText(caption));
}
function handleFiles(files) {
  state.generatedCaption = '';
  state.captionStatus = '';
  const selected = Array.from(files || []).slice(0, 8).map((file, index) => ({ file, name: file.name, kind: file.type.startsWith('video') ? 'video' : 'photo', score: 98 - index * 7 - (file.type.startsWith('video') ? 2 : 0), reason: file.type.startsWith('video') ? '视频优先：动作和声音更适合记录今天的故事。' : '照片清晰、表情自然，适合当天分享。', url: URL.createObjectURL(file) }));
  const video = selected.find((item) => item.kind === 'video');
  state.media = video ? [video] : selected.filter((item) => item.kind === 'photo').slice(0, 3);
  renderSocial();
}

function extractVideoFrame(videoUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = videoUrl;
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(0.5, Math.max(0, (video.duration || 1) / 3));
    }, { once: true });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const width = Math.min(video.videoWidth || 720, 720);
        const height = Math.round(width * ((video.videoHeight || 720) / (video.videoWidth || 720)));
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    }, { once: true });
    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Could not read a frame from this video.'));
    }, { once: true });
  });
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this photo.'));
    };
    image.src = objectUrl;
  });
}

async function generateMediaCaption() {
  if (state.media.length === 0 || !state.user) return;
  const video = state.media.find((item) => item.kind === 'video');
  const photos = state.media.filter((item) => item.kind === 'photo');
  state.captionStatus = video ? 'Reading video frame…' : 'Reading selected photos…';
  renderSocial();
  try {
    const imageDataUrls = video
      ? [await extractVideoFrame(video.url)]
      : await Promise.all(photos.slice(0, 3).map((photo) => imageFileToDataUrl(photo.file)));
    state.captionStatus = 'Generating caption…';
    renderSocial();
    const result = await apiRequest(`/users/${encodeURIComponent(state.user.id)}/social-media/caption`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: video ? video.name : photos.map((photo) => photo.name).join(', '),
        mediaType: video ? 'video' : 'photo',
        tone: state.captionTone,
        imageDataUrls,
      }),
    });
    state.generatedCaption = result.caption;
    state.captionStatus = result.source === 'openai'
      ? `AI caption generated from ${video ? 'video frame' : 'selected photos'}.`
      : 'Local fallback caption generated. Add OPENAI_API_KEY for AI vision captions.';
  } catch (error) {
    state.captionStatus = `Caption failed: ${error.message}`;
  }
  renderSocial();
}

async function loadWeather() {
  const coords = getWeatherCoords();
  if (!coords) {
    state.weather = { label: 'Location needed for weather', temperature: '--', precipitation: '--', wind: '--', updated: 'Use current location to enable weather' };
    if (state.tab === 'play') renderPlay();
    return;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles`;
    const response = await fetch(url);
    const data = await response.json();
    const current = data.current;
    const rainy = Number(current.precipitation) > 0;
    state.weather = { label: rainy ? 'Rainy backup recommended' : 'Outdoor play looks possible', temperature: `${Math.round(current.temperature_2m)}°F`, precipitation: `${current.precipitation} mm`, wind: `${Math.round(current.wind_speed_10m)} mph`, updated: new Date(current.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) };
  } catch {
    state.weather = { label: 'Weather unavailable — use indoor backup', temperature: '--', precipitation: '--', wind: '--', updated: 'Could not reach Open-Meteo' };
  }
  if (state.tab === 'play') renderPlay();
}

function renderError(error) {
  ensureRoot();
  root.innerHTML = `<main class="app-shell"><section class="panel error-panel"><p class="eyebrow">App recovery</p><h1>Aaron planner hit a startup issue</h1><p>${escapeHtml(error.message || 'Unknown error')}</p><button onclick="window.location.reload()">Reload planner</button></section></main>`;
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  if (state.tab === 'home') renderHome();
  if (state.tab === 'play') renderPlay();
  if (state.tab === 'food') renderFood();
  if (state.tab === 'errands') renderErrands();
  if (state.tab === 'social') renderSocial();
}

function startApp() {
  try {
    render();
    ensureBackendUser();
    loadWeather();
    setInterval(() => { if (state.tab === 'home') { state.slide = (state.slide + 1) % slides.length; renderHome(); } }, 4200);
  } catch (error) {
    renderError(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
