import { apiRequest, escapeAttribute, escapeHtml, icon, writeStoredValue } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';
import { buildFamilyLogistics } from '../../lib/kid-logistics.js';

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
    }));
  const plan = state.user?.foodPlan;
  if (plan?.weeklyMenu?.length || plan?.byChild) objects.push({ icon: '🥣', type: 'Saved food plan', title: 'Weekly meals', detail: plan.lastGeneratedAt ? 'Recently updated' : 'Saved for your family', tab: 'food' });
  const logistics = buildFamilyLogistics(state.user, { restockItems: state.restockItems, logisticsItems: state.logisticsItems });
  const nextDueItem = logistics.items
    .filter((item) => item.nextRestockDate)
    .sort((a, b) => a.nextRestockDate.localeCompare(b.nextRestockDate))[0];
  const reminder = nextDueItem || state.amazonReminder;
  if (reminder) {
    const dueDate = nextDueItem?.nextRestockDate || reminder.dueDate;
    objects.push({ icon: '🧺', type: 'Next family reminder', title: nextDueItem?.text || reminder.text || 'Logistics item', detail: dueDate ? `Buy by ${new Date(`${dueDate}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'Open errands to review', tab: 'errands' });
  }
  (state.shoppingSchedule || []).filter((event) => event.saved).slice(0, 3).forEach((event) => {
    const nextOccurrence = nextShoppingOccurrence(event, now);
    if (!nextOccurrence) return;
    objects.push({ icon: '🛒', type: 'Saved grocery event', title: event.title, detail: nextOccurrence.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${event.time}`, tab: 'food', focus: 'shopping-events' });
  });
  (state.familyPlanEvents || [])
    .filter((item) => item.kind === 'external_event' && item.status !== 'cancelled' && isFutureFamilyEvent(item, now))
    .slice(0, 3)
    .forEach((item) => {
    const detail = [item.dateLabel, item.timeLabel, item.venue].filter(Boolean).join(' • ') || 'Saved weekend event';
    const eventDetail = [item.metadata?.dateLabel, item.metadata?.timeLabel, item.venue].filter(Boolean).join(' • ') || detail;
    objects.push({ icon: '🎟️', type: 'Attending weekend event', title: item.title, detail: eventDetail, tab: 'play', focus: 'family-events' });
    });
  return objects.slice(0, 6);
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

function nextShoppingOccurrence(event, now = new Date()) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = weekdays.indexOf(event.weekday);
  if (targetDay < 0 || !/^\d{2}:\d{2}$/.test(event.time || '')) return null;
  const [hour, minute] = event.time.split(':').map((value) => Number.parseInt(value, 10));
  const occurrence = new Date(now);
  occurrence.setHours(hour, minute, 0, 0);
  let dayOffset = (targetDay - now.getDay() + 7) % 7;
  if (dayOffset === 0 && occurrence < now) dayOffset = 7;
  occurrence.setDate(now.getDate() + dayOffset);
  return occurrence;
}

function objectCards(objects, compact = false) {
  if (!objects.length) return `<div class="empty-object-state">${icon('🌱')}<span>No saved family objects yet. Create a playdate, save a food plan, or save a grocery event.</span></div>`;
  return `<div class="home-object-grid ${compact ? 'compact' : ''}">${objects.map((item) => `<button class="home-object-card" type="button" data-home-tab="${escapeAttribute(item.tab || 'home')}"${item.focus ? ` data-home-focus="${escapeAttribute(item.focus)}"` : ''} aria-label="Open ${escapeAttribute(item.title)}"><span class="object-icon" aria-hidden="true">${item.icon}</span><span class="home-object-card-copy"><small>${escapeHtml(item.type)}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></span></button>`).join('')}</div>`;
}

export function renderHome(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const background = activeBackground(state);
  const picker = backgroundPickerMarkup(state, background);
  const objects = homeObjects(state);

  ctx.layout(`<main class="home-layout"><section class="hero-card home-hero" style="--home-background-image: url('${escapeAttribute(background.src)}');"><button id="change-background" class="icon-button home-background-control" type="button" aria-label="Edit background" title="Edit background">✎</button><div class="hero-copy"><h2>Good morning, ${escapeHtml(childName)}</h2><p>One quiet place for today’s play, meals, errands, and small memories.</p></div>${objects.length ? `<aside class="hero-objects"><p class="eyebrow">Your family events</p>${objectCards(objects, true)}</aside>` : ''}</section></main>${picker}`);

  document.getElementById('change-background').addEventListener('click', () => {
    state.showHomeBackgroundPicker = true;
    ctx.renderCurrent();
  });
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
    state.foodFocus = button.dataset.homeFocus === 'shopping-events' ? button.dataset.homeFocus : '';
    state.playFocus = button.dataset.homeFocus === 'family-events' ? button.dataset.homeFocus : '';
    ctx.renderCurrent();
  }));
}
