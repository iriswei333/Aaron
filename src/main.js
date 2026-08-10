import {
  apiRequest,
  escapeAttribute,
  escapeHtml,
  readFirstStoredValue,
  removeStoredValue,
  writeStoredValue,
} from './shared.js';
import { applyErrandsProfile, renderErrands, resetErrandsState } from './tabs/errands.js';
import { applyFoodProfile, renderFood, resetFoodState } from './tabs/food.js';
import { DEFAULT_ALBUM_LINK, DEFAULT_HOME_BACKGROUND_KEY, applyHomeProfile, clearUploadedBackground, loadHomeBackground, renderHome, resetHomeState } from './tabs/home.js';
import { getLocationCoords, refreshPlayPlanning, renderPlay, resetPlayState } from './tabs/play.js';
import { renderSocial, resetSocialState } from './tabs/social.js';
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
} from '../lib/profile-defaults.js';

let root = document.getElementById('root');

const state = {
  tab: 'home',
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
  locationStatus: '',
  foodStatus: '',
  shoppingList: [],
  weeklyMenu: [],
  shoppingSchedule: [],
  foodPlanSeed: 0,
  foodPlanGeneratedAt: '',
  lockedMealDays: [],
  checkedShoppingItems: [],
  customShoppingItems: [],
  newFood: '',
  amazonStatus: '',
  amazonTasks: [],
  restockItems: {},
  logisticsItems: [],
  logisticsEditItemId: '',
  amazonReminder: null,
  foodFocus: '',
  familyPlanEvents: [],
  familyRecurringItems: [],
  newAmazonTask: '',
  outfitIdeas: [],
  albumLink: readFirstStoredValue(['sproutCueApplePhotosLink', 'aaronApplePhotosLink'], DEFAULT_ALBUM_LINK),
  homeBackgroundKey: readFirstStoredValue(['sproutCueHomeBackgroundKey'], DEFAULT_HOME_BACKGROUND_KEY),
  homeUploadedPhoto: null,
  showHomeBackgroundPicker: false,
  homeBackgroundStatus: '',
  weather: { label: 'Loading weather…', temperature: '--', precipitation: '--', wind: '--', updated: 'Fetching from Open-Meteo' },
  nearbyPlayOptions: [],
  nearbyStatus: 'Save a location to personalize nearby play options.',
  selectedPlaygroundKey: '',
  playDatePlaygroundKey: '',
  playDates: [],
  profilePlayDates: [],
  playdateFocus: '',
  playFocus: '',
  playDateStatus: 'Choose a playground to view public play dates.',
  playDateFormStatus: '',
  familyEvents: [],
  familyEventsStatus: 'Save a home city or location to find weekend events.',
  familyEventsMeta: null,
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

function childHeaderSummary() {
  return childProfileSummary(getChildProfile(state.user));
}

function childSwitcherMarkup() {
  const children = getChildProfiles(state.user);
  if (children.length <= 1) return '';
  const activeChildId = getChildProfileState(state.user).activeChildId;
  return `<label class="active-child-control"><span>Planning for</span><select id="active-child-select">${children.map((child) => `<option value="${escapeAttribute(child.id)}" ${child.id === activeChildId ? 'selected' : ''}>${escapeHtml(child.name || 'Unnamed child')}</option>`).join('')}</select></label>`;
}

function layout(content) {
  ensureRoot();
  const tabs = [['home', '🏠', 'Home'], ['play', '🛝', 'Play'], ['food', '🥣', 'Food'], ['errands', '🛒', 'Errands'], ['social', '📷', 'Social']];
  root.innerHTML = `<div class="app-shell"><header class="app-header"><div class="header-top"><div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><div><p class="eyebrow">${escapeHtml(childHeaderSummary())}</p><h1>${APP_NAME}</h1></div></div><div class="sync-banner ${state.apiReady ? 'ready' : ''}"><div><strong>${escapeHtml(state.user.displayName)}</strong><small>${escapeHtml(state.user.email || 'Local family profile')}</small></div><span>${escapeHtml(state.apiMessage)}</span>${childSwitcherMarkup()}<div class="banner-actions"><button id="edit-profile" class="secondary-button" type="button">Edit profile</button><button id="logout-user" class="secondary-button" type="button">Sign out</button></div></div></div><nav class="tabs" aria-label="Planner sections">${tabs.map(([key, emoji, label]) => `<button class="${state.tab === key ? 'active' : ''}" data-tab="${key}" aria-current="${state.tab === key ? 'page' : 'false'}"><span>${emoji}</span>${label}</button>`).join('')}</nav></header>${content}</div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    render();
  }));
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
    resetHomeState(state);
    resetFoodState(state);
    resetErrandsState(state);
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
  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><span class="brand-mark">🌱</span><div><p class="eyebrow">Parent profiles</p><h1>${APP_NAME}</h1></div></div></header><main class="auth-layout"><section class="panel auth-panel"><p class="eyebrow">Sign in</p><h2>${heading}</h2><p>${intro}</p><form id="login-form"><label class="input-label" for="login-email">Parent email</label><input id="login-email" type="email" autocomplete="email" value="${escapeAttribute(state.loginEmail)}" placeholder="parent@example.com" required /><label class="input-label" for="login-name">Parent display name</label><input id="login-name" autocomplete="name" value="${escapeAttribute(state.loginName)}" placeholder="Milo Family" /><button type="submit" ${state.apiReady ? '' : 'disabled'}>${buttonText}</button></form><p class="muted">${escapeHtml(state.authStatus || state.apiMessage)}</p><p class="privacy-link"><a href="/privacy" target="_blank" rel="noreferrer">Read the Privacy Policy</a></p></section><section class="panel auth-note"><p class="eyebrow">Made for parents of little ones</p><h2>Your family day, sorted.</h2><p>${featureNote}</p><div id="auth-feature-carousel" class="auth-feature-carousel" aria-label="SproutCue features"><article class="auth-feature-card"><img class="auth-feature-art" src="/illustrations/family-meals.png" alt="Parent and child enjoying a colorful meal together" /><strong>Meals that fit your child</strong><p>Personalized ideas built around favorites, stages, and foods to avoid.</p></article><article class="auth-feature-card"><img class="auth-feature-art" src="/illustrations/playdates.png" alt="Parents meeting at a neighborhood playground for a playdate" /><strong>Playdates without the back-and-forth</strong><p>Find nearby places, check the weather, and make a plan in minutes.</p></article><article class="auth-feature-card"><img class="auth-feature-art" src="/illustrations/family-logistics.png" alt="Parent organizing a family plan with a checklist and calendar" /><strong>One calm home for logistics</strong><p>Keep errands, reminders, events, and family plans together.</p></article></div><div class="auth-feature-dots" aria-label="Choose a feature"><button type="button" class="active" data-feature-dot="0" aria-label="Show meals feature" aria-current="true"></button><button type="button" data-feature-dot="1" aria-label="Show playdates feature" aria-current="false"></button><button type="button" data-feature-dot="2" aria-label="Show logistics feature" aria-current="false"></button></div></section></main></div>`;
  document.getElementById('login-form').addEventListener('submit', loginUser);
  document.getElementById('login-email').addEventListener('input', (event) => { state.loginEmail = event.target.value; });
  document.getElementById('login-name').addEventListener('input', (event) => { state.loginName = event.target.value; });
  const featureCarousel = document.getElementById('auth-feature-carousel');
  const featureDots = [...document.querySelectorAll('[data-feature-dot]')];
  const updateFeatureDot = (index) => {
    featureDots.forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
  };
  featureDots.forEach((dot) => dot.addEventListener('click', () => {
    const index = Number(dot.dataset.featureDot);
    featureCarousel?.scrollTo({ left: index * (featureCarousel.clientWidth + 12), behavior: 'smooth' });
    updateFeatureDot(index);
  }));
  featureCarousel?.addEventListener('scroll', () => {
    const index = Math.round(featureCarousel.scrollLeft / (featureCarousel.clientWidth + 12));
    updateFeatureDot(Math.max(0, Math.min(index, featureDots.length - 1)));
  }, { passive: true });
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
    foodPreferences: formData.get('foodPreferences'),
    allergies: formData.get('allergies'),
    diaperSize: formData.get('diaperSize'),
    feedingStage: formData.get('feedingStage'),
    daycareDays: formData.get('daycareDays'),
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
  applyFoodProfile(state, state.user);
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
  const isEditing = getChildProfileState(state.user).onboardingComplete;
  const childTabs = draft.children.map((child, index) => {
    const label = child.name || `Child ${index + 1}`;
    const selected = child.id === draft.activeChildId;
    return `<button type="button" class="${selected ? 'selected' : ''}" data-edit-child="${escapeAttribute(child.id)}" aria-pressed="${selected ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
  }).join('');
  const removeButton = draft.children.length > 1
    ? `<button id="remove-child" type="button" class="secondary-button danger-button">Remove this child</button>`
    : '';
  const accountDeletion = isEditing
    ? '<section class="account-danger"><h3>Delete parent data</h3><p> Permanently delete this parent profile, child profiles, plans, play dates, chat messages, and local account data.</p><button id="delete-parent-data" type="button" class="secondary-button danger-button">Delete parent data</button></section>'
    : '';

  root.innerHTML = `<div class="app-shell auth-shell"><header class="app-header"><div class="brand"><span class="brand-mark">🌱</span><div><p class="eyebrow">${escapeHtml(state.user.email || 'Parent profile')}</p><h1>${APP_NAME}</h1></div></div></header><main class="onboarding-layout"><section class="panel onboarding-panel"><p class="eyebrow">${isEditing ? 'Edit profile' : 'Child setup'}</p><h2>${isEditing ? 'Manage children on this profile' : 'Tell us who this planner is for'}</h2><form id="profile-form" class="profile-form"><label class="input-label" for="parent-display-name">Parent display name</label><input id="parent-display-name" name="displayName" autocomplete="name" value="${escapeAttribute(draft.displayName)}" placeholder="Milo Family" /><div class="child-editor-bar"><div class="child-tabs" aria-label="Children on this profile">${childTabs}</div><button id="add-child" type="button" class="secondary-button">Add child</button></div><input name="childId" type="hidden" value="${escapeAttribute(activeChild.id)}" /><div class="form-grid two-field-grid"><label><span>Child nickname</span><input name="childName" value="${escapeAttribute(activeChild.name)}" placeholder="Milo" maxlength="60" required /></label><label><span>Birthday</span><input name="birthday" type="date" value="${escapeAttribute(activeChild.birthday)}" max="${new Date().toISOString().slice(0, 10)}" /></label><label><span>Age if no birthday</span><input name="ageLabel" value="${escapeAttribute(activeChild.ageLabel)}" placeholder="2y 4m" maxlength="32" /></label><label><span>Home city</span><input name="homeCity" value="${escapeAttribute(activeChild.homeCity)}" placeholder="Seattle" maxlength="80" required /></label><label><span>Observed diaper size</span><input name="diaperSize" type="number" min="1" max="8" value="${escapeAttribute(activeChild.diaperSize || '')}" placeholder="e.g. 4" /></label><label><span>Feeding stage override</span><input name="feedingStage" value="${escapeAttribute(activeChild.feedingStage || '')}" placeholder="Leave blank to derive" maxlength="80" /></label></div><label class="input-label" for="food-preferences">Food preferences</label><textarea id="food-preferences" name="foodPreferences" maxlength="320" placeholder="Favorite foods, textures, meals that usually work">${escapeHtml(activeChild.foodPreferences)}</textarea><label class="input-label" for="allergies">Allergies or foods to avoid</label><input id="allergies" name="allergies" value="${escapeAttribute(activeChild.allergies)}" placeholder="None, or e.g. peanuts, egg" maxlength="220" /><label class="input-label" for="daycare-days">Daycare days</label><input class="input-label" name="daycareDays" value="${escapeAttribute(activeChild.daycareDays || '')}" placeholder="mon, tue, thu" /><label class="input-label" for="favorite-activities">Favorite activities</label><input name="favoriteActivities" value="${escapeAttribute(activeChild.favoriteActivities)}" placeholder="cars, climbing, story time" /><div class="form-actions"><button type="submit">${isEditing ? 'Save profile' : 'Save and open planner'}</button>${removeButton}${isEditing ? '<button id="cancel-profile-edit" type="button" class="secondary-button">Cancel</button>' : ''}</div></form><p class="muted">${escapeHtml(state.onboardingStatus || `${draft.children.length} child${draft.children.length === 1 ? '' : 'ren'} on this profile. The selected child becomes the active planner view.`)}</p>${accountDeletion}</section><section class="panel auth-note"><h2>What changes</h2><div class="profile-facts"><span>Derived age + stage</span><span>Restock estimates</span><span>Food preferences</span><span>Allergy guardrails</span><span>Daycare logistics</span></div><p>Birthday stays the source of truth. SproutCue derives age-stage facts at plan time and uses observed diaper size when you provide it.</p></section></main></div>`;

  document.getElementById('profile-form').addEventListener('submit', saveProfileSetup);
  document.querySelectorAll('[data-edit-child]').forEach((button) => {
    button.addEventListener('click', () => setActiveDraftChild(button.dataset.editChild));
  });
  document.getElementById('add-child')?.addEventListener('click', addDraftChild);
  document.getElementById('remove-child')?.addEventListener('click', () => removeDraftChild(activeChild.id));
  document.getElementById('delete-parent-data')?.addEventListener('click', deleteParentData);
  document.getElementById('cancel-profile-edit')?.addEventListener('click', () => {
    state.showProfileSetup = false;
    state.profileDraft = null;
    state.onboardingStatus = '';
    render();
  });
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
  applyFoodProfile(state, user);
  applyErrandsProfile(state, user);
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
  state.familyPlanEvents = Array.isArray(payload.events) ? payload.events : [];
  state.familyRecurringItems = Array.isArray(payload.recurringItems) ? payload.recurringItems : [];
  const savedReminder = state.familyPlanEvents.find((item) => item.kind === 'logistics' && item.metadata?.reminder === true && item.status !== 'cancelled');
  state.amazonReminder = savedReminder
    ? { itemId: savedReminder.metadata?.legacyId || savedReminder.metadata?.recurringId || savedReminder.id, text: savedReminder.title, dueDate: savedReminder.dueDate, planId: savedReminder.id, savedAt: savedReminder.createdAt }
    : null;
  state.shoppingSchedule = state.familyRecurringItems
    .filter((item) => item.kind === 'grocery' && item.active)
    .map((item) => ({
      id: item.metadata?.legacyId || item.id,
      planId: item.id,
      eventPlanId: state.familyPlanEvents.find((event) => event.kind === 'grocery' && event.metadata?.recurringId === item.id)?.id || '',
      weekday: item.recurrenceRule?.weekday || 'Monday',
      time: item.recurrenceRule?.time || '10:00',
      durationMinutes: item.recurrenceRule?.durationMinutes || 60,
      title: item.title,
      saved: true,
    }));
  state.logisticsItems = state.familyRecurringItems
    .filter((item) => item.kind === 'logistics' && item.active)
    .map((item) => ({
      id: item.metadata?.legacyId || item.id,
      planId: item.id,
      text: item.title,
      kidId: item.childId || '',
      kidName: item.metadata?.kidName || 'Family',
      reason: item.metadata?.reason || 'custom',
      frequencyDays: item.recurrenceRule?.frequencyDays || null,
      lastRestocked: item.lastCompletedAt ? item.lastCompletedAt.slice(0, 10) : '',
      nextRestockDate: item.nextDueDate || '',
      active: true,
    }));
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
  state.onboardingStatus = '';
  state.showProfileSetup = false;
  state.profileDraft = null;
  state.magicLinkSent = false;
  removeStoredValue('sproutCueUserId');
  removeStoredValue('sproutCueApplePhotosLink');
  removeStoredValue('sproutCueHomeBackgroundKey');
  removeStoredValue('aaronUserId');
  removeStoredValue('aaronApplePhotosLink');
  render();
}

async function saveUserSection(section, payload, options = {}) {
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
    if (section === 'food-plan') {
      applyFoodProfile(state, user);
      state.foodStatus = options.successMessage || 'Food plan saved for this user.';
    }
    if (section === 'amazon-errands') {
      applyErrandsProfile(state, user);
      state.amazonStatus = '';
    }
    return true;
  } catch (error) {
    state.apiMessage = `Save failed: ${error.message}`;
    if (section === 'food-plan') {
      state.foodStatus = `Food plan save failed: ${error.message}`;
    }
    if (section === 'amazon-errands') {
      state.amazonStatus = `Errands save failed: ${error.message}`;
    }
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
  if (state.showProfileSetup || !getChildProfileState(state.user).onboardingComplete) {
    renderOnboarding();
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
  } catch (error) {
    renderError(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
