/* =============================================================
   UI kit — app shell, toasts, dialogs, share sheet, phone reveal,
   PWA install, scroll reveal, animated counters.
   ============================================================= */

import { APP, APP_VERSION, LS } from './config.js';
import { initials, prettyPhone } from './blood.js';

/* ------------------------------------------------------ icons */
const ICONS = {
  drop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c.3 0 .6.1.8.4 1.6 2 6.2 7.1 6.2 11.2A7 7 0 0 1 12 21a7 7 0 0 1-7-7.2c0-4.1 4.6-9.2 6.2-11.2.2-.3.5-.4.8-.4Z" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.8 20c.6-3.7 3.6-5.8 7.2-5.8s6.6 2.1 7.2 5.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  siren: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18v-4a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="4.5" y="18" width="15" height="3" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 3.4V1.9M4.6 6.4 3.5 5.3M19.4 6.4l1.1-1.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.4M12 7.8v.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.3 3.6h3l1.4 3.6-2 1.4a11.6 11.6 0 0 0 5.7 5.7l1.4-2 3.6 1.4v3a1.9 1.9 0 0 1-2.1 1.9C10.6 18 6 13.4 4.4 5.7a1.9 1.9 0 0 1 1.9-2.1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20.4l1.3-3.4A6.9 6.9 0 0 1 3.5 12c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="17.5" cy="5.8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6.5" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.5" cy="18.2" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8.7 10.8 6.6-3.7M8.7 13.2l6.6 3.7" stroke="currentColor" stroke-width="1.8"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.6-6.1 6.6-11A6.6 6.6 0 0 0 5.4 10c0 4.9 6.6 11 6.6 11Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.6 4.4 4.4L19 7.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 17v-5a5.5 5.5 0 0 1 11 0v5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.8 17h14.4M10.2 20.4h3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 19 6v5.5c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V6l7-2.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.4-4.4-7.4-9.3A4.2 4.2 0 0 1 12 8.2a4.2 4.2 0 0 1 7.4 2.5C19.4 15.6 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h3.2L18.6 8.6a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8V19Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7h13M9.5 7V5.2h5V7M7 7l.8 12.2h8.4L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.4V12l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5a14 14 0 0 1 18 0M6.5 13a9 9 0 0 1 11 0M10 16.4a4 4 0 0 1 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.2" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4.6 2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.4l-4.6 2.5.9-5.2L4.5 10l5.2-.7L12 4.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
};

export function icon(name, cls = '') {
  return `<span class="ico ${cls}" aria-hidden="true">${ICONS[name] || ''}</span>`;
}

/* ------------------------------------------------- app shell */
const NAV = [
  { href: 'index.html',     label: 'Home',      id: 'home' },
  { href: 'donors.html',    label: 'Find Donor', id: 'donors' },
  { href: 'emergency.html', label: 'Emergency',  id: 'emergency' },
  { href: 'register.html',  label: 'Become a Donor', id: 'register' },
  { href: 'about.html',     label: 'About',      id: 'about' },
  { href: 'faq.html',       label: 'FAQ',        id: 'faq' }
];

export function mountShell(active = 'home') {
  const current = NAV.find((n) => n.id === active) || NAV[0];
  document.documentElement.setAttribute('data-page', active);

  const navLinks = NAV.map((n) => `
    <a href="${n.href}" class="navlink ${n.id === active ? 'is-active' : ''}" ${n.id === 'emergency' ? 'data-nav-urgent' : ''}>
      ${n.id === 'emergency' ? icon('siren') : ''}<span>${n.label}</span>
    </a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
  <div class="progress" id="scrollProgress" aria-hidden="true"></div>
  <a class="skip" href="#main">Skip to main content</a>
  <header class="site-header" id="siteHeader">
    <div class="wrap header-inner">
      <a class="brand" href="index.html" aria-label="${APP.name} home">
        <span class="brand-mark"><img class="brand-img" src="assets/img/logo-drop.png" alt=""></span>
        <span class="brand-text">
          <strong>One<span class="brand-accent">Drop</span></strong>
          <em>${APP.tagline}</em>
        </span>
      </a>
      <nav class="nav desktop" aria-label="Main navigation">${navLinks}</nav>
      <div class="header-actions">
        <a class="icon-btn" href="my-donor.html" aria-label="My donor profile" title="My donor profile">${icon('user')}</a>
        <button class="icon-btn" id="btnNotify" aria-pressed="false" aria-label="Turn on emergency alerts">
          ${icon('bell')}<span class="dot" hidden></span>
        </button>
        <a class="btn btn-primary btn-sm" href="emergency.html" aria-label="Post an emergency blood request">${icon('siren')}<span>Request Blood</span></a>
        <button class="icon-btn only-mobile" id="btnMenu" aria-expanded="false" aria-controls="mobileNav" aria-label="Open menu">${icon('menu')}</button>
      </div>
    </div>
    <nav class="nav mobile" id="mobileNav" hidden aria-label="Mobile navigation">${navLinks}
      <div class="mob-extra">
        <a href="my-donor.html" class="navlink ${active === 'mydonor' ? 'is-active' : ''}">${icon('user')}<span>My donor profile</span></a>
        <a href="privacy.html#contact" class="navlink">${icon('chat')}<span>Contact the team</span></a>
      </div>
    </nav>
  </header>
  <div class="netbar" id="netbar" hidden>${icon('wifi')}<span>Offline — showing the last saved data. Requests you make are stored on this device.</span></div>`);

  document.body.insertAdjacentHTML('beforeend', `
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div class="footer-col footer-brand">
        <a class="brand brand-light" href="index.html">
          <span class="brand-mark"><img class="brand-img" src="assets/img/logo-drop.png" alt=""></span>
          <span class="brand-text"><strong>One<span class="brand-accent-light">Drop</span></strong><em>${APP.tagline}</em></span>
        </a>
        <p>A volunteer-run blood donor network built by students, for everyone who has ever stood helpless in front of a hospital blood bank.</p>
        <div class="footer-cta">
          <a class="btn btn-light btn-sm" href="register.html">${icon('plus')} Become a donor</a>
          <button class="btn btn-ghost-light btn-sm" id="btnInstallFooter">${icon('download')} Install app</button>
        </div>
      </div>
      <div class="footer-col">
        <h3>Explore</h3>
        <a href="donors.html">Find a donor</a>
        <a href="emergency.html">Emergency requests</a>
        <a href="register.html">Register as donor</a>
        <a href="my-donor.html">My donor profile</a>
      </div>
      <div class="footer-col">
        <h3>Learn</h3>
        <a href="faq.html">FAQ &amp; donation guide</a>
        <a href="about.html#compatibility">Blood compatibility</a>
        <a href="about.html">About this project</a>
        <a href="admin.html">Moderator login</a>
      </div>
      <div class="footer-col">
        <h3>Trust &amp; safety</h3>
        <a href="privacy.html">Privacy policy</a>
        <a href="privacy.html#terms">Terms of use</a>
        <a href="privacy.html#contact">Contact the team</a>
        <a href="${APP.developerUrl}" target="_blank" rel="noopener noreferrer">Developer portfolio ↗</a>
      </div>
    </div>
    <div class="wrap footer-credits">
      <p class="credit-line">
        <span class="credit"><strong>Idea &amp; initiative</strong> Students of Notre Dame College, Batch 27 — Group 11</span>
        <span class="credit"><strong>Developed by</strong> <a href="${APP.developerUrl}" target="_blank" rel="noopener noreferrer">Foysal Mahmud</a></span>
      </p>
      <p class="credit-meta">
        ${APP.emergencyHotline ? `<a class="hotline" href="tel:${APP.emergencyHotline}">Hotline ${APP.emergencyHotline}</a> · ` : ''}
        v${APP_VERSION} · Not a substitute for hospital blood banks. Always verify through the hospital.
      </p>
    </div>
  </footer>

  <nav class="bottom-bar only-mobile" aria-label="Quick actions">
    <a href="index.html" class="bb-item ${active === 'home' ? 'is-active' : ''}">${icon('drop')}<span>Home</span></a>
    <a href="donors.html" class="bb-item ${active === 'donors' ? 'is-active' : ''}">${icon('search')}<span>Find</span></a>
    <a href="emergency.html" class="bb-item bb-urgent" aria-label="Post an emergency blood request">${icon('siren')}<span>Emergency</span></a>
    <a href="register.html" class="bb-item ${active === 'register' ? 'is-active' : ''}">${icon('user')}<span>Register</span></a>
    <a href="my-donor.html" class="bb-item ${active === 'mydonor' ? 'is-active' : ''}">${icon('user')}<span>Profile</span></a>
  </nav>

  <div class="toasts" id="toasts" role="status" aria-live="polite"></div>
  <div class="modal-root" id="modalRoot"></div>`);

  wireShell(active, current);
}

function wireShell(active) {
  const menuBtn = document.getElementById('btnMenu');
  const mobileNav = document.getElementById('mobileNav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const open = mobileNav.hasAttribute('hidden');
      if (open) mobileNav.removeAttribute('hidden'); else mobileNav.setAttribute('hidden', '');
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('no-scroll', open);
    });
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('a')) { mobileNav.setAttribute('hidden', ''); menuBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll'); }
    });
  }
  const onScroll = () => {
    document.getElementById('siteHeader')?.classList.toggle('is-stuck', window.scrollY > 12);
    const bar = document.getElementById('scrollProgress');
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
    }
  };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  updateNetBar();
  window.addEventListener('online', updateNetBar);
  window.addEventListener('offline', updateNetBar);

  document.getElementById('btnInstallFooter')?.addEventListener('click', () => requestInstall());
}

function updateNetBar() {
  const bar = document.getElementById('netbar');
  if (bar) bar.hidden = navigator.onLine;
}

/* ---------------------------------------------------- toasts */
export function toast(message, type = 'info', timeout = 4200) {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'success' ? 'check' : type === 'error' ? 'close' : 'info')}<span>${escapeHtml(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); };
  const t = setTimeout(kill, timeout);
  el.addEventListener('click', () => { clearTimeout(t); kill(); });
  return el;
}

/* --------------------------------------------------- dialogs */
export function dialog({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary', hideCancel = false }) {
  const root = document.getElementById('modalRoot') || (() => { const d = document.createElement('div'); d.id = 'modalRoot'; d.className = 'modal-root'; document.body.appendChild(d); return d; })();
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <h2 id="dlgTitle">${escapeHtml(title)}</h2>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${hideCancel ? '' : `<button class="btn btn-ghost" data-close>${escapeHtml(cancelText)}</button>`}
          <button class="btn btn-${variant}" data-ok>${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    root.appendChild(wrap);
    document.body.classList.add('no-scroll');
    const okBtn = wrap.querySelector('[data-ok]');
    setTimeout(() => okBtn.focus(), 40);
    const done = (v) => { wrap.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) done(false); });
    okBtn.addEventListener('click', () => done(true));
  });
}

/* ----------------------------------------------------- share */
export function shareUrl(url, text) {
  const abs = new URL(url, location.href).href;
  const items = [
    { id: 'native', label: 'More options', ico: 'share' },
    { id: 'whatsapp', label: 'WhatsApp', ico: 'chat' },
    { id: 'facebook', label: 'Facebook', ico: 'heart' },
    { id: 'copy', label: 'Copy link', ico: 'download' }
  ];
  const rows = items.map((i) => `<button class="share-row" data-share="${i.id}">${icon(i.ico)}<span>${i.label}</span></button>`).join('');
  dialog({ title: 'Share this', body: `<div class="share-list">${rows}</div><p class="muted small">${escapeHtml(abs)}</p>`, confirmText: 'Done', hideCancel: true })
    .then(() => {});
  setTimeout(() => {
    document.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', () => doShare(btn.dataset.share, abs, text));
    });
  }, 30);
}

async function doShare(kind, url, text) {
  const t = text || document.title;
  if (kind === 'native' && navigator.share) {
    try { await navigator.share({ title: t, text: t, url }); return; } catch { if (event && event.name === 'AbortError') return; }
  }
  if (kind === 'whatsapp') { window.open(`https://wa.me/?text=${encodeURIComponent(`${t}\n${url}`)}`, '_blank', 'noopener'); return; }
  if (kind === 'facebook') { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener'); return; }
  if (kind === 'copy') {
    const ok = await copyText(url);
    toast(ok ? 'Link copied to clipboard' : 'Copy failed — long-press the link instead', ok ? 'success' : 'error');
  }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

/* ------------------------------------------------ phone reveal */
export function revealPhone(raw, context = 'donor') {
  const pretty = prettyPhone(raw);
  const key = `${LS.REVEALS}`;
  let log = [];
  try { log = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  const cutoff = Date.now() - 60 * 60 * 1000;
  log = log.filter((t) => t > cutoff);
  if (log.length >= 25) {
    toast('Too many numbers revealed in the last hour. Please wait a while.', 'error');
    return null;
  }
  log.push(Date.now());
  try { localStorage.setItem(key, JSON.stringify(log)); } catch {}

  dialog({
    title: 'Contact details',
    body: `<div class="reveal-card">
      <p class="reveal-num">${escapeHtml(pretty)}</p>
      <p class="muted small">Please introduce yourself, mention you found this number on ${APP.name}, and confirm the requirement with the hospital blood bank before travelling.</p>
      <div class="modal-actions">
        <a class="btn btn-ghost" href="tel:${encodeURIComponent(raw)}">${icon('phone')} Call</a>
        <a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${encodeURIComponent(String(raw).replace('+', ''))}">${icon('chat')} WhatsApp</a>
      </div>
    </div>`,
    confirmText: 'Close', hideCancel: true
  });
  return pretty;
}

/* --------------------------------------------------- helpers */
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function bloodBadge(group, size = 'md') {
  const g = String(group || '').toUpperCase();
  return `<span class="badge-blood badge-${size}" data-group="${escapeHtml(g)}" role="img" aria-label="Blood group ${g.replace('+', ' positive').replace('-', ' negative')}">
    <span class="bb-type">${escapeHtml(g)}</span>
  </span>`;
}

export function avatar(name, group) {
  return `<span class="avatar" style="--hue:${hueFor(group)}">${escapeHtml(initials(name))}</span>`;
}

function hueFor(group) {
  const map = { 'A+': 355, 'A-': 348, 'B+': 12, 'B-': 6, 'AB+': 330, 'AB-': 322, 'O+': 0, 'O-': 352 };
  return map[String(group || '').toUpperCase()] ?? 355;
}

/* ------------------------------------------------ scroll reveal */
export function initReveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        const d = Number(en.target.dataset.delay || 0) + i * 40;
        setTimeout(() => en.target.classList.add('is-in'), Math.min(d, 320));
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach((e) => io.observe(e));
}

/* ------------------------------------------------ counters */
export function countUp(el, to, duration = 1100, suffix = '') {
  const from = 0;
  const start = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = `${to}${suffix}`; return; }
  const tick = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `${Math.round(from + (to - from) * eased)}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------ PWA */
let deferredPrompt = null;

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = false; });
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('One Drop installed. Find it on your home screen.', 'success'); });

  document.querySelectorAll('[data-install]').forEach((btn) => btn.addEventListener('click', () => requestInstall()));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('SW failed', err));
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return; refreshing = true; location.reload();
      });
    });
  }
}

export async function requestInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'dismissed') toast('You can install later from the browser menu.', 'info');
    return;
  }
  dialog({
    title: 'Install One Drop',
    body: `<ul class="install-steps">
      <li><strong>Chrome / Edge (Android):</strong> tap the menu <em>⋮</em> → <em>Install app</em>.</li>
      <li><strong>Safari (iPhone / iPad):</strong> tap <em>Share</em> → <em>Add to Home Screen</em>.</li>
      <li><strong>Desktop Chrome:</strong> click the install icon in the address bar.</li>
    </ul>`,
    confirmText: 'Got it', hideCancel: true
  });
}

/* ---------------------------------------------- notifications */
export function initNotifyButton() {
  const btn = document.getElementById('btnNotify');
  if (!btn) return;
  const dot = btn.querySelector('.dot');
  const saved = localStorage.getItem(LS.NOTIFY) === '1';
  btn.setAttribute('aria-pressed', String(saved));
  if (dot) dot.hidden = !saved;

  btn.addEventListener('click', async () => {
    const on = btn.getAttribute('aria-pressed') === 'true';
    if (on) {
      localStorage.setItem(LS.NOTIFY, '0');
      btn.setAttribute('aria-pressed', 'false'); if (dot) dot.hidden = true;
      toast('Emergency alerts muted.', 'info');
      return;
    }
    if (!('Notification' in window)) { toast('This browser does not support notifications.', 'error'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      localStorage.setItem(LS.NOTIFY, '1');
      btn.setAttribute('aria-pressed', 'true'); if (dot) dot.hidden = false;
      new Notification('One Drop alerts on', { body: 'You will be alerted when a new urgent blood request is posted.', icon: 'assets/icons/icon-192.png' });
      toast('You will be alerted about new urgent requests.', 'success');
    } else {
      toast('Notification permission was blocked. Enable it in browser settings.', 'error');
    }
  });
}

export function notify(title, body) {
  if (localStorage.getItem(LS.NOTIFY) !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: 'assets/icons/icon-192.png', tag: 'lifeline-request', requireInteraction: false }); } catch {}
}

/* ----------------------------------------------- mode banner */
export function modePill(mode, count) {
  const live = mode === 'live';
  return `<span class="mode-pill ${live ? 'is-live' : 'is-local'}" title="${live ? 'Connected to Firebase' : 'Local/offline data'}">
    <span class="mp-dot"></span>${live ? 'Live data' : 'Offline data'}${typeof count === 'number' ? ` · ${count}` : ''}
  </span>`;
}

/* ------------------------------------------------ boot combo */
export function bootUI(active) {
  mountShell(active);
  initReveal();
  initPWA();
  initNotifyButton();
  document.body.classList.add('shell-ready');
}
