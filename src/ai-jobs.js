import { apiRequest, escapeAttribute, escapeHtml } from './shared.js';

let jobPollTimer = null;
let notificationTimer = null;

function terminal(status) { return status === 'succeeded' || status === 'failed'; }
function remainingSeconds(job) {
  const started = new Date(job?.createdAt || Date.now()).getTime();
  const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
  return Math.max(0, (Number(job?.estimatedSeconds) || 60) - elapsed);
}
function timeLabel(seconds) {
  if (seconds <= 0) return 'Finishing up…';
  const minutes = Math.floor(seconds / 60); const rest = seconds % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, '0')}` : `0:${String(rest).padStart(2, '0')}`;
}

async function pollJob(ctx) {
  const { state } = ctx;
  if (!state.activeAiJobId) return;
  try {
    const { job } = await apiRequest(`/ai-jobs?jobId=${encodeURIComponent(state.activeAiJobId)}`);
    state.aiWaitJob = job;
    if (terminal(job.status)) {
      clearInterval(jobPollTimer); jobPollTimer = null;
      state.notificationsLoaded = false;
      if (job.result?.assetType === 'picture_book') { state.pictureBooksLoaded = false; state.familyAssetsLoaded = false; }
      if (job.result?.assetType === 'toy_play') { state.toyPlayAssetsLoaded = false; state.familyAssetsLoaded = false; }
      if (job.result?.assetType === 'practice_story') { state.practiceStoryAssetsLoaded = false; state.familyAssetsLoaded = false; }
    }
    ctx.renderCurrent();
  } catch (error) {
    state.aiWaitError = error.message;
    ctx.renderCurrent();
  }
}

function ensureJobPolling(ctx) {
  if (jobPollTimer || !ctx.state.activeAiJobId || terminal(ctx.state.aiWaitJob?.status)) return;
  jobPollTimer = setInterval(() => pollJob(ctx), 3000);
}

export function startAiJobWait(ctx, job, usage = null) {
  ctx.state.activeAiJobId = job.id;
  ctx.state.aiWaitJob = job;
  ctx.state.aiWaitOpen = true;
  ctx.state.aiWaitError = '';
  ctx.state.aiUsage = usage;
  ensureJobPolling(ctx);
  ctx.renderCurrent();
}

export async function loadNotifications(ctx, { quiet = false } = {}) {
  const { state } = ctx;
  if (!state.user || state.notificationsLoading) return;
  state.notificationsLoading = true;
  try {
    const result = await apiRequest('/notifications');
    state.notifications = result.notifications || [];
    state.notificationUnreadCount = Number(result.unreadCount) || 0;
    state.notificationsLoaded = true;
  } catch (error) {
    if (!quiet) state.notificationStatus = error.message;
  }
  state.notificationsLoading = false;
  ctx.renderCurrent();
}

export function startNotificationPolling(ctx) {
  if (notificationTimer) return;
  notificationTimer = setInterval(() => loadNotifications(ctx, { quiet: true }), 10000);
}

export function resetAiUi(state) {
  if (jobPollTimer) clearInterval(jobPollTimer);
  if (notificationTimer) clearInterval(notificationTimer);
  jobPollTimer = null; notificationTimer = null;
  state.activeAiJobId = ''; state.aiWaitJob = null; state.aiWaitOpen = false; state.aiWaitError = '';
  state.notifications = []; state.notificationsLoaded = false; state.notificationsLoading = false; state.notificationUnreadCount = 0; state.showNotifications = false;
}

export function aiGlobalMarkup(state) {
  const notifications = state.notifications || [];
  const center = `<div class="ai-notification-center"><button type="button" class="ai-notification-bell" data-toggle-notifications aria-label="AI creation notifications"><span aria-hidden="true">♢</span>${state.notificationUnreadCount ? `<b>${state.notificationUnreadCount}</b>` : ''}</button>${state.showNotifications ? `<section class="ai-notification-popover" aria-label="Notifications"><header><div><p class="eyebrow">AI creations</p><h2>Notifications</h2></div><button type="button" class="icon-button" data-toggle-notifications aria-label="Close notifications">×</button></header>${state.notificationsLoading ? '<p class="muted">Loading…</p>' : notifications.length ? `<div>${notifications.map((item) => `<button type="button" class="ai-notification-item ${item.readAt ? '' : 'unread'}" data-notification-id="${escapeAttribute(item.id)}" data-notification-href="${escapeAttribute(item.href)}"><span aria-hidden="true">${item.type === 'ai_asset_failed' ? '!' : '✓'}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></span></button>`).join('')}</div>` : '<p class="muted">Your completed AI creations will appear here.</p>'}${state.notificationStatus ? `<p class="studio-message">${escapeHtml(state.notificationStatus)}</p>` : ''}</section>` : ''}</div>`;
  const job = state.aiWaitJob;
  if (!state.aiWaitOpen || !job) return center;
  const done = job.status === 'succeeded'; const failed = job.status === 'failed'; const seconds = remainingSeconds(job);
  const usage = state.aiUsage;
  const wait = `<div class="modal-backdrop ai-wait-backdrop"><section class="modal-dialog ai-wait-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-wait-title"><div class="ai-wait-orbit ${done ? 'done' : failed ? 'failed' : ''}"><span>${done ? '✓' : failed ? '!' : '✦'}</span></div><p class="eyebrow">${done ? 'Creation complete' : failed ? 'Creation paused' : 'AI is creating'}</p><h2 id="ai-wait-title">${done ? escapeHtml(job.result?.title || 'Your new creation is ready') : failed ? 'We couldn’t finish this creation' : 'Making something special…'}</h2>${done ? '<p>Your new family asset is ready to open.</p>' : failed ? `<p>${escapeHtml(job.error || 'Please try again.')}</p>` : `<p>You can stay here, or leave this window. We’ll notify you when it’s ready.</p><div class="ai-wait-countdown"><strong data-ai-countdown data-created-at="${escapeAttribute(job.createdAt)}" data-estimate="${escapeAttribute(job.estimatedSeconds)}">${timeLabel(seconds)}</strong><small>estimated time remaining</small></div><div class="ai-wait-progress"><i style="width:${Math.max(4, Math.min(100, Number(job.progress) || 4))}%"></i></div>`}${usage ? `<small class="ai-usage-note">${usage.unlimited ? 'Admin account · unlimited AI creations' : `${usage.used} of ${usage.limit} AI creations used today`}</small>` : ''}<div class="ai-wait-actions">${done ? `<button type="button" data-open-ai-result="${escapeAttribute(job.result?.href || '/family')}">Open creation</button>` : failed ? '<button type="button" data-close-ai-wait>Close</button>' : '<button type="button" class="secondary-button" data-close-ai-wait>Leave and notify me</button>'}</div>${state.aiWaitError ? `<p class="studio-message">${escapeHtml(state.aiWaitError)}</p>` : ''}</section></div>`;
  return `${center}${wait}`;
}

export function bindAiGlobalUi(ctx) {
  const { state } = ctx;
  document.querySelectorAll('[data-toggle-notifications]').forEach((button) => button.addEventListener('click', () => { state.showNotifications = !state.showNotifications; if (state.showNotifications && !state.notificationsLoaded) loadNotifications(ctx); else ctx.renderCurrent(); }));
  document.querySelectorAll('[data-notification-id]').forEach((button) => button.addEventListener('click', async () => {
    try { await apiRequest('/notifications', { method: 'PATCH', body: JSON.stringify({ notificationId: button.dataset.notificationId }) }); } catch {}
    globalThis.location.href = button.dataset.notificationHref || '/family';
  }));
  document.querySelector('[data-close-ai-wait]')?.addEventListener('click', () => { state.aiWaitOpen = false; ctx.renderCurrent(); });
  document.querySelector('[data-open-ai-result]')?.addEventListener('click', (event) => { globalThis.location.href = event.currentTarget.dataset.openAiResult; });
  const countdown = document.querySelector('[data-ai-countdown]');
  if (countdown && !terminal(state.aiWaitJob?.status)) {
    const tick = () => { if (!countdown.isConnected) return; countdown.textContent = timeLabel(remainingSeconds(state.aiWaitJob)); setTimeout(tick, 1000); };
    tick();
  }
  ensureJobPolling(ctx);
  if (state.user && !state.notificationsLoaded && !state.notificationsLoading) loadNotifications(ctx, { quiet: true });
  startNotificationPolling(ctx);
}
