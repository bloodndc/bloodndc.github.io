/* Home page controller + shared app wiring */

import { bootUI as shellBoot, icon, toast, initReveal, escapeHtml, notify } from './ui.js';
import { initData, subscribeDonors, subscribeAnnouncements, subscribeRequests, bumpStat } from './data.js';
import { renderStats, initCompatibilityWidget, initEligibilityWidget } from './stats.js';
import { BLOOD_GROUPS } from './blood.js';
import { renderRequestFeed } from './emergency.js';
import { LS } from './config.js';

export async function bootHome() {
  shellBoot('home');
  await initData();

  /* Stats + donor pool */
  subscribeDonors((rows) => {
    renderStats(document.getElementById('statsHost'), rows);
    initReveal(document.getElementById('statsHost'));
    const byGroup = {};
    rows.forEach((d) => { if (d.available !== false && d.status !== 'suspended') byGroup[d.bloodGroup] = (byGroup[d.bloodGroup] || 0) + 1; });
    const pool = document.getElementById('quickPool');
    if (pool) {
      pool.querySelectorAll('[data-pool]').forEach((el) => {
        el.textContent = byGroup[el.dataset.pool] || 0;
      });
    }
    const ticker = document.getElementById('groupTicker');
    if (ticker) {
      const items = BLOOD_GROUPS.map((g) =>
        `<span class="ticker-item"><span class="tdot"></span>${g}<b>${byGroup[g] || 0} available</b></span>`).join('');
      ticker.innerHTML = `<div class="ticker-track">${items}${items}</div>`;
    }
  });

  /* Live emergency strip */
  renderRequestFeed(document.getElementById('homeRequests'), { compact: true, limit: 3 });

  /* Announcements from the admin panel */
  subscribeAnnouncements((rows) => {
    const host = document.getElementById('announceHost');
    if (!host) return;
    if (!rows.length) { host.innerHTML = ''; return; }
    host.innerHTML = rows.map((a) => `
      <div class="announce announce-${escapeHtml(a.level || 'info')}" data-reveal>
        ${icon(a.level === 'alert' ? 'siren' : 'info')}
        <div><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.body)}</p></div>
      </div>`).join('');
    initReveal(host);
  });

  /* Blood group quick picker */
  document.querySelectorAll('[data-quick-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.quickGroup;
      const compat = btn.dataset.compatFor;
      location.href = compat ? `donors.html?compat=${encodeURIComponent(compat)}` : `donors.html?group=${encodeURIComponent(g)}`;
    });
  });

  /* Quick search on hero */
  const form = document.getElementById('quickSearch');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('quickSearchInput')?.value.trim() || '';
      const g = form.querySelector('[name="group"]')?.value || 'ALL';
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (g && g !== 'ALL') p.set('group', g);
      location.href = `donors.html${p.toString() ? `?${p}` : ''}`;
    });
  }

  initCompatibilityWidget(document.getElementById('compatHost'));
  initEligibilityWidget(document.getElementById('eligibilityHost'));

  /* One lightweight counter per visitor per day */
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('lifeline:visitDay') !== today) {
    localStorage.setItem('lifeline:visitDay', today);
    bumpStat('visits');
  }
}

/* -------------------------------------------------------------
   Emergency alerts
   Watches the live request collection and fires an in-app toast +
   a browser notification for anything new and urgent.
   ------------------------------------------------------------- */
let knownRequests = null;
let alertTimer = null;

let alertsStarted = false;
export function initAlerts() {
  if (alertsStarted) return;
  alertsStarted = true;

  /* New notices published from the admin panel */
  subscribeAnnouncements((rows) => {
    const act = rows.filter((a) => a.active !== false);
    if (!act.length) return;
    const top = act.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    const key = top.id || top.title;
    const seen = localStorage.getItem(LS.ANN_SEEN);
    if (seen === null) { localStorage.setItem(LS.ANN_SEEN, key); return; }
    if (key !== seen) {
      localStorage.setItem(LS.ANN_SEEN, key);
      toast(`Notice from the team — ${top.title}`, 'info', 8000);
      notify('New notice from One Drop', top.title);
    }
  });

  subscribeRequests((rows) => {
    const active = rows.filter((r) => r.status === 'active');
    if (knownRequests === null) { knownRequests = new Set(active.map((r) => r.id)); return; }

    const fresh = active.filter((r) => !knownRequests.has(r.id));
    knownRequests = new Set(active.map((r) => r.id));
    if (!fresh.length) return;

    const top = fresh[0];
    const label = `${top.patient || 'A patient'} needs ${top.units || 1} unit(s) of ${top.bloodGroup}`;
    toast(`New emergency request — ${label}`, 'error', 9000);
    notify('New emergency blood request', `${label} at ${top.hospital || 'the hospital'}.`);

    // Update the count badge on the header bell, if the user is not on the emergency page.
    const dot = document.querySelector('#btnNotify .dot');
    if (dot && !document.documentElement.hasAttribute('data-page-emergency')) {
      dot.hidden = localStorage.getItem(LS.NOTIFY) !== '1';
    }

    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { const d = document.querySelector('#btnNotify .dot'); if (d) d.hidden = localStorage.getItem(LS.NOTIFY) !== '1'; }, 12000);
  });
}

/* Every page gets the shell AND the alert wiring (request + notice notifications). */
export function bootUI(id) { shellBoot(id); initAlerts(); }
export { toast, icon };
