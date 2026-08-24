import { escapeAttribute, escapeHtml } from '../shared.js';
import { AVAILABILITY_DAY_OPTIONS, PROFILE_VISIBILITY_OPTIONS, childDisplayName, getChildProfile, MAX_SEARCH_RADIUS_MILES, MIN_SEARCH_RADIUS_MILES, normalizePlayPreferences } from '../../lib/profile-defaults.js';

function profilePlayDateTime(playDate) {
  const startsAt = new Date(playDate.startsAt);
  const endsAt = new Date(playDate.endsAt);
  if (Number.isNaN(startsAt.getTime())) return { date: 'Time not set', time: '' };
  const date = startsAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const end = Number.isNaN(endsAt.getTime()) ? '' : ` – ${endsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return { date, time: `${start}${end}` };
}

export function renderFamilyProfile(ctx) {
  const { state } = ctx;
  const active = getChildProfile(state.user);
  const location = state.user?.location;
  const locationLabel = location?.address || location?.label || active.homeCity || 'No location saved';
  const playPreferences = normalizePlayPreferences(state.user?.playPreferences);
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
  const availabilityMarkup = AVAILABILITY_DAY_OPTIONS.map(([value, label]) => `<button type="button" class="availability-day ${playPreferences.availabilityDays.includes(value) ? 'selected' : ''}" data-availability-day="${value}" aria-pressed="${playPreferences.availabilityDays.includes(value) ? 'true' : 'false'}">${label}</button>`).join('');
  const visibilityOptions = PROFILE_VISIBILITY_OPTIONS.map(([value, label]) => `<option value="${value}" ${playPreferences.visibility === value ? 'selected' : ''}>${label}</option>`).join('');
  const blockedFamilies = playPreferences.blockedFamilies || [];
  ctx.layout(`<main class="stack profile-screen">
    <section class="profile-hero panel">
      <div class="profile-avatar">${escapeHtml((state.user?.displayName || 'F').slice(0, 1).toUpperCase())}</div>
      <div><p class="eyebrow">Family profile</p><h2>${escapeHtml(state.user?.displayName || 'Your family')}</h2><p class="muted">Your private home base for playdates, chats, and family planning.</p></div>
      <button id="profile-edit-action" type="button" class="secondary-button">Edit profile</button>
    </section>
    <section class="grid two-cols">
      <div class="panel"><div class="section-heading"><div><p class="eyebrow">Your playdates</p><h2>${profilePlayDates.length} ${profilePlayDates.length === 1 ? 'playdate' : 'playdates'}</h2></div></div><div class="profile-playdate-list">${playdateListMarkup}</div></div>
      <div class="panel"><p class="eyebrow">Play preferences</p><h2>Make nearby feel personal</h2><div class="profile-stat"><span>Home base</span><strong>${escapeHtml(locationLabel)}</strong></div><div class="profile-stat"><span>Planning for</span><strong>${escapeHtml(childDisplayName(active, 'your child'))}</strong></div><div class="profile-stat"><span>Location sharing</span><strong>${location?.latitude && location?.longitude ? 'Precise location saved' : 'City-level only'}</strong></div><label class="profile-radius-setting" for="play-radius"><span>Search radius <strong id="play-radius-value">${playPreferences.searchRadiusMiles} miles</strong></span><input id="play-radius" type="range" min="${MIN_SEARCH_RADIUS_MILES}" max="${MAX_SEARCH_RADIUS_MILES}" step="1" value="${playPreferences.searchRadiusMiles}" /><small>Drag to choose how far SproutCue looks for playgrounds and family-friendly places.</small></label><div class="availability-setting"><div class="profile-setting-label"><span>Usually free</span><small>Help nearby families find a good time to play.</small></div><div class="availability-days" aria-label="Usually free days">${availabilityMarkup}</div></div><p id="play-preferences-status" class="profile-setting-status" aria-live="polite"></p><button id="profile-play-action" type="button">Find nearby play</button></div>
    </section>
    <section class="grid two-cols profile-safety-grid"><div class="panel profile-privacy"><div><p class="eyebrow">Visibility</p><h2>Choose who can find you</h2><p class="muted">This controls how your family appears in nearby matching and playdate discovery.</p></div><label class="visibility-control" for="profile-visibility"><span>Family visibility</span><select id="profile-visibility">${visibilityOptions}</select></label></div><div class="panel blocked-families-panel"><div class="section-heading"><div><p class="eyebrow">Trust & safety</p><h2>Blocked families</h2></div><span class="privacy-pill">${blockedFamilies.length}</span></div><p class="muted">Blocked families cannot appear in your nearby matching suggestions.</p><form id="blocked-family-form" class="blocked-family-form"><input id="blocked-family-name" maxlength="80" placeholder="Family name to block" aria-label="Family name to block" /><button type="submit" class="secondary-button">Block</button></form><div class="blocked-family-list">${blockedFamilies.length ? blockedFamilies.map((family) => `<div class="blocked-family-row"><span>${escapeHtml(family)}</span><button type="button" class="text-button" data-unblock-family="${escapeAttribute(family)}">Unblock</button></div>`).join('') : '<small>No families blocked.</small>'}</div></div></section>
  </main>`);
  document.getElementById('profile-edit-action')?.addEventListener('click', () => { state.showProfileSetup = true; state.profileDraft = null; ctx.renderCurrent(); });
  document.getElementById('profile-play-action')?.addEventListener('click', () => { state.tab = 'play'; ctx.renderCurrent(); });
  document.getElementById('play-radius')?.addEventListener('input', (event) => {
    const miles = Number(event.target.value);
    const value = document.getElementById('play-radius-value');
    if (value) value.textContent = `${miles} mile${miles === 1 ? '' : 's'}`;
  });
  document.getElementById('play-radius')?.addEventListener('change', async (event) => {
    const status = document.getElementById('play-preferences-status');
    const searchRadiusMiles = Number(event.target.value);
    status.textContent = 'Saving…';
    const saved = await ctx.saveUserSection('play-preferences', { searchRadiusMiles });
    if (saved) {
      status.textContent = `Nearby search now covers ${searchRadiusMiles} mile${searchRadiusMiles === 1 ? '' : 's'}.`;
      state.nearbyPlayOptions = [];
      state.nearbyPlayDatesRequestKey = '';
    } else {
      status.textContent = 'Could not save this preference.';
    }
  });
  document.querySelectorAll('[data-availability-day]').forEach((button) => button.addEventListener('click', async () => {
    const days = new Set(playPreferences.availabilityDays);
    const day = button.dataset.availabilityDay;
    if (days.has(day)) days.delete(day); else days.add(day);
    button.classList.toggle('selected', days.has(day));
    button.setAttribute('aria-pressed', days.has(day) ? 'true' : 'false');
    await ctx.saveUserSection('play-preferences', { availabilityDays: [...days] });
  }));
  document.getElementById('profile-visibility')?.addEventListener('change', (event) => {
    ctx.saveUserSection('play-preferences', { visibility: event.target.value });
  });
  document.getElementById('blocked-family-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('blocked-family-name');
    const family = input.value.trim();
    if (!family) return;
    await ctx.saveUserSection('play-preferences', { blockedFamilies: [...blockedFamilies, family] });
    ctx.renderCurrent();
  });
  document.querySelectorAll('[data-unblock-family]').forEach((button) => button.addEventListener('click', () => {
    ctx.saveUserSection('play-preferences', { blockedFamilies: blockedFamilies.filter((family) => family !== button.dataset.unblockFamily) }).then(() => ctx.renderCurrent());
  }));
}
