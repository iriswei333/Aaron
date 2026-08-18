import { escapeHtml } from '../shared.js';
import { childAgeLabel, childDisplayName, getChildProfile, getChildProfiles } from '../../lib/profile-defaults.js';

export function renderFamilyProfile(ctx) {
  const { state } = ctx;
  const children = getChildProfiles(state.user);
  const active = getChildProfile(state.user);
  const location = state.user?.location;
  const locationLabel = location?.address || location?.label || active.homeCity || 'No location saved';
  ctx.layout(`<main class="stack profile-screen">
    <section class="profile-hero panel">
      <div class="profile-avatar">${escapeHtml((state.user?.displayName || 'F').slice(0, 1).toUpperCase())}</div>
      <div><p class="eyebrow">Family profile</p><h2>${escapeHtml(state.user?.displayName || 'Your family')}</h2><p class="muted">Your private home base for playdates, chats, and family planning.</p></div>
      <button id="profile-edit-action" type="button" class="secondary-button">Edit profile</button>
    </section>
    <section class="grid two-cols">
      <div class="panel"><div class="section-heading"><div><p class="eyebrow">Your family</p><h2>${children.length} ${children.length === 1 ? 'child' : 'children'}</h2></div></div><div class="family-member-list">${children.map((child) => { const activities = Array.isArray(child.favoriteActivities) ? child.favoriteActivities : String(child.favoriteActivities || '').split(',').map((item) => item.trim()).filter(Boolean); return `<article class="family-member"><span class="member-avatar">${escapeHtml((child.name || 'C').slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(childDisplayName(child, 'Child'))}</strong><p>${escapeHtml(childAgeLabel(child) || 'Age not set')} · ${escapeHtml(child.homeCity || 'Home city not set')}</p><small>${escapeHtml((activities.length ? activities : ['Add favorite activities']).slice(0, 3).join(' · '))}</small></div></article>`; }).join('')}</div></div>
      <div class="panel"><p class="eyebrow">Play preferences</p><h2>Make nearby feel personal</h2><div class="profile-stat"><span>Home base</span><strong>${escapeHtml(locationLabel)}</strong></div><div class="profile-stat"><span>Planning for</span><strong>${escapeHtml(childDisplayName(active, 'your child'))}</strong></div><div class="profile-stat"><span>Location sharing</span><strong>${location?.latitude && location?.longitude ? 'Precise location saved' : 'City-level only'}</strong></div><button id="profile-play-action" type="button">Find nearby play</button></div>
    </section>
    <section class="panel profile-privacy"><div><p class="eyebrow">Privacy & account</p><h2>Parent-controlled by design</h2><p class="muted">Only your family profile is used to personalize nearby suggestions. Playdate visibility is chosen each time you create one.</p></div><span class="privacy-pill">Private family account</span></section>
  </main>`);
  document.getElementById('profile-edit-action')?.addEventListener('click', () => { state.showProfileSetup = true; state.profileDraft = null; ctx.renderCurrent(); });
  document.getElementById('profile-play-action')?.addEventListener('click', () => { state.tab = 'play'; ctx.renderCurrent(); });
}
