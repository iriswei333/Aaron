import { apiRequest, escapeAttribute, escapeHtml, readFirstStoredValue } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

const CAREER_TEMPLATE = 'career-recognition-v1';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;

function statusLabel(status) {
  return ({ pending: 'Ready to create', generating: 'Making this page…', ready: 'Ready to view', failed: 'Try again', draft: 'Draft', archived: 'Archived' })[status] || 'Ready to create';
}

function pageLabel(pageKey) {
  return ({ cover: 'Cover', doctor: 'Doctor', firefighter: 'Firefighter', 'police-officer': 'Police officer', astronaut: 'Astronaut', chef: 'Chef', teacher: 'Teacher', pilot: 'Pilot', scientist: 'Scientist', 'race-car-driver': 'Race car driver' })[pageKey] || pageKey;
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
    state.pictureBookStatus = 'Each reference photo must be 10 MB or smaller.';
    ctx.renderCurrent();
    return;
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
    state.pictureBookStatus = 'Your selected photos are over the 50 MB combined limit. Choose smaller photos or fewer photos.';
    ctx.renderCurrent();
    return;
  }
  const data = new FormData();
  data.set('childName', form.elements.childName.value.trim());
  data.set('templateSlug', CAREER_TEMPLATE);
  photos.forEach((photo) => data.append('photos', photo));
  state.pictureBookStatus = 'Saving the private reference photos…';
  ctx.renderCurrent();
  try {
    const localUserId = readFirstStoredValue(['sproutCueUserId', 'aaronUserId'], '');
    const response = await fetch('/api/family-assets/picture-books', {
      method: 'POST', body: data, headers: localUserId ? { 'x-sproutcue-local-user-id': localUserId } : {},
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
    state.pictureBookStatus = 'Book created. Choose a page below to start making it.';
    state.pictureBooks = [result.book, ...state.pictureBooks];
    state.pictureBooksLoaded = true;
  } catch (error) {
    state.pictureBookStatus = `Could not create the book: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function generatePage(ctx, bookId, pageKey) {
  const { state } = ctx;
  state.pictureBookStatus = `Making ${pageLabel(pageKey).toLowerCase()}… this can take a moment.`;
  ctx.renderCurrent();
  try {
    const { book } = await apiRequest(`/family-assets/picture-books/${encodeURIComponent(bookId)}/pages/${encodeURIComponent(pageKey)}`, { method: 'POST', body: '{}' });
    state.pictureBooks = state.pictureBooks.map((item) => item.id === book.id ? book : item);
    state.pictureBookStatus = `${pageLabel(pageKey)} is ready.`;
  } catch (error) {
    state.pictureBookStatus = `Could not make this page: ${error.message}`;
  }
  ctx.renderCurrent();
}

async function viewPage(ctx, bookId, pageKey) {
  const { state } = ctx;
  state.pictureBookStatus = 'Opening your private page…';
  ctx.renderCurrent();
  try {
    const localUserId = readFirstStoredValue(['sproutCueUserId', 'aaronUserId'], '');
    const response = await fetch(`/api/family-assets/picture-books/${encodeURIComponent(bookId)}/assets/${encodeURIComponent(pageKey)}`, {
      headers: localUserId ? { 'x-sproutcue-local-user-id': localUserId } : {},
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Request failed with ${response.status}`);
    }
    if (state.pictureBookPreviewUrl) URL.revokeObjectURL(state.pictureBookPreviewUrl);
    state.pictureBookPreviewUrl = URL.createObjectURL(await response.blob());
    state.pictureBookPreviewTitle = pageLabel(pageKey);
    state.pictureBookStatus = '';
  } catch (error) {
    state.pictureBookStatus = `Could not open this page: ${error.message}`;
  }
  ctx.renderCurrent();
}

function bookCard(book) {
  const pages = Object.entries(book.pages || {}).sort(([, a], [, b]) => a.pageOrder - b.pageOrder);
  return `<article class="studio-book-card"><div class="studio-book-heading"><div><p class="eyebrow">${escapeHtml(book.template?.slug || CAREER_TEMPLATE)}</p><h2>${escapeHtml(book.title || 'My First Jobs')}</h2><p>${escapeHtml(book.childName || 'Your child')} · ${pages.filter(([, page]) => page.status === 'ready').length}/${pages.length} pages ready</p></div><span class="studio-status ${escapeAttribute(book.status || 'draft')}">${escapeHtml(statusLabel(book.status))}</span></div><div class="studio-page-grid">${pages.map(([key, page]) => `<section class="studio-page"><strong>${escapeHtml(pageLabel(key))}</strong><small>${escapeHtml(statusLabel(page.status))}</small>${page.status === 'ready' ? `<button type="button" class="secondary-button" data-view-book="${escapeAttribute(book.id)}" data-view-page="${escapeAttribute(key)}">View page</button>` : `<button type="button" class="secondary-button" data-generate-book="${escapeAttribute(book.id)}" data-generate-page="${escapeAttribute(key)}" ${page.status === 'generating' ? 'disabled' : ''}>${page.status === 'failed' ? 'Try again' : 'Make page'}</button>`}</section>`).join('')}</div></article>`;
}

export function resetStudioState(state) {
  if (state.pictureBookPreviewUrl) URL.revokeObjectURL(state.pictureBookPreviewUrl);
  state.pictureBooks = [];
  state.pictureBooksLoaded = false;
  state.pictureBooksLoading = false;
  state.pictureBookStatus = '';
  state.pictureBookPreviewUrl = '';
  state.pictureBookPreviewTitle = '';
}

export function renderStudio(ctx) {
  const { state } = ctx;
  const childName = childDisplayName(getChildProfile(state.user));
  const books = state.pictureBooks || [];
  ctx.layout(`<main class="studio-page"><header class="studio-hero"><div><p class="eyebrow">A little imagination, made personal</p><h1>Play Studio</h1><p>Make a private bilingual career book starring ${escapeHtml(childName)}. The template keeps every career’s expression and camera angle distinct.</p></div><span class="studio-spark" aria-hidden="true">✦</span></header><section class="studio-create"><div><p class="eyebrow">My First Jobs</p><h2>Create a career picture book</h2><p>Choose 2–5 recent photos. You will create the cover and each career page one at a time, so every page can be reviewed before you continue.</p></div><form id="picture-book-form" class="studio-form"><label>Child’s name<input name="childName" maxlength="80" value="${escapeAttribute(childName)}" /></label><label>Reference photos<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required /><small>JPEG, PNG, or WebP · up to 10 MB each · 50 MB combined</small></label><button type="submit">Create private book <span aria-hidden="true">→</span></button></form></section>${state.pictureBookStatus ? `<p class="studio-message" role="status">${escapeHtml(state.pictureBookStatus)}</p>` : ''}${state.pictureBookPreviewUrl ? `<section class="studio-preview"><div><p class="eyebrow">${escapeHtml(state.pictureBookPreviewTitle)}</p><h2>Your private page</h2></div><button type="button" class="text-button" id="close-book-preview">Close</button><img src="${escapeAttribute(state.pictureBookPreviewUrl)}" alt="Generated ${escapeAttribute(state.pictureBookPreviewTitle)} picture-book page" /></section>` : ''}<section class="studio-library"><div class="studio-library-heading"><div><p class="eyebrow">Your family library</p><h2>Picture books</h2></div><button type="button" class="text-button" id="refresh-picture-books">Refresh</button></div>${state.pictureBooksLoading ? '<p class="muted">Loading your family library…</p>' : books.length ? `<div class="studio-book-list">${books.map(bookCard).join('')}</div>` : '<div class="studio-empty"><span aria-hidden="true">▦</span><div><strong>Your first book can start here.</strong><p>Reference photos stay private to your family profile.</p></div></div>'}</section></main>`);
  document.getElementById('picture-book-form')?.addEventListener('submit', (event) => { event.preventDefault(); createBook(ctx, event.currentTarget); });
  document.getElementById('refresh-picture-books')?.addEventListener('click', () => loadBooks(ctx));
  document.getElementById('close-book-preview')?.addEventListener('click', () => { URL.revokeObjectURL(state.pictureBookPreviewUrl); state.pictureBookPreviewUrl = ''; state.pictureBookPreviewTitle = ''; ctx.renderCurrent(); });
  document.querySelectorAll('[data-generate-book]').forEach((button) => button.addEventListener('click', () => generatePage(ctx, button.dataset.generateBook, button.dataset.generatePage)));
  document.querySelectorAll('[data-view-book]').forEach((button) => button.addEventListener('click', () => viewPage(ctx, button.dataset.viewBook, button.dataset.viewPage)));
  if (!state.pictureBooksLoaded && !state.pictureBooksLoading) loadBooks(ctx);
}
