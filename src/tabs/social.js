import { apiRequest, escapeAttribute, escapeHtml } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile } from '../../lib/profile-defaults.js';

export function resetSocialState(state) {
  state.chatContacts = [];
  state.chatMessages = [];
  state.activeChatContactId = '';
  state.chatStatus = '';
  state.parentingResources = [];
  state.parentingResourcesStatus = '';
  state.parentingResourcesAgeFilter = '';
}

async function loadChat(ctx, contactId = '') {
  const { state } = ctx;
  try {
    const data = await apiRequest(`/chat${contactId ? `?threadId=${encodeURIComponent(contactId)}` : ''}`);
    state.chatContacts = data.threads || [];
    state.chatMessages = data.messages || [];
    if (!state.activeChatContactId && state.chatContacts[0]) state.activeChatContactId = state.chatContacts[0].id;
    if (!contactId && state.chatContacts[0]) {
      const selectedId = state.chatContacts.find((thread) => thread.id === state.activeChatContactId)?.id || state.chatContacts[0].id;
      if (!data.messages?.length) {
        const selected = await apiRequest(`/chat?threadId=${encodeURIComponent(selectedId)}`);
        state.chatMessages = selected.messages || [];
      }
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

function renderChat(ctx) {
  const { state } = ctx;
  const contacts = state.chatContacts || [];
  const active = contacts.find((contact) => contact.id === state.activeChatContactId) || contacts[0];
  const contactList = contacts.length
    ? contacts.map((contact) => `<button type="button" class="chat-contact ${active?.id === contact.id ? 'selected' : ''}" data-chat-contact="${escapeAttribute(contact.id)}"><span class="avatar">${contact.type === 'playdate' ? '👥' : escapeHtml((contact.title || 'P').slice(0, 1).toUpperCase())}</span><span>${escapeHtml(contact.title || 'Chat')}<small>${contact.type === 'playdate' ? `${contact.participantIds?.length || 0} families` : 'Direct chat'}</small></span></button>`).join('')
    : '<p class="muted">Join a playdate to open its family thread, or start a direct chat from a connected family.</p>';
  const messages = active
    ? (state.chatMessages || []).map((message) => `<article class="chat-message ${message.senderId === state.user?.id ? 'mine' : ''}">${message.mediaUrl ? (message.mediaType === 'video' ? `<video src="${escapeAttribute(message.mediaUrl)}" controls></video>` : `<img src="${escapeAttribute(message.mediaUrl)}" alt="Shared photo" />`) : ''}${message.text ? `<p>${escapeHtml(message.text)}</p>` : ''}<small>${new Date(message.createdAt).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}</small></article>`).join('')
    : '';
  return `<div class="chat-layout"><aside class="chat-contacts">${contactList}</aside><section class="chat-thread">${active ? `<div class="chat-thread-heading"><strong>${escapeHtml(active.title || 'Chat')}</strong><small>${active.type === 'playdate' ? 'Everyone in this playdate is included' : 'Private 1:1 conversation'}</small></div><div class="chat-messages">${messages || '<p class="muted">Say hello and make the meetup easy.</p>'}</div><form id="chat-form" class="chat-compose"><input name="chat-text" placeholder="Message, emoji, or meetup note…" maxlength="2000" /><label class="chat-attach" title="Attach photo or short video">＋<input name="chat-media" type="file" accept="image/*,video/*" /></label><button type="submit">Send</button></form>` : '<div class="chat-empty"><span>💬</span><p>Your playdate family threads will appear here.</p></div>'}</section></div>`;
}

function renderResourceCard(resource) {
  const image = resource.thumbnailUrl || 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=640&q=80';
  return `<article class="resource-card"><img src="${escapeAttribute(image)}" alt="" loading="lazy" /><div><span>${escapeHtml(resource.tag || 'Parenting tips')}</span><h3>${escapeHtml(resource.title)}</h3>${resource.summary ? `<p>${escapeHtml(resource.summary)}</p>` : ''}<a class="mini-link" href="${escapeAttribute(resource.url)}" target="_blank" rel="noreferrer">Read article</a></div></article>`;
}

export function renderSocial(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile, 'your child');
  const ageLabel = childAgeLabel(childProfile) || 'your child’s age range';
  if (!state.chatContacts.length) loadChat(ctx);
  if (!state.parentingResourcesStatus) loadParentingResources(ctx);

  ctx.layout(`<main class="stack"><section class="panel chat-panel"><div class="section-heading"><div><p class="eyebrow">Your playdate circle</p><h2>Chat</h2><p class="muted">Keep plans, hellos, and meetup details together with the families you connect with.</p></div></div>${renderChat(ctx)}${state.chatStatus ? `<p class="muted">${escapeHtml(state.chatStatus)}</p>` : ''}</section><section class="panel"><div class="section-heading"><div><p class="eyebrow">For your family</p><h2>Parenting resources</h2><p class="muted">${escapeHtml(state.parentingResourcesStatus || `Matching ParentMap articles to ${ageLabel}.`)}</p></div><button id="refresh-parenting-resources" type="button" class="secondary-button small-button">Refresh</button></div><div class="resource-grid">${state.parentingResources.length ? state.parentingResources.map(renderResourceCard).join('') : '<p class="muted">Age-matched articles will appear here.</p>'}</div></section></main>`);

  document.querySelectorAll('[data-chat-contact]').forEach((button) => button.addEventListener('click', () => {
    state.activeChatContactId = button.dataset.chatContact;
    loadChat(ctx, state.activeChatContactId);
  }));
  document.getElementById('chat-form')?.addEventListener('submit', (event) => sendChat(ctx, event));
  document.getElementById('refresh-parenting-resources')?.addEventListener('click', () => loadParentingResources(ctx, true));
}
