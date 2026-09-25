import { apiRequest, escapeAttribute, escapeHtml, icon, writeStoredValue } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

const DEFAULT_ALBUM_LINK = 'photos-redirect://';
const DEFAULT_HOME_BACKGROUND_KEY = 'morning-table';
const HOME_BACKGROUND_STORAGE_KEY = 'sproutCueHomeBackgroundKey';

const defaultBackgrounds = [
  {
    key: 'morning-table',
    name: 'Morning table',
    detail: 'Books, tiny shoes, snack bowl, and a soft morning start.',
    src: '/backgrounds/parenting-home-default.png',
  },
  {
    key: 'playground-walk',
    name: 'Playground walk',
    detail: 'A stroller blanket and playground details after outdoor time.',
    src: '/backgrounds/parenting-playground-default.png',
  },
  {
    key: 'art-table',
    name: 'Art table',
    detail: 'Crayons, paper shapes, and a tidy afternoon craft setup.',
    src: '/backgrounds/parenting-art-table-default.png',
  },
];

export { DEFAULT_ALBUM_LINK, DEFAULT_HOME_BACKGROUND_KEY };

export function applyHomeProfile(state, user) {
  state.albumLink = user.socialLinks?.icloudPhotosUrl || DEFAULT_ALBUM_LINK;
  writeStoredValue('sproutCueApplePhotosLink', state.albumLink);
}

export function resetHomeState(state) {
  state.albumLink = DEFAULT_ALBUM_LINK;
  if (state.homeUploadedPhoto?.url && !state.homeUploadedPhoto.persisted) URL.revokeObjectURL(state.homeUploadedPhoto.url);
  state.homeBackgroundKey = DEFAULT_HOME_BACKGROUND_KEY;
  state.homeUploadedPhoto = null;
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = '';
  state.homeSocialPoster = null;
  state.homeSocialPosterStatus = '';
  state.homeSocialPosterLoading = false;
}

async function loadHomeSocialPoster(ctx) {
  const { state } = ctx;
  state.homeSocialPosterLoading = true;
  try {
    const data = await apiRequest('/social-posters');
    state.homeSocialPoster = data.recommendedPoster || null;
    state.homeSocialPosterStatus = data.locationCity
      ? (state.homeSocialPoster ? `Showing the closest generated post for ${data.locationCity}.` : `No generated poster matches ${data.locationCity} yet.`)
      : 'Save a location to match a generated poster to your area.';
  } catch (error) {
    state.homeSocialPoster = null;
    state.homeSocialPosterStatus = `Could not load generated poster: ${error.message}`;
  }
  state.homeSocialPosterLoading = false;
  if (state.tab === 'home') ctx.renderCurrent();
}

function renderHomeSocialPoster(ctx) {
  const { state } = ctx;
  const poster = state.homeSocialPoster;
  if (!poster) return `<div class="home-utility-card home-social-poster-empty"><p class="eyebrow">Weekend social post</p><strong>Generated poster</strong><span>${escapeHtml(state.homeSocialPosterStatus || 'Run the weekly social agent to create a location-matched poster.')}</span><button type="button" class="secondary-button" data-home-tab="profile">Open Family</button></div>`;
  return `<div class="home-utility-card home-social-poster-card"><div class="home-social-poster-heading"><p class="eyebrow">Weekend social post</p><span>Nearby match</span></div><a href="${escapeAttribute(poster.url)}" target="_blank" rel="noreferrer"><img src="${escapeAttribute(poster.url)}" alt="Generated weekend social poster ${escapeAttribute(poster.name)}" loading="lazy" /></a><strong>${escapeHtml(poster.name.replace(/[-_]/g, ' ').replace(/\.\w+$/, ''))}</strong><span>${escapeHtml(state.homeSocialPosterStatus)}</span></div>`;
}

export async function loadHomeBackground(ctx) {
  try {
    const { background } = await apiRequest('/home-background');
    if (!background?.mediaUrl) return;
    clearUploadedBackground(ctx.state);
    ctx.state.homeUploadedPhoto = {
      name: background.fileName || 'home-background',
      url: background.mediaUrl,
      persisted: true,
    };
    if (ctx.state.tab === 'home') ctx.renderCurrent();
  } catch {
    // The default background remains usable if the persisted background cannot be loaded.
  }
}

function activeBackground(state) {
  if (state.homeUploadedPhoto) {
    return {
      name: state.homeUploadedPhoto.name,
      src: state.homeUploadedPhoto.url,
      source: 'upload',
    };
  }

  const selected = defaultBackgrounds.find((background) => background.key === state.homeBackgroundKey)
    || defaultBackgrounds[0];
  return {
    ...selected,
    source: 'default',
  };
}

export function clearUploadedBackground(state) {
  if (state.homeUploadedPhoto?.url && !state.homeUploadedPhoto.persisted) URL.revokeObjectURL(state.homeUploadedPhoto.url);
  state.homeUploadedPhoto = null;
}

async function handleHomePhoto(ctx, files) {
  const { state } = ctx;
  const [file] = Array.from(files || []);
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    state.homeBackgroundStatus = 'Choose an image file for the home background.';
    ctx.renderCurrent();
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    state.homeBackgroundStatus = 'Choose an image smaller than 5 MB.';
    ctx.renderCurrent();
    return;
  }
  clearUploadedBackground(state);
  state.homeUploadedPhoto = {
    name: file.name,
    url: URL.createObjectURL(file),
  };
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = 'Saving your private home background…';
  ctx.renderCurrent();

  try {
    const mediaUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read that image.'));
      reader.readAsDataURL(file);
    });
    const { background } = await apiRequest('/home-background', {
      method: 'PUT',
      body: JSON.stringify({ fileName: file.name, mediaUrl }),
    });
    clearUploadedBackground(state);
    state.homeUploadedPhoto = {
      name: background.fileName || file.name,
      url: background.mediaUrl,
      persisted: true,
    };
    state.homeBackgroundStatus = 'Private home background saved for this family profile.';
  } catch (error) {
    state.homeBackgroundStatus = `Background save failed: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function chooseDefaultBackground(ctx, key) {
  const { state } = ctx;
  const selected = defaultBackgrounds.find((background) => background.key === key);
  if (!selected) return;
  clearUploadedBackground(state);
  state.homeBackgroundKey = selected.key;
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = `${selected.name} is now the home background.`;
  writeStoredValue(HOME_BACKGROUND_STORAGE_KEY, selected.key);
  ctx.renderCurrent();
  try {
    await apiRequest('/home-background', { method: 'DELETE' });
  } catch (error) {
    state.homeBackgroundStatus = `Default selected locally, but saved photo removal failed: ${error.message}`;
  }
  ctx.renderCurrent();
}

function backgroundPickerMarkup(state, active) {
  if (!state.showHomeBackgroundPicker) return '';
  const uploadedSelected = active.source === 'upload';
  const choices = defaultBackgrounds.map((background) => `
    <button class="background-choice ${active.source === 'default' && active.key === background.key ? 'selected' : ''}" type="button" data-background-key="${escapeAttribute(background.key)}" aria-pressed="${active.source === 'default' && active.key === background.key ? 'true' : 'false'}">
      <img src="${escapeAttribute(background.src)}" alt="" loading="lazy" />
      <strong>${escapeHtml(background.name)}</strong>
      <span>${escapeHtml(background.detail)}</span>
    </button>
  `).join('');

  return `<div id="background-picker-backdrop" class="background-picker-backdrop"><section class="background-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="background-picker-title"><div class="section-heading"><div><h2 id="background-picker-title">Change background</h2><p>Upload one private photo saved to this family profile, or choose a calm default scene.</p></div><button id="close-background-picker" class="icon-button" type="button" aria-label="Close background picker">×</button></div><div class="background-picker-grid"><label class="upload-box home-upload-box ${uploadedSelected ? 'selected' : ''}" for="home-photo-input">${icon('🖼️')}<strong>Upload photo</strong><span>Private to this family profile and used only on the home page.</span><input id="home-photo-input" type="file" accept="image/*" /></label><div class="default-backgrounds" aria-label="Default background images">${choices}</div></div></section></div>`;
}

function homeObjects(state) {
  const objects = [];
  const now = new Date();
  (state.profilePlayDates || [])
    .filter((item) => {
      if (item.status === 'cancelled') return false;
      const endsAt = new Date(item.endsAt || item.startsAt || 0);
      return Number.isFinite(endsAt.getTime()) && endsAt >= now;
    })
    .slice(0, 3)
    .forEach((item) => objects.push({
    icon: '🛝',
    type: item.isHost ? 'Hosted playdate' : 'Joined playdate',
    title: item.playgroundName,
    detail: new Date(item.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    tab: 'play',
    focus: 'playdates',
    playDateId: item.id,
    participantCount: item.participantCount,
    }));
  (state.savedFamilyPlans || [])
    .filter((item) => ['external_event', 'story_time'].includes(item.kind) && item.status !== 'cancelled' && isFutureFamilyEvent(item, now))
    .sort(compareFamilyPlans)
    .slice(0, 3)
    .forEach((item) => {
    const isStoryTime = item.kind === 'story_time';
    const detail = [item.dateLabel, item.timeLabel, item.venue].filter(Boolean).join(' • ') || (isStoryTime ? 'Saved story time' : 'Saved weekend event');
    const eventDetail = [item.metadata?.dateLabel, item.metadata?.timeLabel, item.venue].filter(Boolean).join(' • ') || detail;
    objects.push({ icon: isStoryTime ? '📖' : '🎟️', type: isStoryTime ? 'Saved story time' : 'Attending weekend event', title: item.title, detail: eventDetail, tab: 'play', focus: isStoryTime ? 'story-times' : 'family-events' });
    });
  return objects.slice(0, 5);
}

function isFutureFamilyEvent(item, now) {
  const timestamp = item.endsAt || item.startsAt;
  if (timestamp) {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  const dateValue = item.dueDate || item.date || item.metadata?.date;
  if (dateValue) {
    const date = new Date(`${dateValue}T23:59:59`);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  return false;
}

function objectCards(objects, compact = false) {
  if (!objects.length) return `<div class="empty-object-state">${icon('🌱')}<span>No upcoming playdates or saved family plans yet.</span></div>`;
  return `<div class="home-object-grid ${compact ? 'compact' : ''}">${objects.map((item) => `<article class="home-object-card"><button class="home-object-card-main" type="button" data-home-tab="${escapeAttribute(item.tab || 'home')}"${item.focus ? ` data-home-focus="${escapeAttribute(item.focus)}"` : ''} aria-label="Open ${escapeAttribute(item.title)}"><span class="object-icon" aria-hidden="true">${item.icon}</span><span class="home-object-card-copy"><small>${escapeHtml(item.type)}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></span></button>${item.playDateId && item.participantCount > 1 ? `<button class="home-object-card-chat" type="button" data-open-chat-playdate="${escapeAttribute(item.playDateId)}"><span aria-hidden="true">◌</span> Open chat</button>` : ''}</article>`).join('')}</div>`;
}

function firstName(value, fallback = 'there') {
  return String(value || '').trim().split(/\s+/)[0] || fallback;
}

function formatHomePlayDate(playDate) {
  const startsAt = new Date(playDate.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { date: 'Upcoming playdate', time: 'Time pending' };
  return {
    date: startsAt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
    time: startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function compareFamilyPlans(a, b) {
  const timestamp = (item) => {
    if (item.startsAt) {
      const value = new Date(item.startsAt).getTime();
      if (Number.isFinite(value)) return value;
    }
    const date = item.dueDate || item.date || item.metadata?.date;
    const value = date ? new Date(`${date}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  };
  return timestamp(a) - timestamp(b);
}

function selectedHomeFamilyPlans(state) {
  return (state.savedFamilyPlans || [])
    .filter((item) => {
      const hasSchedule = item.endsAt || item.startsAt || item.dueDate || item.date || item.metadata?.date;
      return ['external_event', 'story_time'].includes(item.kind)
        && item.status !== 'cancelled'
        && (!hasSchedule || isFutureFamilyEvent(item, new Date()));
    })
    .map((item) => ({
      ...item,
      date: item.dueDate || item.metadata?.date || item.date || '',
      dateLabel: item.metadata?.dateLabel || item.dateLabel || '',
      timeLabel: item.metadata?.timeLabel || item.timeLabel || '',
      imageUrl: item.metadata?.imageUrl || item.imageUrl || '',
    }))
    .sort(compareFamilyPlans);
}

function homePlanTimestamp(item) {
  if (item.startsAt) {
    const value = new Date(item.startsAt).getTime();
    if (Number.isFinite(value)) return value;
  }
  const date = item.dueDate || item.date || item.metadata?.date;
  const value = date ? new Date(`${date}T12:00:00`).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function upcomingHomePlans(state) {
  const now = Date.now();
  const playDates = (state.profilePlayDates || [])
    .filter((item) => item.status !== 'cancelled' && new Date(item.endsAt || item.startsAt).getTime() >= now)
    .map((item) => ({ ...item, homeKind: 'playdate' }));
  const familyPlans = selectedHomeFamilyPlans(state).map((item) => ({ ...item, homeKind: item.kind }));
  return [...playDates, ...familyPlans].sort((a, b) => homePlanTimestamp(a) - homePlanTimestamp(b));
}

function homePlanView(plan) {
  if (plan.homeKind === 'playdate') {
    const timing = formatHomePlayDate(plan);
    return {
      icon: '☺',
      type: plan.isHost ? 'Your playdate' : 'Playdate',
      title: plan.playgroundName || 'Neighborhood playdate',
      when: `${timing.date} · ${timing.time}`,
      where: plan.playgroundAddress || 'Nearby playground',
      focus: 'playdates',
    };
  }
  const isStoryTime = plan.homeKind === 'story_time';
  const date = plan.dueDate || plan.date || plan.metadata?.date;
  const parsedDate = date ? new Date(`${date}T12:00:00`) : null;
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    : plan.metadata?.dateLabel || plan.dateLabel || 'Date to be decided';
  return {
    icon: isStoryTime ? '📖' : '🎟️',
    type: isStoryTime ? 'Story time' : 'Weekend event',
    title: plan.title || (isStoryTime ? 'Story time' : 'Family event'),
    when: `${dateLabel} · ${plan.metadata?.timeLabel || plan.timeLabel || 'Time TBD'}`,
    where: plan.venue || plan.summary || 'Family-friendly place nearby',
    focus: isStoryTime ? 'story-times' : 'family-events',
  };
}

function renderTodayPlans(plans) {
  if (!plans.length) return '';
  const featured = homePlanView(plans[0]);
  const remaining = plans.slice(1, 4);
  return `<section class="today-plans" aria-labelledby="today-plans-title"><div class="today-section-title"><div><p class="eyebrow">Something to look forward to</p><h2 id="today-plans-title">Your family’s plans</h2><p>Playdates, events, and story times in one calm list.</p></div><button type="button" class="text-button" data-home-tab="play">View all →</button></div><button type="button" class="today-plan-feature" data-home-tab="play" data-home-focus="${featured.focus}"><span class="today-plan-icon" aria-hidden="true">${featured.icon}</span><span class="today-plan-copy"><small>${escapeHtml(featured.type)} · ${escapeHtml(featured.when)}</small><strong>${escapeHtml(featured.title)}</strong><span>${escapeHtml(featured.where)}</span></span><b aria-hidden="true">→</b></button>${remaining.length ? `<div class="today-plan-list">${remaining.map((plan) => { const view = homePlanView(plan); return `<button type="button" class="today-plan-row" data-home-tab="play" data-home-focus="${view.focus}"><span aria-hidden="true">${view.icon}</span><span><small>${escapeHtml(view.type)} · ${escapeHtml(view.when)}</small><strong>${escapeHtml(view.title)}</strong></span><b aria-hidden="true">→</b></button>`; }).join('')}</div>` : ''}</section>`;
}

function todayRecommendation(state, childName) {
  const weather = state.weather || {};
  const isIndoor = String(weather.label || '').toLowerCase().includes('rain')
    || String(weather.label || '').toLowerCase().includes('indoor')
    || parseFloat(weather.precipitation) > 0;
  const options = state.nearbyPlayOptions || [];
  const recommendation = options.find((item) => item.preference === (isIndoor ? 'indoor' : 'outdoor')) || options[0];
  return {
    title: recommendation?.name || (isIndoor ? 'A cozy story-time outing' : 'Fresh air and big little discoveries'),
    description: recommendation?.best || (isIndoor
      ? `A weather-friendly place for ${childName} to move, read, and explore.`
      : `A playground morning made for ${childName}’s curious pace.`),
    detail: recommendation
      ? `${recommendation.type || 'Nearby place'} · ${recommendation.distance || 'Close to home'}`
      : `${weather.label || 'Weather-friendly'} · Near your family`,
    focus: isIndoor ? 'story-times' : '',
    image: isIndoor ? '/backgrounds/parenting-home-default.png' : '/backgrounds/parenting-playground-default.png',
  };
}

function homeWeekendEvents(state) {
  const selected = selectedHomeFamilyPlans(state);
  if (selected.length) return selected;
  return state.familyEvents || [];
}

function renderHomeEventCards(state) {
  const events = homeWeekendEvents(state).slice(0, 5);
  if (!events.length) return `<div class="home-empty-card"><span aria-hidden="true">🎟️</span><div><strong>No family plans saved yet</strong><small>Open Play to save weekend events and story times near your home base.</small></div></div>`;
  return `<div class="home-weekend-list">${events.map((event) => {
    const date = event.date ? new Date(`${event.date}T12:00:00`) : null;
    const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : event.dateLabel || 'This weekend';
    const isStoryTime = event.kind === 'story_time';
    return `<button type="button" class="home-weekend-card" data-home-tab="play" data-home-focus="${isStoryTime ? 'story-times' : 'family-events'}"><span class="home-weekend-icon" aria-hidden="true">${isStoryTime ? '📖' : '🎟️'}</span><span><small>${escapeHtml(dateLabel)} · ${escapeHtml(event.timeLabel || 'Time TBD')} · ${isStoryTime ? 'Story time' : 'Weekend event'}</small><strong>${escapeHtml(event.title || (isStoryTime ? 'Story time' : 'Family event'))}</strong><span>${escapeHtml(event.venue || event.summary || 'Family-friendly event nearby')}</span></span><b aria-hidden="true">→</b></button>`;
  }).join('')}</div>`;
}

export function renderHome(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const parent = firstName(state.user?.displayName, 'there');
  const weather = state.weather || {};
  const plans = upcomingHomePlans(state);
  const recommendation = todayRecommendation(state, childName);
  const locationLabel = state.user?.location?.address || state.user?.location?.label || 'Set your neighborhood';
  ctx.layout(`<main class="home-layout today-page">${renderTodayPlans(plans)}<header class="today-greeting"><div><button type="button" class="today-location-pill" data-home-tab="profile">⌖ ${escapeHtml(locationLabel)}</button><p class="eyebrow">Little adventures, together</p><h1>What shall we do<br />with ${escapeHtml(childName)} today?</h1><p>A nearby adventure. A new way to play.<br />A little less planning for you, ${escapeHtml(parent)}.</p></div><div class="home-weather"><span aria-hidden="true">${weather.label?.toLowerCase().includes('rain') ? '☔' : '☀️'}</span><strong>${escapeHtml(weather.temperature || '--')}</strong><small>${escapeHtml(weather.label || 'Weather loading')}</small></div></header><section class="today-intents" aria-label="Choose what your family needs"><button type="button" class="today-intent active" data-home-tab="play"><span aria-hidden="true">☀</span><strong>Go somewhere</strong><small>Places and events nearby</small></button><button type="button" class="today-intent" data-home-tab="play" data-home-focus="playdates"><span aria-hidden="true">☺</span><strong>Meet playmates</strong><small>Find a nearby playdate</small></button><button type="button" class="today-intent" data-home-tab="play" data-home-focus="story-times"><span aria-hidden="true">▤</span><strong>Find story time</strong><small>Books and a cozy outing</small></button></section><section class="today-adventure-grid" aria-labelledby="today-adventure-title"><article class="today-adventure-card" style="--today-adventure-image: url('${escapeAttribute(recommendation.image)}')"><div class="today-adventure-copy"><span class="today-adventure-badge">Your next little adventure</span><h2 id="today-adventure-title">${escapeHtml(recommendation.title)}</h2><p>${escapeHtml(recommendation.description)}</p><small>${escapeHtml(recommendation.detail)}</small><button type="button" data-home-tab="play"${recommendation.focus ? ` data-home-focus="${recommendation.focus}"` : ''}>Explore this adventure <span aria-hidden="true">↗</span></button></div></article><aside class="today-journey-card"><p class="eyebrow">More than a place to go</p><h2>Make a little day of it</h2><ol><li><span>1</span><div><strong>Get ready together</strong><p>Talk about one thing ${escapeHtml(childName)} might see or try.</p></div></li><li><span>2</span><div><strong>Bring one familiar toy</strong><p>Use it to start a simple game while you explore.</p></div></li><li><span>3</span><div><strong>Keep one small memory</strong><p>Name a favorite moment on the way home.</p></div></li></ol><button type="button" class="secondary-button" data-home-tab="play" data-home-focus="story-times">Find a getting-ready story</button></aside></section></main>`);
  document.getElementById('close-background-picker')?.addEventListener('click', () => {
    state.showHomeBackgroundPicker = false;
    ctx.renderCurrent();
  });
  document.getElementById('background-picker-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id !== 'background-picker-backdrop') return;
    state.showHomeBackgroundPicker = false;
    ctx.renderCurrent();
  });
  document.getElementById('home-photo-input')?.addEventListener('change', (event) => handleHomePhoto(ctx, event.target.files));
  document.querySelectorAll('[data-background-key]').forEach((button) => button.addEventListener('click', () => chooseDefaultBackground(ctx, button.dataset.backgroundKey)));
  document.querySelectorAll('[data-home-tab]').forEach((button) => button.addEventListener('click', () => {
    state.tab = button.dataset.homeTab;
    state.playdateFocus = button.dataset.homeFocus === 'playdates' ? button.dataset.homeFocus : '';
    state.playFocus = ['family-events', 'story-times'].includes(button.dataset.homeFocus) ? button.dataset.homeFocus : '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-open-chat-playdate]').forEach((button) => button.addEventListener('click', () => {
    state.pendingChatPlayDateId = button.dataset.openChatPlaydate;
    state.activeChatContactId = '';
    state.chatLoaded = false;
    state.tab = 'profile';
    ctx.renderCurrent();
  }));
}
