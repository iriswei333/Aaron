import {
  apiRequest,
  downloadCalendar,
  escapeAttribute,
  escapeHtml,
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
} from './shared.js';
import { applyErrandsProfile, renderErrands, resetErrandsState } from './tabs/errands.js';
import { applyFoodProfile, renderFood, resetFoodState } from './tabs/food.js';
import { DEFAULT_ALBUM_LINK, applyHomeProfile, renderHome, resetHomeState, slides } from './tabs/home.js';
import { getLocationCoords, refreshPlayPlanning, renderPlay, resetPlayState } from './tabs/play.js';
import { renderSocial, resetSocialState } from './tabs/social.js';

let root = document.getElementById('root');

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
  nearbyPlayOptions: [],
  nearbyStatus: 'Save a location to personalize nearby play options.',
  media: [],
  captionTone: '温柔可爱',
  generatedCaption: '',
  captionStatus: '',
};

const tabRenderers = {
  home: renderHome,
  play: renderPlay,
  food: renderFood,
  errands: renderErrands,
  social: renderSocial,
};

const appContext = {
  state,
  layout,
  saveUserSection,
  renderCurrent: render,
};

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
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    render();
  }));
  document.getElementById('logout-user').addEventListener('click', logoutUser);
}

function renderLogin() {
  ensureRoot();
  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><span class="brand-mark">👶</span><div><p class="eyebrow">Aaron • family profiles</p><h1>Daily Life Planner</h1></div></div></header><main class="auth-layout"><section class="panel auth-panel"><p class="eyebrow">Sign in</p><h2>Choose your family profile</h2><p>Use an email to keep each family member’s iCloud link, location, food plan, Amazon errands, and social captions separate.</p><form id="login-form"><label class="input-label" for="login-email">Email</label><input id="login-email" type="email" autocomplete="email" value="${escapeAttribute(state.loginEmail)}" placeholder="parent@example.com" required /><label class="input-label" for="login-name">Display name</label><input id="login-name" autocomplete="name" value="${escapeAttribute(state.loginName)}" placeholder="Aaron Family" /><button type="submit" ${state.apiReady ? '' : 'disabled'}>Continue</button></form><p class="muted">${escapeHtml(state.authStatus || state.apiMessage)}</p></section><section class="panel auth-note"><h2>Multi-user backend</h2><p>Each login maps to a separate backend user record. Existing emails open the same profile; new emails create a fresh one.</p><div class="profile-facts"><span>Social links</span><span>Location</span><span>Food plan</span><span>Amazon errands</span><span>AI captions</span></div></section></main></div>`;
  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('login-email').addEventListener('input', (event) => { state.loginEmail = event.target.value; });
  document.getElementById('login-name').addEventListener('input', (event) => { state.loginName = event.target.value; });
}

async function ensureBackendUser() {
  try {
    const health = await apiRequest('/health');
    let userId = readStoredValue('aaronUserId', '');
    let user = null;
    if (userId) {
      try {
        ({ user } = await apiRequest(`/users/${encodeURIComponent(userId)}/profile`));
      } catch {
        userId = '';
      }
    }
    state.user = user || null;
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
  applyHomeProfile(state, user);
  applyFoodProfile(state, user);
  applyErrandsProfile(state, user);
  resetSocialState(state);
  state.locationStatus = user.location ? '' : 'No location saved yet. Share current location or enter one below.';
  refreshPlayPlanning(appContext);
  writeStoredValue('aaronUserId', user.id);
  if (user.email) writeStoredValue('aaronLoginEmail', user.email);
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
  resetHomeState(state);
  resetFoodState(state);
  resetErrandsState(state);
  resetSocialState(state);
  resetPlayState(state);
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
      applyHomeProfile(state, user);
    }
    if (section === 'location') {
      state.locationStatus = getLocationCoords(user.location)
        ? 'Location saved. Updating forecast and nearby play options.'
        : 'Address saved, but forecast needs a recognized place or current location.';
      refreshPlayPlanning(appContext);
    }
    if (section === 'food-plan') {
      applyFoodProfile(state, user);
      state.foodStatus = 'Shopping list saved for this user.';
    }
    if (section === 'amazon-errands') {
      applyErrandsProfile(state, user);
      state.amazonStatus = 'Amazon automation saved for this user.';
    }
  } catch (error) {
    state.apiMessage = `Save failed: ${error.message}`;
  }
  render();
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
  const renderTab = tabRenderers[state.tab] || renderHome;
  renderTab(appContext);
}

function startApp() {
  try {
    render();
    ensureBackendUser();
    setInterval(() => {
      if (state.user && state.tab === 'home') {
        state.slide = (state.slide + 1) % slides.length;
        renderHome(appContext);
      }
    }, 4200);
  } catch (error) {
    renderError(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
