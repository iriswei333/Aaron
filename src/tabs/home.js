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
  (state.savedFamilyEvents || [])
    .filter((item) => item.kind === 'external_event' && item.status !== 'cancelled' && isFutureFamilyEvent(item, now))
    .slice(0, 3)
    .forEach((item) => {
    const detail = [item.dateLabel, item.timeLabel, item.venue].filter(Boolean).join(' • ') || 'Saved weekend event';
    const eventDetail = [item.metadata?.dateLabel, item.metadata?.timeLabel, item.venue].filter(Boolean).join(' • ') || detail;
    objects.push({ icon: '🎟️', type: 'Attending weekend event', title: item.title, detail: eventDetail, tab: 'play', focus: 'family-events' });
    });
  return objects.slice(0, 5);
}

function isFutureFamilyEvent(item, now) {
  const timestamp = item.endsAt || item.startsAt;
  if (timestamp) {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  if (item.metadata?.date) {
    const date = new Date(`${item.metadata.date}T23:59:59`);
    return Number.isFinite(date.getTime()) && date >= now;
  }
  return false;
}

function objectCards(objects, compact = false) {
  if (!objects.length) return `<div class="empty-object-state">${icon('🌱')}<span>No upcoming playdates or weekend events yet.</span></div>`;
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

function renderHomeEventCards(state) {
  const events = (state.familyEvents || []).slice(0, 5);
  if (!events.length) return `<div class="home-empty-card"><span aria-hidden="true">🎟️</span><div><strong>No weekend events loaded yet</strong><small>Open Play to find family-friendly events near your home base.</small></div></div>`;
  return `<div class="home-weekend-list">${events.map((event) => {
    const date = event.date ? new Date(`${event.date}T12:00:00`) : null;
    const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : event.dateLabel || 'This weekend';
    return `<button type="button" class="home-weekend-card" data-home-tab="play" data-home-focus="family-events"><span class="home-weekend-icon" aria-hidden="true">🎟️</span><span><small>${escapeHtml(dateLabel)} · ${escapeHtml(event.timeLabel || 'Time TBD')}</small><strong>${escapeHtml(event.title || 'Family event')}</strong><span>${escapeHtml(event.venue || event.summary || 'Family-friendly event nearby')}</span></span><b aria-hidden="true">→</b></button>`;
  }).join('')}</div>`;
}

export function renderHome(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const parent = firstName(state.user?.displayName, 'there');
  const nextPlayDate = (state.profilePlayDates || []).filter((item) => new Date(item.endsAt || item.startsAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const homeDate = nextPlayDate ? formatHomePlayDate(nextPlayDate) : null;
  const weather = state.weather || {};
  const participantCount = Math.max(1, Number(nextPlayDate?.participantCount) || 1);
  ctx.layout(`<main class="home-layout home-dashboard"><header class="home-welcome"><div><p class="eyebrow">Your family day, made social</p><h2>Good morning, ${escapeHtml(parent)}</h2><p>${escapeHtml(weather.label || 'A good day for family plans')} ${weather.temperature && weather.temperature !== '--' ? `· ${escapeHtml(weather.temperature)}` : ''}</p></div><div class="home-welcome-actions"><div class="home-weather"><span aria-hidden="true">${weather.label?.toLowerCase().includes('rain') ? '☔' : '☀️'}</span><strong>${escapeHtml(weather.temperature || '--')}</strong><small>${escapeHtml(weather.label || 'Weather loading')}</small></div></div></header><div class="home-dashboard-grid"><section class="home-primary-column"><div class="home-section-heading"><div><p class="eyebrow">Up next</p><h3>${nextPlayDate ? 'Your next playdate' : 'Make a plan for today'}</h3></div><button type="button" class="text-button" data-home-tab="play">See all playdates →</button></div>${nextPlayDate ? `<article class="home-next-playdate"><div class="home-next-playdate-glow"></div><span class="home-today-badge">${homeDate.date}</span><h3>${escapeHtml(nextPlayDate.playgroundName || 'Neighborhood playdate')}</h3><p>${escapeHtml(homeDate.time)} · ${escapeHtml(nextPlayDate.playgroundAddress || 'Nearby playground')}</p><small>${escapeHtml(nextPlayDate.isHost ? 'Hosted by your family' : 'You are going')} · ${participantCount} ${participantCount === 1 ? 'family' : 'families'} joining</small><div class="home-next-footer"><div class="home-participant-stack" aria-label="Families joining"><span>M</span><span>T</span><span>${participantCount > 2 ? `+${participantCount - 2}` : '✓'}</span></div><button type="button" data-open-chat-playdate="${escapeAttribute(nextPlayDate.id)}">Open chat <span>→</span></button></div></article>` : `<div class="home-empty-card home-empty-primary"><span aria-hidden="true">🛝</span><div><strong>Find a nearby playground</strong><small>See places, weather, and playdates around your family.</small></div><button type="button" data-home-tab="play">Find play →</button></div>`}<div class="home-section-heading home-invites-heading"><div><p class="eyebrow">Coming up</p><h3>Weekend events</h3></div><button type="button" class="text-button" data-home-tab="play" data-home-focus="family-events">Browse events →</button></div>${renderHomeEventCards(state)}</section><aside class="home-secondary-column"><div class="home-utility-card"><p class="eyebrow">Planning for</p><strong>${escapeHtml(childName)}</strong><span>${escapeHtml(state.user?.location?.address || state.user?.location?.label || 'Set a home base for nearby ideas')}</span><button type="button" class="secondary-button" data-home-tab="profile">Open family profile</button></div><div class="home-utility-card home-utility-soft"><p class="eyebrow">A little help nearby</p><strong>Keep the day moving</strong><span>Find weather-friendly places and family events matched to your home base.</span><button type="button" class="secondary-button" data-home-tab="play">Explore nearby →</button></div></aside></div></main>`);

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
    state.playFocus = button.dataset.homeFocus === 'family-events' ? button.dataset.homeFocus : '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-open-chat-playdate]').forEach((button) => button.addEventListener('click', () => {
    state.pendingChatPlayDateId = button.dataset.openChatPlaydate;
    state.activeChatContactId = '';
    state.chatLoaded = false;
    state.tab = 'chat';
    ctx.renderCurrent();
  }));
}
