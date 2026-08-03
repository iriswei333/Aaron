import { downloadCalendar, escapeAttribute, escapeHtml, icon } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';
import { buildFamilyLogistics } from '../../lib/kid-logistics.js';

export const defaultAmazonTasks = [
  { title: 'Amazon monthly subscribe-and-save: diapers and wipes on the 1st at 8:00 AM.', source: 'amazon', status: 'planned' },
  { title: 'Order status check: every Friday at 4:00 PM until delivered.', source: 'amazon', status: 'planned' },
  { title: 'Low-stock alert: when fewer than 20 diapers or one unopened wipe pack remains.', source: 'amazon', status: 'planned' },
];

export const defaultOutfitIdeas = [
  {
    item: 'Waterproof toddler sneakers',
    reason: 'Rainy days + playground traction',
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
  state.restockItems = user.amazonErrands?.restockItems && typeof user.amazonErrands.restockItems === 'object' ? user.amazonErrands.restockItems : {};
  state.logisticsItems = Array.isArray(user.amazonErrands?.logisticsItems) ? user.amazonErrands.logisticsItems : [];
}

export function resetErrandsState(state) {
  state.amazonTasks = defaultAmazonTasks.map((task) => ({ ...task }));
  state.outfitIdeas = defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.newAmazonTask = '';
  state.amazonStatus = '';
  state.restockItems = {};
  state.logisticsItems = [];
}

function saveAmazonErrands(ctx, tasks = ctx.state.amazonTasks, outfitIdeas = ctx.state.outfitIdeas) {
  return ctx.saveUserSection('amazon-errands', {
    tasks,
    outfitIdeas,
    restockItems: ctx.state.restockItems || {},
    logisticsItems: ctx.state.logisticsItems || [],
  });
}

function markRestockBought(ctx, itemId) {
  const today = new Date().toISOString().slice(0, 10);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, lastRestocked: today } : item);
  ctx.state.amazonStatus = 'Restock recorded. Save errands to keep the next date.';
  ctx.renderCurrent();
}

function updateLogisticsFrequency(ctx, itemId, value) {
  const frequencyDays = Math.min(Math.max(Number.parseInt(value, 10) || 0, 0), 3650);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, frequencyDays: frequencyDays || null } : item);
  ctx.state.amazonStatus = 'Restock frequency changed. Save errands to keep it.';
  ctx.renderCurrent();
}

function removeLogisticsItem(ctx, itemId) {
  const current = (ctx.state.logisticsItems || []).find((item) => item.id === itemId);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, active: false } : item);
  ctx.state.amazonStatus = `${current?.text || 'Logistics item'} removed. Save errands to keep it removed.`;
  ctx.renderCurrent();
}

function addLogisticsItem(ctx, event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const textValue = String(formData.get('logisticsItem') || '').trim().slice(0, 80);
  const kidId = String(formData.get('logisticsKid') || '');
  const frequencyDays = Math.min(Math.max(Number.parseInt(formData.get('logisticsFrequency'), 10) || 0, 0), 3650);
  if (!textValue) {
    ctx.state.amazonStatus = 'Enter a logistics item to add.';
    ctx.renderCurrent();
    return;
  }
  const child = (ctx.state.user?.childProfile?.children || []).find((item) => item.id === kidId);
  ctx.state.logisticsItems = [
    ...(ctx.state.logisticsItems || []),
    {
      id: `custom-${Date.now()}`,
      text: textValue,
      kidId,
      kidName: child?.name || 'Family',
      reason: 'custom',
      frequencyDays: frequencyDays || null,
      lastRestocked: '',
    },
  ];
  ctx.state.amazonStatus = `${textValue} added. Set a starting restock date by marking it bought today.`;
  ctx.renderCurrent();
}

function formatRestockDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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
  const childName = childDisplayName(getChildProfile(state.user));
  const amazonTasks = state.amazonTasks.length > 0 ? state.amazonTasks : defaultAmazonTasks.map((task) => ({ ...task }));
  const outfitIdeas = state.outfitIdeas.length > 0 ? state.outfitIdeas : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  const reminderText = amazonTasks.map((task) => task.title).join(' ');
  const logistics = buildFamilyLogistics(state.user, { restockItems: state.restockItems, logisticsItems: state.logisticsItems });
  const savedIds = new Set((state.logisticsItems || []).map((item) => item.id));
  state.logisticsItems = [
    ...(state.logisticsItems || []),
    ...logistics.items.filter((item) => !savedIds.has(item.id)).map((item) => ({
      id: item.id,
      text: item.text,
      kidId: item.kidId,
      kidName: item.kidName,
      reason: item.reason,
      frequencyDays: item.frequencyDays,
      lastRestocked: item.lastRestocked,
    })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const logisticsRows = logistics.items.map((item) => {
    const status = item.nextRestockDate
      ? `${item.nextRestockDate <= today ? 'Due now' : `Next: ${formatRestockDate(item.nextRestockDate)}`}`
      : item.frequencyDays ? 'Mark bought to start the schedule' : 'Set a frequency to schedule this item';
    return `<article class="mini-card logistics-card"><div><strong>${escapeHtml(item.text)}</strong><span class="kid-chip">${escapeHtml(item.kidName || 'Family')}</span><small>${escapeHtml(item.reason === 'custom' ? 'Added by you' : 'Suggested from age stage')} • ${escapeHtml(status)}</small></div><div class="logistics-controls"><label><small>Every (days)</small><input type="number" min="1" max="3650" value="${escapeAttribute(item.frequencyDays || '')}" data-logistics-frequency="${escapeAttribute(item.id)}" aria-label="Restock frequency for ${escapeAttribute(item.text)}" /></label><button class="secondary-button small-button" data-mark-restock="${escapeAttribute(item.id)}">Bought today</button><button class="icon-button danger" data-remove-logistics="${escapeAttribute(item.id)}" aria-label="Remove ${escapeAttribute(item.text)}">×</button></div></article>`;
  });

  ctx.layout(`<main class="grid two-cols"><section class="panel"><p class="eyebrow">Family logistics</p><h2>Restock plan for ${escapeHtml(childName)}</h2><p>Food stays in the Food tab. This list starts with age-stage care supplies, then lets you add, remove, and schedule anything your family needs.</p><div class="automation-list">${logisticsRows.length ? logisticsRows.join('') : '<p class="muted">Add a birthday to a child profile to derive age-stage supplies, or add a family item below.</p>'}</div><form id="logistics-form" class="shopping-edit"><label class="input-label" for="new-logistics-item">Add logistics item</label><div class="form-grid two-field-grid"><input id="new-logistics-item" name="logisticsItem" placeholder="e.g. sunscreen or extra daycare clothes" maxlength="80" required /><select name="logisticsKid" aria-label="Assign logistics item to a child"><option value="">Family</option>${(state.user?.childProfile?.children || []).map((child) => `<option value="${escapeAttribute(child.id)}">${escapeHtml(child.name || 'Child')}</option>`).join('')}</select><input name="logisticsFrequency" type="number" min="1" max="3650" placeholder="Restock every N days" /></div><button type="submit">Add logistics item</button></form><h3>Automations</h3><div class="automation-list">${amazonTasks.map((task, index) => `<article class="mini-card editable-card">${icon('🔄')}<p>${escapeHtml(task.title)}</p><button class="icon-button danger" data-remove-amazon="${index}" aria-label="Remove ${escapeAttribute(task.title)}">×</button></article>`).join('')}</div><form id="amazon-task-form" class="shopping-edit"><label class="input-label" for="new-amazon-task">Add Amazon or grocery automation</label><div class="inline-form"><input id="new-amazon-task" value="${escapeAttribute(state.newAmazonTask)}" placeholder="e.g. Grocery delivery every Tuesday at 10 AM" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.amazonStatus || 'Set a frequency and mark an item bought to see its next restock date.')}</p><button id="download-amazon-reminder">Download monthly reminder</button><button id="save-amazon-errands">Save errands</button></section><section class="panel"><p class="eyebrow">Email promotion scanner</p><h2>New outfit recommendations</h2><p>Connect promotion emails by searching for kid shoe/clothing keywords, then choose comfortable pieces for active play.</p>${outfitIdeas.map((idea) => `<article class="event-card outfit-card"><img class="outfit-preview" src="${escapeAttribute(idea.photoUrl)}" alt="Photo preview for ${escapeAttribute(idea.item)}" loading="lazy" /><div><span>👕 ${escapeHtml(idea.source)}</span><h3>${escapeHtml(idea.item)}</h3><p>${escapeHtml(idea.reason)}</p><a class="shopping-link" href="${escapeAttribute(idea.href)}" target="_blank" rel="noreferrer">${escapeHtml(idea.linkLabel)} ↗</a></div></article>`).join('')}</section></main>`);

  document.getElementById('download-amazon-reminder').addEventListener('click', () => downloadCalendar('Family logistics reminder', '20260601T080000', '20260601T081500', reminderText || 'Family logistics and restock reminder'));
  document.getElementById('save-amazon-errands').addEventListener('click', () => saveAmazonErrands(ctx, amazonTasks, outfitIdeas));
  document.getElementById('logistics-form').addEventListener('submit', (event) => addLogisticsItem(ctx, event));
  document.getElementById('amazon-task-form').addEventListener('submit', (event) => addAmazonTask(ctx, event));
  document.getElementById('new-amazon-task').addEventListener('input', (event) => { state.newAmazonTask = event.target.value; });
  document.querySelectorAll('[data-remove-amazon]').forEach((button) => button.addEventListener('click', () => removeAmazonTask(ctx, Number(button.dataset.removeAmazon))));
  document.querySelectorAll('[data-mark-restock]').forEach((button) => button.addEventListener('click', () => markRestockBought(ctx, button.dataset.markRestock)));
  document.querySelectorAll('[data-remove-logistics]').forEach((button) => button.addEventListener('click', () => removeLogisticsItem(ctx, button.dataset.removeLogistics)));
  document.querySelectorAll('[data-logistics-frequency]').forEach((input) => input.addEventListener('change', () => updateLogisticsFrequency(ctx, input.dataset.logisticsFrequency, input.value)));
}
