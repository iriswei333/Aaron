import { escapeAttribute, escapeHtml, icon, writeStoredValue } from '../shared.js';
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
  if (state.homeUploadedPhoto?.url) URL.revokeObjectURL(state.homeUploadedPhoto.url);
  state.homeBackgroundKey = DEFAULT_HOME_BACKGROUND_KEY;
  state.homeUploadedPhoto = null;
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = '';
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

function clearUploadedBackground(state) {
  if (state.homeUploadedPhoto?.url) URL.revokeObjectURL(state.homeUploadedPhoto.url);
  state.homeUploadedPhoto = null;
}

function handleHomePhoto(ctx, files) {
  const { state } = ctx;
  const [file] = Array.from(files || []);
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    state.homeBackgroundStatus = 'Choose an image file for the home background.';
    ctx.renderCurrent();
    return;
  }
  clearUploadedBackground(state);
  state.homeUploadedPhoto = {
    name: file.name,
    url: URL.createObjectURL(file),
  };
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = 'Using a private photo from this device for this browser session.';
  ctx.renderCurrent();
}

function chooseDefaultBackground(ctx, key) {
  const { state } = ctx;
  const selected = defaultBackgrounds.find((background) => background.key === key);
  if (!selected) return;
  clearUploadedBackground(state);
  state.homeBackgroundKey = selected.key;
  state.showHomeBackgroundPicker = false;
  state.homeBackgroundStatus = `${selected.name} is now the home background.`;
  writeStoredValue(HOME_BACKGROUND_STORAGE_KEY, selected.key);
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

  return `<div id="background-picker-backdrop" class="background-picker-backdrop"><section class="background-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="background-picker-title"><div class="section-heading"><div><h2 id="background-picker-title">Change background</h2><p>Upload one local photo or choose a calm default scene.</p></div><button id="close-background-picker" class="icon-button" type="button" aria-label="Close background picker">×</button></div><div class="background-picker-grid"><label class="upload-box home-upload-box ${uploadedSelected ? 'selected' : ''}" for="home-photo-input">${icon('🖼️')}<strong>Upload photo</strong><span>Shown only in this browser session. It is not uploaded or saved.</span><input id="home-photo-input" type="file" accept="image/*" /></label><div class="default-backgrounds" aria-label="Default background images">${choices}</div></div></section></div>`;
}

function homeObjects(state) {
  const objects = [];
  (state.profilePlayDates || []).slice(0, 3).forEach((item) => objects.push({
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
    objects.push({ icon: '🛒', type: 'Saved grocery event', title: event.title, detail: `${event.weekday} at ${event.time}`, tab: 'food', focus: 'shopping-events' });
  });
  (state.familyObjects || []).filter((item) => item.kind === 'weekend-event').slice(0, 3).forEach((item) => {
    const detail = [item.dateLabel, item.timeLabel, item.venue].filter(Boolean).join(' • ') || 'Saved weekend event';
    objects.push({ icon: '🎟️', type: 'Attending weekend event', title: item.title, detail, tab: 'play', focus: 'family-events' });
  });
  return objects.slice(0, 6);
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
