import { apiRequest, escapeAttribute, escapeHtml } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

export function resetSocialState(state) {
  state.chatContacts = [];
  state.chatMessages = [];
  state.activeChatContactId = '';
  state.chatLoaded = false;
  state.chatStatus = '';
  state.parentingResources = [];
  state.parentingResourcesStatus = '';
  state.parentingResourcesAgeFilter = '';
}

async function loadChat(ctx, contactId = '') {
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
  if (state.tab === 'chat') ctx.renderCurrent();
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
  await apiRequest('/chat', { method: 'POST', body: JSON.stringify({ threadId: active?.id, recipientId: active?.type === 'direct' ? active.contactId || active.participantIds?.find((id) => id !== state.user?.id) : '', playDateId: active?.playDateId, text, mediaType, mediaUrl }) });
  await loadChat(ctx, state.activeChatContactId);
}

function chatThreadSchedule(thread) {
  if (thread?.type !== 'playdate' || !thread.startsAt) return '';
  const startsAt = new Date(thread.startsAt);
  const endsAt = thread.endsAt ? new Date(thread.endsAt) : null;
  if (Number.isNaN(startsAt.getTime())) return '';
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = endsAt && !Number.isNaN(endsAt.getTime())
    ? endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  return `${date} · ${start}${end ? `–${end}` : ''}`;
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

function renderChat(ctx) {
  const { state } = ctx;
  const contacts = sortChatThreads(state.chatContacts || []);
  const active = contacts.find((contact) => contact.id === state.activeChatContactId) || contacts[0];
  const contactList = contacts.length
    ? contacts.map((contact, index) => `<button type="button" class="chat-contact ${active?.id === contact.id ? 'selected' : ''}" data-chat-contact="${escapeAttribute(contact.id)}"><span class="avatar chat-thread-emoji" role="img" aria-label="Chat topic">${chatThreadEmoji(contact, index)}</span><span>${escapeHtml(contact.title || 'Chat')}<small>${contact.type === 'playdate' ? `${contact.participantIds?.length || 0} families` : 'Direct chat'}</small></span>${contact.unreadCount > 0 ? '<i class="chat-unread-dot" aria-label="Unread messages"></i>' : ''}</button>`).join('')
    : '<p class="muted">Join a playdate to open its family thread, or start a direct chat from a connected family.</p>';
  const messages = active
    ? (state.chatMessages || []).map((message) => `<article class="chat-message ${message.senderId === state.user?.id ? 'mine' : ''}">${message.senderId === state.user?.id ? userAvatarMarkup(state.user, 'chat-message-avatar', 'Your avatar') : userAvatarMarkup(null, 'chat-message-avatar', 'Family avatar')}<div class="chat-message-body">${message.mediaUrl ? (message.mediaType === 'video' ? `<video src="${escapeAttribute(message.mediaUrl)}" controls></video>` : `<img src="${escapeAttribute(message.mediaUrl)}" alt="Shared photo" />`) : ''}${message.text ? `<p>${escapeHtml(message.text)}</p>` : ''}<small>${new Date(message.createdAt).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}</small></div></article>`).join('')
    : '';
  const quickReplies = active ? quickReplySuggestions(active) : [];
  return `<div class="chat-layout"><aside class="chat-contacts">${contactList}</aside><section class="chat-thread">${active ? `<div class="chat-thread-heading"><div class="chat-thread-title"><div>${userAvatarMarkup(state.user, 'chat-header-avatar', 'Your profile avatar')}</div><div><strong>${escapeHtml(active.title || 'Chat')}</strong>${chatThreadSchedule(active) ? `<small>${escapeHtml(chatThreadSchedule(active))}</small>` : ''}<small>${active.type === 'playdate' ? 'Everyone in this playdate is included' : 'Private 1:1 conversation'}</small></div></div></div><div class="chat-messages">${messages || '<p class="muted">Say hello and make the meetup easy.</p>'}</div><div class="chat-quick-replies" aria-label="Quick reply suggestions">${quickReplies.map((reply) => `<button type="button" class="quick-reply" data-quick-reply="${escapeAttribute(reply)}">${escapeHtml(reply)}</button>`).join('')}</div><form id="chat-form" class="chat-compose"><input name="chat-text" placeholder="Message, emoji, or meetup note…" maxlength="2000" /><label class="chat-attach" title="Attach photo or short video">＋<input name="chat-media" type="file" accept="image/*,video/*" /></label><button type="submit">Send</button></form>` : '<div class="chat-empty"><span>💬</span><p>Your playdate family threads will appear here.</p></div>'}</section></div>`;
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
  if (!state.chatLoaded) {
    state.chatLoaded = true;
    loadChat(ctx);
  }
  if (!state.parentingResourcesStatus) loadParentingResources(ctx);

  const usedResourceImages = new Set();
  ctx.layout(`<main class="stack"><section class="panel chat-panel"><div class="section-heading"><div><p class="eyebrow">Your playdate circle</p><h2>Chat</h2><p class="muted">Keep plans, hellos, and meetup details together with the families you connect with.</p></div></div>${renderChat(ctx)}${state.chatStatus ? `<p class="muted">${escapeHtml(state.chatStatus)}</p>` : ''}</section><section class="panel"><div class="section-heading"><div><p class="eyebrow">For your family</p><h2>Parenting resources</h2><p class="muted">${escapeHtml(state.parentingResourcesStatus || `Matching ParentMap articles to ${ageLabel}.`)}</p></div><button id="refresh-parenting-resources" type="button" class="secondary-button small-button">Refresh</button></div><div class="resource-grid">${state.parentingResources.length ? state.parentingResources.map((resource, index) => renderResourceCard(resource, index, usedResourceImages)).join('') : '<p class="muted">Age-matched articles will appear here.</p>'}</div></section></main>`);

  document.querySelectorAll('[data-chat-contact]').forEach((button) => button.addEventListener('click', () => {
    state.activeChatContactId = button.dataset.chatContact;
    loadChat(ctx, state.activeChatContactId);
  }));
  document.getElementById('chat-form')?.addEventListener('submit', (event) => sendChat(ctx, event));
  document.querySelectorAll('[data-quick-reply]').forEach((button) => button.addEventListener('click', () => {
    const input = document.querySelector('#chat-form input[name="chat-text"]');
    if (!input) return;
    input.value = button.dataset.quickReply || '';
    input.focus();
  }));
  document.getElementById('refresh-parenting-resources')?.addEventListener('click', () => loadParentingResources(ctx, true));
}
