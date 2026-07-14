import { escapeAttribute, escapeHtml, icon, writeStoredValue } from '../shared.js';

const DEFAULT_ALBUM_LINK = 'photos-redirect://';

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

export { DEFAULT_ALBUM_LINK, slides };

export function applyHomeProfile(state, user) {
  state.albumLink = user.socialLinks?.icloudPhotosUrl || DEFAULT_ALBUM_LINK;
  writeStoredValue('aaronApplePhotosLink', state.albumLink);
}

export function resetHomeState(state) {
  state.albumLink = DEFAULT_ALBUM_LINK;
  state.homePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.homePhotos = [];
  state.slide = 0;
}

function handleHomePhotos(ctx, files) {
  const { state } = ctx;
  state.homePhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  state.homePhotos = Array.from(files || []).slice(0, 6).map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));
  state.slide = 0;
  ctx.renderCurrent();
}

export function renderHome(ctx) {
  const { state } = ctx;
  const [title, note, color] = slides[state.slide];
  const activePhoto = state.homePhotos[state.slide % Math.max(state.homePhotos.length, 1)];
  const photoMarkup = activePhoto
    ? `<figure class="home-photo-frame"><img src="${activePhoto.url}" alt="Local preview of ${escapeHtml(activePhoto.name)}" /><figcaption>${escapeHtml(activePhoto.name)}</figcaption></figure>`
    : '';

  ctx.layout(`<main class="home-layout"><section class="hero-card ${color} ${activePhoto ? 'with-photo' : ''}"><div class="hero-copy"><div class="slide-meta">${icon('✨')}<span>${activePhoto ? 'Local photo preview' : 'Apple Photos linked slideshow'}</span></div><h2>${title}</h2><p>${activePhoto ? 'This photo is displayed only in this browser session and scaled to fit the home card.' : note}</p><a class="primary-link" href="${escapeAttribute(state.albumLink)}" target="_blank" rel="noreferrer">Open Aaron’s Apple Photos</a></div>${photoMarkup}<div class="slide-dots">${slides.map((item, index) => `<button class="${index === state.slide ? 'selected' : ''}" data-slide="${index}" aria-label="Show ${item[0]}"></button>`).join('')}</div></section><section class="panel"><p class="eyebrow">Photo setup</p><h2>Safer ways to show Aaron’s photos</h2><p>Direct iCloud account login should not be built into this static front page. The safer pattern is to let Apple handle authentication, then display a shared album link or local photo previews.</p><label class="input-label" for="album">Shared iCloud Photos link</label><input id="album" value="${escapeAttribute(state.albumLink)}" placeholder="https://www.icloud.com/sharedalbum/..." /><button id="save-social-links">Save social links</button><label class="upload-box compact" for="home-photo-input">${icon('🖼️')}<span>Preview photos from this device</span><input id="home-photo-input" type="file" accept="image/*" multiple /></label><div class="photo-options">${photoConnectionOptions.map(([name, badge, detail]) => `<article><strong>${name}</strong><span>${badge}</span><p>${detail}</p></article>`).join('')}</div></section></main>`);

  document.getElementById('album').addEventListener('input', (event) => {
    state.albumLink = event.target.value;
    writeStoredValue('aaronApplePhotosLink', state.albumLink);
  });
  document.getElementById('save-social-links').addEventListener('click', () => ctx.saveUserSection('social-links', { icloudPhotosUrl: state.albumLink }));
  document.getElementById('home-photo-input').addEventListener('change', (event) => handleHomePhotos(ctx, event.target.files));
  document.querySelectorAll('[data-slide]').forEach((button) => button.addEventListener('click', () => {
    state.slide = Number(button.dataset.slide);
    ctx.renderCurrent();
  }));
}
