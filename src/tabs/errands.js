import { downloadCalendar, escapeAttribute, escapeHtml, icon } from '../shared.js';

export const defaultAmazonTasks = [
  { title: 'Amazon monthly subscribe-and-save: diapers and wipes on the 1st at 8:00 AM.', source: 'amazon', status: 'planned' },
  { title: 'Order status check: every Friday at 4:00 PM until delivered.', source: 'amazon', status: 'planned' },
  { title: 'Low-stock alert: when fewer than 20 diapers or one unopened wipe pack remains.', source: 'amazon', status: 'planned' },
];

export const defaultOutfitIdeas = [
  {
    item: 'Waterproof toddler sneakers',
    reason: 'Seattle drizzle + playground traction',
    source: 'Promotion email keyword: toddler shoes, waterproof, 20% off',
    linkLabel: 'Shop toddler waterproof shoes',
    href: 'https://www.amazon.com/s?k=toddler+waterproof+sneakers',
    photoUrl: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=600&q=80',
  },
  {
    item: 'Layered fleece hoodie',
    reason: 'Warm stroller layer for 3-6 PM outings',
    source: 'Promotion email keyword: fleece, outerwear, seasonal sale',
    linkLabel: 'Shop toddler fleece hoodies',
    href: 'https://www.target.com/s?searchTerm=toddler+fleece+hoodie',
    photoUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=600&q=80',
  },
  {
    item: 'Soft jogger set',
    reason: 'Easy diaper changes and indoor-play comfort',
    source: 'Promotion email keyword: toddler set, bundle, clearance',
    linkLabel: 'Shop toddler jogger sets',
    href: 'https://www.carters.com/search?q=toddler%20jogger%20set',
    photoUrl: 'https://images.unsplash.com/photo-1525171254930-643fc658b64e?auto=format&fit=crop&w=600&q=80',
  },
];

function normalizeTask(task) {
  return typeof task === 'string' ? { title: task, source: 'amazon', status: 'planned' } : task;
}

export function applyErrandsProfile(state, user) {
  state.amazonTasks = Array.isArray(user.amazonErrands?.tasks) && user.amazonErrands.tasks.length > 0
    ? user.amazonErrands.tasks.map(normalizeTask)
    : defaultAmazonTasks.map((task) => ({ ...task }));
  state.outfitIdeas = Array.isArray(user.amazonErrands?.outfitIdeas) && user.amazonErrands.outfitIdeas.length > 0
    ? user.amazonErrands.outfitIdeas.map((idea, index) => ({ ...defaultOutfitIdeas[index % defaultOutfitIdeas.length], ...idea }))
    : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.amazonStatus = '';
}

export function resetErrandsState(state) {
  state.amazonTasks = defaultAmazonTasks.map((task) => ({ ...task }));
  state.outfitIdeas = defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.newAmazonTask = '';
  state.amazonStatus = '';
}

function saveAmazonErrands(ctx, tasks = ctx.state.amazonTasks, outfitIdeas = ctx.state.outfitIdeas) {
  return ctx.saveUserSection('amazon-errands', { tasks, outfitIdeas });
}

function addAmazonTask(ctx, event) {
  const { state } = ctx;
  event.preventDefault();
  const value = state.newAmazonTask.trim();
  if (!value) {
    state.amazonStatus = 'Enter an automation item to add.';
    ctx.renderCurrent();
    return;
  }

  state.amazonTasks = [...state.amazonTasks, { title: value, source: 'amazon', status: 'planned' }];
  state.newAmazonTask = '';
  state.amazonStatus = 'Automation item added. Save when ready.';
  ctx.renderCurrent();
}

function removeAmazonTask(ctx, index) {
  const { state } = ctx;
  const removed = state.amazonTasks[index]?.title || 'Automation item';
  state.amazonTasks = state.amazonTasks.filter((_, taskIndex) => taskIndex !== index);
  state.amazonStatus = `${removed} removed. Save when ready.`;
  ctx.renderCurrent();
}

export function renderErrands(ctx) {
  const { state } = ctx;
  const amazonTasks = state.amazonTasks.length > 0 ? state.amazonTasks : defaultAmazonTasks.map((task) => ({ ...task }));
  const outfitIdeas = state.outfitIdeas.length > 0 ? state.outfitIdeas : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  const reminderText = amazonTasks.map((task) => task.title).join(' ');

  ctx.layout(`<main class="grid two-cols"><section class="panel"><p class="eyebrow">Amazon automation</p><h2>Diapers + wipes monthly order</h2><p>Use this checklist to keep the subscription visible and avoid surprise low-stock mornings.</p><div class="automation-list">${amazonTasks.map((task, index) => `<article class="mini-card editable-card">${icon('🔄')}<p>${escapeHtml(task.title)}</p><button class="icon-button danger" data-remove-amazon="${index}" aria-label="Remove ${escapeAttribute(task.title)}">×</button></article>`).join('')}</div><form id="amazon-task-form" class="shopping-edit"><label class="input-label" for="new-amazon-task">Add Amazon or grocery automation</label><div class="inline-form"><input id="new-amazon-task" value="${escapeAttribute(state.newAmazonTask)}" placeholder="e.g. Grocery delivery every Tuesday at 10 AM" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.amazonStatus || 'Edit Amazon and grocery errands for the signed-in user, then save.')}</p><button id="download-amazon-reminder">Download monthly reminder</button><button id="save-amazon-errands">Save Amazon errands</button></section><section class="panel"><p class="eyebrow">Email promotion scanner</p><h2>New outfit recommendations</h2><p>Connect promotion emails by searching for toddler shoe/clothing keywords, then choose comfortable pieces for Seattle play.</p>${outfitIdeas.map((idea) => `<article class="event-card outfit-card"><img class="outfit-preview" src="${escapeAttribute(idea.photoUrl)}" alt="Photo preview for ${escapeAttribute(idea.item)}" loading="lazy" /><div><span>👕 ${escapeHtml(idea.source)}</span><h3>${escapeHtml(idea.item)}</h3><p>${escapeHtml(idea.reason)}</p><a class="shopping-link" href="${escapeAttribute(idea.href)}" target="_blank" rel="noreferrer">${escapeHtml(idea.linkLabel)} ↗</a></div></article>`).join('')}</section></main>`);

  document.getElementById('download-amazon-reminder').addEventListener('click', () => downloadCalendar('Order diapers and wipes', '20260601T080000', '20260601T081500', reminderText || 'Monthly Amazon and grocery errand reminder'));
  document.getElementById('save-amazon-errands').addEventListener('click', () => saveAmazonErrands(ctx, amazonTasks, outfitIdeas));
  document.getElementById('amazon-task-form').addEventListener('submit', (event) => addAmazonTask(ctx, event));
  document.getElementById('new-amazon-task').addEventListener('input', (event) => { state.newAmazonTask = event.target.value; });
  document.querySelectorAll('[data-remove-amazon]').forEach((button) => button.addEventListener('click', () => removeAmazonTask(ctx, Number(button.dataset.removeAmazon))));
}
