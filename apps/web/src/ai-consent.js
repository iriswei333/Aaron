// AI consent on the web (Apple Guideline 5.1.2(i), same text as the mobile sheet:
// @sproutcue/shared/ai-consent). Every AI action goes through withAiConsent(ctx, action):
// with consent it runs right away; without, the consent dialog opens and the action runs
// only after the parent chooses "Allow AI features". The server refuses AI requests without
// consent (403 AI_CONSENT_REQUIRED); handleAiConsentError() turns that into the same dialog.
import { AI_CONSENT_VERSION, aiConsentCopy, hasAiConsent, isAiConsentError } from '@sproutcue/shared/ai-consent';
import { getChildProfile } from '@sproutcue/shared/profile-defaults';
import { apiRequest, escapeHtml } from './shared.js';

let pendingAction = null;

function consentLanguage(state) {
  return getChildProfile(state.user)?.storyLanguage === 'zh-CN' ? 'zh-CN' : 'en';
}

/** Runs `action` once AI consent exists, asking for it first when needed. */
export function withAiConsent(ctx, action) {
  if (hasAiConsent(ctx.state.user)) return action();
  pendingAction = action;
  ctx.state.aiConsentPrompt = { saving: false, error: '' };
  ctx.renderCurrent();
  return undefined;
}

/**
 * For catch blocks: true when `error` (an ApiError or a JSON body) is AI_CONSENT_REQUIRED.
 * Then consent is cleared locally and the dialog opens; `retry` runs if the parent allows.
 */
export function handleAiConsentError(ctx, error, retry = null) {
  if (!isAiConsentError(error)) return false;
  if (ctx.state.user) ctx.state.user = { ...ctx.state.user, aiConsent: null };
  pendingAction = retry;
  ctx.state.aiConsentPrompt = { saving: false, error: '' };
  return true;
}

export function aiConsentMarkup(state) {
  const prompt = state.aiConsentPrompt;
  if (!prompt) return '';
  const copy = aiConsentCopy(consentLanguage(state));
  return `<div class="modal-backdrop ai-consent-backdrop" data-ai-consent-backdrop><section class="modal-dialog ai-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" aria-describedby="ai-consent-intro" tabindex="-1"><span class="ai-consent-icon" aria-hidden="true">✦</span><p class="eyebrow">${escapeHtml(copy.eyebrow)}</p><h2 id="ai-consent-title">${escapeHtml(copy.title)}</h2><p id="ai-consent-intro">${escapeHtml(copy.intro)}</p><ul class="ai-consent-list">${copy.sends.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p class="ai-consent-never"><strong>${escapeHtml(copy.neverSends)}</strong></p><p class="muted">${escapeHtml(copy.provider)}</p><p class="muted">${escapeHtml(copy.control)} <a href="/privacy" target="_blank" rel="noreferrer">${escapeHtml(copy.privacyLink)}</a></p>${prompt.error ? `<p class="chat-report-error" role="alert">${escapeHtml(prompt.error)}</p>` : ''}<div class="form-actions"><button type="button" data-ai-consent-allow${prompt.saving ? ' disabled' : ''}>${prompt.saving ? 'One moment…' : escapeHtml(copy.allow)}</button><button type="button" class="secondary-button" data-ai-consent-decline${prompt.saving ? ' disabled' : ''}>${escapeHtml(copy.decline)}</button></div></section></div>`;
}

function close(ctx) {
  pendingAction = null;
  ctx.state.aiConsentPrompt = null;
  ctx.renderCurrent();
}

export function bindAiConsentUi(ctx) {
  const { state } = ctx;
  const backdrop = document.querySelector('[data-ai-consent-backdrop]');
  if (!backdrop) return;
  backdrop.querySelector('[data-ai-consent-allow]')?.addEventListener('click', async () => {
    state.aiConsentPrompt = { saving: true, error: '' };
    ctx.renderCurrent();
    try {
      const result = await apiRequest('/ai-consent', { method: 'PUT', body: JSON.stringify({ version: AI_CONSENT_VERSION }) });
      state.user = result.user;
      state.aiConsentPrompt = null;
      const action = pendingAction;
      pendingAction = null;
      ctx.renderCurrent();
      if (action) action();
    } catch (error) {
      state.aiConsentPrompt = { saving: false, error: error.message || 'Could not save your choice. Please try again.' };
      ctx.renderCurrent();
    }
  });
  backdrop.querySelector('[data-ai-consent-decline]')?.addEventListener('click', () => close(ctx));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop && !state.aiConsentPrompt?.saving) close(ctx); });
  backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !state.aiConsentPrompt?.saving) close(ctx); });
  backdrop.querySelector('[data-ai-consent-allow]')?.focus();
}

/** Family tab panel: whether AI features are on, with a button to turn them on or off. */
export function aiConsentSettingsMarkup(state) {
  const copy = aiConsentCopy(consentLanguage(state));
  const allowed = hasAiConsent(state.user);
  const grantedAt = state.user?.aiConsent?.grantedAt;
  const date = grantedAt ? new Date(grantedAt).toLocaleDateString(consentLanguage(state) === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const button = allowed
    ? `<button type="button" class="secondary-button" data-ai-consent-revoke${state.aiConsentBusy ? ' disabled' : ''}>${state.aiConsentBusy ? 'One moment…' : escapeHtml(copy.turnOff)}</button>`
    : `<button type="button" class="secondary-button" data-ai-consent-open>${escapeHtml(copy.allow)}</button>`;
  return `<section class="panel ai-consent-panel"><div class="section-heading"><div><p class="eyebrow">Privacy</p><h2>${escapeHtml(copy.settingsTitle)}</h2><p class="muted">${escapeHtml(allowed ? copy.statusOn(date) : copy.statusOff)}</p></div><span class="privacy-pill">${allowed ? 'On' : 'Off'}</span></div>${button}${state.aiConsentStatus ? `<p class="studio-message" role="status">${escapeHtml(state.aiConsentStatus)}</p>` : ''}<p class="help-contact"><a href="/privacy" target="_blank" rel="noreferrer">${escapeHtml(copy.privacyLink)}</a></p></section>`;
}

export function bindAiConsentSettings(ctx) {
  const { state } = ctx;
  const copy = aiConsentCopy(consentLanguage(state));
  document.querySelector('[data-ai-consent-open]')?.addEventListener('click', () => {
    state.aiConsentStatus = '';
    withAiConsent(ctx, () => ctx.renderCurrent());
  });
  document.querySelector('[data-ai-consent-revoke]')?.addEventListener('click', async () => {
    if (!globalThis.confirm(copy.turnOffConfirm)) return;
    state.aiConsentBusy = true;
    state.aiConsentStatus = '';
    ctx.renderCurrent();
    try {
      const result = await apiRequest('/ai-consent', { method: 'DELETE' });
      state.user = result.user;
      state.aiConsentStatus = copy.revoked;
    } catch (error) {
      state.aiConsentStatus = error.message || 'Could not turn off AI features. Please try again.';
    }
    state.aiConsentBusy = false;
    ctx.renderCurrent();
  });
}
