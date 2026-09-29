import { apiRequest, escapeAttribute, escapeHtml, readFirstStoredValue } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

const DEFAULT_TEMPLATE = 'career-recognition-v1';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;

function pictureBookCreateError(response, result, photos) {
  if (response.status === 413) {
    const totalMb = (photos.reduce((total, photo) => total + photo.size, 0) / (1024 * 1024)).toFixed(1);
    return `Your ${photos.length} selected photos total ${totalMb} MB, and the upload was too large for the server. Try two photos first, then add smaller photos. HEIC files convert after upload, so choose smaller originals or set iPhone Camera → Formats → Most Compatible for future photos.`;
  }
  if (response.status === 415) return 'Those photos use a format we cannot read. Choose JPEG, PNG, WebP, HEIC, or HEIF photos.';
  return result.error || result.help || `Request failed with ${response.status}`;
}

function statusLabel(status) {
  return ({ pending: 'Ready to create', generating: 'Making this page…', ready: 'Ready to view', failed: 'Try again', draft: 'Draft', archived: 'Archived' })[status] || 'Ready to create';
}

function pageLabel(pageKey, page = {}) {
  return page.titleZh || page.titleEn || ({ cover: 'Cover', doctor: 'Doctor', firefighter: 'Firefighter', 'police-officer': 'Police officer', astronaut: 'Astronaut', chef: 'Chef', teacher: 'Teacher', pilot: 'Pilot', scientist: 'Scientist', 'race-car-driver': 'Race car driver' })[pageKey] || pageKey;
}

function localHeaders() {
  const localUserId = readFirstStoredValue(['sproutCueUserId', 'aaronUserId'], '');
  return localUserId ? { 'x-sproutcue-local-user-id': localUserId } : {};
}

async function loadTemplates(ctx) {
  const { state } = ctx;
  state.pictureBookTemplatesLoading = true;
  try {
    const { templates } = await apiRequest('/family-assets/picture-book-templates');
    state.pictureBookTemplates = templates || [];
    if (!state.pictureBookTemplateSlug || !state.pictureBookTemplates.some((template) => template.slug === state.pictureBookTemplateSlug)) {
      state.pictureBookTemplateSlug = state.pictureBookTemplates[0]?.slug || DEFAULT_TEMPLATE;
    }
    state.pictureBookTemplatesLoaded = true;
  } catch (error) {
    state.pictureBookStatus = `Could not load picture-book templates: ${error.message}`;
  }
  state.pictureBookTemplatesLoading = false;
  if (state.tab === 'studio') ctx.renderCurrent();
}

async function loadBooks(ctx) {
  const { state } = ctx;
  state.pictureBooksLoading = true;
  try {
    const { books } = await apiRequest('/family-assets/picture-books');
    state.pictureBooks = books || [];
    state.pictureBooksLoaded = true;
    state.pictureBookStatus = '';
  } catch (error) {
    state.pictureBookStatus = `Could not load your books: ${error.message}`;
  }
  state.pictureBooksLoading = false;
  if (state.tab === 'studio') ctx.renderCurrent();
}

async function createBook(ctx, form) {
  const { state } = ctx;
  const photos = Array.from(form.elements.photos?.files || []);
  if (photos.length < 2 || photos.length > 5) {
    state.pictureBookStatus = 'Please choose 2 to 5 clear photos of your child.';
    ctx.renderCurrent();
    return;
  }
  if (photos.some((photo) => photo.size > MAX_PHOTO_BYTES)) {
    state.pictureBookStatus = 'Each reference photo must be 20 MB or smaller.';
    ctx.renderCurrent();
    return;
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
    state.pictureBookStatus = 'Your selected photos are over the 90 MB combined limit. Choose smaller photos or fewer photos.';
    ctx.renderCurrent();
    return;
  }
  const data = new FormData();
  data.set('childName', form.elements.childName.value.trim());
  data.set('templateSlug', form.elements.templateSlug.value || DEFAULT_TEMPLATE);
  photos.forEach((photo) => data.append('photos', photo));
  state.pictureBookStatus = 'Saving the private reference photos…';
  ctx.renderCurrent();
  try {
    const response = await fetch('/api/family-assets/picture-books', { method: 'POST', body: data, headers: localHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(pictureBookCreateError(response, result, photos));
    state.pictureBookStatus = 'Book created. You can make the whole book or work one page at a time.';
    state.pictureBooks = [result.book, ...state.pictureBooks];
    state.pictureBooksLoaded = true;
    state.studioView = 'library';
    globalThis.history.replaceState({}, '', '/picture-books');
  } catch (error) {
    state.pictureBookStatus = `Could not create the book: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function generatePage(ctx, bookId, pageKey, { quiet = false } = {}) {
  const { state } = ctx;
  const page = state.pictureBooks.find((book) => book.id === bookId)?.pages?.[pageKey];
  if (!quiet) {
    state.pictureBookStatus = `Making ${pageLabel(pageKey, page).toLowerCase()}… this can take a moment.`;
    ctx.renderCurrent();
  }
  const { book } = await apiRequest('/family-assets/picture-book-pages', { method: 'POST', body: JSON.stringify({ bookAssetId: bookId, pageKey }) });
  state.pictureBooks = state.pictureBooks.map((item) => item.id === book.id ? book : item);
  if (!quiet) state.pictureBookStatus = `${pageLabel(pageKey, book.pages?.[pageKey])} is ready.`;
  return book;
}

async function makeWholeBook(ctx, bookId) {
  const { state } = ctx;
  const book = state.pictureBooks.find((item) => item.id === bookId);
  const pending = Object.entries(book?.pages || {}).sort(([, a], [, b]) => a.pageOrder - b.pageOrder).filter(([, page]) => page.status !== 'ready');
  if (!pending.length) {
    state.pictureBookStatus = 'Every page is already ready. Open the complete PDF whenever you like.';
    ctx.renderCurrent();
    return;
  }
  state.pictureBookGeneratingBookId = bookId;
  let completed = 0;
  for (const [pageKey, page] of pending) {
    state.pictureBookStatus = `Making the whole book · ${completed + 1} of ${pending.length}: ${pageLabel(pageKey, page)}`;
    ctx.renderCurrent();
    try {
      await generatePage(ctx, bookId, pageKey, { quiet: true });
      completed += 1;
    } catch (error) {
      state.pictureBookStatus = `Stopped after ${completed} page${completed === 1 ? '' : 's'}: ${error.message}`;
      state.pictureBookGeneratingBookId = '';
      ctx.renderCurrent();
      return;
    }
  }
  state.pictureBookGeneratingBookId = '';
  state.pictureBookStatus = 'Your whole picture book is ready to view as a PDF.';
  ctx.renderCurrent();
}

async function viewPage(ctx, bookId, pageKey) {
  const { state } = ctx;
  state.pictureBookStatus = 'Opening your private page…';
  ctx.renderCurrent();
  try {
    const response = await fetch(`/api/family-assets/picture-book-assets?bookAssetId=${encodeURIComponent(bookId)}&pageKey=${encodeURIComponent(pageKey)}`, { headers: localHeaders() });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Request failed with ${response.status}`);
    }
    if (state.pictureBookPreviewUrl) URL.revokeObjectURL(state.pictureBookPreviewUrl);
    state.pictureBookPreviewUrl = URL.createObjectURL(await response.blob());
    state.pictureBookPreviewTitle = pageLabel(pageKey, state.pictureBooks.find((book) => book.id === bookId)?.pages?.[pageKey]);
    state.pictureBookStatus = '';
  } catch (error) {
    state.pictureBookStatus = `Could not open this page: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function viewPdf(ctx, bookId) {
  const popup = globalThis.open('', '_blank');
  const { state } = ctx;
  state.pictureBookStatus = 'Preparing the complete PDF…';
  ctx.renderCurrent();
  try {
    const response = await fetch(`/api/family-assets/picture-book-pdf?bookAssetId=${encodeURIComponent(bookId)}`, { headers: localHeaders() });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Request failed with ${response.status}`);
    }
    const url = URL.createObjectURL(await response.blob());
    if (popup) popup.location.href = url;
    else {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    state.pictureBookStatus = 'The complete PDF opened in a new tab.';
  } catch (error) {
    popup?.close();
    state.pictureBookStatus = `Could not open the PDF: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function deleteBook(ctx, bookId) {
  const { state } = ctx;
  const book = state.pictureBooks.find((item) => item.id === bookId);
  if (!globalThis.confirm(`Delete “${book?.title || 'this picture book'}”? This removes its photos and generated pages and cannot be undone.`)) return;
  state.pictureBookStatus = 'Deleting the picture book…';
  ctx.renderCurrent();
  try {
    await apiRequest(`/family-assets/picture-books?bookAssetId=${encodeURIComponent(bookId)}`, { method: 'DELETE' });
    state.pictureBooks = state.pictureBooks.filter((item) => item.id !== bookId);
    state.pictureBookStatus = 'Picture book deleted.';
  } catch (error) {
    state.pictureBookStatus = `Could not delete the book: ${error.message}`;
  }
  ctx.renderCurrent();
}

function bookCard(book, state) {
  const pages = Object.entries(book.pages || {}).sort(([, a], [, b]) => a.pageOrder - b.pageOrder);
  const readyCount = pages.filter(([, page]) => page.status === 'ready').length;
  const complete = pages.length > 0 && readyCount === pages.length;
  const generating = state.pictureBookGeneratingBookId === book.id;
  return `<article class="studio-book-card"><div class="studio-book-heading"><div><p class="eyebrow">${escapeHtml(book.template?.name || book.template?.slug || DEFAULT_TEMPLATE)}</p><h2>${escapeHtml(book.title || 'Picture book')}</h2><p>${escapeHtml(book.childName || 'Your child')} · ${readyCount}/${pages.length} pages ready</p></div><span class="studio-status ${escapeAttribute(book.status || 'draft')}">${escapeHtml(statusLabel(book.status))}</span></div><div class="studio-book-actions"><button type="button" data-generate-whole-book="${escapeAttribute(book.id)}" ${generating || complete ? 'disabled' : ''}>${generating ? 'Making whole book…' : complete ? 'Whole book ready' : 'Make whole book'}</button><button type="button" class="secondary-button" data-view-pdf="${escapeAttribute(book.id)}" ${complete ? '' : 'disabled'}>View PDF</button><button type="button" class="danger-text-button" data-delete-book="${escapeAttribute(book.id)}" ${generating ? 'disabled' : ''}>Delete project</button></div><div class="studio-page-grid">${pages.map(([key, page]) => `<section class="studio-page-tile"><strong>${escapeHtml(pageLabel(key, page))}</strong><small>${escapeHtml(statusLabel(page.status))}</small>${page.status === 'ready' ? `<button type="button" class="secondary-button" data-view-book="${escapeAttribute(book.id)}" data-view-page="${escapeAttribute(key)}">View page</button>` : `<button type="button" class="secondary-button" data-generate-book="${escapeAttribute(book.id)}" data-generate-page="${escapeAttribute(key)}" ${page.status === 'generating' || generating ? 'disabled' : ''}>${page.status === 'failed' ? 'Try again' : 'Make page'}</button>`}</section>`).join('')}</div></article>`;
}

function featureCards() {
  const features = [
    ['book', '▤', 'A book starring them', 'Turn favorite photos into a private, illustrated story.'],
    ['toy', '▧', 'New play, same toys', 'Photograph a toy and discover a fresh way to play.'],
    ['story', '✦', 'Little stories, big steps', 'Make a gentle story for a new routine or tricky moment.'],
    ['voice', '♫', 'Read in your voice', 'Bring story time close with a familiar family voice.'],
  ];
  return `<section class="studio-feature-section" aria-labelledby="studio-feature-title"><div><p class="eyebrow">Four ways to make something together</p><h2 id="studio-feature-title">What shall we create?</h2></div><div class="studio-feature-grid">${features.map(([id, icon, title, copy]) => `<button type="button" class="studio-feature-card studio-feature-${id}" data-studio-feature="${id}"><span aria-hidden="true">${icon}</span><strong>${title}</strong><small>${copy}</small><b>Open <span aria-hidden="true">→</span></b></button>`).join('')}</div></section>`;
}

function pictureBookChooser(state) {
  if (!state.showPictureBookChooser) return '';
  const templates = state.pictureBookTemplates || [];
  return `<div class="modal-backdrop studio-modal-backdrop" data-close-book-chooser><section class="modal-dialog studio-template-dialog" role="dialog" aria-modal="true" aria-labelledby="picture-book-choice-title"><div class="section-heading"><div><p class="eyebrow">A book starring them</p><h2 id="picture-book-choice-title">Choose a book template</h2><p class="muted">Pick a starting story now, or return to books you already made.</p></div><button type="button" class="icon-button" data-close-book-chooser aria-label="Close picture book choices">×</button></div>${state.pictureBookTemplatesLoading ? '<p class="muted">Loading templates…</p>' : `<div class="studio-template-grid">${templates.map((template) => `<button type="button" class="studio-template-option ${template.slug === state.pictureBookTemplateSlug ? 'selected' : ''}" data-book-template="${escapeAttribute(template.slug)}" aria-pressed="${template.slug === state.pictureBookTemplateSlug}"><span aria-hidden="true">${template.slug.includes('kindergarten') ? '🎒' : '🌈'}</span><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.description)}</small><b>${template.pageCount ? `${template.pageCount} pages` : 'Picture book'}</b></button>`).join('')}</div>`}<div class="studio-template-actions"><button type="button" data-start-picture-book ${templates.length ? '' : 'disabled'}>Use this template</button><button type="button" class="secondary-button" data-view-picture-books>View existing picture books${state.pictureBooks?.length ? ` (${state.pictureBooks.length})` : ''}</button></div></section></div>`;
}

function featureNotice(state) {
  if (!state.studioFeatureNotice) return '';
  const content = {
    toy: ['New play, same toys', 'This AI play maker will turn a toy photo into simple, age-aware games.'],
    story: ['Little stories, big steps', 'This story maker will help families prepare for routines and new experiences.'],
    voice: ['Read in your voice', 'This feature will pair reviewed stories with a private family recording.'],
  }[state.studioFeatureNotice];
  return `<div class="modal-backdrop studio-modal-backdrop" data-close-feature-notice><section class="modal-dialog studio-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-notice-title"><button type="button" class="icon-button studio-modal-close" data-close-feature-notice aria-label="Close">×</button><span class="studio-notice-icon" aria-hidden="true">✦</span><p class="eyebrow">Play Studio preview</p><h2 id="studio-notice-title">${escapeHtml(content?.[0] || 'Coming soon')}</h2><p>${escapeHtml(content?.[1] || '')}</p><button type="button" data-close-feature-notice>Got it</button></section></div>`;
}

function studioLanding(state, childName) {
  return `<main class="studio-page"><header class="studio-hero"><div><p class="eyebrow">A little imagination, made personal</p><h1>Play Studio</h1><p>Turn ${escapeHtml(childName)}’s favorite things into new ways to play, learn and grow together.</p></div><span class="studio-spark" aria-hidden="true">✦</span></header>${featureCards()}<section class="studio-trust"><span aria-hidden="true">♡</span><div><h3>Your ideas. A little AI help.</h3><p>You choose what to make and review it before sharing. Family photos and creations stay private to your account.</p></div></section>${pictureBookChooser(state)}${featureNotice(state)}</main>`;
}

function studioCreate(state, childName) {
  const templates = state.pictureBookTemplates || [];
  const selected = templates.find((template) => template.slug === state.pictureBookTemplateSlug) || templates[0];
  const options = templates.map((template) => `<option value="${escapeAttribute(template.slug)}" ${template.slug === selected?.slug ? 'selected' : ''}>${escapeHtml(template.name)}${template.pageCount ? ` · ${template.pageCount} pages` : ''}</option>`).join('');
  return `<main class="studio-page studio-subpage"><button type="button" class="studio-back" data-studio-view="landing">← Back to Play Studio</button><header class="studio-subpage-heading"><div><p class="eyebrow">A book starring them</p><h1>Start a picture book</h1><p>${escapeHtml(selected?.description || 'Choose a private picture-book template for your family.')}</p></div><button type="button" class="secondary-button" data-studio-view="library">View existing books</button></header><section class="studio-create"><div><span class="studio-create-icon" aria-hidden="true">${selected?.slug?.includes('kindergarten') ? '🎒' : '🌈'}</span><h2>${escapeHtml(selected?.name || 'Loading templates…')}</h2><p>Use 2–5 clear photos from different angles to help keep ${escapeHtml(childName)} recognizable across the story.</p></div><form id="picture-book-form" class="studio-form"><label>Picture-book template<select name="templateSlug" ${state.pictureBookTemplatesLoading ? 'disabled' : ''}>${options || '<option>Loading templates…</option>'}</select></label><label>Child’s name<input name="childName" maxlength="80" value="${escapeAttribute(childName)}" /></label><label>Reference photos<input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple required /><small>JPEG, PNG, WebP, or HEIC · 2–5 photos · up to 20 MB each · 90 MB combined · HEIC converts privately to JPEG</small></label><button type="submit" ${selected ? '' : 'disabled'}>Create private book <span aria-hidden="true">→</span></button></form></section>${state.pictureBookStatus ? `<p class="studio-message" role="status">${escapeHtml(state.pictureBookStatus)}</p>` : ''}</main>`;
}

function studioLibrary(state) {
  const books = state.pictureBooks || [];
  return `<main class="studio-page studio-subpage"><button type="button" class="studio-back" data-studio-view="landing">← Back to Play Studio</button><header class="studio-subpage-heading"><div><p class="eyebrow">Your family library</p><h1>Picture books</h1><p>Create every page in one action, revisit individual pages, or open a completed book as a PDF.</p></div><button type="button" data-open-book-chooser>+ New picture book</button></header>${state.pictureBookStatus ? `<p class="studio-message" role="status">${escapeHtml(state.pictureBookStatus)}</p>` : ''}${state.pictureBookPreviewUrl ? `<section class="studio-preview"><div><p class="eyebrow">${escapeHtml(state.pictureBookPreviewTitle)}</p><h2>Your private page</h2></div><button type="button" class="text-button" id="close-book-preview">Close</button><img src="${escapeAttribute(state.pictureBookPreviewUrl)}" alt="Generated ${escapeAttribute(state.pictureBookPreviewTitle)} picture-book page" /></section>` : ''}<section class="studio-library"><div class="studio-library-heading"><div><h2>All projects</h2><p class="muted">${books.length} ${books.length === 1 ? 'book' : 'books'}</p></div><button type="button" class="text-button" id="refresh-picture-books">Refresh</button></div>${state.pictureBooksLoading ? '<p class="muted">Loading your family library…</p>' : books.length ? `<div class="studio-book-list">${books.map((book) => bookCard(book, state)).join('')}</div>` : '<div class="studio-empty"><span aria-hidden="true">▦</span><div><strong>Your first book can start here.</strong><p>Choose a template and add 2–5 private reference photos.</p><button type="button" data-open-book-chooser>Create a picture book</button></div></div>'}</section>${pictureBookChooser(state)}</main>`;
}

export function resetStudioState(state) {
  if (state.pictureBookPreviewUrl) URL.revokeObjectURL(state.pictureBookPreviewUrl);
  state.pictureBooks = [];
  state.pictureBooksLoaded = false;
  state.pictureBooksLoading = false;
  state.pictureBookStatus = '';
  state.pictureBookPreviewUrl = '';
  state.pictureBookPreviewTitle = '';
  state.pictureBookTemplates = [];
  state.pictureBookTemplatesLoaded = false;
  state.pictureBookTemplatesLoading = false;
  state.pictureBookTemplateSlug = DEFAULT_TEMPLATE;
  state.pictureBookGeneratingBookId = '';
  state.showPictureBookChooser = false;
  state.studioFeatureNotice = '';
  state.studioView = 'landing';
}

export function renderStudio(ctx) {
  const { state } = ctx;
  const childName = childDisplayName(getChildProfile(state.user));
  const view = state.studioView || 'landing';
  ctx.layout(view === 'library' ? studioLibrary(state) : view === 'create' ? studioCreate(state, childName) : studioLanding(state, childName));

  document.querySelectorAll('[data-studio-view]').forEach((button) => button.addEventListener('click', () => {
    state.studioView = button.dataset.studioView;
    state.pictureBookStatus = '';
    globalThis.history.pushState({}, '', state.studioView === 'library' ? '/picture-books' : '/play-studio');
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-studio-feature]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.studioFeature === 'book') state.showPictureBookChooser = true;
    else state.studioFeatureNotice = button.dataset.studioFeature;
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-close-book-chooser]').forEach((button) => button.addEventListener('click', (event) => {
    if (event.currentTarget.classList.contains('studio-modal-backdrop') && event.target !== event.currentTarget) return;
    state.showPictureBookChooser = false;
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-close-feature-notice]').forEach((button) => button.addEventListener('click', (event) => {
    if (event.currentTarget.classList.contains('studio-modal-backdrop') && event.target !== event.currentTarget) return;
    state.studioFeatureNotice = '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-book-template]').forEach((button) => button.addEventListener('click', () => { state.pictureBookTemplateSlug = button.dataset.bookTemplate; ctx.renderCurrent(); }));
  document.querySelectorAll('[data-open-book-chooser]').forEach((button) => button.addEventListener('click', () => { state.showPictureBookChooser = true; ctx.renderCurrent(); }));
  document.querySelector('[data-start-picture-book]')?.addEventListener('click', () => { state.showPictureBookChooser = false; state.studioView = 'create'; globalThis.history.pushState({}, '', '/play-studio?create=picture-book'); ctx.renderCurrent(); });
  document.querySelector('[data-view-picture-books]')?.addEventListener('click', () => { state.showPictureBookChooser = false; state.studioView = 'library'; globalThis.history.pushState({}, '', '/picture-books'); ctx.renderCurrent(); });
  document.getElementById('picture-book-form')?.addEventListener('submit', (event) => { event.preventDefault(); createBook(ctx, event.currentTarget); });
  document.querySelector('[name="templateSlug"]')?.addEventListener('change', (event) => { state.pictureBookTemplateSlug = event.currentTarget.value; ctx.renderCurrent(); });
  document.getElementById('refresh-picture-books')?.addEventListener('click', () => loadBooks(ctx));
  document.getElementById('close-book-preview')?.addEventListener('click', () => { URL.revokeObjectURL(state.pictureBookPreviewUrl); state.pictureBookPreviewUrl = ''; state.pictureBookPreviewTitle = ''; ctx.renderCurrent(); });
  document.querySelectorAll('[data-generate-book]').forEach((button) => button.addEventListener('click', async () => {
    try { await generatePage(ctx, button.dataset.generateBook, button.dataset.generatePage); } catch (error) { state.pictureBookStatus = `Could not make this page: ${error.message}`; } ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-generate-whole-book]').forEach((button) => button.addEventListener('click', () => makeWholeBook(ctx, button.dataset.generateWholeBook)));
  document.querySelectorAll('[data-view-book]').forEach((button) => button.addEventListener('click', () => viewPage(ctx, button.dataset.viewBook, button.dataset.viewPage)));
  document.querySelectorAll('[data-view-pdf]').forEach((button) => button.addEventListener('click', () => viewPdf(ctx, button.dataset.viewPdf)));
  document.querySelectorAll('[data-delete-book]').forEach((button) => button.addEventListener('click', () => deleteBook(ctx, button.dataset.deleteBook)));

  if (!state.pictureBooksLoaded && !state.pictureBooksLoading) loadBooks(ctx);
  if (!state.pictureBookTemplatesLoaded && !state.pictureBookTemplatesLoading) loadTemplates(ctx);
}
