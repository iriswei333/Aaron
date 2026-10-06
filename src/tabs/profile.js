import { apiRequest, escapeAttribute, escapeHtml } from '../shared.js';
import { bindChatInteractions, ensureChatLoaded, renderChat } from './social.js';
import { STORY_LANGUAGE_OPTIONS, childAgeLabel, childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

function profilePlayDateTime(playDate) {
  const startsAt = new Date(playDate.startsAt);
  const endsAt = new Date(playDate.endsAt);
  if (Number.isNaN(startsAt.getTime())) return { date: 'Time not set', time: '' };
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = Number.isNaN(endsAt.getTime()) ? '' : ` – ${endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return { date, time: `${start}${end}` };
}

async function ensureFamilyAssetsLoaded(ctx) {
  const { state } = ctx;
  if (state.familyAssetsLoaded || state.familyAssetsLoading) return;
  state.familyAssetsLoading = true;
  try {
    const [bookResult, toyResult, storyResult] = await Promise.all([
      state.pictureBooksLoaded ? Promise.resolve({ books: state.pictureBooks || [] }) : apiRequest('/family-assets/picture-books'),
      state.toyPlayAssetsLoaded ? Promise.resolve({ assets: state.toyPlayAssets || [] }) : apiRequest('/family-assets/toy-plays'),
      state.practiceStoryAssetsLoaded ? Promise.resolve({ assets: state.practiceStoryAssets || [] }) : apiRequest('/family-assets/practice-stories'),
    ]);
    state.pictureBooks = bookResult.books || [];
    state.toyPlayAssets = toyResult.assets || [];
    state.practiceStoryAssets = storyResult.assets || [];
    state.pictureBooksLoaded = true;
    state.toyPlayAssetsLoaded = true;
    state.practiceStoryAssetsLoaded = true;
    state.familyAssetsLoaded = true;
    state.familyAssetsStatus = '';
  } catch (error) {
    state.familyAssetsLoaded = true;
    state.familyAssetsStatus = `Could not load family AI assets: ${error.message}`;
  }
  state.familyAssetsLoading = false;
  if (state.tab === 'profile') ctx.renderCurrent();
}

async function deleteFamilyAsset(ctx, kind, asset) {
  const { state } = ctx;
  const label = kind === 'toy' ? 'saved play idea' : 'practice story';
  if (!globalThis.confirm(`Delete “${asset.title || `this ${label}`}”? This permanently removes the ${label}${asset.hasCoverImage || kind === 'toy' ? ' and its generated image' : ''}.`)) return;
  state.deletingFamilyAssetId = asset.id;
  state.familyAssetsStatus = `Deleting ${label}…`;
  ctx.renderCurrent();
  try {
    const endpoint = kind === 'toy' ? '/family-assets/toy-plays' : '/family-assets/practice-stories';
    await apiRequest(`${endpoint}?assetId=${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
    if (kind === 'toy') {
      state.toyPlayAssets = (state.toyPlayAssets || []).filter((item) => item.id !== asset.id);
      state.selectedToyPlayAssetId = '';
    } else {
      state.practiceStoryAssets = (state.practiceStoryAssets || []).filter((item) => item.id !== asset.id);
      state.selectedPracticeStoryAssetId = '';
    }
    state.familyAssetsStatus = `${kind === 'toy' ? 'Play idea' : 'Practice story'} deleted.`;
  } catch (error) {
    state.familyAssetsStatus = `Could not delete the ${label}: ${error.message}`;
  }
  state.deletingFamilyAssetId = '';
  ctx.renderCurrent();
}

function practiceStoryDialog(asset, state) {
  if (!asset) return '';
  const story = asset.story || {};
  const deleting = state.deletingFamilyAssetId === asset.id;
  return `<div class="modal-backdrop family-story-backdrop" data-close-practice-story-dialog><section class="modal-dialog family-story-dialog" role="dialog" aria-modal="true" aria-labelledby="family-story-title"><button type="button" class="icon-button family-toy-play-close" data-close-practice-story-dialog aria-label="Close">×</button><header>${asset.coverUrl ? `<img src="${escapeAttribute(asset.coverUrl)}" alt="Illustration for ${escapeAttribute(asset.title)}" />` : '<span aria-hidden="true">✦</span>'}<div><p class="eyebrow">Little stories, big steps</p><h2 id="family-story-title">${escapeHtml(story.title || asset.title)}</h2><p>${escapeHtml(story.summary || '')}</p>${story.mission ? `<p class="practice-story-mission">${escapeHtml(story.mission)}</p>` : ''}<div class="family-toy-play-meta"><span>${escapeHtml(story.readAloudMinutes || 3)} minute read</span><span>${escapeHtml(asset.goal || story.goal || '')}</span></div></div></header><div class="family-story-scenes">${(story.scenes || []).map((scene, index) => `<article><span>${index + 1}</span><div><h3>${escapeHtml(scene.heading)}</h3><p>${escapeHtml(scene.storyText)}</p>${scene.sayTogether ? `<p class="practice-say-together">Say it together: “${escapeHtml(scene.sayTogether)}”</p>` : ''}<small>Practice together: ${escapeHtml(scene.practiceCue)}</small></div></article>`).join('')}</div><blockquote>${escapeHtml(story.celebration || '')}</blockquote>${story.reflectionQuestions?.length ? `<section class="family-story-tips"><h3>Talk about it</h3><ul>${story.reflectionQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}${story.caregiverTips?.length ? `<section class="family-story-tips"><h3>For the grown-up</h3><ul>${story.caregiverTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul></section>` : ''}${state.familyAssetsStatus && (deleting || state.familyAssetsStatus.startsWith('Could not delete')) ? `<p class="profile-setting-status" role="status">${escapeHtml(state.familyAssetsStatus)}</p>` : ''}<div class="family-asset-dialog-actions"><button type="button" class="secondary-button" data-close-practice-story-dialog ${deleting ? 'disabled' : ''}>Close</button><button type="button" class="danger-button" data-delete-practice-story="${escapeAttribute(asset.id)}" ${deleting ? 'disabled' : ''}>${deleting ? 'Deleting…' : 'Delete story'}</button></div></section></div>`;
}

function toyPlayDialog(asset, state) {
  if (!asset) return '';
  const mandarin = asset.language === 'zh-CN';
  const play = asset.play || {};
  const toy = asset.toy || {};
  const copy = mandarin ? {
    label: '普通话玩法', close: '关闭', identified: '识别到的玩具', duration: '分钟', age: '适合年龄', goals: '练习方向', materials: '需要准备', prompts: '可以这样说', steps: '一起玩', variations: '调整难度', easier: '更简单', harder: '增加挑战', safety: '家长安全检查', confidence: { high: '高可信度', medium: '中等可信度', low: '低可信度' },
  } : {
    label: 'Saved play idea', close: 'Close', identified: 'Identified toy', duration: 'minutes', age: 'Age', goals: 'Developmental goals', materials: 'What you need', prompts: 'Try saying', steps: 'Play together', variations: 'Make it easier or harder', easier: 'Easier', harder: 'More challenge', safety: 'Grown-up check', confidence: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
  };
  const deleting = state.deletingFamilyAssetId === asset.id;
  return `<div class="modal-backdrop family-toy-play-backdrop" data-close-toy-play-dialog><section class="modal-dialog family-toy-play-dialog" role="dialog" aria-modal="true" aria-labelledby="family-toy-play-title" lang="${mandarin ? 'zh-CN' : 'en'}"><button type="button" class="icon-button family-toy-play-close" data-close-toy-play-dialog aria-label="${copy.close}">×</button><header><p class="eyebrow">${copy.label}</p><h2 id="family-toy-play-title">${escapeHtml(play.title || asset.title || 'A new way to play')}</h2><p>${escapeHtml(play.summary || '')}</p><div class="family-toy-play-meta"><span>${escapeHtml(play.durationMinutes || 5)} ${copy.duration}</span><span>${copy.age} ${escapeHtml(play.ageRange || `${asset.childAgeMonths || ''} months`)}</span></div></header><section class="family-toy-play-toy"><span aria-hidden="true">▧</span><div><small>${copy.identified} · ${escapeHtml(copy.confidence[toy.confidence] || toy.confidence || '')}</small><strong>${escapeHtml(toy.name || 'Toy')}</strong><p>${escapeHtml(toy.description || '')}</p></div></section>${play.developmentalGoals?.length ? `<section><h3>${copy.goals}</h3><div class="family-toy-play-goals">${play.developmentalGoals.map((goal) => `<span>${escapeHtml(goal)}</span>`).join('')}</div></section>` : ''}<div class="family-toy-play-columns"><section><h3>${copy.materials}</h3><ul>${(play.materials || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h3>${copy.prompts}</h3><ul>${(play.parentPrompts || []).map((item) => `<li>“${escapeHtml(item)}”</li>`).join('')}</ul></section><section><h3>${copy.steps}</h3><ol>${(play.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section></div><details class="family-toy-play-variations"><summary>${copy.variations}</summary><p><strong>${copy.easier}：</strong> ${escapeHtml(play.easierVariation || '')}</p><p><strong>${copy.harder}：</strong> ${escapeHtml(play.harderVariation || '')}</p></details><section class="family-toy-play-safety"><strong>${copy.safety}</strong><p>${escapeHtml(play.supervision || '')}</p>${play.safetyNotes?.length ? `<ul>${play.safetyNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}</section>${state.familyAssetsStatus && (deleting || state.familyAssetsStatus.startsWith('Could not delete')) ? `<p class="profile-setting-status" role="status">${escapeHtml(state.familyAssetsStatus)}</p>` : ''}<div class="family-asset-dialog-actions"><button type="button" class="secondary-button" data-close-toy-play-dialog ${deleting ? 'disabled' : ''}>${copy.close}</button><button type="button" class="danger-button" data-delete-toy-play="${escapeAttribute(asset.id)}" ${deleting ? 'disabled' : ''}>${deleting ? (mandarin ? '正在删除…' : 'Deleting…') : (mandarin ? '删除玩法' : 'Delete play idea')}</button></div></section></div>`;
}

export function renderFamilyProfile(ctx) {
  const { state } = ctx;
  const active = getChildProfile(state.user);
  ensureChatLoaded(ctx);
  const profilePlayDates = (Array.isArray(state.profilePlayDates) ? state.profilePlayDates : [])
    .filter((playDate) => playDate?.isHost || playDate?.isJoined)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.startsAt).getTime();
      const bTime = new Date(b.startsAt).getTime();
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      return aTime - bTime;
    });
  const playdateListMarkup = profilePlayDates.length
    ? profilePlayDates.map((playDate) => {
      const timing = profilePlayDateTime(playDate);
      const isCancelled = playDate.status === 'cancelled';
      const role = playDate.isHost ? 'Created by you' : 'Joined playdate';
      const visibility = playDate.visibility === 'private' ? 'Private' : 'Public';
      const count = Number(playDate.participantCount) || 0;
      return `<article class="profile-playdate ${isCancelled ? 'cancelled' : ''}"><span class="profile-playdate-date"><strong>${escapeHtml(timing.date)}</strong><small>${escapeHtml(timing.time)}</small></span><div><strong>${escapeHtml(playDate.playgroundName || 'Playdate')}</strong><p>${escapeHtml(role)} · ${escapeHtml(isCancelled ? 'Cancelled' : visibility)} · ${count} ${count === 1 ? 'family' : 'families'}</p>${playDate.notes ? `<small>${escapeHtml(playDate.notes)}</small>` : ''}</div></article>`;
    }).join('')
    : '<p class="muted">Playdates you create or join will appear here.</p>';
  const pictureBooks = state.pictureBooks || [];
  const toyPlayAssets = state.toyPlayAssets || [];
  const practiceStoryAssets = state.practiceStoryAssets || [];
  const selectedToyPlay = toyPlayAssets.find((asset) => asset.id === state.selectedToyPlayAssetId);
  const selectedPracticeStory = practiceStoryAssets.find((asset) => asset.id === state.selectedPracticeStoryAssetId);
  const familyAssets = [
    ...pictureBooks.map((book) => ({ kind: 'book', item: book, createdAt: book.createdAt })),
    ...toyPlayAssets.map((asset) => ({ kind: 'toy', item: asset, createdAt: asset.createdAt })),
    ...practiceStoryAssets.map((asset) => ({ kind: 'story', item: asset, createdAt: asset.createdAt })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);
  const familyAssetMarkup = familyAssets.length
    ? `<div class="family-asset-list">${familyAssets.map(({ kind, item }) => {
      if (kind === 'story') return `<button type="button" class="family-asset-row family-story-asset" data-open-practice-story="${escapeAttribute(item.id)}"><span aria-hidden="true">✦</span><span><strong>${escapeHtml(item.title || 'A little story')}</strong><small>${escapeHtml(item.goal || 'Everyday practice')} · ${escapeHtml((item.interests || []).join(', '))}</small></span><em>Story →</em></button>`;
      if (kind === 'toy') return `<button type="button" class="family-asset-row family-toy-asset" data-open-toy-play="${escapeAttribute(item.id)}"><span aria-hidden="true">▧</span><span><strong>${escapeHtml(item.title || 'A new way to play')}</strong><small>${escapeHtml(item.toy?.name || 'Toy play')} · ${escapeHtml(item.play?.durationMinutes || 5)} minutes · Age ${escapeHtml(item.childAgeMonths || '')} months</small></span><em>${item.language === 'zh-CN' ? '普通话玩法' : 'Play idea'} →</em></button>`;
      const book = item;
      const pages = Object.values(book.pages || {});
      const ready = pages.filter((page) => page.status === 'ready').length;
      return `<button type="button" class="family-asset-row" data-open-picture-books><span aria-hidden="true">▤</span><span><strong>${escapeHtml(book.title || book.template?.name || 'Picture book')}</strong><small>${escapeHtml(book.childName || childDisplayName(active, 'Your child'))} · ${ready}/${pages.length} pages ready</small></span><b aria-hidden="true">→</b></button>`;
    }).join('')}</div>`
    : `<div class="family-assets-empty"><span aria-hidden="true">✦</span><div><strong>No AI creations yet</strong><p>Make a picture book or turn a familiar toy into a new game.</p></div></div>`;
  const storyLanguage = STORY_LANGUAGE_OPTIONS.find(([value]) => value === active.storyLanguage)?.[1] || 'English';
  const favorites = active.favoriteActivities || [];
  const practicingSteps = active.practicingSteps || [];
  const profileChips = (items, empty) => items.length
    ? `<div class="family-chip-list">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
    : `<p class="muted">${empty}</p>`;
  ctx.layout(`<main class="stack profile-screen family-screen">
    <header class="family-heading"><div><p class="eyebrow">Your family, your pace</p><h1>${escapeHtml(state.user?.displayName || 'Your family')}</h1><p>One private home for ${escapeHtml(childDisplayName(active, 'your child'))}’s profile, play plans, and family conversations.</p></div><button id="profile-edit-action" type="button" class="secondary-button">Edit family details</button></header>
    <section class="family-child-card panel"><div class="family-child-avatar">${escapeHtml((active.name || 'K').slice(0, 1).toUpperCase())}</div><div class="family-child-intro"><p class="eyebrow">Your little explorer</p><h2>${escapeHtml(childDisplayName(active, 'Add your kid'))}</h2><p>${escapeHtml(childAgeLabel(active) || 'Age not set')} · Stories in ${escapeHtml(storyLanguage)}</p></div><div class="family-child-grid"><div><small>Favorites</small>${profileChips(favorites, 'Add a few favorite things to personalize play and stories.')}</div><div><small>Practicing now</small>${profileChips(practicingSteps, 'Add a little step such as brushing teeth or meeting new friends.')}</div></div></section>
    <section class="panel family-chat-panel"><div class="section-heading"><div><p class="eyebrow">Family conversations</p><h2>Chats and playdate details</h2><p class="muted">Keep hellos, timing, and meetup notes beside the rest of your family plans.</p></div><span class="privacy-pill">${(state.chatContacts || []).length}</span></div>${renderChat(ctx)}${state.chatStatus ? `<p class="muted">${escapeHtml(state.chatStatus)}</p>` : ''}</section>
    <section class="grid two-cols family-assets-grid">
      <div class="panel"><div class="section-heading"><div><p class="eyebrow">Your playdates</p><h2>${profilePlayDates.length} ${profilePlayDates.length === 1 ? 'playdate' : 'playdates'}</h2></div></div><div class="profile-playdate-list">${playdateListMarkup}</div></div>
      <div class="panel family-assets-card"><div class="section-heading"><div><p class="eyebrow">Family AI assets</p><h2>AI creations</h2><p class="muted">Private picture books, practice stories, and saved ways to play.</p></div><span class="family-assets-count">${pictureBooks.length + toyPlayAssets.length + practiceStoryAssets.length}</span></div>${state.familyAssetsLoading ? '<p class="muted">Loading family assets…</p>' : familyAssetMarkup}${state.familyAssetsStatus ? `<p class="profile-setting-status" role="status">${escapeHtml(state.familyAssetsStatus)}</p>` : ''}<button type="button" class="secondary-button family-assets-action" data-open-family-assets>Open Play Studio <span aria-hidden="true">→</span></button></div>
    </section>
  </main>${toyPlayDialog(selectedToyPlay, state)}${practiceStoryDialog(selectedPracticeStory, state)}`);
  document.getElementById('profile-edit-action')?.addEventListener('click', () => {
    state.showProfileSetup = true;
    state.profileDraft = null;
    state.onboardingMeta = null;
    state.onboardingStep = 1;
    ctx.renderCurrent();
  });
  document.querySelectorAll('[data-open-family-assets]').forEach((button) => button.addEventListener('click', () => {
    state.tab = 'studio';
    state.studioView = 'landing';
    globalThis.history.pushState({}, '', '/play-studio');
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-open-picture-books]').forEach((button) => button.addEventListener('click', () => {
    state.tab = 'studio';
    state.studioView = 'library';
    globalThis.history.pushState({}, '', '/picture-books');
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-open-toy-play]').forEach((button) => button.addEventListener('click', () => {
    state.selectedToyPlayAssetId = button.dataset.openToyPlay;
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-open-practice-story]').forEach((button) => button.addEventListener('click', () => {
    state.selectedPracticeStoryAssetId = button.dataset.openPracticeStory;
    ctx.renderCurrent();
  }));
  document.querySelector('[data-delete-toy-play]')?.addEventListener('click', () => deleteFamilyAsset(ctx, 'toy', selectedToyPlay));
  document.querySelector('[data-delete-practice-story]')?.addEventListener('click', () => deleteFamilyAsset(ctx, 'story', selectedPracticeStory));
  document.querySelectorAll('[data-close-practice-story-dialog]').forEach((element) => element.addEventListener('click', (event) => {
    if (event.currentTarget.classList.contains('family-story-backdrop') && event.target !== event.currentTarget) return;
    state.selectedPracticeStoryAssetId = '';
    ctx.renderCurrent();
  }));
  document.querySelectorAll('[data-close-toy-play-dialog]').forEach((element) => element.addEventListener('click', (event) => {
    if (event.currentTarget.classList.contains('family-toy-play-backdrop') && event.target !== event.currentTarget) return;
    state.selectedToyPlayAssetId = '';
    ctx.renderCurrent();
  }));
  const toyPlayBackdrop = document.querySelector('.family-toy-play-backdrop');
  if (toyPlayBackdrop) {
    toyPlayBackdrop.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      state.selectedToyPlayAssetId = '';
      ctx.renderCurrent();
    });
    toyPlayBackdrop.querySelector('.family-toy-play-close')?.focus();
  }
  const storyBackdrop = document.querySelector('.family-story-backdrop');
  if (storyBackdrop) {
    storyBackdrop.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      state.selectedPracticeStoryAssetId = '';
      ctx.renderCurrent();
    });
    storyBackdrop.querySelector('.family-toy-play-close')?.focus();
  }
  bindChatInteractions(ctx);
  ensureFamilyAssetsLoaded(ctx);
}
