/* Donor board — search, filters, sort, nearest-first, share, reveal */

import { BLOOD_GROUPS, GROUP_META, timeAgo, formatDate } from './blood.js';
import { compatibleDonorGroups } from './blood.js';
import { subscribeDonors, updateDonor, deleteDonor, isLive, nextEligibleDate } from './data.js';
import { icon, bloodBadge, avatar, toast, dialog, shareUrl, revealPhone, modePill, initReveal, escapeHtml as _e } from './ui.js';
import { DISTRICTS, donorCoords, haversineKm, distanceLabel, getPosition } from './geo.js';


const state = {
  rows: [],
  q: '',
  group: 'ALL',
  compat: '',
  district: 'ALL',
  onlyAvailable: true,
  sort: 'recent',
  me: null,          // {lat,lng}
  distances: new Map(),
  shown: 24,
  admin: false,
  mode: 'local'
};

export async function initDonorBoard(opts = {}) {
  const host = document.getElementById('donorGrid');
  if (!host) return;

  state.admin = opts.admin === true;
  host.innerHTML = skeleton(8);

  // Restore from URL (?group=O-&q=mirpur&district=Dhaka)
  const sp = new URLSearchParams(location.search);
  if (sp.get('group')) state.group = sp.get('group').toUpperCase();
  if (sp.get('q')) state.q = sp.get('q');
  if (sp.get('district')) state.district = sp.get('district');
  if (sp.get('compat')) state.compat = sp.get('compat').toUpperCase();
  if (sp.get('sort') === 'nearest') state.sort = 'nearest';

  wireControls();
  applyCompatBanner();

  subscribeDonors((rows, mode) => {
    state.rows = rows; state.mode = mode;
    const pill = document.getElementById('modePill');
    if (pill) pill.innerHTML = modePill(mode, rows.length);
    render();
  });

  if (state.sort === 'nearest') askLocation(true);
}

function wireControls() {
  const $ = (id) => document.getElementById(id);

  const search = $('donorSearch');
  if (search) {
    search.value = state.q;
    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); state.shown = 24; render(); }, 160); });
  }

  document.querySelectorAll('[data-group-chip]').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.groupChip === state.group);
    chip.addEventListener('click', () => {
      state.group = chip.dataset.groupChip;
      state.compat = '';
      applyCompatBanner();
      document.querySelectorAll('[data-group-chip]').forEach((c) => c.classList.toggle('is-active', c === chip));
      state.shown = 24; render();
    });
  });

  const district = $('districtFilter');
  if (district) {
    district.innerHTML = `<option value="ALL">All districts</option>` + DISTRICTS.map((d) => `<option value="${d}">${d}</option>`).join('');
    district.value = state.district;
    district.addEventListener('change', () => { state.district = district.value; state.shown = 24; render(); });
  }

  const avail = $('onlyAvailable');
  if (avail) {
    avail.checked = state.onlyAvailable;
    avail.addEventListener('change', () => { state.onlyAvailable = avail.checked; state.shown = 24; render(); });
  }

  const sort = $('sortBy');
  if (sort) {
    sort.value = state.sort;
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      if (state.sort === 'nearest') askLocation();
      render();
    });
  }

  const locate = $('btnLocate');
  if (locate) locate.addEventListener('click', () => askLocation());

  const reset = $('btnReset');
  if (reset) reset.addEventListener('click', () => {
    state.q = ''; state.group = 'ALL'; state.district = 'ALL'; state.compat = ''; state.onlyAvailable = true; state.sort = 'recent'; state.shown = 24;
    if (search) search.value = '';
    if (district) district.value = 'ALL';
    if (avail) avail.checked = true;
    if (sort) sort.value = 'recent';
    document.querySelectorAll('[data-group-chip]').forEach((c) => c.classList.toggle('is-active', c.dataset.groupChip === 'ALL'));
    applyCompatBanner();
    render();
  });
}

function applyCompatBanner() {
  const el = document.getElementById('compatBanner');
  if (!el) return;
  if (!state.compat) { el.hidden = true; el.innerHTML = ''; return; }
  const groups = compatibleDonorGroups(state.compat);
  el.hidden = false;
  el.innerHTML = `${icon('info')}<span>Patient needs <strong>${state.compat}</strong> — showing donors whose group is compatible: <strong>${groups.join(', ')}</strong>.</span>
    <button class="link-btn" id="clearCompat">Clear</button>`;
  el.querySelector('#clearCompat').addEventListener('click', () => {
    state.compat = ''; state.group = 'ALL';
    document.querySelectorAll('[data-group-chip]').forEach((c) => c.classList.toggle('is-active', c.dataset.groupChip === 'ALL'));
    applyCompatBanner(); render();
  });
}

async function askLocation(silent = false) {
  const res = await getPosition();
  if (res.error) {
    if (!silent) toast(res.error === 'denied' ? 'Location permission denied — sorting by newest instead.' : 'Could not read your location on this device.', 'error');
    state.me = null;
    const sort = document.getElementById('sortBy');
    if (sort && sort.value === 'nearest') { state.sort = 'recent'; sort.value = 'recent'; }
    render();
    return;
  }
  state.me = { lat: res.lat, lng: res.lng };
  document.getElementById('locateStatus')?.setAttribute('data-on', 'true');
  if (!silent) toast('Sorted by distance from your location.', 'success');
  render();
}

/* --------------------------------------------------- filtering */
function visible() {
  const q = state.q.toLowerCase();
  const compat = state.compat ? compatibleDonorGroups(state.compat) : null;
  let out = state.rows.filter((d) => {
    if (d.status === 'suspended') return false;
    if (state.onlyAvailable && d.available === false) return false;
    if (state.group !== 'ALL' && String(d.bloodGroup).toUpperCase() !== state.group) return false;
    if (compat && !compat.includes(String(d.bloodGroup).toUpperCase())) return false;
    if (state.district !== 'ALL' && d.district !== state.district) return false;
    if (q) {
      const hay = `${d.name} ${d.area} ${d.district} ${d.bloodGroup} ${d.note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  out.forEach((d) => {
    const c = donorCoords(d);
    state.distances.set(d.id, state.me && c ? haversineKm([state.me.lat, state.me.lng], c.coords) : null);
  });

  const by = {
    recent: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    nearest: (a, b) => {
      const da = state.distances.get(a.id), db = state.distances.get(b.id);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    },
    group: (a, b) => String(a.bloodGroup).localeCompare(String(b.bloodGroup)),
    name: (a, b) => String(a.name).localeCompare(String(b.name))
  };
  out.sort(by[state.sort] || by.recent);
  return out;
}

/* ------------------------------------------------------ render */
function render() {
  const host = document.getElementById('donorGrid');
  if (!host) return;
  const list = visible();
  const countEl = document.getElementById('resultCount');
  if (countEl) countEl.textContent = `${list.length} donor${list.length === 1 ? '' : 's'} found`;

  if (!list.length) {
    host.innerHTML = `<div class="empty">
      <div class="empty-mark">${icon('search')}</div>
      <h3>No donor matches these filters</h3>
      <p>Try clearing the district filter, or include donors who donated recently — they may still be able to help with plasma or platelets.</p>
      <div class="empty-actions">
        <button class="btn btn-primary" id="emptyReset">Clear filters</button>
        <a class="btn btn-ghost" href="emergency.html">Post an emergency request</a>
      </div>
    </div>`;
    host.querySelector('#emptyReset')?.addEventListener('click', () => document.getElementById('btnReset')?.click());
    const more = document.getElementById('btnMore'); if (more) more.hidden = true;
    return;
  }

  const page = list.slice(0, state.shown);
  host.innerHTML = page.map(card).join('');
  const more = document.getElementById('btnMore');
  if (more) {
    more.hidden = list.length <= state.shown;
    more.textContent = `Show ${Math.min(24, list.length - state.shown)} more`;
    more.onclick = () => { state.shown += 24; render(); };
  }
  wireCards(host);
  initReveal(host);
}

function card(d) {
  const g = String(d.bloodGroup).toUpperCase();
  const dist = state.distances.get(d.id);
  const eligible = nextEligibleDate(d);
  const eligibleFuture = eligible && new Date(eligible) > new Date();
  const available = d.available !== false;
  const meta = GROUP_META[g] || { note: '' };
  const place = [d.area, d.district].filter(Boolean).join(', ') || 'Bangladesh';

  return `<article class="donor-card ${available ? '' : 'is-busy'}" style="--hue:${(GROUP_META[g] || {}).hue || 355}" data-id="${d.id}" data-reveal>
    <div class="dc-top">
      ${avatar(d.name, g)}
      <div class="dc-id">
        <h3 class="dc-name">${_e(d.name)}${d.status === 'verified' ? `<span class="tick" title="Verified by the team">${icon('check')}</span>` : ''}</h3>
        <p class="dc-place">${icon('pin')}<span>${_e(place)}</span></p>
      </div>
      ${bloodBadge(g, 'lg')}
    </div>

    <div class="dc-tags">
      <span class="tag ${available ? 'tag-ok' : 'tag-off'}">${available ? 'Available now' : `Busy — back ${formatDate(eligible)}`}</span>
      ${dist != null ? `<span class="tag tag-dist" title="Approximate distance">${icon('pin')}${distanceLabel(dist)}</span>` : ''}
      ${d.donations ? `<span class="tag">${d.donations} donation${d.donations > 1 ? 's' : ''}</span>` : ''}
      ${d.age ? `<span class="tag">Age ${d.age}</span>` : ''}
    </div>

    ${d.note ? `<p class="dc-note">${_e(d.note)}</p>` : ''}

    <p class="dc-fact muted small">${_e(meta.note)} · Listed ${timeAgo(d.createdAt)}</p>

    <div class="dc-actions">
      <button class="btn btn-primary btn-sm" data-act="reveal">${icon('phone')}<span>Show contact</span></button>
      <button class="btn btn-ghost btn-sm" data-act="share">${icon('share')}<span>Share</span></button>
      <button class="btn btn-ghost btn-sm" data-act="info" aria-label="About this donor">${icon('info')}</button>
      ${state.admin ? `<button class="btn btn-ghost btn-sm" data-act="verify" aria-label="Verify">${icon('star')}</button>
      <button class="btn btn-ghost btn-sm" data-act="toggle" aria-label="Toggle availability">${available ? icon('clock') : icon('check')}</button>
      <button class="btn btn-ghost btn-sm danger" data-act="delete" aria-label="Delete">${icon('trash')}</button>` : ''}
    </div>
  </article>`;
}

function wireCards(host) {
  host.querySelectorAll('.donor-card').forEach((el) => {
    const d = state.rows.find((r) => r.id === el.dataset.id);
    if (!d) return;
    el.querySelector('[data-act="reveal"]')?.addEventListener('click', () => revealPhone(d.phone, 'donor'));
    el.querySelector('[data-act="share"]')?.addEventListener('click', () => shareDonor(d));
    el.querySelector('[data-act="info"]')?.addEventListener('click', () => donorInfo(d));
    el.querySelector('[data-act="verify"]')?.addEventListener('click', async () => {
      const next = d.status === 'verified' ? 'pending' : 'verified';
      await updateDonor(d.id, { status: next });
      toast(next === 'verified' ? 'Donor marked as verified.' : 'Verification removed.', 'success');
    });
    el.querySelector('[data-act="toggle"]')?.addEventListener('click', async () => {
      await updateDonor(d.id, { available: !(d.available !== false) });
      toast('Availability updated.', 'success');
    });
    el.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      const ok = await dialog({ title: 'Delete this donor?', body: `<p>This permanently removes <strong>${_e(d.name)}</strong> from the directory. This cannot be undone.</p>`, confirmText: 'Delete', variant: 'danger' });
      if (ok) { await deleteDonor(d.id); toast('Donor deleted.', 'success'); }
    });
  });
}

function donorInfo(d) {
  const g = String(d.bloodGroup).toUpperCase();
  const eligible = nextEligibleDate(d);
  dialog({
    title: d.name,
    body: `<div class="info-grid">
      <div>${bloodBadge(g, 'lg')}</div>
      <dl>
        <dt>Blood group</dt><dd>${g} — ${(GROUP_META[g] || {}).label || ''}</dd>
        <dt>Location</dt><dd>${_e([d.area, d.district].filter(Boolean).join(', '))}</dd>
        <dt>Status</dt><dd>${d.available !== false ? 'Available now' : `Cooling-off until ${formatDate(eligible)}`}</dd>
        <dt>Last donation</dt><dd>${d.lastDonation ? formatDate(d.lastDonation) : 'Not recorded'}</dd>
        <dt>Total donations</dt><dd>${d.donations || 0}</dd>
        <dt>Listed</dt><dd>${timeAgo(d.createdAt)}</dd>
      </dl>
      <p class="muted small">Phone numbers stay hidden until you tap “Show contact”, and every reveal is rate-limited to protect donors from spam.</p>
    </div>`,
    confirmText: 'Close', hideCancel: true
  });
}

export function shareDonor(d) {
  const url = new URL('donors.html', location.href);
  url.searchParams.set('group', d.bloodGroup);
  url.searchParams.set('q', d.name);
  const text = `${d.name} (${d.bloodGroup}) is a registered blood donor on One Drop — ${[d.area, d.district].filter(Boolean).join(', ')}.`;
  shareUrl(url.toString(), text);
}

function skeleton(n) {
  return Array.from({ length: n }).map(() => `<div class="donor-card skeleton" aria-hidden="true">
    <div class="dc-top"><span class="sk-avatar"></span><div class="sk-lines"><i></i><i></i></div><span class="sk-badge"></span></div>
    <div class="sk-tags"><i></i><i></i><i></i></div>
    <div class="sk-line"></div>
    <div class="sk-line short"></div>
  </div>`).join('');
}
