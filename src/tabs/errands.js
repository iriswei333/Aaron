import { escapeAttribute, escapeHtml, icon } from '../shared.js';
import { childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';
import { buildFamilyLogistics } from '../../lib/kid-logistics.js';

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

export function applyErrandsProfile(state, user) {
  state.amazonTasks = [];
  state.outfitIdeas = Array.isArray(user.amazonErrands?.outfitIdeas) && user.amazonErrands.outfitIdeas.length > 0
    ? user.amazonErrands.outfitIdeas.map((idea, index) => ({ ...defaultOutfitIdeas[index % defaultOutfitIdeas.length], ...idea }))
    : defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.amazonStatus = '';
  state.restockItems = user.amazonErrands?.restockItems && typeof user.amazonErrands.restockItems === 'object' ? user.amazonErrands.restockItems : {};
  state.logisticsItems = Array.isArray(user.amazonErrands?.logisticsItems) ? user.amazonErrands.logisticsItems : [];
  state.amazonReminder = user.amazonErrands?.reminder && typeof user.amazonErrands.reminder === 'object' ? user.amazonErrands.reminder : null;
}

export function resetErrandsState(state) {
  state.amazonTasks = [];
  state.outfitIdeas = defaultOutfitIdeas.map((idea) => ({ ...idea }));
  state.newAmazonTask = '';
  state.amazonStatus = '';
  state.restockItems = {};
  state.logisticsItems = [];
  state.logisticsEditItemId = '';
  state.amazonReminder = null;
}

function saveAmazonErrands(ctx, outfitIdeas = ctx.state.outfitIdeas) {
  return ctx.saveUserSection('amazon-errands', {
    tasks: [],
    outfitIdeas,
    restockItems: ctx.state.restockItems || {},
    logisticsItems: ctx.state.logisticsItems || [],
    reminder: ctx.state.amazonReminder || null,
  });
}

function markRestockBought(ctx, itemId) {
  const today = new Date().toISOString().slice(0, 10);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, lastRestocked: today } : item);
  ctx.state.amazonStatus = 'Restock recorded. Save errands to keep the next date.';
  saveAmazonErrands(ctx);
}

function updateLogisticsFrequency(ctx, itemId, value) {
  const frequencyDays = Math.min(Math.max(Number.parseInt(value, 10) || 0, 0), 3650);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, frequencyDays: frequencyDays || null } : item);
  ctx.state.amazonStatus = 'Restock frequency changed. Save errands to keep it.';
  saveAmazonErrands(ctx);
}

function removeLogisticsItem(ctx, itemId) {
  const current = (ctx.state.logisticsItems || []).find((item) => item.id === itemId);
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId ? { ...item, active: false } : item);
  if (ctx.state.amazonReminder?.itemId === itemId) ctx.state.amazonReminder = null;
  ctx.state.amazonStatus = `${current?.text || 'Logistics item'} removed. Save errands to keep it removed.`;
  saveAmazonErrands(ctx);
}

function openLogisticsEditor(ctx, item) {
  if (!item) return;
  ctx.state.logisticsEditItemId = item.id;
  ctx.renderCurrent();
}

function closeLogisticsEditor(ctx) {
  ctx.state.logisticsEditItemId = '';
  ctx.renderCurrent();
}

function saveLogisticsEdit(ctx, event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const itemId = ctx.state.logisticsEditItemId;
  const textValue = String(formData.get('logisticsItemName') || '').trim().slice(0, 80);
  const frequencyDays = Math.min(Math.max(Number.parseInt(formData.get('logisticsFrequency'), 10) || 0, 0), 3650);
  if (!textValue) return;
  ctx.state.logisticsItems = (ctx.state.logisticsItems || []).map((item) => item.id === itemId
    ? { ...item, text: textValue, frequencyDays: frequencyDays || null }
    : item);
  ctx.state.amazonStatus = `${textValue} updated. Save errands to keep the change.`;
  ctx.state.logisticsEditItemId = '';
  if (ctx.state.amazonReminder?.itemId === itemId) ctx.state.amazonReminder = null;
  saveAmazonErrands(ctx);
}

function logisticsEditModal(item) {
  if (!item) return '';
  return `<div id="logistics-edit-backdrop" class="modal-backdrop"><section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="logistics-edit-title"><div class="section-heading"><div><p class="eyebrow">Family logistics</p><h2 id="logistics-edit-title">Edit supply</h2></div><button id="close-logistics-edit" class="icon-button" type="button" aria-label="Close edit supply dialog">×</button></div><form id="logistics-edit-form"><label class="input-label" for="logistics-item-name">Item name</label><input id="logistics-item-name" name="logisticsItemName" value="${escapeAttribute(item.text)}" maxlength="80" required /><label class="input-label" for="logistics-frequency">Frequency in days</label><input id="logistics-frequency" name="logisticsFrequency" type="number" min="1" max="3650" value="${escapeAttribute(item.frequencyDays || '')}" placeholder="e.g. 30" /><div class="form-actions"><button type="submit">Save changes</button><button id="cancel-logistics-edit" type="button" class="secondary-button">Cancel</button></div></form></section></div>`;
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
  saveAmazonErrands(ctx);
}

function formatRestockDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function saveReminder(ctx, item) {
  if (!item?.nextRestockDate) {
    ctx.state.amazonStatus = 'Set a frequency and mark an item bought today before saving a reminder.';
    ctx.renderCurrent();
    return;
  }
  ctx.state.amazonReminder = {
    itemId: item.id,
    text: item.text,
    dueDate: item.nextRestockDate,
    savedAt: new Date().toISOString(),
  };
  ctx.state.amazonStatus = `${item.text} reminder saved for ${formatRestockDate(item.nextRestockDate)}.`;
  saveAmazonErrands(ctx);
}

export function renderErrands(ctx) {
  const { state } = ctx;
  const childName = childDisplayName(getChildProfile(state.user));
  const outfitIdeas = state.outfitIdeas.length > 0 ? state.outfitIdeas : defaultOutfitIdeas.map((idea) => ({ ...idea }));
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
  const nextDueItem = logistics.items
    .filter((item) => item.nextRestockDate)
    .sort((a, b) => a.nextRestockDate.localeCompare(b.nextRestockDate))[0];
  const savedReminder = state.amazonReminder;
  const logisticsRows = logistics.items.map((item) => {
    const status = item.nextRestockDate
      ? `${item.nextRestockDate <= today ? 'Due now' : `Next: ${formatRestockDate(item.nextRestockDate)}`}`
      : item.frequencyDays ? 'Mark bought to start the schedule' : 'Set a frequency to schedule this item';
    return `<article class="mini-card logistics-card"><div><strong>${escapeHtml(item.text)}</strong><span class="kid-chip">${escapeHtml(item.kidName || 'Family')}</span><small>${escapeHtml(item.reason === 'custom' ? 'Added by you' : 'Suggested from age stage')} • ${escapeHtml(status)}</small></div><div class="logistics-controls" aria-label="Actions for ${escapeAttribute(item.text)}"><button class="icon-button logistics-action edit" type="button" data-edit-logistics="${escapeAttribute(item.id)}" aria-label="Edit ${escapeAttribute(item.text)}" title="Edit item">✎</button><button class="icon-button logistics-action bought" type="button" data-mark-restock="${escapeAttribute(item.id)}" aria-label="Mark ${escapeAttribute(item.text)} as bought today" title="Bought today">✓</button><button class="icon-button logistics-action danger" type="button" data-remove-logistics="${escapeAttribute(item.id)}" aria-label="Delete ${escapeAttribute(item.text)}" title="Delete item">🗑️</button></div></article>`;
  });
  const editingItem = logistics.items.find((item) => item.id === state.logisticsEditItemId);

  const reminderMarkup = nextDueItem
    ? `<div class="logistics-reminder"><div><p class="eyebrow">Next family reminder</p><strong>${escapeHtml(nextDueItem.text)}</strong><span>Buy by ${escapeHtml(formatRestockDate(nextDueItem.nextRestockDate))}</span></div><button id="save-reminder" class="secondary-button small-button" type="button">Save reminder</button></div>`
    : savedReminder?.dueDate
      ? `<div class="logistics-reminder"><div><p class="eyebrow">Saved family reminder</p><strong>${escapeHtml(savedReminder.text || 'Logistics item')}</strong><span>Buy by ${escapeHtml(formatRestockDate(savedReminder.dueDate))}</span></div><button id="save-reminder" class="secondary-button small-button" type="button" disabled>Saved</button></div>`
      : '<div class="logistics-reminder empty"><span>Set a frequency and mark an item bought today to create the next family reminder.</span></div>';

  ctx.layout(`<main class="grid two-cols"><section class="panel"><p class="eyebrow">Family logistics</p><h2>Restock plan for ${escapeHtml(childName)}</h2><p>Manage care supplies here. Edit an item to set its frequency, mark it bought today, and save the next reminder.</p>${reminderMarkup}<form id="logistics-form" class="logistics-add-form"><input id="new-logistics-item" name="logisticsItem" placeholder="Add a logistics item" maxlength="80" aria-label="New logistics item" required /><input name="logisticsFrequency" type="number" min="1" max="3650" placeholder="Every days" aria-label="Frequency in days" required /><select name="logisticsKid" aria-label="Assign logistics item to a child"><option value="">Family</option>${(state.user?.childProfile?.children || []).map((child) => `<option value="${escapeAttribute(child.id)}">${escapeHtml(child.name || 'Child')}</option>`).join('')}</select><button class="icon-button logistics-action add" type="submit" aria-label="Add logistics item" title="Add logistics item">＋</button></form><div class="automation-list">${logisticsRows.length ? logisticsRows.join('') : '<p class="muted">Add a birthday to a child profile to derive age-stage supplies.</p>'}</div>${state.amazonStatus ? `<p class="muted">${escapeHtml(state.amazonStatus)}</p>` : ''}</section><section class="panel"><p class="eyebrow">Email promotion scanner</p><h2>New outfit recommendations</h2><p>Connect promotion emails by searching for kid shoe/clothing keywords, then choose comfortable pieces for active play.</p>${outfitIdeas.map((idea) => `<article class="event-card outfit-card"><img class="outfit-preview" src="${escapeAttribute(idea.photoUrl)}" alt="Photo preview for ${escapeAttribute(idea.item)}" loading="lazy" /><div><span>👕 ${escapeHtml(idea.source)}</span><h3>${escapeHtml(idea.item)}</h3><p>${escapeHtml(idea.reason)}</p><a class="shopping-link" href="${escapeAttribute(idea.href)}" target="_blank" rel="noreferrer">${escapeHtml(idea.linkLabel)} ↗</a></div></article>`).join('')}</section></main>${logisticsEditModal(editingItem)}`);

  document.getElementById('save-reminder')?.addEventListener('click', () => saveReminder(ctx, nextDueItem));
  document.getElementById('logistics-form')?.addEventListener('submit', (event) => addLogisticsItem(ctx, event));
  document.querySelectorAll('[data-mark-restock]').forEach((button) => button.addEventListener('click', () => markRestockBought(ctx, button.dataset.markRestock)));
  document.querySelectorAll('[data-remove-logistics]').forEach((button) => button.addEventListener('click', () => removeLogisticsItem(ctx, button.dataset.removeLogistics)));
  document.querySelectorAll('[data-edit-logistics]').forEach((button) => button.addEventListener('click', () => openLogisticsEditor(ctx, logistics.items.find((item) => item.id === button.dataset.editLogistics))));
  document.getElementById('logistics-edit-form')?.addEventListener('submit', (event) => saveLogisticsEdit(ctx, event));
  document.getElementById('close-logistics-edit')?.addEventListener('click', () => closeLogisticsEditor(ctx));
  document.getElementById('cancel-logistics-edit')?.addEventListener('click', () => closeLogisticsEditor(ctx));
  document.getElementById('logistics-edit-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'logistics-edit-backdrop') closeLogisticsEditor(ctx);
  });
}
