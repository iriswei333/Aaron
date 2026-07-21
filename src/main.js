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
import { createSupabaseBrowserClient } from '../lib/supabase/client.js';

let root = document.getElementById('root');

const state = {
  tab: 'home',
  slide: 0,
  user: null,
  apiReady: false,
  authMode: 'local',
  apiMessage: 'Connecting family profile…',
  loginEmail: readStoredValue('aaronLoginEmail', ''),
  loginName: '',
  magicLinkSent: false,
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
  selectedPlaygroundKey: '',
  playDatePlaygroundKey: '',
  playDates: [],
  playDateStatus: 'Choose a playground to view public play dates.',
  playDateFormStatus: '',
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

function consumeAuthRedirectStatus() {
  try {
    const url = new URL(globalThis.location.href);
    const auth = url.searchParams.get('auth');
    const hashParams = url.hash.startsWith('#') ? new URLSearchParams(url.hash.slice(1)) : null;
    const hashError = hashParams?.get('error_code') || hashParams?.get('error');
    if (auth === 'confirmed') {
      state.authStatus = 'Email link confirmed. Loading your profile…';
    }
    if (auth === 'error') {
      state.authStatus = 'Email link could not be verified. Please request a fresh sign-in link.';
    }
    if (hashError === 'otp_expired') {
      state.authStatus = 'Email link is invalid, expired, or already used. Please request a fresh sign-in link and open the newest email.';
    } else if (hashError) {
      state.authStatus = hashParams?.get('error_description') || 'Email sign-in could not be completed. Please request a fresh sign-in link.';
    }
    if (auth) {
      url.searchParams.delete('auth');
    }
    if (auth || hashError) {
      globalThis.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  } catch {
    // Ignore URL cleanup errors in restricted browser contexts.
  }
}

function getSupabaseClient() {
  return createSupabaseBrowserClient();
}

function usesSupabaseAuth() {
  return state.authMode === 'supabase' && Boolean(getSupabaseClient());
}

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
  const useSupabase = usesSupabaseAuth();
  const buttonText = useSupabase ? (state.magicLinkSent ? 'Send link again' : 'Send sign-in link') : 'Continue';
  const heading = useSupabase && state.magicLinkSent ? 'Check your email' : 'Choose your family profile';
  const intro = useSupabase
    ? 'Use Supabase magic link email verification to open your private family profile.'
    : 'Use an email to keep each family member’s local planner data separate.';
  const backendNote = useSupabase
    ? 'Supabase Auth owns the session. API routes read the current user from secure cookies and never need a user id in the URL.'
    : 'Local development mode stores a profile cookie and JSON data until Supabase environment variables are configured.';
  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><span class="brand-mark">👶</span><div><p class="eyebrow">Aaron • family profiles</p><h1>Daily Life Planner</h1></div></div></header><main class="auth-layout"><section class="panel auth-panel"><p class="eyebrow">Sign in</p><h2>${heading}</h2><p>${intro}</p><form id="login-form"><label class="input-label" for="login-email">Email</label><input id="login-email" type="email" autocomplete="email" value="${escapeAttribute(state.loginEmail)}" placeholder="parent@example.com" required /><label class="input-label" for="login-name">Display name</label><input id="login-name" autocomplete="name" value="${escapeAttribute(state.loginName)}" placeholder="Aaron Family" /><button type="submit" ${state.apiReady ? '' : 'disabled'}>${buttonText}</button></form><p class="muted">${escapeHtml(state.authStatus || state.apiMessage)}</p></section><section class="panel auth-note"><h2>${useSupabase ? 'Session-backed API' : 'Local profile mode'}</h2><p>${backendNote}</p><div class="profile-facts"><span>Social links</span><span>Location</span><span>Food plan</span><span>Amazon errands</span><span>AI captions</span></div></section></main></div>`;
  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('login-email').addEventListener('input', (event) => { state.loginEmail = event.target.value; });
  document.getElementById('login-name').addEventListener('input', (event) => { state.loginName = event.target.value; });
}

async function ensureBackendUser() {
  try {
    const health = await apiRequest('/health');
    state.authMode = health.authMode || 'local';
    if (usesSupabaseAuth()) {
      await getSupabaseClient().auth.getSession();
    }
    let user = null;
    try {
      ({ user } = await apiRequest('/profile'));
    } catch (error) {
      state.authStatus = state.authStatus || error.message;
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
  state.magicLinkSent = false;
  applyHomeProfile(state, user);
  applyFoodProfile(state, user);
  applyErrandsProfile(state, user);
  resetSocialState(state);
  state.locationStatus = user.location ? '' : 'No location saved yet. Share current location or enter one below.';
  refreshPlayPlanning(appContext);
  if (user.email) writeStoredValue('aaronLoginEmail', user.email);
}

async function loginUser(event) {
  event?.preventDefault();
  state.authStatus = usesSupabaseAuth() ? 'Sending sign-in link…' : 'Signing in…';
  renderLogin();
  try {
    let user;
    if (usesSupabaseAuth()) {
      const supabase = getSupabaseClient();
      const email = state.loginEmail.trim();
      const displayName = state.loginName.trim() || 'Aaron Family';

      const origin = globalThis.location?.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          ...(origin ? { emailRedirectTo: `${origin}/auth/confirm` } : {}),
          data: { display_name: displayName },
        },
      });
      if (error) throw error;
      state.magicLinkSent = true;
      state.authStatus = 'Check your email and open the sign-in link to finish signing in.';
      renderLogin();
      return;
    } else {
      ({ user } = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: state.loginEmail,
          displayName: state.loginName,
        }),
      }));
    }
    applyUserProfile(user);
    state.authStatus = '';
    state.apiReady = true;
    state.apiMessage = usesSupabaseAuth() ? 'Family profile synced with Supabase.' : 'Family profile synced.';
  } catch (error) {
    state.authStatus = error.message;
  }
  render();
}

async function logoutUser() {
  if (usesSupabaseAuth()) {
    await getSupabaseClient().auth.signOut();
  }
  await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  resetHomeState(state);
  resetFoodState(state);
  resetErrandsState(state);
  resetSocialState(state);
  resetPlayState(state);
  state.authStatus = 'Signed out. Choose another family profile.';
  state.magicLinkSent = false;
  removeStoredValue('aaronUserId');
  removeStoredValue('aaronApplePhotosLink');
  render();
}

async function saveUserSection(section, payload) {
  if (!state.user) return;
  try {
    const { user } = await apiRequest(`/${section}`, {
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
    consumeAuthRedirectStatus();
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
