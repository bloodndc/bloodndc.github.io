/* Home-page statistics: totals, per-group breakdown bars, compatibility widget */

import { BLOOD_GROUPS, GROUP_META, compatibleDonorGroups, daysBetween } from './blood.js';
import { countUp, escapeHtml, bloodBadge, icon } from './ui.js';
import { DONATION_COOLDOWN_DAYS } from './config.js';

export function computeStats(donors) {
  const list = Array.isArray(donors) ? donors : [];
  const active = list.filter((d) => d.available !== false && d.status !== 'suspended');
  const byGroup = {};
  BLOOD_GROUPS.forEach((g) => { byGroup[g] = { total: 0, available: 0 }; });
  list.forEach((d) => {
    const g = String(d.bloodGroup || '').toUpperCase();
    if (!byGroup[g]) return;
    byGroup[g].total += 1;
    if (d.available !== false && d.status !== 'suspended') byGroup[g].available += 1;
  });
  const districts = new Set(list.map((d) => d.district).filter(Boolean));
  const donations = list.reduce((s, d) => s + (Number(d.donations) || 0), 0);
  return {
    total: list.length,
    active: active.length,
    districts: districts.size,
    donations,
    byGroup,
    rarest: rarestGroup(byGroup),
    inDemand: mostNeededGroup(byGroup)
  };
}

function rarestGroup(byGroup) {
  let best = null;
  for (const g of BLOOD_GROUPS) {
    const n = byGroup[g].available;
    if (n > 0 && (best === null || n < byGroup[best].available)) best = g;
  }
  return best;
}
function mostNeededGroup(byGroup) {
  // Heuristic: groups with the widest recipient reach are in highest demand.
  const weights = { 'O-': 8, 'O+': 8, 'A-': 4, 'A+': 5, 'B-': 4, 'B+': 5, 'AB-': 1, 'AB+': 1 };
  let best = 'O+';
  let score = -1;
  for (const g of BLOOD_GROUPS) {
    const s = (byGroup[g].available ? 0.5 : 0) + weights[g];
    if (s > score) { score = s; best = g; }
  }
  return best;
}

export function renderStats(host, donors) {
  if (!host) return;
  const s = computeStats(donors);
  const max = Math.max(1, ...BLOOD_GROUPS.map((g) => s.byGroup[g].available));

  host.innerHTML = `
    <div class="stat-grid">
      ${statCard('Registered donors', s.total, 'people who said yes', 'user', 355)}
      ${statCard('Available now', s.active, 'ready within hours', 'drop', 0)}
      ${statCard('Districts covered', s.districts, 'across Bangladesh', 'pin', 12)}
      ${statCard('Donations logged', s.donations, 'by this community', 'heart', 330)}
    </div>
    <div class="panel breakdown" aria-label="Donors by blood group">
      <div class="panel-head">
        <h3>Donors by blood group</h3>
        <span class="muted small">Tap a bar to search that group</span>
      </div>
      <div class="bars">
        ${BLOOD_GROUPS.map((g) => {
          const v = s.byGroup[g].available;
          const pct = Math.round((v / max) * 100);
          return `<a class="bar-row" href="donors.html?group=${encodeURIComponent(g)}" aria-label="${v} available ${g} donors">
            <span class="bar-label">${escapeHtml(g)}</span>
            <span class="bar-track"><span class="bar-fill" style="--w:${pct}%; --hue:${GROUP_META[g].hue}"></span></span>
            <span class="bar-value">${v}</span>
          </a>`;
        }).join('')}
      </div>
      <p class="muted small bar-note">
        ${s.rarest ? `<strong>${escapeHtml(s.rarest)}</strong> is the rarest group here right now. ` : ''}
        Bars show donors marked <em>available</em>.
      </p>
    </div>`;

  host.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count)));
}

function statCard(label, value, sub, ico, hue) {
  return `<div class="stat-card" data-reveal style="--hue:${hue}">
    <span class="sc-ico">${icon(ico)}</span>
    <span class="stat-value" data-count="${value}">0</span>
    <span class="stat-label">${escapeHtml(label)}</span>
    <span class="stat-sub">${escapeHtml(sub)}</span>
  </div>`;
}


/* ------------------------------------------ eligibility tool */
export function initEligibilityWidget(host) {
  if (!host) return;
  if (!host) return;
  const options = BLOOD_GROUPS.map((g) => `<option value="${g}">${g} — ${GROUP_META[g].label}</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);
  host.innerHTML = `
    <div class="elig">
      <div class="elig-form">
        <label for="eligGroup">Your blood group</label>
        <select id="eligGroup" class="input">${options}</select>
        <label for="eligDate">Last donation date <span class="muted small">(leave empty if never)</span></label>
        <input id="eligDate" class="input" type="date" max="${today}">
        <button class="btn btn-primary btn-sm" id="eligBtn">Check eligibility</button>
      </div>
      <div class="elig-out" id="eligOut">
        <div class="elig-gauge" aria-hidden="true">
          <svg viewBox="0 0 132 132">
            <defs>
              <linearGradient id="eligGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#D92142"/><stop offset="1" stop-color="#8C0D1F"/>
              </linearGradient>
            </defs>
            <circle class="g-bg" cx="66" cy="66" r="54"></circle>
            <circle class="g-fg" id="eligRing" cx="66" cy="66" r="54"></circle>
          </svg>
          <div class="g-mid"><div><b id="eligNum">—</b><span id="eligUnit">days left</span></div></div>
        </div>
        <div class="elig-copy">
          <h3 id="eligTitle">Waiting for your details</h3>
          <p id="eligText">The gauge fills as your 56-day cooling-off period completes. Whole blood needs the full gap; plasma and platelets have shorter ones, decided by the blood bank.</p>
        </div>
      </div>
    </div>`;

  const C = 339.3; // 2πr
  const paint = () => {
    const g = host.querySelector('#eligGroup').value;
    const raw = host.querySelector('#eligDate').value;
    const out = host.querySelector('#eligOut');
    const ring = host.querySelector('#eligRing');
    const num = host.querySelector('#eligNum');
    const unit = host.querySelector('#eligUnit');
    const title = host.querySelector('#eligTitle');
    const text = host.querySelector('#eligText');
    if (!raw) {
      out.classList.add('is-ok');
      ring.style.strokeDashoffset = 0;
      num.textContent = 'GO';
      unit.textContent = 'ready';
      title.textContent = `You can donate ${g} today`;
      text.textContent = 'No previous donation recorded. Eat a proper meal, drink water, bring your national ID — and remember: one donation can help up to three patients.';
      return;
    }
    const passed = daysBetween(raw, new Date().toISOString());
    const left = Math.max(0, DONATION_COOLDOWN_DAYS - passed);
    const frac = Math.min(1, passed / DONATION_COOLDOWN_DAYS);
    ring.style.strokeDashoffset = String(C * (1 - frac));
    if (left === 0) {
      out.classList.add('is-ok');
      num.textContent = 'GO'; unit.textContent = 'ready';
      title.textContent = `Cooling-off complete — ${g} donor ready`;
      text.textContent = `It has been ${passed} days since your last donation. Thank you for coming back; hospitals always need repeat donors.`;
    } else {
      out.classList.remove('is-ok');
      num.textContent = String(left); unit.textContent = 'days left';
      const when = new Date(); when.setDate(when.getDate() + left);
      title.textContent = 'Almost there — rest and hydrate';
      text.textContent = `${DONATION_COOLDOWN_DAYS - left} of ${DONATION_COOLDOWN_DAYS} days done. You will be eligible again on ${when.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}. Your body is rebuilding red cells right now.`;
    }
  };
  host.querySelector('#eligBtn').addEventListener('click', paint);
  host.querySelector('#eligDate').addEventListener('change', paint);
  host.querySelector('#eligGroup').addEventListener('change', paint);
}

/* --------------------------------------------- compatibility */
export function initCompatibilityWidget(host) {
  if (!host) return;
  const options = BLOOD_GROUPS.map((g) => `<option value="${g}">${g} — ${GROUP_META[g].label}</option>`).join('');
  host.innerHTML = `
    <div class="compat">
      <div class="compat-pick">
        <label for="compatSelect">Patient needs</label>
        <select id="compatSelect">${options}</select>
      </div>
      <div class="compat-out" id="compatOut"></div>
    </div>`;
  const sel = host.querySelector('#compatSelect');
  const out = host.querySelector('#compatOut');
  const paint = () => {
    const g = sel.value;
    const can = compatibleDonorGroups(g);
    out.innerHTML = `
      <div class="compat-col">
        <h4>Can receive from</h4>
        <div class="compat-chips">${BLOOD_GROUPS.map((x) => `<span class="chip-static ${can.includes(x) ? 'yes' : 'no'}">${x}</span>`).join('')}</div>
      </div>
      <p class="compat-note">${escapeHtml(GROUP_META[g].note)}. In an emergency, doctors decide what is safe — this chart is a guide for finding matching donors faster.</p>
      <a class="btn btn-primary btn-sm" href="donors.html?group=${encodeURIComponent(can[0])}&compat=${encodeURIComponent(g)}">Find ${escapeHtml(can[0])} donors →</a>`;
  };
  sel.addEventListener('change', paint);
  paint();
}

export function donorCardHtml(d) {
  return `<article class="donor-card">${bloodBadge(d.bloodGroup)}<h3>${escapeHtml(d.name)}</h3></article>`;
}
