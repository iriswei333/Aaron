import { apiRequest, escapeAttribute, escapeHtml, readFirstStoredValue } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

const DEFAULT_TEMPLATE = 'career-recognition-v1';
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;

const FALLBACK_PRACTICE_TOPICS = [
  ['calm-with-caregiver', 'Settle with a caregiver', 0, 18], ['sleep-routine', 'Follow the bedtime routine', 0, 71],
  ['try-new-food', 'Explore a new food', 6, 71], ['car-seat', 'Get into the car seat', 6, 71],
  ['wash-hands', 'Wash hands', 12, 71], ['bath-shower', 'Take a bath or shower', 12, 71],
  ['brush-teeth', 'Brush teeth with a grown-up', 12, 71], ['get-dressed', 'Get dressed', 18, 71],
  ['clean-up', 'Put toys away', 18, 71], ['ask-for-help', 'Ask for help', 18, 71],
  ['potty-routine', 'Practice the potty routine', 24, 71], ['sleep-own-space', 'Sleep in my own bed or space', 24, 71],
  ['separation', 'Say goodbye at childcare or preschool', 24, 71], ['take-turns', 'Wait and take turns', 24, 71],
  ['transition', 'Move calmly to the next activity', 24, 71], ['doctor-dentist', 'Prepare for a doctor or dentist visit', 24, 71],
  ['feelings', 'Use words for big feelings', 24, 71], ['follow-routine', 'Follow a simple family routine', 24, 71],
].map(([id, label, minMonths, maxMonths]) => ({ id, label, minMonths, maxMonths }));

function resetPracticeStoryDraft(state, { close = false } = {}) {
  if (state.practiceStoryPhotoPreviewUrl) URL.revokeObjectURL(state.practiceStoryPhotoPreviewUrl);
  state.practiceStoryPhotoFile = null;
  state.practiceStoryPhotoPreviewUrl = '';
  state.practiceStorySelectedPhotoId = '';
  state.practiceStoryGenerating = false;
  state.practiceStoryStatus = '';
  state.practiceStoryResult = null;
  if (close) state.showPracticeStory = false;
}

async function loadPracticeStoryOptions(ctx) {
  const { state } = ctx;
  try {
    const [storyResult, photoResult] = await Promise.all([
      state.practiceStoryAssetsLoaded ? Promise.resolve({ assets: state.practiceStoryAssets, topics: state.practiceStoryTopics }) : apiRequest('/family-assets/practice-stories'),
      state.practiceStoryPhotosLoaded ? Promise.resolve({ photos: state.practiceStoryPhotos }) : apiRequest('/family-assets/photos'),
    ]);
    state.practiceStoryAssets = storyResult.assets || [];
    state.practiceStoryTopics = storyResult.topics || FALLBACK_PRACTICE_TOPICS;
    state.practiceStoryPhotos = photoResult.photos || [];
    state.practiceStoryAssetsLoaded = true;
    state.practiceStoryPhotosLoaded = true;
  } catch (error) {
    state.practiceStoryStatus = `Could not load story options: ${error.message}`;
  }
  if (state.showPracticeStory) ctx.renderCurrent();
}

async function generatePracticeStory(ctx, form) {
  const { state } = ctx;
  const goal = form.elements.goal.value.trim();
  const interests = form.elements.interests.value.trim();
  if (!goal || !interests) {
    state.practiceStoryStatus = 'Choose one goal and add at least one favorite thing.';
    ctx.renderCurrent();
    return;
  }
  const data = new FormData();
  data.set('goal', goal);
  data.set('interests', interests);
  data.set('language', state.practiceStoryLanguage === 'zh-CN' ? 'zh-CN' : 'en');
  if (state.practiceStorySelectedPhotoId) data.set('savedPhotoId', state.practiceStorySelectedPhotoId);
  else if (state.practiceStoryPhotoFile) data.set('photo', state.practiceStoryPhotoFile);
  state.practiceStoryGenerating = true;
  state.practiceStoryStatus = state.practiceStorySelectedPhotoId || state.practiceStoryPhotoFile ? 'Writing the story and illustrating the big step…' : 'Writing a gentle, age-matched story…';
  state.practiceStoryResult = null;
  ctx.renderCurrent();
  try {
    const response = await fetch('/api/family-assets/practice-stories', { method: 'POST', body: data, headers: localHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
    state.practiceStoryResult = result.asset;
    state.practiceStoryAssets = [result.asset, ...(state.practiceStoryAssets || []).filter((asset) => asset.id !== result.asset.id)];
    state.practiceStoryAssetsLoaded = true;
    state.familyAssetsLoaded = false;
    state.practiceStoryStatus = 'Story created and saved to Family AI Assets.';
  } catch (error) {
    state.practiceStoryStatus = `Could not create the story: ${error.message}`;
  }
  state.practiceStoryGenerating = false;
  ctx.renderCurrent();
}

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

async function generateToyPlay(ctx) {
  const { state } = ctx;
  const mandarin = state.toyPlayLanguage === 'zh-CN';
  if (!state.toyPlayPhotoFile) {
    state.toyPlayStatus = mandarin ? '请先选择一张清晰的玩具照片。' : 'Choose a clear photo of one toy first.';
    ctx.renderCurrent();
    return;
  }
  const data = new FormData();
  data.set('photo', state.toyPlayPhotoFile);
  data.set('language', state.toyPlayLanguage || 'en');
  state.toyPlayGenerating = true;
  state.toyPlayStatus = mandarin ? '正在识别玩具，并生成适合孩子年龄的玩法…' : 'Looking at the toy and making an age-matched play idea…';
  state.toyPlayAnalysis = null;
  state.toyPlaySaved = false;
  ctx.renderCurrent();
  try {
    const response = await fetch('/api/family-assets/toy-play/generate', { method: 'POST', body: data, headers: localHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
    state.toyPlayAnalysis = result.analysis;
    state.toyPlayLanguage = result.language || state.toyPlayLanguage || 'en';
    state.toyPlayModel = result.model || '';
    state.toyPlayResponseId = result.responseId || '';
    state.toyPlayStatus = result.analysis?.status === 'ready' ? (mandarin ? '新玩法已生成，请查看。' : 'Your new way to play is ready to review.') : result.analysis?.message || (mandarin ? '请换一张更清晰、只包含一个玩具的照片。' : 'Try a clearer photo of one toy.');
  } catch (error) {
    state.toyPlayStatus = mandarin ? `暂时无法生成玩法：${error.message}` : `Could not make a play idea: ${error.message}`;
  }
  state.toyPlayGenerating = false;
  ctx.renderCurrent();
}

async function saveToyPlay(ctx) {
  const { state } = ctx;
  const mandarin = state.toyPlayLanguage === 'zh-CN';
  if (!state.toyPlayPhotoFile || state.toyPlayAnalysis?.status !== 'ready') return;
  const data = new FormData();
  data.set('photo', state.toyPlayPhotoFile);
  data.set('analysis', JSON.stringify(state.toyPlayAnalysis));
  data.set('language', state.toyPlayLanguage || 'en');
  data.set('model', state.toyPlayModel || '');
  data.set('responseId', state.toyPlayResponseId || '');
  state.toyPlaySaving = true;
  state.toyPlayStatus = mandarin ? '正在保存到家庭 AI 作品…' : 'Saving this idea to Family AI Assets…';
  ctx.renderCurrent();
  try {
    const response = await fetch('/api/family-assets/toy-plays', { method: 'POST', body: data, headers: localHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);
    state.toyPlayAssets = [result.asset, ...(state.toyPlayAssets || []).filter((item) => item.id !== result.asset.id)];
    state.toyPlayAssetsLoaded = true;
    state.familyAssetsLoaded = false;
    state.toyPlaySaved = true;
    state.toyPlayStatus = mandarin ? '已保存到家庭 AI 作品。' : 'Saved to Family AI Assets.';
  } catch (error) {
    state.toyPlayStatus = mandarin ? `暂时无法保存这个玩法：${error.message}` : `Could not save this play idea: ${error.message}`;
  }
  state.toyPlaySaving = false;
  ctx.renderCurrent();
}

function resetToyPlayDraft(state) {
  if (state.toyPlayPhotoPreviewUrl) URL.revokeObjectURL(state.toyPlayPhotoPreviewUrl);
  state.toyPlayPhotoFile = null;
  state.toyPlayPhotoPreviewUrl = '';
  state.toyPlayAnalysis = null;
  state.toyPlayModel = '';
  state.toyPlayResponseId = '';
  state.toyPlayStatus = '';
  state.toyPlayGenerating = false;
  state.toyPlaySaving = false;
  state.toyPlaySaved = false;
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

function practiceStoryModal(state, childName, ageMonths, child) {
  if (!state.showPracticeStory) return '';
  const topics = (state.practiceStoryTopics?.length ? state.practiceStoryTopics : FALLBACK_PRACTICE_TOPICS)
    .filter((topic) => ageMonths >= topic.minMonths && ageMonths <= topic.maxMonths);
  const allTopics = state.practiceStoryTopics?.length ? state.practiceStoryTopics : FALLBACK_PRACTICE_TOPICS;
  const topicOptions = (topics.length ? topics : allTopics).map((topic) => `<option value="${escapeAttribute(topic.label)}"></option>`).join('');
  const suggestions = [...new Set([...(child?.favoriteActivities || []), 'cars', 'animals', 'trains', 'dinosaurs', 'music', 'space'])].slice(0, 8);
  const photos = state.practiceStoryPhotos || [];
  const result = state.practiceStoryResult;
  const selectedPhoto = photos.find((photo) => photo.id === state.practiceStorySelectedPhotoId);
  const photoChoice = state.practiceStoryPhotoPreviewUrl
    ? `<img src="${escapeAttribute(state.practiceStoryPhotoPreviewUrl)}" alt="New child photo preview" /><span>New photo selected</span>`
    : selectedPhoto
      ? `<img src="${escapeAttribute(selectedPhoto.contentUrl)}" alt="${escapeAttribute(selectedPhoto.label)}" /><span>${escapeHtml(selectedPhoto.label)}</span>`
      : '<span class="practice-photo-placeholder" aria-hidden="true">＋</span><span>Add a photo for an illustration</span>';
  const mandarin = state.practiceStoryLanguage === 'zh-CN';
  const languageChoice = `<fieldset class="practice-story-language"><legend>3 · Story language</legend><label><input type="radio" name="practiceStoryLanguage" value="en" ${mandarin ? '' : 'checked'} ${state.practiceStoryGenerating ? 'disabled' : ''} /><span><strong>English</strong><small>Generate the full story in English</small></span></label><label><input type="radio" name="practiceStoryLanguage" value="zh-CN" ${mandarin ? 'checked' : ''} ${state.practiceStoryGenerating ? 'disabled' : ''} /><span><strong>中文（普通话）</strong><small>生成简体中文故事</small></span></label></fieldset>`;
  const storyMarkup = result ? `<section class="practice-story-preview"><div class="practice-story-preview-heading">${result.coverUrl ? `<img src="${escapeAttribute(result.coverUrl)}" alt="Illustration for ${escapeAttribute(result.title)}" />` : '<span aria-hidden="true">✦</span>'}<div><p class="eyebrow">Saved to Family AI Assets</p><h2>${escapeHtml(result.story?.title || result.title)}</h2><p>${escapeHtml(result.story?.summary || '')}</p></div></div><div class="practice-story-scenes">${(result.story?.scenes || []).map((scene, index) => `<article><span>${index + 1}</span><div><h3>${escapeHtml(scene.heading)}</h3><p>${escapeHtml(scene.storyText)}</p><small>Try together: ${escapeHtml(scene.practiceCue)}</small></div></article>`).join('')}</div><blockquote>${escapeHtml(result.story?.celebration || '')}</blockquote><div class="practice-story-actions"><button type="button" class="secondary-button" data-new-practice-story>Make another story</button><button type="button" data-view-family-assets>View Family AI Assets →</button></div></section>` : '';
  return `<div class="modal-backdrop studio-modal-backdrop practice-story-backdrop" data-close-practice-story tabindex="-1"><section class="modal-dialog practice-story-dialog" role="dialog" aria-modal="true" aria-labelledby="practice-story-title"><button type="button" class="icon-button studio-modal-close" data-close-practice-story aria-label="Close story maker">×</button><header><p class="eyebrow">Little stories, big steps</p><h2 id="practice-story-title">A story made for ${escapeHtml(childName)}</h2><p>Choose one everyday goal, then add a few favorite things to turn practice into a familiar adventure.</p><span>${escapeHtml(String(ageMonths))} months · suggestions matched to age</span></header>${result ? storyMarkup : `<form id="practice-story-form" class="practice-story-form"><label class="practice-story-field"><span>1 · What are we practicing?</span><input name="goal" list="practice-story-goals" maxlength="120" required placeholder="e.g. Wash hands" value="${escapeAttribute(state.practiceStoryGoal || '')}" ${state.practiceStoryGenerating ? 'disabled' : ''} /><datalist id="practice-story-goals">${topicOptions}</datalist><small>Choose a suggestion or describe one clear, positive goal.</small></label><label class="practice-story-field"><span>2 · What does ${escapeHtml(childName)} love?</span><input name="interests" maxlength="300" required placeholder="e.g. cars, elephants, music" value="${escapeAttribute(state.practiceStoryInterests || '')}" ${state.practiceStoryGenerating ? 'disabled' : ''} /><small>Add up to five interests, separated by commas.</small></label><div class="practice-interest-chips">${suggestions.map((interest) => `<button type="button" data-add-story-interest="${escapeAttribute(interest)}" ${state.practiceStoryGenerating ? 'disabled' : ''}>+ ${escapeHtml(interest)}</button>`).join('')}</div>${languageChoice}<section class="practice-photo-section"><div><strong>4 · Add an illustration <em>Optional</em></strong><p>Use a new or saved photo to picture ${escapeHtml(childName)} completing the goal. The story works without one.</p></div><label class="practice-photo-upload" for="practice-story-photo">${photoChoice}<input id="practice-story-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" ${state.practiceStoryGenerating ? 'disabled' : ''} /></label>${state.practiceStoryPhotoFile || state.practiceStorySelectedPhotoId ? '<button type="button" class="text-button practice-photo-clear" data-clear-practice-photo>Use story without a photo</button>' : ''}${photos.length ? `<div class="practice-saved-photos"><span>Or choose a saved photo</span><div>${photos.slice(0, 8).map((photo) => `<button type="button" data-practice-photo-id="${escapeAttribute(photo.id)}" class="${photo.id === state.practiceStorySelectedPhotoId ? 'selected' : ''}" aria-pressed="${photo.id === state.practiceStorySelectedPhotoId}" ${state.practiceStoryGenerating ? 'disabled' : ''}><img src="${escapeAttribute(photo.contentUrl)}" alt="${escapeAttribute(photo.label)}" /><small>${escapeHtml(photo.label)}</small></button>`).join('')}</div></div>` : state.practiceStoryPhotosLoaded ? '<small class="muted">No saved photos yet. You can upload one above.</small>' : '<small class="muted">Loading saved photos…</small>'}</section><div class="practice-story-submit"><p><span aria-hidden="true">♡</span> Your story is private and will be saved to Family AI Assets.</p><button type="submit" ${state.practiceStoryGenerating ? 'disabled' : ''}>${state.practiceStoryGenerating ? (mandarin ? '正在生成故事…' : 'Creating the story…') : mandarin ? '生成普通话故事' : 'Create my story'} <span aria-hidden="true">→</span></button></div></form>`}${state.practiceStoryStatus ? `<p class="studio-message" role="status">${escapeHtml(state.practiceStoryStatus)}</p>` : ''}</section></div>`;
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

function studioLanding(state, childName, ageMonths, child) {
  return `<main class="studio-page"><header class="studio-hero"><div><p class="eyebrow">A little imagination, made personal</p><h1>Play Studio</h1><p>Turn ${escapeHtml(childName)}’s favorite things into new ways to play, learn and grow together.</p></div><span class="studio-spark" aria-hidden="true">✦</span></header>${featureCards()}<section class="studio-trust"><span aria-hidden="true">♡</span><div><h3>Your ideas. A little AI help.</h3><p>You choose what to make and review it before sharing. Family photos and creations stay private to your account.</p></div></section>${pictureBookChooser(state)}${practiceStoryModal(state, childName, ageMonths, child)}${featureNotice(state)}</main>`;
}

function studioToyPlay(state, childName, ageMonths) {
  const analysis = state.toyPlayAnalysis;
  const ready = analysis?.status === 'ready';
  const play = analysis?.play || {};
  const toy = analysis?.toy || {};
  const mandarin = state.toyPlayLanguage === 'zh-CN';
  const copy = mandarin ? {
    back: '返回 Play Studio', eyebrow: '旧玩具，新玩法', heading: '给我们看一个玩具，\n一起发现新玩法。', intro: `上传一张照片，获取适合 ${childName} 年龄的简单玩法。`, madeFor: `适合 ${childName} · ${ageMonths} 个月`, selected: '照片已选择，可以开始识别。', addPhoto: '添加一张玩具照片', photoTip: '请把一个玩具放在光线充足、背景清晰的平面上。', ready: '准备好发现一个新玩法了吗？', choose: '选择一张清晰的玩具照片', fileHelp: '支持 JPEG、PNG、WebP 或 HEIC，最大 20 MB。点击“生成玩法”后才会分析照片。', generating: '正在生成玩法…', generate: '生成普通话玩法', how: '使用方法', show: '展示一个玩具', showHelp: '我们只识别主要玩具，不识别人脸、品牌或地点。', match: '获取适龄玩法', matchHelp: `玩法会参考 ${childName} 保存的年龄：${ageMonths} 个月。`, review: '查看后保存', reviewHelp: '只有点击保存后，内容才会出现在家庭 AI 作品中。', retryTitle: '请换一张照片试试', retryMessage: '我们无法确认照片中有一个清晰的玩具。', chooseAnother: '选择其他照片', identified: '已识别玩具', confidence: { high: '高', medium: '中', low: '低' }, idea: '分钟玩法', need: '需要准备', say: '可以这样说', together: '一起玩', variations: '调整难度', easier: '更简单', harder: '增加挑战', safety: '家长安全检查', saving: '正在保存…', saved: '已保存到家庭 AI 作品 ✓', save: '保存到家庭 AI 作品', anotherToy: '换一个玩具', viewAssets: '查看家庭 AI 作品 →', privacy: '预览不会自动保存到家庭 AI 作品。请先检查玩具，并在玩耍时全程陪伴。',
  } : {
    back: 'Back to Play Studio', eyebrow: 'New play, same toys', heading: 'Show us a toy.\nWe’ll spark a new game.', intro: `Upload one photo and get a simple play idea matched to ${childName}’s age.`, madeFor: `Made for ${childName} · ${ageMonths} months`, selected: 'Photo selected and ready to analyze.', addPhoto: 'Add one toy photo', photoTip: 'Place the toy on a clear surface in good light.', ready: 'Ready to discover a new way to play?', choose: 'Choose a clear toy photo', fileHelp: 'JPEG, PNG, WebP, or HEIC · up to 20 MB. Photos are analyzed only when you tap Make a play idea.', generating: 'Making your play idea…', generate: 'Make a play idea', how: 'How it works', show: 'Show one toy', showHelp: 'We look only for the main toy—not people, brands, or places.', match: 'Get an age-matched idea', matchHelp: `The plan uses ${childName}’s saved age of ${ageMonths} months.`, review: 'Review, then save', reviewHelp: 'Nothing appears in Family AI Assets until you choose Save.', retryTitle: 'Let’s try another photo', retryMessage: 'We could not confidently identify one toy in this photo.', chooseAnother: 'Choose another photo', identified: 'Toy identified', confidence: { high: 'high', medium: 'medium', low: 'low' }, idea: 'minute play idea', need: 'What you need', say: 'Try saying', together: 'Play together', variations: 'Make it easier or harder', easier: 'Easier', harder: 'More challenge', safety: 'Grown-up check', saving: 'Saving…', saved: 'Saved to Family Assets ✓', save: 'Save to Family Assets', anotherToy: 'Try another toy', viewAssets: 'View Family Assets →', privacy: 'Your preview is not added to Family AI Assets until you save it. Always inspect the toy and supervise play.',
  };
  const photo = state.toyPlayPhotoPreviewUrl
    ? `<img src="${escapeAttribute(state.toyPlayPhotoPreviewUrl)}" alt="${mandarin ? '已选择的玩具照片' : 'Selected toy preview'}" />`
    : state.toyPlayPhotoFile
      ? `<span aria-hidden="true">✓</span><strong>${escapeHtml(state.toyPlayPhotoFile.name)}</strong><small>${copy.selected}</small>`
      : `<span aria-hidden="true">▧</span><strong>${copy.addPhoto}</strong><small>${copy.photoTip}</small>`;
  const languageChoice = `<fieldset class="toy-play-language"><legend>Play idea language · 玩法语言</legend><label><input type="radio" name="toyPlayLanguage" value="en" ${mandarin ? '' : 'checked'} ${state.toyPlayGenerating ? 'disabled' : ''} /><span><strong>English</strong><small>Generate in English</small></span></label><label><input type="radio" name="toyPlayLanguage" value="zh-CN" ${mandarin ? 'checked' : ''} ${state.toyPlayGenerating ? 'disabled' : ''} /><span><strong>中文（普通话）</strong><small>生成简体中文玩法</small></span></label></fieldset>`;
  const result = !analysis
    ? `<section class="toy-play-how"><p class="eyebrow">${copy.how}</p><div><span>1</span><p><strong>${copy.show}</strong><small>${copy.showHelp}</small></p></div><div><span>2</span><p><strong>${copy.match}</strong><small>${escapeHtml(copy.matchHelp)}</small></p></div><div><span>3</span><p><strong>${copy.review}</strong><small>${copy.reviewHelp}</small></p></div></section>`
    : !ready
      ? `<section class="toy-play-result toy-play-no-result"><span aria-hidden="true">⌕</span><h2>${copy.retryTitle}</h2><p>${escapeHtml(analysis.message || copy.retryMessage)}</p><button type="button" class="secondary-button" data-reset-toy-play>${copy.chooseAnother}</button></section>`
      : `<section class="toy-play-result"><div class="toy-play-recognition"><span aria-hidden="true">✓</span><div><p class="eyebrow">${copy.identified} · ${escapeHtml(copy.confidence[toy.confidence] || toy.confidence)}</p><h2>${escapeHtml(toy.name)}</h2><p>${escapeHtml(toy.description)}</p></div></div><article class="toy-play-plan"><div class="toy-play-plan-heading"><div><p class="eyebrow">${escapeHtml(play.durationMinutes)} ${copy.idea} · ${escapeHtml(play.ageRange)}</p><h2>${escapeHtml(play.title)}</h2><p>${escapeHtml(play.summary)}</p></div><span aria-hidden="true">✦</span></div>${play.developmentalGoals?.length ? `<div class="toy-play-goals">${play.developmentalGoals.map((goal) => `<span>${escapeHtml(goal)}</span>`).join('')}</div>` : ''}<div class="toy-play-plan-grid"><div><h3>${copy.need}</h3><ul>${(play.materials || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h3>${copy.say}</h3><ul>${(play.parentPrompts || []).map((item) => `<li>“${escapeHtml(item)}”</li>`).join('')}</ul></div><div><h3>${copy.together}</h3><ol>${(play.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div></div><details class="toy-play-variations"><summary>${copy.variations}</summary><p><strong>${copy.easier}：</strong> ${escapeHtml(play.easierVariation)}</p><p><strong>${copy.harder}：</strong> ${escapeHtml(play.harderVariation)}</p></details><div class="toy-play-safety"><strong>${copy.safety}</strong><p>${escapeHtml(play.supervision)}</p>${play.safetyNotes?.length ? `<ul>${play.safetyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}</div><div class="toy-play-actions"><button type="button" data-save-toy-play ${state.toyPlaySaving || state.toyPlaySaved ? 'disabled' : ''}>${state.toyPlaySaving ? copy.saving : state.toyPlaySaved ? copy.saved : copy.save}</button><button type="button" class="secondary-button" data-reset-toy-play>${copy.anotherToy}</button>${state.toyPlaySaved ? `<button type="button" class="text-button" data-view-family-assets>${copy.viewAssets}</button>` : ''}</div></article></section>`;
  return `<main class="studio-page studio-subpage toy-play-page" lang="${mandarin ? 'zh-CN' : 'en'}"><button type="button" class="studio-back" data-studio-view="landing">← ${copy.back}</button><header class="studio-subpage-heading"><div><p class="eyebrow">${copy.eyebrow}</p><h1>${copy.heading.split('\n').map(escapeHtml).join('<br />')}</h1><p>${escapeHtml(copy.intro)}</p></div><span class="toy-play-age">${escapeHtml(copy.madeFor)}</span></header><section class="toy-play-workspace"><form id="toy-play-form" class="toy-play-upload"><label class="toy-photo-picker" for="toy-play-photo">${photo}<input id="toy-play-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" /></label><div class="toy-play-upload-copy"><h2>${state.toyPlayPhotoFile ? copy.ready : copy.choose}</h2><p>${copy.fileHelp}</p>${languageChoice}</div><button type="submit" ${!state.toyPlayPhotoFile || state.toyPlayGenerating ? 'disabled' : ''}>${state.toyPlayGenerating ? copy.generating : copy.generate} <span aria-hidden="true">→</span></button></form>${state.toyPlayStatus ? `<p class="studio-message" role="status">${escapeHtml(state.toyPlayStatus)}</p>` : ''}${result}</section><p class="toy-play-privacy"><span aria-hidden="true">♡</span> ${copy.privacy}</p></main>`;
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
  resetToyPlayDraft(state);
  state.pictureBooks = [];
  state.pictureBooksLoaded = false;
  state.pictureBooksLoading = false;
  state.pictureBookStatus = '';
  state.pictureBookPreviewUrl = '';
  state.pictureBookPreviewTitle = '';
  state.familyAssetsStatus = '';
  state.familyAssetsLoaded = false;
  state.familyAssetsLoading = false;
  state.pictureBookTemplates = [];
  state.pictureBookTemplatesLoaded = false;
  state.pictureBookTemplatesLoading = false;
  state.pictureBookTemplateSlug = DEFAULT_TEMPLATE;
  state.pictureBookGeneratingBookId = '';
  state.toyPlayAssets = [];
  state.toyPlayAssetsLoaded = false;
  state.toyPlayAssetsLoading = false;
  state.selectedToyPlayAssetId = '';
  state.practiceStoryAssets = [];
  state.practiceStoryAssetsLoaded = false;
  state.practiceStoryTopics = [];
  state.practiceStoryPhotos = [];
  state.practiceStoryPhotosLoaded = false;
  state.practiceStoryGoal = '';
  state.practiceStoryInterests = '';
  state.practiceStoryLanguage = 'en';
  state.selectedPracticeStoryAssetId = '';
  resetPracticeStoryDraft(state, { close: true });
  state.toyPlayLanguage = 'en';
  state.showPictureBookChooser = false;
  state.studioFeatureNotice = '';
  state.studioView = 'landing';
}

export function renderStudio(ctx) {
  const { state } = ctx;
  const child = getChildProfile(state.user);
  const childName = childDisplayName(child);
  const ageMonths = Number(child?.ageMonths) || 30;
  const view = state.studioView || 'landing';
  ctx.layout(view === 'library' ? studioLibrary(state) : view === 'create' ? studioCreate(state, childName) : view === 'toy' ? studioToyPlay(state, childName, ageMonths) : studioLanding(state, childName, ageMonths, child));

  document.querySelectorAll('[data-studio-view]').forEach((button) => button.addEventListener('click', () => {
    if (state.studioView === 'toy' && button.dataset.studioView !== 'toy') resetToyPlayDraft(state);
    state.studioView = button.dataset.studioView;
    state.pictureBookStatus = '';
    globalThis.history.pushState({}, '', state.studioView === 'library' ? '/picture-books' : '/play-studio');
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-studio-feature]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.studioFeature === 'book') state.showPictureBookChooser = true;
    else if (button.dataset.studioFeature === 'toy') {
      state.studioView = 'toy';
      state.studioFeatureNotice = '';
      globalThis.history.pushState({}, '', '/play-studio?create=toy-play');
    }
    else if (button.dataset.studioFeature === 'story') {
      state.showPracticeStory = true;
      state.studioFeatureNotice = '';
      if (!state.practiceStoryGoal) state.practiceStoryGoal = child?.practicingSteps?.[0] || '';
      if (!state.practiceStoryInterests) state.practiceStoryInterests = (child?.favoriteActivities || []).slice(0, 3).join(', ');
      if (!state.practiceStoryResult) state.practiceStoryLanguage = child?.storyLanguage === 'zh-CN' ? 'zh-CN' : 'en';
      loadPracticeStoryOptions(ctx);
    }
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
  document.querySelectorAll('[data-close-practice-story]').forEach((button) => button.addEventListener('click', (event) => {
    if (event.currentTarget.classList.contains('practice-story-backdrop') && event.target !== event.currentTarget) return;
    resetPracticeStoryDraft(state, { close: true });
    ctx.renderCurrent();
  }));
  document.querySelector('[name="goal"]')?.addEventListener('input', (event) => { state.practiceStoryGoal = event.currentTarget.value; });
  document.querySelector('[name="interests"]')?.addEventListener('input', (event) => { state.practiceStoryInterests = event.currentTarget.value; });
  document.querySelectorAll('[name="practiceStoryLanguage"]').forEach((input) => input.addEventListener('change', (event) => {
    state.practiceStoryLanguage = event.currentTarget.value === 'zh-CN' ? 'zh-CN' : 'en';
    state.practiceStoryStatus = '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-add-story-interest]').forEach((button) => button.addEventListener('click', () => {
    const interests = state.practiceStoryInterests.split(',').map((item) => item.trim()).filter(Boolean);
    if (!interests.some((item) => item.toLowerCase() === button.dataset.addStoryInterest.toLowerCase()) && interests.length < 5) interests.push(button.dataset.addStoryInterest);
    state.practiceStoryInterests = interests.join(', ');
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-practice-photo-id]').forEach((button) => button.addEventListener('click', () => {
    if (state.practiceStoryPhotoPreviewUrl) URL.revokeObjectURL(state.practiceStoryPhotoPreviewUrl);
    state.practiceStoryPhotoPreviewUrl = '';
    state.practiceStoryPhotoFile = null;
    state.practiceStorySelectedPhotoId = state.practiceStorySelectedPhotoId === button.dataset.practicePhotoId ? '' : button.dataset.practicePhotoId;
    ctx.renderCurrent();
  }));
  document.querySelector('[data-clear-practice-photo]')?.addEventListener('click', () => {
    if (state.practiceStoryPhotoPreviewUrl) URL.revokeObjectURL(state.practiceStoryPhotoPreviewUrl);
    state.practiceStoryPhotoPreviewUrl = '';
    state.practiceStoryPhotoFile = null;
    state.practiceStorySelectedPhotoId = '';
    ctx.renderCurrent();
  });
  document.getElementById('practice-story-photo')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { state.practiceStoryStatus = 'Choose a photo that is 20 MB or smaller.'; ctx.renderCurrent(); return; }
    if (state.practiceStoryPhotoPreviewUrl) URL.revokeObjectURL(state.practiceStoryPhotoPreviewUrl);
    state.practiceStoryPhotoFile = file;
    state.practiceStoryPhotoPreviewUrl = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? URL.createObjectURL(file) : '';
    state.practiceStorySelectedPhotoId = '';
    ctx.renderCurrent();
  });
  document.getElementById('practice-story-form')?.addEventListener('submit', (event) => { event.preventDefault(); generatePracticeStory(ctx, event.currentTarget); });
  document.querySelector('[data-new-practice-story]')?.addEventListener('click', () => { resetPracticeStoryDraft(state); ctx.renderCurrent(); });
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
  document.getElementById('toy-play-photo')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      state.toyPlayStatus = 'Choose a photo that is 20 MB or smaller.';
      ctx.renderCurrent();
      return;
    }
    if (state.toyPlayPhotoPreviewUrl) URL.revokeObjectURL(state.toyPlayPhotoPreviewUrl);
    state.toyPlayPhotoFile = file;
    state.toyPlayPhotoPreviewUrl = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? URL.createObjectURL(file) : '';
    state.toyPlayAnalysis = null;
    state.toyPlayStatus = '';
    state.toyPlaySaved = false;
    ctx.renderCurrent();
  });
  document.getElementById('toy-play-form')?.addEventListener('submit', (event) => { event.preventDefault(); generateToyPlay(ctx); });
  document.querySelectorAll('[name="toyPlayLanguage"]').forEach((input) => input.addEventListener('change', (event) => {
    state.toyPlayLanguage = event.currentTarget.value === 'zh-CN' ? 'zh-CN' : 'en';
    state.toyPlayAnalysis = null;
    state.toyPlayModel = '';
    state.toyPlayResponseId = '';
    state.toyPlayStatus = '';
    state.toyPlaySaved = false;
    ctx.renderCurrent();
  }));
  document.querySelector('[data-save-toy-play]')?.addEventListener('click', () => saveToyPlay(ctx));
  document.querySelectorAll('[data-reset-toy-play]').forEach((button) => button.addEventListener('click', () => { resetToyPlayDraft(state); ctx.renderCurrent(); }));
  document.querySelector('[data-view-family-assets]')?.addEventListener('click', () => {
    if (state.showPracticeStory) resetPracticeStoryDraft(state, { close: true });
    state.tab = 'profile';
    globalThis.history.pushState({}, '', '/family');
    ctx.renderCurrent();
  });

  const practiceBackdrop = document.querySelector('.practice-story-backdrop');
  if (practiceBackdrop) {
    practiceBackdrop.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      resetPracticeStoryDraft(state, { close: true });
      ctx.renderCurrent();
    });
    practiceBackdrop.querySelector('.studio-modal-close')?.focus();
  }

  if (!state.pictureBooksLoaded && !state.pictureBooksLoading) loadBooks(ctx);
  if (!state.pictureBookTemplatesLoaded && !state.pictureBookTemplatesLoading) loadTemplates(ctx);
}
