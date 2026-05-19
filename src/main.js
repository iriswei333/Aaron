const AARON_ADDRESS = '588 Bell St, Seattle, WA 98121';
const AARON_COORDS = { latitude: 47.6167, longitude: -122.3448 };
const root = document.getElementById('root');
const state = {
  tab: 'home',
  slide: 0,
  albumLink: localStorage.getItem('aaronApplePhotosLink') || 'photos-redirect://',
  homePhotos: [],
  weather: { label: 'Loading Seattle weather…', temperature: '--', precipitation: '--', wind: '--', updated: 'Fetching from Open-Meteo' },
  media: [],
  captionTone: '温柔可爱',
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
const toddlerFoods = ['peas', 'broccoli', 'banana', 'strawberry', 'sweet corn', 'sweet potato', 'dumplings', 'baby waffle', 'baby smoothie', 'yogurt bites'];
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
function downloadCalendar(title, start, end, description) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aaron Planner//Daily Life//EN', 'BEGIN:VEVENT', `SUMMARY:${clean(title)}`, `DTSTART:${start}`, `DTEND:${end}`, `DESCRIPTION:${clean(description)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
<<<<<<< ours
window.downloadCalendar = downloadCalendar;

function layout(content) {
=======
globalThis.downloadCalendar = downloadCalendar;

function ensureRoot() {
  root = root || document.getElementById('root');
  if (!root) {
    throw new Error('Aaron planner could not find the #root mount element.');
  }
}

function layout(content) {
  ensureRoot();
>>>>>>> theirs
  const tabs = [['home', '🏠', 'Home'], ['play', '🛝', 'Play'], ['food', '🥣', 'Food'], ['errands', '🛒', 'Errands'], ['social', '📷', 'Social']];
  root.innerHTML = `<div class="app-shell"><header class="app-header"><div class="brand"><span class="brand-mark">👶</span><div><p class="eyebrow">Aaron • 2 years old • Seattle</p><h1>Daily Life Planner</h1></div></div><nav class="tabs" aria-label="Planner sections">${tabs.map(([key, emoji, label]) => `<button class="${state.tab === key ? 'active' : ''}" data-tab="${key}"><span>${emoji}</span>${label}</button>`).join('')}</nav></header>${content}</div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => { state.tab = button.dataset.tab; render(); }));
}

function renderHome() {
  const [title, note, color] = slides[state.slide];
  const activePhoto = state.homePhotos[state.slide % Math.max(state.homePhotos.length, 1)];
  const photoMarkup = activePhoto
    ? `<figure class="home-photo-frame"><img src="${activePhoto.url}" alt="Local preview of ${escapeHtml(activePhoto.name)}" /><figcaption>${escapeHtml(activePhoto.name)}</figcaption></figure>`
    : '';
<<<<<<< ours
  layout(`<main class="home-layout"><section class="hero-card ${color} ${activePhoto ? 'with-photo' : ''}"><div class="hero-copy"><div class="slide-meta">${icon('✨')}<span>${activePhoto ? 'Local photo preview' : 'Apple Photos linked slideshow'}</span></div><h2>${title}</h2><p>${activePhoto ? 'This photo is displayed only in this browser session and scaled to fit the home card.' : note}</p><a class="primary-link" href="${state.albumLink}" target="_blank" rel="noreferrer">Open Aaron’s Apple Photos</a></div>${photoMarkup}<div class="slide-dots">${slides.map((item, index) => `<button class="${index === state.slide ? 'selected' : ''}" data-slide="${index}" aria-label="Show ${item[0]}"></button>`).join('')}</div></section><section class="panel"><p class="eyebrow">Photo setup</p><h2>Safer ways to show Aaron’s photos</h2><p>Direct iCloud account login should not be built into this static front page. The safer pattern is to let Apple handle authentication, then display a shared album link or local photo previews.</p><label class="input-label" for="album">Shared iCloud Photos link</label><input id="album" value="${state.albumLink}" placeholder="https://www.icloud.com/sharedalbum/..." /><label class="upload-box compact" for="home-photo-input">${icon('🖼️')}<span>Preview photos from this device</span><input id="home-photo-input" type="file" accept="image/*" multiple /></label><div class="photo-options">${photoConnectionOptions.map(([name, badge, detail]) => `<article><strong>${name}</strong><span>${badge}</span><p>${detail}</p></article>`).join('')}</div></section></main>`);
  document.getElementById('album').addEventListener('input', (event) => { state.albumLink = event.target.value; localStorage.setItem('aaronApplePhotosLink', state.albumLink); });
=======
  layout(`<main class="home-layout"><section class="hero-card ${color} ${activePhoto ? 'with-photo' : ''}"><div class="hero-copy"><div class="slide-meta">${icon('✨')}<span>${activePhoto ? 'Local photo preview' : 'Apple Photos linked slideshow'}</span></div><h2>${title}</h2><p>${activePhoto ? 'This photo is displayed only in this browser session and scaled to fit the home card.' : note}</p><a class="primary-link" href="${escapeAttribute(state.albumLink)}" target="_blank" rel="noreferrer">Open Aaron’s Apple Photos</a></div>${photoMarkup}<div class="slide-dots">${slides.map((item, index) => `<button class="${index === state.slide ? 'selected' : ''}" data-slide="${index}" aria-label="Show ${item[0]}"></button>`).join('')}</div></section><section class="panel"><p class="eyebrow">Photo setup</p><h2>Safer ways to show Aaron’s photos</h2><p>Direct iCloud account login should not be built into this static front page. The safer pattern is to let Apple handle authentication, then display a shared album link or local photo previews.</p><label class="input-label" for="album">Shared iCloud Photos link</label><input id="album" value="${escapeAttribute(state.albumLink)}" placeholder="https://www.icloud.com/sharedalbum/..." /><label class="upload-box compact" for="home-photo-input">${icon('🖼️')}<span>Preview photos from this device</span><input id="home-photo-input" type="file" accept="image/*" multiple /></label><div class="photo-options">${photoConnectionOptions.map(([name, badge, detail]) => `<article><strong>${name}</strong><span>${badge}</span><p>${detail}</p></article>`).join('')}</div></section></main>`);
  document.getElementById('album').addEventListener('input', (event) => { state.albumLink = event.target.value; writeStoredValue('aaronApplePhotosLink', state.albumLink); });
>>>>>>> theirs
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
  layout(`<main class="stack"><section class="dashboard-row"><div class="panel weather-panel"><p class="eyebrow">🌤 Live planning tool</p><h2>3:00–6:00 PM activity plan</h2><p class="muted">Home base: ${AARON_ADDRESS}</p><div class="weather-grid"><strong>${state.weather.label}</strong><span>${state.weather.temperature}</span><span>Rain: ${state.weather.precipitation}</span><span>Wind: ${state.weather.wind}</span></div><small>Updated: ${state.weather.updated}. Daily automation: refresh weather and nearby options at 5:00 AM.</small><button onclick="downloadCalendar('Aaron daily 3-6 PM plan','20260514T150000','20260514T180000','Daily play plan using weather and nearby indoor/outdoor options')">Download today’s calendar block</button></div><div class="panel automation-card">${icon('🔔')}<h3>Daily 5:00 AM automation</h3><p>Refresh weather, pick an indoor/outdoor destination, and create one 3–6 PM plan. Add this app as your family dashboard and use the calendar export for Apple Calendar.</p></div></section><section class="timeline panel">${dailyPlan.map(([time, title, detail]) => `<article><time>${time}</time><div><h3>${title}</h3><p>${detail}</p></div></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Nearby indoor/outdoor play options</h2><div class="cards-list">${nearbyPlaces.map(([name, type, distance, best, weather]) => `<article class="mini-card">${icon('📍')}<div><h3>${name}</h3><p>${type} • ${distance}</p><small>${best} • Best: ${weather}</small></div></article>`).join('')}</div></div><div class="panel"><h2>Weekend family events</h2><p class="muted">Every Thursday: choose one, create a reminder, and organize a playdate.</p>${weekendEvents.map(([title, theme, plan, reminder]) => `<article class="event-card"><span>${theme}</span><h3>${title}</h3><p>${plan}</p><small>${reminder}</small></article>`).join('')}</div></section><section class="grid two-cols"><div class="panel action-panel">${icon('☎️')}<h2>Saturday night family phone call</h2><p>Recurring reminder: Saturday 7:30 PM, after dinner and before bedtime wind-down.</p><button onclick="downloadCalendar('Family phone call','20260516T193000','20260516T200000','Weekly Saturday night family call with Aaron')">Download family-call event</button></div><div class="panel"><h2>Holiday planning reminders</h2>${holidays.map(([holiday, reminder]) => `<article class="mini-card">${icon('🎁')}<div><h3>${holiday}</h3><p>${reminder}</p></div></article>`).join('')}</div></section></main>`);
}

function renderFood() {
  layout(`<main class="stack"><section class="panel title-panel">${icon('👨‍🍳')}<div><p class="eyebrow">Weekly refresh</p><h2>Menu recommendations for a 2-year-old toddler</h2><p>Rotates around Aaron’s favorites while balancing fruit, vegetables, protein, and simple family meals.</p></div></section><section class="menu-grid">${menu.map(([day, b, l, s, d]) => `<article class="panel meal-card"><h3>${day}</h3><p><strong>Breakfast:</strong> ${b}</p><p><strong>Lunch:</strong> ${l}</p><p><strong>Snack:</strong> ${s}</p><p><strong>Dinner:</strong> ${d}</p></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Whole Foods weekday shopping events</h2><article class="event-card"><span>Tuesday 10:00 AM</span><h3>Fresh produce + snacks</h3><p>Avoids the 3–6 PM weekday play block. Buy fruit, vegetables, yogurt bites, smoothie ingredients, and waffles.</p></article><article class="event-card"><span>Thursday 10:30 AM</span><h3>Freezer + pantry restock</h3><p>Avoids weekday play and leaves time before Thursday weekend playdate planning.</p></article></div><div class="panel"><h2>Shopping list</h2><div class="shopping-list">${toddlerFoods.map((food) => `<label><input type="checkbox" /> ${food}</label>`).join('')}</div><button onclick="downloadCalendar('Whole Foods toddler shop','20260519T100000','20260519T110000','Buy ${toddlerFoods.join(' ')}')">🛒 Download shopping event</button></div></section></main>`);
}

function renderErrands() {
  const diaperAutomation = ['Amazon monthly subscribe-and-save: diapers and wipes on the 1st at 8:00 AM.', 'Order status check: every Friday at 4:00 PM until delivered.', 'Low-stock alert: when fewer than 20 diapers or one unopened wipe pack remains.'];
  const outfits = [
    ['Waterproof toddler sneakers', 'Seattle drizzle + playground traction', 'Promotion email keyword: toddler shoes, waterproof, 20% off', 'Shop toddler waterproof shoes', 'https://www.amazon.com/s?k=toddler+waterproof+sneakers'],
    ['Layered fleece hoodie', 'Warm stroller layer for 3–6 PM outings', 'Promotion email keyword: fleece, outerwear, seasonal sale', 'Shop toddler fleece hoodies', 'https://www.target.com/s?searchTerm=toddler+fleece+hoodie'],
    ['Soft jogger set', 'Easy diaper changes and indoor-play comfort', 'Promotion email keyword: toddler set, bundle, clearance', 'Shop toddler jogger sets', 'https://www.carters.com/search?q=toddler%20jogger%20set'],
  ];
  layout(`<main class="grid two-cols"><section class="panel"><p class="eyebrow">Amazon automation</p><h2>Diapers + wipes monthly order</h2><p>Use this checklist to keep the subscription visible and avoid surprise low-stock mornings.</p>${diaperAutomation.map((item) => `<article class="mini-card">${icon('🔄')}<p>${item}</p></article>`).join('')}<button onclick="downloadCalendar('Order diapers and wipes','20260601T080000','20260601T081500','Monthly Amazon diaper and wipes reorder plus status tracking')">Download monthly reminder</button></section><section class="panel"><p class="eyebrow">Email promotion scanner</p><h2>New outfit recommendations</h2><p>Connect promotion emails by searching for toddler shoe/clothing keywords, then choose comfortable pieces for Seattle play.</p>${outfits.map(([item, reason, source, linkLabel, href]) => `<article class="event-card"><span>👕 ${source}</span><h3>${item}</h3><p>${reason}</p><a class="shopping-link" href="${href}" target="_blank" rel="noreferrer">${linkLabel} ↗</a></article>`).join('')}</section></main>`);
}

<<<<<<< ours
=======
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

>>>>>>> theirs
function renderSocial() {
  const caption = state.media.length === 1 && state.media[0].kind === 'video'
    ? `今日份Aaron小电影🎬：两岁的小小探险家，把平凡的一天玩成了冒险。${state.captionTone}，每一秒都想珍藏。`
    : '今日份Aaron三连拍📷：小手忙着探索，笑容负责发光。两岁的快乐很简单，有爱、有玩具，也有一点点甜甜的惊喜。#Aaron成长日记';
  layout(`<main class="grid two-cols"><section class="panel upload-panel"><p class="eyebrow">Today’s best post</p><h2>Pick best 3 photos or 1 video</h2><p>Upload today’s Apple Photos exports. The app selects one video if present; otherwise it picks the top three photos and drafts a Chinese caption.</p><label class="upload-box">${icon('⬆️')}<span>Choose photos or video</span><input id="media-input" type="file" accept="image/*,video/*" multiple /></label><label class="input-label" for="tone">Caption tone</label><select id="tone"><option>温柔可爱</option><option>俏皮活泼</option><option>季节感</option><option>车车主题</option></select></section><section class="panel"><h2>Selected media</h2><div class="media-grid">${state.media.length === 0 ? '<p class="muted">No media selected yet. Upload today’s photos or a video.</p>' : state.media.map((pick) => `<article class="media-card">${pick.kind === 'video' ? `<video src="${pick.url}" controls></video>` : `<img src="${pick.url}" alt="${pick.name}" />`}<h3>${pick.name}</h3><p>Score ${pick.score}/100 • ${pick.reason}</p></article>`).join('')}</div><div class="caption-box"><h3>Chinese caption</h3><p id="caption">${caption}</p><button id="copy-caption">➕ Copy caption</button></div></section></main>`);
  document.getElementById('tone').value = state.captionTone;
  document.getElementById('tone').addEventListener('change', (event) => { state.captionTone = event.target.value; renderSocial(); });
  document.getElementById('media-input').addEventListener('change', (event) => handleFiles(event.target.files));
<<<<<<< ours
  document.getElementById('copy-caption').addEventListener('click', () => navigator.clipboard.writeText(caption));
=======
  document.getElementById('copy-caption').addEventListener('click', () => copyText(caption));
>>>>>>> theirs
}
function handleFiles(files) {
  const selected = Array.from(files || []).slice(0, 8).map((file, index) => ({ name: file.name, kind: file.type.startsWith('video') ? 'video' : 'photo', score: 98 - index * 7 - (file.type.startsWith('video') ? 2 : 0), reason: file.type.startsWith('video') ? '视频优先：动作和声音更适合记录今天的故事。' : '照片清晰、表情自然，适合当天分享。', url: URL.createObjectURL(file) }));
  const video = selected.find((item) => item.kind === 'video');
  state.media = video ? [video] : selected.filter((item) => item.kind === 'photo').slice(0, 3);
  renderSocial();
}

async function loadWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${AARON_COORDS.latitude}&longitude=${AARON_COORDS.longitude}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles`;
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

<<<<<<< ours
=======
function renderError(error) {
  ensureRoot();
  root.innerHTML = `<main class="app-shell"><section class="panel error-panel"><p class="eyebrow">App recovery</p><h1>Aaron planner hit a startup issue</h1><p>${escapeHtml(error.message || 'Unknown error')}</p><button onclick="window.location.reload()">Reload planner</button></section></main>`;
}

>>>>>>> theirs
function render() {
  if (state.tab === 'home') renderHome();
  if (state.tab === 'play') renderPlay();
  if (state.tab === 'food') renderFood();
  if (state.tab === 'errands') renderErrands();
  if (state.tab === 'social') renderSocial();
}

<<<<<<< ours
setInterval(() => { if (state.tab === 'home') { state.slide = (state.slide + 1) % slides.length; renderHome(); } }, 4200);
render();
<<<<<<< ours
loadWeather();
=======
loadWeather();
>>>>>>> theirs
=======
function startApp() {
  try {
    render();
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
>>>>>>> theirs
