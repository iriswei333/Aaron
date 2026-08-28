import {
  apiRequest,
  escapeAttribute,
  escapeHtml,
  readFirstStoredValue,
  removeStoredValue,
  writeStoredValue,
} from './shared.js';
import { DEFAULT_ALBUM_LINK, DEFAULT_HOME_BACKGROUND_KEY, applyHomeProfile, clearUploadedBackground, loadHomeBackground, renderHome, resetHomeState } from './tabs/home.js';
import { getLocationCoords, refreshPlayPlanning, renderPlay, renderSharedPlayDate, resetPlayState } from './tabs/play.js';
import { renderSocial, resetSocialState, resizeAvatarFile } from './tabs/social.js';
import { renderFamilyProfile } from './tabs/profile.js';
import { createSupabaseBrowserClient } from '../lib/supabase/client.js';
import { loadFamilyPlans } from './family-plans.js';
import {
  APP_NAME,
  createChildId,
  childProfileSummary,
  getChildProfile,
  getChildProfiles,
  getChildProfileState,
  isChildComplete,
  normalizeChild,
  normalizeChildProfile,
  normalizePlayPreferences,
} from '../lib/profile-defaults.js';

let root = document.getElementById('root');

// Keep tab navigation addressable so each section can be bookmarked, refreshed,
// and reached directly from a link.
const TAB_PATHS = {
  home: '/home',
  play: '/play',
  chat: '/chat',
  profile: '/family',
};

const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab]));

function tabFromLocation() {
  const pathname = globalThis.location?.pathname?.replace(/\/$/, '') || '';
  return PATH_TABS[pathname] || 'home';
}

function navigateToTab(tab, { replace = false } = {}) {
  const path = TAB_PATHS[tab] || TAB_PATHS.home;
  const currentPath = globalThis.location?.pathname?.replace(/\/$/, '') || '';
  if (currentPath !== path) {
    const method = replace ? 'replaceState' : 'pushState';
    globalThis.history[method]({}, '', path);
  }
  if (tab === 'chat') {
    state.chatLoaded = false;
  }
  state.tab = tab;
  render();
}

const state = {
  tab: tabFromLocation(),
  user: null,
  apiReady: false,
  authMode: 'local',
  apiMessage: 'Connecting family profile…',
  loginEmail: readFirstStoredValue(['sproutCueLoginEmail', 'aaronLoginEmail'], ''),
  loginName: '',
  magicLinkSent: false,
  authStatus: '',
  onboardingStatus: '',
  showProfileSetup: false,
  profileDraft: null,
  onboardingStep: 1,
  onboardingMeta: null,
  locationStatus: '',
  savedFamilyEvents: [],
  albumLink: readFirstStoredValue(['sproutCueApplePhotosLink', 'aaronApplePhotosLink'], DEFAULT_ALBUM_LINK),
  homeBackgroundKey: readFirstStoredValue(['sproutCueHomeBackgroundKey'], DEFAULT_HOME_BACKGROUND_KEY),
  homeUploadedPhoto: null,
  showHomeBackgroundPicker: false,
  homeBackgroundStatus: '',
  weather: { label: 'Loading weather…', temperature: '--', precipitation: '--', wind: '--', updated: 'Fetching from Open-Meteo' },
  nearbyPlayOptions: [],
  nearbyPlayDates: [],
  nearbyPlayDatesRequestKey: '',
  nearbyPlayDateFilter: 'all',
  mapZoom: 1,
  nearbyStatus: 'Save a location to personalize nearby play options.',
  selectedPlaygroundKey: '',
  playgroundDetailKey: '',
  playDatePlaygroundKey: '',
  playDates: [],
  profilePlayDates: [],
  playdateFocus: '',
  sharedPlayDateId: new URLSearchParams(globalThis.location?.search || '').get('playdate') || '',
  sharedPlayDate: null,
  sharedPlayDateStatus: '',
  playFocus: '',
  playDateStatus: 'Choose a playground to view public play dates.',
  playDateFormStatus: '',
  playDateShareStatus: '',
  editingPlayDateId: '',
  familyEvents: [],
  familyEventsStatus: 'Save a home city or location to find weekend events.',
  familyEventsMeta: null,
  familyEventsLoading: false,
  familyEventsRequestKey: '',
  chatContacts: [],
  chatMessages: [],
  activeChatContactId: '',
  parentingResources: [],
  parentingResourcesStatus: '',
  parentingResourcesAgeFilter: '',
};

const tabRenderers = {
  home: renderHome,
  play: renderPlay,
  chat: renderSocial,
  profile: renderFamilyProfile,
};

const appContext = {
  state,
  layout,
  saveUserSection,
  renderCurrent: render,
};


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

function authCallbackUrl(origin) {
  if (!origin) return '';
  const nextPath = state.sharedPlayDateId
    ? `/?playdate=${encodeURIComponent(state.sharedPlayDateId)}&auth=confirmed`
    : '/?auth=confirmed';
  return `${origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}

function ensureRoot() {
  root = root || document.getElementById('root');
  if (!root) {
    throw new Error(`${APP_NAME} could not find the #root mount element.`);
  }
}

function profileDraftFromUser(user = state.user) {
  if (state.profileDraft) return state.profileDraft;
  const childProfileState = getChildProfileState(user);
  const children = childProfileState.children.length > 0
    ? childProfileState.children.map(childDraftFromChild)
    : [blankChildDraft()];
  return {
    displayName: user?.displayName || state.loginName || '',
    activeChildId: childProfileState.activeChildId || children[0]?.id || '',
    children,
  };
}

function onboardingMetaFromUser(user = state.user) {
  if (state.onboardingMeta) return state.onboardingMeta;
  const preferences = normalizePlayPreferences(user?.playPreferences);
  const child = getChildProfile(user);
  return {
    relationship: '',
    interests: Array.isArray(child.favoriteActivities) ? child.favoriteActivities : [],
    neighborhood: user?.location?.address || user?.location?.label || child.homeCity || '',
    radius: preferences.searchRadiusMiles,
    days: preferences.availabilityDays,
    times: [],
    visibility: preferences.visibility,
    verified: false,
  };
}

function openWelcome() {
  state.showProfileSetup = true;
  state.onboardingStep = 1;
  state.profileDraft = null;
  state.onboardingMeta = null;
  state.onboardingStatus = '';
  if (globalThis.location?.pathname !== '/welcome') globalThis.history.replaceState({}, '', '/welcome');
  render();
}

function childHeaderSummary() {
  return childProfileSummary(getChildProfile(state.user));
}

function childSwitcherMarkup() {
  const children = getChildProfiles(state.user);
  if (children.length <= 1) return '';
  const activeChildId = getChildProfileState(state.user).activeChildId;
  return `<label class="active-child-control"><span>Planning for</span><select id="active-child-select">${children.map((child) => `<option value="${escapeAttribute(child.id)}" ${child.id === activeChildId ? 'selected' : ''}>${escapeHtml(child.name || 'Unnamed child')}</option>`).join('')}</select></label>`;
}

const TAB_EMOJIS = {
  home: [0x1f3e0, '🏠'],
  play: [0x1f6dd, '🛝'],
  chat: [0x1f4ac, '💬'],
  profile: [0x1f46a, '👪'],
};

const TAB_ICONS = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />',
  play: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.6" />',
  chat: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z" />',
  profile: '<circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.3-3.4 3.9-5 7-5s5.7 1.6 7 5" />',
};

function tabEmoji(name) {
  const [codePoint, fallback] = TAB_EMOJIS[name] || [];
  try {
    return codePoint ? String.fromCodePoint(codePoint) : fallback || '';
  } catch {
    return fallback || '';
  }
}

function layout(content) {
  ensureRoot();
  const tabs = [['home', 'Home'], ['play', 'Play'], ['chat', 'Chat'], ['profile', 'Family']];
  const locationLabel = state.user?.location?.address || state.user?.location?.label || getChildProfile(state.user)?.homeCity || 'Location not set';
  const unreadChatCount = (state.chatContacts || []).reduce((total, thread) => total + (Number(thread.unreadCount) || 0), 0);
  const navMarkup = tabs.map(([key, label]) => `<button class="rail-nav-button ${state.tab === key ? 'active' : ''}" data-tab="${key}" aria-current="${state.tab === key ? 'page' : 'false'}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[key]}</svg><span>${label}</span>${key === 'chat' && unreadChatCount ? `<span class="rail-count">${unreadChatCount}</span>` : ''}</button>`).join('');
  root.innerHTML = `<div class="app-shell"><div class="app-frame"><aside class="app-rail"><div class="rail-brand"><img src="/favicon.svg" alt="" aria-hidden="true" /><span>${APP_NAME}</span></div><nav class="rail-nav" aria-label="Planner sections">${navMarkup}</nav><button id="new-playdate" class="rail-create" type="button"><span aria-hidden="true">＋</span> New playdate</button><div class="rail-spacer"></div><div class="rail-account"><div class="rail-account-avatar">${escapeHtml((state.user?.displayName || 'F').slice(0, 1).toUpperCase())}</div><div class="rail-account-copy"><strong>${escapeHtml(state.user?.displayName || 'Family')}</strong><small>${escapeHtml(locationLabel)}</small></div></div><div class="rail-account-actions"><button id="edit-profile" type="button">Edit profile</button><button id="logout-user" type="button">Sign out</button></div>${childSwitcherMarkup()}</aside><section class="app-content"><div class="app-status ${state.apiReady ? 'ready' : ''}"><span>${escapeHtml(state.apiMessage)}</span>${state.user?.email ? `<small>${escapeHtml(state.user.email)}</small>` : ''}</div>${content}</section></div></div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    navigateToTab(button.dataset.tab);
  }));
  document.getElementById('new-playdate').addEventListener('click', () => {
    state.playdateFocus = '';
    navigateToTab('play');
  });
  document.getElementById('active-child-select')?.addEventListener('change', (event) => switchActiveChild(event.target.value));
  document.getElementById('edit-profile').addEventListener('click', () => {
    state.showProfileSetup = true;
    state.profileDraft = null;
    state.onboardingStatus = '';
    render();
  });
  document.getElementById('logout-user').addEventListener('click', logoutUser);
}

async function deleteParentData() {
  const confirmation = globalThis.prompt('This permanently deletes your SproutCue profile, child profiles, plans, play dates, chat messages, and local account data. Type DELETE to continue.');
  if (confirmation !== 'DELETE') return;
  state.apiMessage = 'Deleting parent data…';
  render();
  try {
    await apiRequest('/account/delete', { method: 'DELETE' });
    if (usesSupabaseAuth()) await getSupabaseClient().auth.signOut();
    state.user = null;
    state.authStatus = 'Your SproutCue parent data was deleted.';
    state.apiMessage = 'Parent data deleted.';
    state.showProfileSetup = false;
    state.profileDraft = null;
    state.savedFamilyEvents = [];
    resetHomeState(state);
    resetSocialState(state);
    resetPlayState(state);
    render();
  } catch (error) {
    state.apiMessage = `Deletion failed: ${error.message}`;
    render();
  }
}

function renderLogin() {
  ensureRoot();
  const useSupabase = usesSupabaseAuth();
  const buttonText = useSupabase ? (state.magicLinkSent ? 'Send link again' : 'Send sign-in link') : 'Continue';
  const heading = useSupabase && state.magicLinkSent ? 'Check your email' : 'Sign in to your parent account';
  const intro = useSupabase
    ? 'Use an email magic link to open your private parent profile.'
    : 'Use an email to keep each local parent profile separate while you test.';
  const featureNote = 'Less mental load for little-kid days.';
  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><img class="brand-mark-image" src="/favicon.svg" alt="" aria-hidden="true" /><div><p class="eyebrow">Parent profiles</p><h1>${APP_NAME}</h1></div></div></header><main class="auth-layout"><section class="panel auth-panel"><p class="eyebrow">Sign in</p><h2>${heading}</h2><p>${intro}</p>${useSupabase ? '<div class="social-login-options"><button id="google-login" type="button" class="google-login-button"><svg class="social-logo google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.38a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.88-1.73 2.99-4.28 2.99-7.55Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.45l-3.22-2.5c-.9.6-2.04.95-3.4.95-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.55H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.45l3.33-2.58Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.51l2.87-2.87C16.96 2.91 14.7 2 12 2a10 10 0 0 0-8.94 5.55l3.33 2.58C7.18 7.76 9.39 6 12 6Z"/></svg>Continue with Google</button><button id="facebook-login" type="button" class="facebook-login-button"><svg class="social-logo facebook-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8h3V4.5c-.52-.07-1.72-.17-3.27-.17-3.24 0-5.46 1.98-5.46 5.62V13H5v3.91h3.27V24h4.01v-7.09h3.34l.53-3.91h-3.87V10.3c0-1.13.31-2.3 1.72-2.3Z"/></svg>Continue with Facebook</button></div><div class="auth-divider"><span>or use email</span></div>' : ''}<form id="login-form"><label class="input-label" for="login-email">Parent email</label><input id="login-email" type="email" autocomplete="email" value="${escapeAttribute(state.loginEmail)}" placeholder="parent@example.com" required />${useSupabase ? '<label class="input-label" for="login-password">Password</label><input id="login-password" type="password" autocomplete="current-password" placeholder="Your password" minlength="6" />' : ''}<label class="input-label" for="login-name">Parent display name</label><input id="login-name" autocomplete="name" value="${escapeAttribute(state.loginName)}" placeholder="Milo Family" /><button type="submit" ${state.apiReady ? '' : 'disabled'}>${buttonText}</button>${useSupabase ? '<button id="password-login" type="button" class="password-login-button" disabled>Sign in with password</button>' : ''}</form><p class="muted">${escapeHtml(state.authStatus || state.apiMessage)}</p><p class="privacy-link"><a href="/privacy" target="_blank" rel="noreferrer">Read the Privacy Policy</a></p></section><section class="panel auth-note"><p class="eyebrow">Made for parents of little ones</p><h2>Your family day, sorted.</h2><p>${featureNote}</p><div class="auth-feature-card"><img class="auth-feature-art" src="/illustrations/playdates.png" alt="Parents meeting at a neighborhood playground for a playdate" /><strong>Playdates without the back-and-forth</strong><p>Find nearby places, check the weather, see weekend events, and make a plan in minutes.</p></div></section></main></div>`;
  document.getElementById('login-form').addEventListener('submit', useSupabase ? revealAuthMethods : loginUser);
  document.getElementById('google-login')?.addEventListener('click', signInWithGoogle);
  document.getElementById('facebook-login')?.addEventListener('click', signInWithFacebook);
  const passwordInput = document.getElementById('login-password');
  const passwordButton = document.getElementById('password-login');
  if (useSupabase) setupAuthMethodMenu();
  passwordInput?.addEventListener('input', () => { passwordButton.disabled = !passwordInput.value || !state.loginEmail.trim(); });
  passwordButton?.addEventListener('click', signInWithPassword);
  document.getElementById('login-email').addEventListener('input', (event) => { state.loginEmail = event.target.value; });
  document.getElementById('login-name').addEventListener('input', (event) => { state.loginName = event.target.value; });
}

function revealAuthMethods(event) {
  event.preventDefault();
  const email = document.getElementById('login-email');
  if (!email?.checkValidity()) {
    email?.reportValidity();
    return;
  }
  const menu = document.getElementById('auth-method-menu');
  if (menu) menu.hidden = false;
}

function setupAuthMethodMenu() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordLabel = document.querySelector('label[for="login-password"]');
  const passwordInput = document.getElementById('login-password');
  const nameLabel = document.querySelector('label[for="login-name"]');
  const nameInput = document.getElementById('login-name');
  const submitButton = form?.querySelector('button[type="submit"]');
  const passwordButton = document.getElementById('password-login');
  if (!form || !emailInput || !passwordLabel || !passwordInput || !nameLabel || !nameInput || !submitButton || !passwordButton) return;

  const menu = document.createElement('div');
  menu.id = 'auth-method-menu';
  menu.className = 'auth-method-menu';
  menu.hidden = true;
  menu.innerHTML = '<p class="auth-method-title">How would you like to continue?</p>';
  form.insertBefore(menu, passwordLabel);
  [passwordLabel, passwordInput, nameLabel, nameInput, submitButton, passwordButton].forEach((element) => menu.appendChild(element));
  submitButton.type = 'button';
  submitButton.addEventListener('click', loginUser);

  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.className = 'email-continue-button';
  continueButton.textContent = 'Continue with email';
  form.insertBefore(continueButton, menu);
  continueButton.addEventListener('click', revealAuthMethods);
  emailInput.addEventListener('input', () => { menu.hidden = true; });
}

async function signInWithPassword() {
  if (!usesSupabaseAuth()) return;
  const email = state.loginEmail.trim();
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) {
    state.authStatus = 'Enter your email and password.';
    renderLogin();
    return;
  }
  state.authStatus = 'Signing in…';
  renderLogin();
  try {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { user } = await apiRequest('/profile');
    state.apiReady = true;
    state.authStatus = '';
    applyUserProfile(user);
    state.apiMessage = 'Family profile synced with Supabase.';
    if (!getChildProfileState(user).onboardingComplete) {
      openWelcome();
      return;
    }
    render();
  } catch (error) {
    state.authStatus = error.message || 'Password sign-in failed.';
    renderLogin();
  }
}

async function signInWithGoogle() {
  if (!usesSupabaseAuth()) return;
  state.authStatus = 'Redirecting to Google…';
  renderLogin();
  try {
    const origin = globalThis.location?.origin;
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        ...(origin ? { redirectTo: authCallbackUrl(origin) } : {}),
      },
    });
    if (error) throw error;
  } catch (error) {
    state.authStatus = error.message || 'Google sign-in could not be started.';
    renderLogin();
  }
}

async function signInWithFacebook() {
  if (!usesSupabaseAuth()) return;
  state.authStatus = 'Redirecting to Facebook…';
  renderLogin();
  try {
    const origin = globalThis.location?.origin;
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        ...(origin ? { redirectTo: authCallbackUrl(origin) } : {}),
      },
    });
    if (error) throw error;
  } catch (error) {
    state.authStatus = error.message || 'Facebook sign-in could not be started.';
    renderLogin();
  }
}

function childDraftFromChild(child) {
  return {
    ...child,
    id: child.id || createChildId(child.name || 'child'),
    favoriteActivities: Array.isArray(child.favoriteActivities)
      ? child.favoriteActivities.join(', ')
      : String(child.favoriteActivities || ''),
  };
}

function blankChildDraft() {
  return childDraftFromChild(normalizeChild({
    id: createChildId(),
  }));
}

function activeDraftChild(draft) {
  return draft.children.find((child) => child.id === draft.activeChildId)
    || draft.children[0]
    || blankChildDraft();
}

function normalizeDraftChildren(children) {
  return children.map((child) => ({
    ...child,
    favoriteActivities: Array.isArray(child.favoriteActivities)
      ? child.favoriteActivities
      : String(child.favoriteActivities || '').split(/[,;\n]/),
  }));
}

function updateDraftFromActiveForm(form) {
  if (!form) return profileDraftFromUser();
  const formData = new FormData(form);
  const draft = profileDraftFromUser();
  const activeChildId = String(formData.get('childId') || draft.activeChildId || '').trim();
  const updatedChild = childDraftFromChild(normalizeChild({
    id: activeChildId || createChildId(formData.get('childName') || 'child'),
    name: formData.get('childName'),
    birthday: formData.get('birthday'),
    ageLabel: formData.get('ageLabel'),
    homeCity: formData.get('homeCity'),
    favoriteActivities: formData.get('favoriteActivities'),
  }, activeDraftChild(draft)));
  const children = draft.children.map((child) => (child.id === updatedChild.id ? updatedChild : child));
  if (!children.some((child) => child.id === updatedChild.id)) children.push(updatedChild);
  state.profileDraft = {
    displayName: String(formData.get('displayName') || '').trim(),
    activeChildId: updatedChild.id,
    children,
  };
  return state.profileDraft;
}

function childProfileFromDraft(draft) {
  return normalizeChildProfile({
    activeChildId: draft.activeChildId,
    children: normalizeDraftChildren(draft.children),
  });
}

function setActiveDraftChild(childId) {
  const form = document.getElementById('profile-form');
  const draft = form ? updateDraftFromActiveForm(form) : profileDraftFromUser();
  state.profileDraft = { ...draft, activeChildId: childId };
  state.onboardingStatus = '';
  renderOnboarding();
}

function addDraftChild() {
  const form = document.getElementById('profile-form');
  const draft = form ? updateDraftFromActiveForm(form) : profileDraftFromUser();
  const child = blankChildDraft();
  state.profileDraft = {
    ...draft,
    activeChildId: child.id,
    children: [...draft.children, child],
  };
  state.onboardingStatus = 'Added another child. Fill in the details, then save.';
  renderOnboarding();
}

function removeDraftChild(childId) {
  const form = document.getElementById('profile-form');
  const draft = form ? updateDraftFromActiveForm(form) : profileDraftFromUser();
  if (draft.children.length <= 1) {
    state.onboardingStatus = 'Keep at least one child on the profile.';
    renderOnboarding();
    return;
  }
  const children = draft.children.filter((child) => child.id !== childId);
  state.profileDraft = {
    ...draft,
    activeChildId: children[0]?.id || '',
    children,
  };
  state.onboardingStatus = 'Child removed. Save the profile to keep this change.';
  renderOnboarding();
}

async function switchActiveChild(childId) {
  const childProfile = normalizeChildProfile({
    ...getChildProfileState(state.user),
    activeChildId: childId,
  });
  const activeChild = getChildProfile({ childProfile });
  state.user = { ...state.user, childProfile };
  state.parentingResources = [];
  state.parentingResourcesStatus = '';
  state.parentingResourcesAgeFilter = '';
  state.locationStatus = state.user.location
    ? ''
    : activeChild.homeCity
      ? 'Using the selected child home city until a precise location is saved.'
      : 'No location saved yet. Share current location or enter one below.';
  state.apiMessage = `Planning for ${activeChild.name || 'selected child'}.`;
  refreshPlayPlanning(appContext);
  render();

  try {
    const { user } = await apiRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        displayName: state.user.displayName,
        childProfile,
      }),
    });
    applyUserProfile(user);
    state.apiMessage = `Planning for ${getChildProfile(user).name || 'selected child'}.`;
  } catch (error) {
    state.apiMessage = `Could not save selected child: ${error.message}`;
  }
  render();
}

function renderOnboarding() {
  ensureRoot();
  const draft = profileDraftFromUser();
  const activeChild = activeDraftChild(draft);
  const meta = onboardingMetaFromUser();
  const step = state.onboardingStep || 1;
  const days = [['mon','M'],['tue','T'],['wed','W'],['thu','T'],['fri','F'],['sat','S'],['sun','S']];
  const interests = [['sandbox','🏖️ Sandbox'],['bikes','🚲 Bikes'],['climbing','🧗 Climbing'],['crafts','🎨 Crafts'],['ball games','⚽ Ball games'],['quiet play','🌿 Quiet play']];
  const selected = (list, value) => list.includes(value) ? ' selected' : '';
  const chips = (items, values, attr = 'data-value') => items.map(([value, label]) => `<button type="button" class="welcome-chip${selected(values, value)}" ${attr}="${escapeAttribute(value)}">${label}</button>`).join('');
  const previewDays = days.map(([value, label]) => `<span class="welcome-preview-day${selected(meta.days, value) ? ' active' : ''}">${label}</span>`).join('');
  const cardKid = activeChild.name ? `<span class="welcome-kid">🧒 ${escapeHtml(activeChild.name)}${activeChild.ageLabel ? ` · ${escapeHtml(activeChild.ageLabel)}` : ''}</span>` : '<span class="welcome-kid muted-kid">🧒 Add your kid</span>';
  const progress = [1,2,3,4,5].map((item) => `<span class="welcome-progress-dot ${item < step ? 'done' : ''} ${item === step ? 'current' : ''}">${item === 5 ? '✦' : item}</span>`).join('<i></i>');
  const formField = step === 1 ? `<label class="welcome-label">Your first name<input id="welcome-name" value="${escapeAttribute(draft.displayName)}" placeholder="e.g. Priya" /></label><label class="welcome-label">You are…<span class="welcome-chip-row" id="welcome-rel">${chips([['mom','Mom'],['dad','Dad'],['grandparent','Grandparent'],['caregiver','Caregiver']], meta.relationship ? [meta.relationship] : [])}</span></label><div class="welcome-two-fields"><label class="welcome-label">Kid’s first name<input id="welcome-kid" value="${escapeAttribute(activeChild.name)}" placeholder="Name" /></label><label class="welcome-label">Age<select id="welcome-age"><option value="">Age</option>${[1,2,3,4,5,6,7,'8+'].map((age) => `<option ${String(activeChild.ageLabel) === String(age) ? 'selected' : ''}>${age}</option>`).join('')}</select></label></div><label class="welcome-label">What do they love? <small>(helps match playdates)</small><span class="welcome-chip-row" id="welcome-interests">${chips(interests, meta.interests)}</span></label>`
    : step === 2 ? `<label class="welcome-label">Neighborhood<input id="welcome-neighborhood" value="${escapeAttribute(meta.neighborhood)}" placeholder="Capitol Hill, Seattle" /></label><label class="welcome-label">How far for a good playdate?<strong class="welcome-radius-read" id="welcome-radius-read">${meta.radius} miles</strong><input id="welcome-radius" type="range" min="1" max="10" value="${meta.radius}" /></label>`
    : step === 3 ? `<p class="welcome-notice">Not a commitment — just a shortcut to playdates you could actually make.</p><label class="welcome-label">Days<span class="welcome-chip-row" id="welcome-days">${chips(days, meta.days)}</span></label><label class="welcome-label">Times <small>(optional)</small><span class="welcome-chip-row" id="welcome-times">${chips([['morning','🌅 Mornings'],['afternoon','☀️ Afternoons'],['after-school','🎒 After school']], meta.times)}</span></label>`
    : step === 4 ? `<p class="welcome-privacy-copy">You can change this anytime — even per playdate.</p><div class="welcome-visibility">${[['friends-nearby','Friends + nearby families','Verified families in your radius can see open playdates.','Recommended'],['nearby-only','Nearby families only','Keep your family visible to nearby matches.',''],['invite-only','Invite-only','Only families you invite can find you.','']].map(([value,title,desc,badge]) => `<button type="button" class="welcome-visibility-card${meta.visibility === value ? ' selected' : ''}" data-visibility="${value}"><span class="welcome-radio"></span><span><strong>${title} ${badge ? `<em>${badge}</em>` : ''}</strong><small>${desc}</small></span></button>`).join('')}</div><div class="welcome-verify"><span>📱</span><p><strong>Verify your phone</strong><small>Verified families get 3× more joins — a trust signal other parents look for.</small></p><button type="button" id="welcome-verify">${meta.verified ? '✓ Verified' : 'Verify'}</button></div>`
    : `<p class="welcome-payoff-copy">Your family card is ready to help you find an easy first connection.</p>`;
  const back = step > 1 ? '<button type="button" class="welcome-back" id="welcome-back">← Back</button>' : '';
  const nextLabel = step === 5 ? 'Go to my map →' : step === 4 ? 'Finish setup' : 'Continue';
  root.innerHTML = `<main class="welcome-shell"><header class="welcome-header"><div class="welcome-brand"><img src="/favicon.svg" alt="" /><span>SproutCue</span></div><span class="welcome-time">Takes about 2 minutes</span></header><div class="welcome-layout"><section class="welcome-form"><div class="welcome-progress">${progress}<span>Step ${step} of 4${step === 5 ? ' · Done' : ''}</span></div><p class="eyebrow">${step === 5 ? 'Your first connection' : 'Welcome to SproutCue'}</p><h1>${step === 1 ? 'Who’s coming to play?' : step === 2 ? 'Where do you usually play?' : step === 3 ? 'When are you usually free?' : step === 4 ? 'Who can see your playdates?' : `You’re in, ${escapeHtml(draft.displayName || 'friend')}! 🎈`}</h1><p class="welcome-lede">${step === 1 ? 'Other parents see a family card, not a profile. First names and kid ages only — no last names, no photos of kids required, ever.' : step === 2 ? 'We show your neighborhood, never your address. Your radius helps personalize playdates.' : step === 3 ? 'Tell us the windows that tend to work. Skip this if your week is still a moving target.' : step === 4 ? 'Trust settings are yours to control. Friends + nearby is the recommended starting point.' : 'Your profile is ready for nearby playdates.'}</p><form id="welcome-form">${formField}<div class="welcome-actions">${back}<button type="submit" class="welcome-primary">${nextLabel}</button>${step === 3 ? '<button type="button" class="welcome-skip" id="welcome-skip">Skip for now</button>' : ''}</div></form><p class="welcome-status">${escapeHtml(state.onboardingStatus || '')}</p></section><aside class="welcome-preview"><p class="welcome-preview-label">Your family card · live preview</p><div class="welcome-family-card"><div class="welcome-orb"></div><div class="welcome-avatar-stack"><span>${escapeHtml((draft.displayName || '?').slice(0,1).toUpperCase())}</span><span>${escapeHtml((activeChild.name || '?').slice(0,1).toUpperCase())}</span></div><h2>${escapeHtml(draft.displayName || 'Your name')}</h2><p>${escapeHtml(meta.neighborhood || 'Your neighborhood')} · new this week 🌱</p><div>${cardKid}</div><div class="welcome-preview-days">${previewDays}</div>${meta.verified ? '<strong class="welcome-verified">✓ Phone verified</strong>' : ''}</div><p class="welcome-preview-note">This is exactly what another parent sees. First names and kid ages only — nothing more.</p><img class="welcome-art" src="/illustrations/playdates.png" alt="Families meeting at a neighborhood playground" /></aside></div></main>`;
  document.getElementById('welcome-form')?.addEventListener('submit', (event) => { event.preventDefault(); captureWelcomeStep(); if (step < 5) { state.onboardingStep = step + 1; renderOnboarding(); } else saveWelcomeProfile(); });
  document.getElementById('welcome-back')?.addEventListener('click', () => { captureWelcomeStep(); state.onboardingStep = step - 1; renderOnboarding(); });
  document.getElementById('welcome-skip')?.addEventListener('click', () => { captureWelcomeStep(); state.onboardingStep = 4; renderOnboarding(); });
  document.getElementById('welcome-verify')?.addEventListener('click', () => { captureWelcomeStep(); meta.verified = true; state.onboardingMeta = meta; renderOnboarding(); });
  document.querySelectorAll('#welcome-rel .welcome-chip').forEach((button) => button.addEventListener('click', () => { captureWelcomeStep(); meta.relationship = button.dataset.value; state.onboardingMeta = meta; renderOnboarding(); }));
  document.querySelectorAll('#welcome-interests .welcome-chip').forEach((button) => button.addEventListener('click', () => { captureWelcomeStep(); meta.interests = meta.interests.includes(button.dataset.value) ? meta.interests.filter((x) => x !== button.dataset.value) : [...meta.interests, button.dataset.value]; state.onboardingMeta = meta; renderOnboarding(); }));
  document.querySelectorAll('#welcome-days .welcome-chip, #welcome-times .welcome-chip').forEach((button) => button.addEventListener('click', () => { const key = button.closest('#welcome-days') ? 'days' : 'times'; meta[key] = meta[key].includes(button.dataset.value) ? meta[key].filter((x) => x !== button.dataset.value) : [...meta[key], button.dataset.value]; state.onboardingMeta = meta; renderOnboarding(); }));
  document.querySelectorAll('[data-visibility]').forEach((button) => button.addEventListener('click', () => { meta.visibility = button.dataset.visibility; state.onboardingMeta = meta; renderOnboarding(); }));
  document.getElementById('welcome-radius')?.addEventListener('input', (event) => { meta.radius = Number(event.target.value); state.onboardingMeta = meta; document.getElementById('welcome-radius-read').textContent = `${meta.radius} miles`; });
}

function captureWelcomeStep() {
  const draft = profileDraftFromUser();
  const meta = onboardingMetaFromUser();
  const name = document.getElementById('welcome-name')?.value?.trim();
  const kid = document.getElementById('welcome-kid')?.value?.trim();
  const age = document.getElementById('welcome-age')?.value;
  if (name !== undefined) draft.displayName = name;
  if (kid !== undefined) { const child = activeDraftChild(draft); child.name = kid; child.ageLabel = age || child.ageLabel; }
  meta.neighborhood = document.getElementById('welcome-neighborhood')?.value?.trim() || meta.neighborhood;
  meta.radius = Number(document.getElementById('welcome-radius')?.value || meta.radius);
  state.profileDraft = draft;
  state.onboardingMeta = meta;
}

async function saveWelcomeProfile() {
  captureWelcomeStep();
  const draft = profileDraftFromUser();
  const meta = onboardingMetaFromUser();
  const draftChild = activeDraftChild(draft);
  if (meta.neighborhood) draftChild.homeCity = meta.neighborhood;
  const childProfile = childProfileFromDraft(draft);
  const child = getChildProfile({ childProfile });
  if (!draft.displayName || !child.name || (!child.ageLabel && !child.birthday)) { state.onboardingStatus = 'Add your name, your kid’s name, and their age to continue.'; state.onboardingStep = 1; renderOnboarding(); return; }
  if (!child.homeCity) { state.onboardingStatus = 'Add your neighborhood so we can personalize nearby playdates.'; state.onboardingStep = 2; renderOnboarding(); return; }
  state.onboardingStatus = 'Saving your family card…'; renderOnboarding();
  try {
    const profile = await apiRequest('/profile', { method: 'PUT', body: JSON.stringify({ displayName: draft.displayName, childProfile }) });
    state.user = profile.user;
    await saveUserSection('play-preferences', { searchRadiusMiles: meta.radius, availabilityDays: meta.days, visibility: meta.visibility });
    if (meta.neighborhood) await saveUserSection('location', { address: meta.neighborhood, label: meta.neighborhood, source: 'onboarding' });
    state.showProfileSetup = false; state.profileDraft = null; state.onboardingMeta = null; state.onboardingStep = 1; state.onboardingStatus = ''; globalThis.history.replaceState({}, '', '/home'); applyUserProfile(state.user); render();
  } catch (error) { state.onboardingStatus = `Could not save setup: ${error.message}`; renderOnboarding(); }
}

async function handleProfileAvatarChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    state.onboardingStatus = 'Choose an image for your avatar.';
    renderOnboarding();
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    state.onboardingStatus = 'Choose an avatar image smaller than 6 MB.';
    renderOnboarding();
    return;
  }
  const form = document.getElementById('profile-form');
  if (form) updateDraftFromActiveForm(form);
  state.onboardingStatus = 'Saving avatar…';
  renderOnboarding();
  try {
    const avatarUrl = await resizeAvatarFile(file);
    const saved = await saveUserSection('social-links', { avatarUrl });
    state.onboardingStatus = saved ? 'Avatar updated.' : 'Could not save your avatar.';
  } catch (error) {
    state.onboardingStatus = error.message || 'Could not use that image.';
  }
  renderOnboarding();
}

function draftFromPayload(payload) {
  const childProfile = normalizeChildProfile(payload.childProfile);
  return {
    displayName: payload.displayName,
    activeChildId: childProfile.activeChildId,
    children: childProfile.children.map(childDraftFromChild),
  };
}

function profilePayloadFromForm(form) {
  const draft = updateDraftFromActiveForm(form);
  return {
    displayName: draft.displayName,
    childProfile: childProfileFromDraft(draft),
  };
}

async function saveProfileSetup(event) {
  event.preventDefault();
  const payload = profilePayloadFromForm(event.currentTarget);
  state.profileDraft = draftFromPayload(payload);
  if (payload.childProfile.children.length === 0) {
    state.onboardingStatus = 'Add at least one child to personalize the planner.';
    renderOnboarding();
    return;
  }
  const incompleteChild = payload.childProfile.children.find((child) => !isChildComplete(child));
  if (incompleteChild) {
    state.profileDraft.activeChildId = incompleteChild.id;
    state.onboardingStatus = `Add a nickname, birthday or age, and home city for ${incompleteChild.name || 'each child'}.`;
    renderOnboarding();
    return;
  }

  state.onboardingStatus = 'Saving children…';
  renderOnboarding();
  try {
    const { user } = await apiRequest('/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.showProfileSetup = false;
    state.profileDraft = null;
    applyUserProfile(user);
    const children = getChildProfiles(user);
    state.apiMessage = `${children.length} child${children.length === 1 ? '' : 'ren'} saved. Planner personalized.`;
    render();
  } catch (error) {
    state.onboardingStatus = `Profile save failed: ${error.message}`;
    renderOnboarding();
  }
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
    state.apiMessage = 'Backend online.';
    if (user) {
      applyUserProfile(user);
      state.apiMessage = 'Family profile synced.';
      if (!getChildProfileState(user).onboardingComplete) {
        openWelcome();
        return;
      }
    }
  } catch (error) {
    state.apiReady = false;
    state.user = null;
    state.apiMessage = `Backend unavailable: ${error.message}`;
  }
  render();
}

function applyUserProfile(user) {
  clearUploadedBackground(state);
  state.user = user;
  const childProfile = getChildProfile(user);
  state.loginEmail = user.email || state.loginEmail;
  state.loginName = user.displayName || '';
  state.magicLinkSent = false;
  applyHomeProfile(state, user);
  loadHomeBackground(appContext);
  resetSocialState(state);
  state.locationStatus = user.location
    ? ''
    : childProfile.homeCity
      ? 'Using the child profile home city until a precise location is saved.'
      : 'No location saved yet. Share current location or enter one below.';
  refreshPlayPlanning(appContext);
  loadFamilyPlanState(appContext);
  if (user.email) writeStoredValue('sproutCueLoginEmail', user.email);
}

function applyFamilyPlanState(state, payload = {}) {
  state.savedFamilyEvents = Array.isArray(payload.events)
    ? payload.events.filter((item) => item.kind === 'external_event')
    : [];
}

async function loadFamilyPlanState(ctx) {
  try {
    const payload = await loadFamilyPlans();
    applyFamilyPlanState(ctx.state, payload);
    if (ctx.state.tab === 'home') ctx.renderCurrent();
  } catch (error) {
    ctx.state.apiMessage = `Family planning data unavailable: ${error.message}`;
    if (ctx.state.tab === 'home') ctx.renderCurrent();
  }
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
      const displayName = state.loginName.trim() || 'Family Profile';

      const origin = globalThis.location?.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          ...(origin ? { emailRedirectTo: authCallbackUrl(origin) } : {}),
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
    if (!getChildProfileState(user).onboardingComplete) {
      openWelcome();
      return;
    }
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
  resetSocialState(state);
  resetPlayState(state);
  state.authStatus = 'Signed out. Choose another family profile.';
  state.onboardingStatus = '';
  state.showProfileSetup = false;
  state.profileDraft = null;
  state.savedFamilyEvents = [];
  state.magicLinkSent = false;
  removeStoredValue('sproutCueUserId');
  removeStoredValue('sproutCueApplePhotosLink');
  removeStoredValue('sproutCueHomeBackgroundKey');
  removeStoredValue('aaronUserId');
  removeStoredValue('aaronApplePhotosLink');
  render();
}

async function saveUserSection(section, payload) {
  if (!state.user) return false;
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
    if (section === 'play-preferences') {
      refreshPlayPlanning(appContext);
    }
    return true;
  } catch (error) {
    state.apiMessage = `Save failed: ${error.message}`;
  }
  render();
  return false;
}

function renderError(error) {
  ensureRoot();
  root.innerHTML = `<main class="app-shell"><section class="panel error-panel"><p class="eyebrow">App recovery</p><h1>${APP_NAME} hit a startup issue</h1><p>${escapeHtml(error.message || 'Unknown error')}</p><button onclick="window.location.reload()">Reload planner</button></section></main>`;
}

function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  if (state.showProfileSetup) {
    renderOnboarding();
    return;
  }
  if (state.sharedPlayDateId) {
    state.tab = 'play';
    renderSharedPlayDate(appContext);
    return;
  }
  const renderTab = tabRenderers[state.tab] || renderHome;
  renderTab(appContext);
}

function startApp() {
  try {
    consumeAuthRedirectStatus();
    globalThis.addEventListener('popstate', () => {
      state.tab = tabFromLocation();
      render();
    });
    render();
    ensureBackendUser();
  } catch (error) {
    renderError(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
