import { apiRequest, escapeAttribute, escapeHtml } from '../shared.js';
import { CHAT_REPORT_DETAILS_MAX, CHAT_REPORT_REASONS, normalizeChatReport } from '@sproutcue/shared/chat-report';
import { chatThreadSchedule } from '@sproutcue/shared/playdates';
import { SAFETY_EMAIL, SUPPORT_EMAIL } from '@sproutcue/shared/terms';
import { blockActionLabel, blockConfirmCopy, unblockConfirmCopy } from '@sproutcue/shared/user-blocks';
import { childAgeLabel, childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';

export function resetSocialState(state) {
  state.chatContacts = [];
  state.chatMessages = [];
  state.activeChatContactId = '';
  state.chatLoaded = false;
  state.chatStatus = '';
  state.chatReport = null;
  state.reportedChatMessageIds = [];
  state.chatMenuOpen = false;
  state.chatBlockConfirm = null;
  state.blockedFamilies = [];
  state.blockedFamiliesStatus = '';
  state.parentingResources = [];
  state.parentingResourcesStatus = '';
  state.parentingResourcesAgeFilter = '';
}

export async function loadChat(ctx, contactId = '') {
  const { state } = ctx;
  try {
    const data = await apiRequest(`/chat${contactId ? `?threadId=${encodeURIComponent(contactId)}` : ''}`);
    state.chatContacts = sortChatThreads(data.threads || []);
    state.chatMessages = data.messages || [];
    if (state.pendingChatPlayDateId) {
      const pendingThread = state.chatContacts.find((thread) => thread.type === 'playdate' && thread.playDateId === state.pendingChatPlayDateId);
      state.activeChatContactId = pendingThread?.id || '';
      state.pendingChatPlayDateId = '';
    }
    if (!state.chatContacts.some((thread) => thread.id === state.activeChatContactId)) state.activeChatContactId = state.chatContacts[0]?.id || '';
    if (!contactId && state.chatContacts[0]) {
      const selectedId = state.chatContacts.find((thread) => thread.id === state.activeChatContactId)?.id || state.chatContacts[0].id;
      if (!data.messages?.length) {
        const selected = await apiRequest(`/chat?threadId=${encodeURIComponent(selectedId)}`);
        state.chatMessages = selected.messages || [];
      }
    }
    const selectedThreadId = state.activeChatContactId;
    if (selectedThreadId && state.chatContacts.some((thread) => thread.id === selectedThreadId)) {
      await apiRequest('/chat', { method: 'PATCH', body: JSON.stringify({ action: 'markRead', threadId: selectedThreadId }) });
      state.chatContacts = state.chatContacts.map((thread) => thread.id === selectedThreadId ? { ...thread, unreadCount: 0 } : thread);
    }
  } catch (error) {
    state.chatStatus = `Chat unavailable: ${error.message}`;
  }
  if (state.tab === 'chat' || state.tab === 'profile') ctx.renderCurrent();
}

async function loadParentingResources(ctx, forceRefresh = false) {
  const { state } = ctx;
  try {
    state.parentingResourcesStatus = 'Finding age-matched parenting tips…';
    if (state.tab === 'chat') ctx.renderCurrent();
    const data = await apiRequest(`/parenting-resources${forceRefresh ? '?refresh=1' : ''}`);
    state.parentingResources = Array.isArray(data.resources) ? data.resources : [];
    state.parentingResourcesAgeFilter = data.ageFilter || '';
    state.parentingResourcesStatus = `${data.cached ? 'Daily cache' : 'Updated'}: five ParentMap articles for ${data.ageFilter === 'baby' ? 'baby' : data.ageFilter === 'elementary' ? 'elementary' : 'toddlers and preschoolers'}.`;
  } catch (error) {
    state.parentingResources = [];
    state.parentingResourcesStatus = `Could not load parenting resources: ${error.message}`;
  }
  if (state.tab === 'chat') ctx.renderCurrent();
}

async function sendChat(ctx, event) {
  event.preventDefault();
  const { state } = ctx;
  const form = event.currentTarget;
  const text = form.elements.namedItem('chat-text').value.trim();
  const file = form.elements.namedItem('chat-media').files?.[0];
  if (!state.activeChatContactId || (!text && !file)) return;
  let mediaUrl = '';
  let mediaType = '';
  if (file) {
    if (file.size > 8 * 1024 * 1024) return;
    mediaUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    mediaType = file.type.startsWith('video/') ? 'video' : 'photo';
  }
  const active = (state.chatContacts || []).find((thread) => thread.id === state.activeChatContactId);
  try {
    await apiRequest('/chat', { method: 'POST', body: JSON.stringify({ threadId: active?.id, recipientId: active?.type === 'direct' ? active.contactId || active.participantIds?.find((id) => id !== state.user?.id) : '', playDateId: active?.playDateId, text, mediaType, mediaUrl }) });
    state.chatStatus = '';
  } catch (error) {
    // e.g. "You can’t message this family." after a block.
    state.chatStatus = `Message not sent: ${error.message}`;
  }
  await loadChat(ctx, state.activeChatContactId);
}

function sortChatThreads(threads = []) {
  return [...threads].sort((first, second) => new Date(second.lastMessageAt || 0) - new Date(first.lastMessageAt || 0));
}

function chatThreadEmoji(thread, index = 0) {
  const title = String(thread?.title || '').toLowerCase();
  if (thread?.type === 'playdate') {
    if (/book|story|library|read/.test(title)) return '📚';
    if (/beach|island|water|lake|pool/.test(title)) return '🏝️';
    if (/bike|cycle|ride|trail/.test(title)) return '🚲';
    if (/park|playground|sandbox|garden/.test(title)) return '🛝';
    return ['🛝', '📚', '🏝️', '🚲', '🎨'][index % 5];
  }
  return ['💬', '🌼', '🧺', '🌈'][index % 4];
}

function userAvatarMarkup(user, className = 'chat-avatar', label = 'Profile avatar') {
  const avatarUrl = user?.socialLinks?.avatarUrl;
  return avatarUrl
    ? `<img class="${className}" src="${escapeAttribute(avatarUrl)}" alt="${escapeAttribute(label)}" />`
    : `<span class="${className} default-avatar" role="img" aria-label="${escapeAttribute(label)}"><img src="/avatars/sproutcue-default-avatar.png" alt="" aria-hidden="true" /></span>`;
}

function quickReplySuggestions(thread) {
  return thread?.type === 'playdate'
    ? ['What time works best?', 'We can bring snacks.', 'See you at the playground!', 'We may be a few minutes late.']
    : ['How is your week going?', 'That sounds great!', 'What works for your family?', 'Talk soon!'];
}

export function resizeAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not use that image.'));
      image.onload = () => {
        const size = 192;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function renderChat(ctx) {
  const { state } = ctx;
  const contacts = sortChatThreads(state.chatContacts || []);
  const active = contacts.find((contact) => contact.id === state.activeChatContactId) || contacts[0];
  const contactList = contacts.length
    ? contacts.map((contact, index) => `<button type="button" class="chat-contact ${active?.id === contact.id ? 'selected' : ''}" data-chat-contact="${escapeAttribute(contact.id)}"><span class="avatar chat-thread-emoji" role="img" aria-label="Chat topic">${chatThreadEmoji(contact, index)}</span><span>${escapeHtml(contact.title || 'Chat')}<small>${contact.type === 'playdate' ? `${contact.participantIds?.length || 0} families` : 'Direct chat'}</small></span>${contact.unreadCount > 0 ? '<i class="chat-unread-dot" aria-label="Unread messages"></i>' : ''}</button>`).join('')
    : '<p class="muted">Join a playdate to open its family thread, or start a direct chat from a connected family.</p>';
  const messages = active
    ? (state.chatMessages || []).map((message) => {
      const mine = message.senderId === state.user?.id;
      const reportable = !mine && Boolean(message.id);
      const reported = reportable && (state.reportedChatMessageIds || []).includes(message.id);
      const time = new Date(message.createdAt).toLocaleString([], { hour: 'numeric', minute: '2-digit' });
      const senderName = chatParticipantName(active, message.senderId);
      const blockControl = reportable ? ` · <button type="button" class="chat-report-button" data-block-user="${escapeAttribute(message.senderId)}" data-block-name="${escapeAttribute(senderName)}" aria-label="${escapeAttribute(blockActionLabel(senderName))}">Block</button>` : '';
      const reportControl = reported
        ? ` · <span class="chat-reported-label">Reported</span><span class="chat-report-action">${blockControl}</span>`
        : reportable ? `<span class="chat-report-action"> · <button type="button" class="chat-report-button" data-report-chat-message="${escapeAttribute(message.id)}" aria-label="Report this message">Report</button>${blockControl}</span>` : '';
      return `<article class="chat-message ${mine ? 'mine' : ''}"${reportable ? ` data-chat-message-id="${escapeAttribute(message.id)}"` : ''}>${mine ? userAvatarMarkup(state.user, 'chat-message-avatar', 'Your avatar') : userAvatarMarkup(null, 'chat-message-avatar', 'Family avatar')}<div class="chat-message-body">${message.mediaUrl ? (message.mediaType === 'video' ? `<video src="${escapeAttribute(message.mediaUrl)}" controls></video>` : `<img src="${escapeAttribute(message.mediaUrl)}" alt="Shared photo" />`) : ''}${message.text ? `<p>${escapeHtml(message.text)}</p>` : ''}<small>${time}${reportControl}</small></div></article>`;
    }).join('')
    : '';
  const quickReplies = active ? quickReplySuggestions(active) : [];
  return `<div class="chat-layout"><aside class="chat-contacts">${contactList}</aside><section class="chat-thread">${active ? `<div class="chat-thread-heading"><div class="chat-thread-title"><div>${userAvatarMarkup(state.user, 'chat-header-avatar', 'Your profile avatar')}</div><div><strong>${escapeHtml(active.title || 'Chat')}</strong>${chatThreadSchedule(active) ? `<small>${escapeHtml(chatThreadSchedule(active))}</small>` : ''}<small>${active.type === 'playdate' ? 'Everyone in this playdate is included' : 'Private 1:1 conversation'}</small></div>${chatThreadMenu(state, active)}</div></div><div class="chat-messages">${messages || '<p class="muted">Say hello and make the meetup easy.</p>'}</div><div class="chat-quick-replies" aria-label="Quick reply suggestions">${quickReplies.map((reply) => `<button type="button" class="quick-reply" data-quick-reply="${escapeAttribute(reply)}">${escapeHtml(reply)}</button>`).join('')}</div><form id="chat-form" class="chat-compose"><input name="chat-text" placeholder="Message, emoji, or meetup note…" maxlength="2000" /><label class="chat-attach" title="Attach photo or short video">＋<input name="chat-media" type="file" accept="image/*,video/*" /></label><button type="submit">Send</button></form>` : '<div class="chat-empty"><span>💬</span><p>Your playdate family threads will appear here.</p></div>'}</section></div>${renderChatReportDialog(state, active)}${renderBlockDialog(state)}`;
}

// ── Chat safety: block a family ───────────────────────────────────────────────
// Direct chats: ⋯ in the header → Block. Any chat: the "Block" link under a message,
// or "Also block" after reporting. Unblock from the Blocked families panel (Family tab).
// The server does the hiding (POST/DELETE /api/blocks); the client just reloads.

function chatParticipantName(thread, userId) {
  return thread?.participants?.find((person) => person.id === userId)?.displayName || '';
}

function directContactId(thread, state) {
  if (thread?.type !== 'direct') return '';
  return thread.contactId || thread.participants?.[0]?.id || thread.participantIds?.find((id) => id !== state.user?.id) || '';
}

function chatThreadMenu(state, thread) {
  const contactId = directContactId(thread, state);
  if (!contactId) return '';
  const name = chatParticipantName(thread, contactId) || thread.title || '';
  return `<div class="chat-thread-menu"><button type="button" class="icon-button chat-thread-menu-toggle" data-chat-menu-toggle aria-label="Chat options" aria-haspopup="menu" aria-expanded="${state.chatMenuOpen ? 'true' : 'false'}">⋯</button>${state.chatMenuOpen ? `<div class="chat-thread-menu-list" role="menu"><button type="button" role="menuitem" class="danger-menu-item" data-block-user="${escapeAttribute(contactId)}" data-block-name="${escapeAttribute(name)}">${escapeHtml(blockActionLabel(name))}</button></div>` : ''}</div>`;
}

function renderBlockDialog(state) {
  const confirm = state.chatBlockConfirm;
  if (!confirm) return '';
  const copy = confirm.mode === 'unblock' ? unblockConfirmCopy(confirm.name) : blockConfirmCopy(confirm.name);
  const busy = confirm.status === 'sending';
  return `<div class="modal-backdrop chat-report-backdrop" data-chat-block-backdrop><section class="modal-dialog chat-report-dialog chat-block-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chat-block-title" aria-describedby="chat-block-message"><h2 id="chat-block-title">${escapeHtml(copy.title)}</h2><p id="chat-block-message" class="muted">${escapeHtml(copy.message)}</p>${confirm.error ? `<p class="chat-report-error" role="alert">${escapeHtml(confirm.error)}</p>` : ''}<div class="form-actions"><button type="button" class="${confirm.mode === 'unblock' ? '' : 'danger-solid-button'}" data-confirm-block${busy ? ' disabled' : ''}>${busy ? 'One moment…' : escapeHtml(copy.confirm)}</button><button type="button" class="secondary-button" data-cancel-block>Cancel</button></div></section></div>`;
}

function openBlockConfirm(ctx, mode, userId, name) {
  if (!userId) return;
  ctx.state.chatMenuOpen = false;
  ctx.state.chatBlockConfirm = { mode, userId, name: name || '', status: 'idle', error: '' };
  ctx.renderCurrent();
  document.querySelector('[data-cancel-block]')?.focus();
}

function closeBlockConfirm(ctx) {
  ctx.state.chatBlockConfirm = null;
  ctx.renderCurrent();
}

async function loadBlockedFamilies(ctx) {
  const { state } = ctx;
  try {
    const data = await apiRequest('/blocks');
    state.blockedFamilies = data.blocks || [];
    state.blockedFamiliesStatus = 'ready';
  } catch (error) {
    state.blockedFamiliesStatus = `Couldn’t load blocked families: ${error.message}`;
  }
  ctx.renderCurrent();
}

export function ensureBlockedFamiliesLoaded(ctx) {
  if (ctx.state.blockedFamiliesStatus) return;
  ctx.state.blockedFamiliesStatus = 'loading';
  loadBlockedFamilies(ctx);
}

async function confirmBlockChange(ctx) {
  const { state } = ctx;
  const confirm = state.chatBlockConfirm;
  if (!confirm || confirm.status === 'sending') return;
  confirm.status = 'sending';
  confirm.error = '';
  ctx.renderCurrent();
  try {
    await apiRequest('/blocks', { method: confirm.mode === 'unblock' ? 'DELETE' : 'POST', body: JSON.stringify({ userId: confirm.userId }) });
  } catch (error) {
    if (state.chatBlockConfirm !== confirm) return;
    confirm.status = 'idle';
    confirm.error = `Couldn’t ${confirm.mode === 'unblock' ? 'unblock' : 'block'}: ${error.message}`;
    ctx.renderCurrent();
    return;
  }
  state.chatBlockConfirm = null;
  state.chatReport = null;
  if (confirm.mode === 'unblock') {
    state.blockedFamilies = (state.blockedFamilies || []).filter((family) => family.userId !== confirm.userId);
  } else {
    state.blockedFamilies = [{ userId: confirm.userId, displayName: confirm.name || 'A family', createdAt: new Date().toISOString() }, ...(state.blockedFamilies || []).filter((family) => family.userId !== confirm.userId)];
    // Their direct chat leaves the list; let loadChat pick the next thread.
    const active = (state.chatContacts || []).find((thread) => thread.id === state.activeChatContactId);
    if (directContactId(active, state) === confirm.userId) state.activeChatContactId = '';
  }
  await loadChat(ctx, state.activeChatContactId);
  ctx.renderCurrent();
}

export function renderBlockedFamilies(ctx) {
  const { state } = ctx;
  ensureBlockedFamiliesLoaded(ctx);
  const families = state.blockedFamilies || [];
  const body = state.blockedFamiliesStatus === 'loading'
    ? '<p class="muted">Loading…</p>'
    : state.blockedFamiliesStatus && state.blockedFamiliesStatus !== 'ready'
      ? `<p class="muted">${escapeHtml(state.blockedFamiliesStatus)}</p>`
      : families.length
        ? `<div class="blocked-family-list">${families.map((family) => `<div class="blocked-family-row"><span>${escapeHtml(family.displayName || 'A family')}</span><button type="button" class="text-button" data-unblock-user="${escapeAttribute(family.userId)}" data-block-name="${escapeAttribute(family.displayName || '')}">Unblock</button></div>`).join('')}</div>`
        : '<p class="muted">You haven’t blocked anyone. To block a family, use ⋯ in a direct chat or “Block” under one of their messages.</p>';
  return `<section class="panel blocked-families-panel"><div class="section-heading"><div><p class="eyebrow">Chat safety</p><h2>Blocked families</h2><p class="muted">Blocked families can’t message you directly, and you won’t see their messages. They aren’t told.</p></div>${families.length ? `<span class="privacy-pill">${families.length}</span>` : ''}</div>${body}<p class="help-contact">Need help? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> · Safety concern? <a href="mailto:${SAFETY_EMAIL}">${SAFETY_EMAIL}</a> · <a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></p></section>`;
}

function bindBlockInteractions(ctx) {
  const { state } = ctx;
  document.querySelector('[data-chat-menu-toggle]')?.addEventListener('click', () => {
    state.chatMenuOpen = !state.chatMenuOpen;
    ctx.renderCurrent();
    if (state.chatMenuOpen) document.querySelector('.chat-thread-menu-list [role="menuitem"]')?.focus();
  });
  if (state.chatMenuOpen) {
    // Close the ⋯ menu on the next click anywhere outside it.
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('.chat-thread-menu') || !state.chatMenuOpen) return;
      state.chatMenuOpen = false;
      ctx.renderCurrent();
    }, { capture: true, once: true });
  }
  document.querySelector('.chat-thread-menu-list')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    state.chatMenuOpen = false;
    ctx.renderCurrent();
    document.querySelector('[data-chat-menu-toggle]')?.focus();
  });
  document.querySelectorAll('[data-block-user]').forEach((button) => button.addEventListener('click', () => openBlockConfirm(ctx, 'block', button.dataset.blockUser, button.dataset.blockName)));
  document.querySelectorAll('[data-unblock-user]').forEach((button) => button.addEventListener('click', () => openBlockConfirm(ctx, 'unblock', button.dataset.unblockUser, button.dataset.blockName)));
  const backdrop = document.querySelector('[data-chat-block-backdrop]');
  if (!backdrop) return;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeBlockConfirm(ctx); });
  backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeBlockConfirm(ctx); });
  backdrop.querySelector('[data-cancel-block]')?.addEventListener('click', () => closeBlockConfirm(ctx));
  backdrop.querySelector('[data-confirm-block]')?.addEventListener('click', () => confirmBlockChange(ctx));
  if (!backdrop.contains(document.activeElement)) backdrop.querySelector('[data-cancel-block]')?.focus();
}

// ── Chat safety: report a message ─────────────────────────────────────────────
// Long-press (touch), right-click, or the "Report" link under a message opens this
// dialog. Same reasons and endpoint as the mobile app: POST /api/chat/report.

function chatReportPreview(message) {
  if (!message) return '';
  if (message.text) return message.text.length > 160 ? `${message.text.slice(0, 160)}…` : message.text;
  return message.mediaType === 'video' ? 'Shared a video' : 'Shared a photo';
}

function renderChatReportDialog(state, thread) {
  const report = state.chatReport;
  if (!report) return '';
  const message = (state.chatMessages || []).find((candidate) => candidate.id === report.messageId);
  const sender = thread?.participants?.find((person) => person.id === message?.senderId)?.displayName || 'Another family';
  if (report.status === 'done') {
    return `<div class="modal-backdrop chat-report-backdrop" data-chat-report-backdrop><section class="modal-dialog chat-report-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-report-title" data-chat-report-dialog><div class="chat-report-done"><span aria-hidden="true">✓</span><h2 id="chat-report-title">Thanks for letting us know</h2><p class="muted">${report.alreadyReported ? 'You already reported this message. Our team has it.' : 'Our team will review this message. The family won’t know who reported it.'}</p><div class="form-actions chat-report-done-actions">${message?.senderId && !(state.blockedFamilies || []).some((family) => family.userId === message.senderId) ? `<button type="button" class="secondary-button" data-block-user="${escapeAttribute(message.senderId)}" data-block-name="${escapeAttribute(chatParticipantName(thread, message.senderId))}">${escapeHtml(blockActionLabel(chatParticipantName(thread, message.senderId)).replace(/^Block/, 'Also block'))}</button>` : ''}<button type="button" data-close-chat-report>Done</button></div></div></section></div>`;
  }
  const sending = report.status === 'sending';
  const reasons = CHAT_REPORT_REASONS.map((reason) => `<label class="chat-report-reason"><input type="radio" name="chat-report-reason" value="${escapeAttribute(reason.id)}"${report.reason === reason.id ? ' checked' : ''} required /><span>${escapeHtml(reason.label)}</span></label>`).join('');
  return `<div class="modal-backdrop chat-report-backdrop" data-chat-report-backdrop><section class="modal-dialog chat-report-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-report-title" data-chat-report-dialog><div class="section-heading"><div><p class="eyebrow">Chat safety</p><h2 id="chat-report-title">Report message</h2></div><button type="button" class="icon-button" data-close-chat-report aria-label="Close report dialog">×</button></div><blockquote class="chat-report-quote"><small>${escapeHtml(sender)}</small>${escapeHtml(chatReportPreview(message))}</blockquote><form id="chat-report-form"><fieldset><legend>What’s wrong with this message?</legend>${reasons}</fieldset><label class="input-label" for="chat-report-details">Anything else we should know? <span class="muted">${report.reason === 'other' ? '(required)' : '(optional)'}</span></label><textarea id="chat-report-details" name="chat-report-details" maxlength="${CHAT_REPORT_DETAILS_MAX}" rows="3"${report.reason === 'other' ? ' required' : ''}>${escapeHtml(report.details || '')}</textarea><p class="chat-report-note">Reports are private. If anyone is in immediate danger, call 911 or your local emergency number.</p>${report.error ? `<p class="chat-report-error" role="alert">${escapeHtml(report.error)}</p>` : ''}<div class="form-actions"><button type="submit"${sending ? ' disabled' : ''}>${sending ? 'Sending…' : 'Send report'}</button><button type="button" class="secondary-button" data-close-chat-report>Cancel</button></div></form></section></div>`;
}

function openChatReport(ctx, messageId) {
  const { state } = ctx;
  if (!messageId || state.chatReport?.messageId === messageId) return;
  if ((state.reportedChatMessageIds || []).includes(messageId)) return;
  state.chatReport = { messageId, reason: '', details: '', status: 'idle', error: '' };
  ctx.renderCurrent();
  document.querySelector('#chat-report-form input[name="chat-report-reason"]')?.focus();
}

function closeChatReport(ctx) {
  ctx.state.chatReport = null;
  ctx.renderCurrent();
}

function readChatReportForm(state, form) {
  state.chatReport.reason = form.querySelector('input[name="chat-report-reason"]:checked')?.value || '';
  state.chatReport.details = form.elements.namedItem('chat-report-details')?.value || '';
}

async function submitChatReport(ctx, event) {
  event.preventDefault();
  const { state } = ctx;
  const report = state.chatReport;
  if (!report || report.status === 'sending') return;
  readChatReportForm(state, event.currentTarget);
  const checked = normalizeChatReport(report);
  if (checked.error) {
    report.error = checked.error;
    ctx.renderCurrent();
    return;
  }
  report.status = 'sending';
  report.error = '';
  ctx.renderCurrent();
  try {
    const data = await apiRequest('/chat/report', { method: 'POST', body: JSON.stringify({ messageId: checked.messageId, reason: checked.reason, details: checked.details }) });
    if (state.chatReport !== report) return;
    report.status = 'done';
    report.alreadyReported = Boolean(data.report?.alreadyReported);
    state.reportedChatMessageIds = [...new Set([...(state.reportedChatMessageIds || []), report.messageId])];
  } catch (error) {
    if (state.chatReport !== report) return;
    report.status = 'idle';
    report.error = `Couldn’t send the report: ${error.message}`;
  }
  ctx.renderCurrent();
}

const LONG_PRESS_MS = 500;

function bindChatReportInteractions(ctx) {
  document.querySelectorAll('[data-report-chat-message]').forEach((button) => button.addEventListener('click', () => openChatReport(ctx, button.dataset.reportChatMessage)));
  document.querySelectorAll('[data-chat-message-id]').forEach((article) => {
    const messageId = article.dataset.chatMessageId;
    // Right-click on desktop; Android Chrome also fires this on long-press.
    article.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openChatReport(ctx, messageId);
    });
    // Long-press on touch screens (iOS Safari never fires contextmenu).
    let timer = 0;
    let start = null;
    const cancel = () => { clearTimeout(timer); timer = 0; start = null; };
    article.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      start = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => { cancel(); openChatReport(ctx, messageId); }, LONG_PRESS_MS);
    });
    article.addEventListener('pointermove', (event) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => article.addEventListener(type, cancel));
  });
  const backdrop = document.querySelector('[data-chat-report-backdrop]');
  if (!backdrop) return;
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeChatReport(ctx); });
  backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeChatReport(ctx); });
  backdrop.querySelectorAll('[data-close-chat-report]').forEach((button) => button.addEventListener('click', () => closeChatReport(ctx)));
  const form = document.getElementById('chat-report-form');
  form?.addEventListener('submit', (event) => submitChatReport(ctx, event));
  // Keep choices in state so a re-render doesn't drop them; "Something else" makes details required.
  form?.addEventListener('change', () => {
    const before = ctx.state.chatReport?.reason;
    readChatReportForm(ctx.state, form);
    if ((before === 'other') !== (ctx.state.chatReport.reason === 'other')) {
      ctx.renderCurrent();
      document.querySelector('#chat-report-form input[name="chat-report-reason"]:checked')?.focus();
    }
  });
  if (!backdrop.contains(document.activeElement)) backdrop.querySelector('[data-close-chat-report], input, button')?.focus();
}

export function ensureChatLoaded(ctx) {
  if (ctx.state.chatLoaded) return;
  ctx.state.chatLoaded = true;
  loadChat(ctx);
}

export function bindChatInteractions(ctx) {
  const { state } = ctx;
  document.querySelectorAll('[data-chat-contact]').forEach((button) => button.addEventListener('click', () => {
    state.activeChatContactId = button.dataset.chatContact;
    state.chatReport = null;
    state.chatMenuOpen = false;
    loadChat(ctx, state.activeChatContactId);
  }));
  document.getElementById('chat-form')?.addEventListener('submit', (event) => sendChat(ctx, event));
  bindChatReportInteractions(ctx);
  bindBlockInteractions(ctx);
  document.querySelectorAll('[data-quick-reply]').forEach((button) => button.addEventListener('click', () => {
    const input = document.querySelector('#chat-form input[name="chat-text"]');
    if (!input) return;
    input.value = button.dataset.quickReply || '';
    input.focus();
  }));
}

const resourceFallbackImages = [
  '/illustrations/playdates.png',
  '/illustrations/family-meals.png',
  '/illustrations/family-logistics.png',
  '/backgrounds/parenting-playground-default.png',
  '/backgrounds/parenting-art-table-default.png',
];

function renderResourceCard(resource, index, usedImages) {
  let image = resource.thumbnailUrl || '';
  if (!image || usedImages.has(image)) image = resourceFallbackImages[index % resourceFallbackImages.length];
  usedImages.add(image);
  return `<article class="resource-card"><img src="${escapeAttribute(image)}" alt="" loading="lazy" /><div><span>${escapeHtml(resource.tag || 'Parenting tips')}</span><h3>${escapeHtml(resource.title)}</h3>${resource.summary ? `<p>${escapeHtml(resource.summary)}</p>` : ''}<a class="mini-link" href="${escapeAttribute(resource.url)}" target="_blank" rel="noreferrer">Read article</a></div></article>`;
}

export function renderSocial(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile, 'your child');
  const ageLabel = childAgeLabel(childProfile) || 'your child’s age range';
  ensureChatLoaded(ctx);
  if (!state.parentingResourcesStatus) loadParentingResources(ctx);

  const usedResourceImages = new Set();
  ctx.layout(`<main class="stack"><section class="panel chat-panel"><div class="section-heading"><div><p class="eyebrow">Your playdate circle</p><h2>Chat</h2><p class="muted">Keep plans, hellos, and meetup details together with the families you connect with.</p></div></div>${renderChat(ctx)}${state.chatStatus ? `<p class="muted">${escapeHtml(state.chatStatus)}</p>` : ''}</section><section class="panel"><div class="section-heading"><div><p class="eyebrow">For your family</p><h2>Parenting resources</h2><p class="muted">${escapeHtml(state.parentingResourcesStatus || `Matching ParentMap articles to ${ageLabel}.`)}</p></div><button id="refresh-parenting-resources" type="button" class="secondary-button small-button">Refresh</button></div><div class="resource-grid">${state.parentingResources.length ? state.parentingResources.map((resource, index) => renderResourceCard(resource, index, usedResourceImages)).join('') : '<p class="muted">Age-matched articles will appear here.</p>'}</div></section></main>`);

  bindChatInteractions(ctx);
  document.getElementById('refresh-parenting-resources')?.addEventListener('click', () => loadParentingResources(ctx, true));
}
