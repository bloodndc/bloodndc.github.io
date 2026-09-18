/* Emergency blood requests — posting, live feed, countdowns, sharing */

import { BLOOD_GROUPS, countdown, formatDate, timeAgo, prettyPhone, isValidPhone, normalizePhone } from './blood.js';
import { subscribeRequests, addRequest, updateRequest, deleteRequest, listDonors, isLive } from './data.js';
import { icon, toast, dialog, revealPhone, initReveal, bloodBadge, copyText, escapeHtml as _e } from './ui.js';
import { DISTRICTS } from './geo.js';

let liveRows = [];
let countdownTimer = null;

/* -------------------------------------------------- live feed */
export function renderRequestFeed(host, opts = {}) {
  if (!host) return;
  host.dataset.compact = opts.compact ? '1' : '';
  host.innerHTML = `<div class="feed-loading">${icon('clock')}<span>Loading live requests…</span></div>`;

  subscribeRequests((rows) => {
    liveRows = rows;
    paintFeed(host, opts);
  });

  if (!countdownTimer) {
    countdownTimer = setInterval(() => {
      document.querySelectorAll('[data-countdown]').forEach((el) => {
        const c = countdown(el.dataset.countdown);
        if (!c) return;
        el.textContent = c.overdue ? `${c.text} overdue` : `${c.text} left`;
        el.classList.toggle('is-overdue', c.overdue);
      });
    }, 1000);
  }
}

function paintFeed(host, opts) {
  // Public board: pending rows await moderation; expired rows auto-remove.
  const visible = liveRows.filter((r) => r.status !== 'pending' && !expired(r));
  const active = visible.filter((r) => r.status === 'active');
  const done = visible.filter((r) => r.status !== 'active');
  const limit = opts.limit || active.length;
  const list = active.slice(0, limit);

  if (!list.length && !opts.compact) {
    host.innerHTML = `<div class="empty empty-soft">
      <div class="empty-mark ok">${icon('check')}</div>
      <h3>No active emergency right now</h3>
      <p>That is good news. If a hospital needs blood, post it here — donors across the network get alerted instantly.</p>
    </div>`;
    if (done.length) host.insertAdjacentHTML('beforeend', closedSection(done));
    wireFeed(host);
    return;
  }
  if (!list.length && opts.compact) {
    host.innerHTML = `<div class="all-clear">${icon('check')}<span>No active emergency requests right now — the network is calm.</span></div>`;
    return;
  }

  host.innerHTML = list.map((r) => requestCard(r, opts.compact)).join('')
    + (opts.compact && active.length > limit ? `<a class="see-all" href="emergency.html">See all ${active.length} active requests →</a>` : '')
    + (!opts.compact && done.length ? closedSection(done) : '');

  wireFeed(host);
  initReveal(host);
}

function closedSection(rows) {
  return `<details class="closed-wrap"><summary>Closed &amp; expired requests (${rows.length})</summary>
    <div class="closed-list">${rows.slice(0, 20).map((r) => requestCard(r, true, true)).join('')}</div></details>`;
}

function expired(r) {
  return r.neededBy && new Date(r.neededBy).getTime() < Date.now() - 6 * 36e5;
}

function requestCard(r, compact = false, closed = false) {
  const c = countdown(r.neededBy);
  const critical = r.urgency === 'critical';
  return `<article class="req-card ${critical ? 'is-critical' : ''} ${closed || r.status !== 'active' ? 'is-closed' : ''}" data-req="${r.id}" data-reveal>
    <div class="req-head">
      ${bloodBadge(r.bloodGroup, 'lg')}
      <div class="req-title">
        <h3>${_e(r.patient || 'Patient')}</h3>
        <p class="req-hospital">${icon('pin')}<span>${_e([r.hospital, r.area, r.district].filter(Boolean).join(' · '))}</span></p>
      </div>
      ${closed || r.status !== 'active'
        ? `<span class="req-state state-${r.status}">${r.status === 'fulfilled' ? 'Fulfilled' : r.status === 'cancelled' ? 'Cancelled' : 'Expired'}</span>`
        : `<span class="req-live"><span class="pulse"></span>${critical ? 'Critical' : 'Urgent'}</span>`}
    </div>

    <ul class="req-facts">
      <li><span>Units needed</span><strong>${r.units || 1}</strong></li>
      <li><span>Needed by</span><strong>${r.neededBy ? formatDate(r.neededBy) : 'ASAP'}</strong></li>
      <li><span>Posted</span><strong>${timeAgo(r.createdAt)}</strong></li>
      ${c && !closed && r.status === 'active' ? `<li><span>Time</span><strong class="req-count" data-countdown="${r.neededBy}">${c.overdue ? c.text + ' overdue' : c.text + ' left'}</strong></li>` : ''}
    </ul>

    ${r.note ? `<p class="req-note">${_e(r.note)}</p>` : ''}
    ${!compact ? `<p class="req-by muted small">Posted by ${_e(r.contactName || 'a volunteer')} · ${_e(r.district || '')}</p>` : ''}

    <div class="req-actions">
      ${closed || r.status !== 'active' ? '' : `<button class="btn btn-primary btn-sm" data-act="contact">${icon('phone')}<span>Offer to donate</span></button>`}
      <button class="btn btn-ghost btn-sm" data-act="share">${icon('share')}<span>Share</span></button>
      ${closed || r.status !== 'active' ? '' : `<button class="btn btn-ghost btn-sm" data-act="matches">${icon('search')}<span>Matching donors</span></button>`}
      ${closed || r.status !== 'active' ? '' : `<button class="btn btn-ghost btn-sm" data-act="done" title="Mark as fulfilled">${icon('check')}</button>`}
    </div>
  </article>`;
}

function wireFeed(host) {
  host.querySelectorAll('.req-card').forEach((el) => {
    const r = liveRows.find((x) => x.id === el.dataset.req);
    if (!r) return;
    el.querySelector('[data-act="contact"]')?.addEventListener('click', () => offerToDonate(r));
    el.querySelector('[data-act="share"]')?.addEventListener('click', () => shareRequest(r));
    el.querySelector('[data-act="matches"]')?.addEventListener('click', () => findMatches(r));
    el.querySelector('[data-act="done"]')?.addEventListener('click', async () => {
      const ok = await dialog({ title: 'Mark as fulfilled?', body: `<p>The request for <strong>${_e(r.patient)}</strong> will move to the closed list. Do this only when the blood has been arranged.</p>`, confirmText: 'Yes, fulfilled' });
      if (ok) { await updateRequest(r.id, { status: 'fulfilled' }); toast('Marked as fulfilled. Thank you.', 'success'); }
    });
  });
}

async function offerToDonate(r) {
  const donors = await listDonors();
  const compat = donors.filter((d) => d.available !== false && d.status !== 'suspended' && d.bloodGroup === r.bloodGroup).slice(0, 5);
  dialog({
    title: 'Offer to donate',
    body: `<div class="offer">
      <p><strong>${_e(r.patient)}</strong> needs <strong>${r.units || 1} unit(s)</strong> of <strong>${r.bloodGroup}</strong> at ${_e(r.hospital || 'the hospital')}.</p>
      <p class="muted small">Call the attendant, confirm the requirement and the blood bank timing, then reach the hospital with your national ID.</p>
      <div class="offer-attendant">
        <div class="offer-attendant-who">
          <strong>${_e(r.contactName || 'Attendant')}</strong>
          <span class="muted small">is handling this request</span>
        </div>
        <button class="btn btn-primary btn-sm" type="button" data-rev="${r.phone}">${icon('phone')}<span>Show attendant contact</span></button>
      </div>
      ${compat.length ? `<p class="offer-alt">Other ${_e(r.bloodGroup)} donors near this request:</p>
        <ul class="offer-list">${compat.map((d) => `<li><span>${_e(d.name)} · ${_e(d.area || d.district || '')}</span><button class="link-btn" data-rev="${d.phone}">Show contact</button></li>`).join('')}</ul>` : ''}
    </div>`,
    confirmText: 'Close', hideCancel: true
  });
  setTimeout(() => {
    document.querySelectorAll('[data-rev]').forEach((b) => b.addEventListener('click', () => revealPhone(b.dataset.rev)));
  }, 30);
}

export function shareRequest(r) {
  const url = new URL('emergency.html', location.href);
  url.searchParams.set('req', r.id);
  const abs = url.href;
  const text = `🩸 URGENT BLOOD REQUEST\n${r.patient} needs ${r.units || 1} unit(s) of ${r.bloodGroup}\nHospital: ${r.hospital}${r.area ? ', ' + r.area : ''}${r.district ? ', ' + r.district : ''}\nNeeded by: ${r.neededBy ? formatDate(r.neededBy) : 'ASAP'}\nContact: ${prettyPhone(r.phone)}\n${r.note || ''}\n\nVia One Drop — A Drop of Life · NDC Batch 27 blood donor community`;

  const items = [
    { id: 'native', label: 'More options', ico: 'share' },
    { id: 'whatsapp', label: 'WhatsApp', ico: 'chat' },
    { id: 'facebook', label: 'Facebook', ico: 'heart' },
    { id: 'poster', label: 'Save share poster (PNG)', ico: 'download' },
    { id: 'copy', label: 'Copy link', ico: 'pin' }
  ];
  dialog({
    title: 'Share this request',
    body: `<div class="share-list">${items.map((i) => `<button class="share-row" data-share="${i.id}">${icon(i.ico)}<span>${i.label}</span></button>`).join('')}</div>
           <p class="muted small">${_e(abs)}</p>`,
    confirmText: 'Done', hideCancel: true
  });
  setTimeout(() => {
    document.querySelectorAll('.modal [data-share]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.share;
        if (kind === 'poster') { makePoster(r); return; }
        if (kind === 'native' && navigator.share) { try { await navigator.share({ title: text.split('\n')[0], text, url: abs }); } catch { /* dismissed */ } return; }
        if (kind === 'whatsapp') { window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + abs)}`, '_blank', 'noopener'); return; }
        if (kind === 'facebook') { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(abs)}`, '_blank', 'noopener'); return; }
        const ok = await copyText(abs);
        toast(ok ? 'Link copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
      });
    });
  }, 30);
}

/* ------------------------------------------------ share poster */
function dropPath(x, cx, cy, r) {
  x.beginPath();
  x.moveTo(cx, cy - r * 1.35);
  x.bezierCurveTo(cx + r * 0.95, cy - r * 0.25, cx + r, cy + r * 0.25, cx + r * 0.72, cy + r * 0.75);
  x.bezierCurveTo(cx + r * 0.4, cy + r * 1.18, cx - r * 0.4, cy + r * 1.18, cx - r * 0.72, cy + r * 0.75);
  x.bezierCurveTo(cx - r, cy + r * 0.25, cx - r * 0.95, cy - r * 0.25, cx, cy - r * 1.35);
  x.closePath();
}

function wrapCenter(x, text, cx, y, maxW, lh, maxLines = 3) {
  const words = String(text || '').split(/\s+/);
  let line = '', lines = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  lines = lines.slice(0, maxLines);
  lines.forEach((l, i) => x.fillText(l, cx, y + i * lh));
  return lines.length;
}

function makePoster(r) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const SYS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#8c0d1f'); bg.addColorStop(.55, '#5c0815'); bg.addColorStop(1, '#38050d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);

  x.save(); x.globalAlpha = .06; x.fillStyle = '#ffffff';
  for (let i = 0; i < 24; i++) { dropPath(x, (i * 197) % W, (i * 331) % H, 16 + (i % 5) * 9); x.fill(); }
  x.restore();

  x.textAlign = 'center';
  x.fillStyle = '#ffd9de'; x.font = `700 34px ${SYS}`;
  x.fillText('O N E   D R O P', W / 2, 96);
  x.fillStyle = '#e8aab2'; x.font = `500 26px ${SYS}`;
  x.fillText('A Drop of Life · Notre Dame College · Batch 27', W / 2, 138);

  x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 40; x.shadowOffsetY = 16;
  dropPath(x, W / 2, 420, 170); x.fillStyle = '#ffffff'; x.fill(); x.restore();
  x.fillStyle = '#8C0D1F'; x.font = `800 130px ${SYS}`;
  x.fillText(r.bloodGroup, W / 2, 470);

  x.fillStyle = '#ff5d73'; x.font = `800 54px ${SYS}`;
  x.fillText('URGENT BLOOD REQUEST', W / 2, 700);

  x.fillStyle = '#ffffff'; x.font = `700 60px ${SYS}`;
  wrapCenter(x, `${r.patient || 'Patient'} · ${r.units || 1} unit(s)`, W / 2, 780, W - 170, 76);

  x.fillStyle = '#ffd9de'; x.font = `500 40px ${SYS}`;
  wrapCenter(x, `${r.hospital || ''}${r.area ? ', ' + r.area : ''}${r.district ? ', ' + r.district : ''}`, W / 2, 900, W - 150, 54);

  x.fillStyle = '#ffffff'; x.font = `700 44px ${SYS}`;
  x.fillText(`Needed by: ${r.neededBy ? formatDate(r.neededBy) : 'ASAP'}`, W / 2, 1030);
  x.fillStyle = '#ffd9de'; x.font = `600 46px ${SYS}`;
  x.fillText(`Contact: ${prettyPhone(r.phone)} (${r.contactName || 'attendant'})`, W / 2, 1096);

  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(140, 1180); x.lineTo(W - 140, 1180); x.stroke();
  x.fillStyle = '#e8aab2'; x.font = `500 30px ${SYS}`;
  x.fillText('Verify through the hospital blood bank before travelling.', W / 2, 1230);
  x.fillStyle = '#ffffff'; x.font = `700 34px ${SYS}`;
  x.fillText('onedropndc.github.io', W / 2, 1284);

  const a = document.createElement('a');
  a.download = `onedrop-request-${r.bloodGroup}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
  toast('Poster saved — share it anywhere.', 'success');
}

async function findMatches(r) {
  const donors = await listDonors();
  const list = donors.filter((d) => d.status !== 'suspended' && d.bloodGroup === r.bloodGroup);
  const avail = list.filter((d) => d.available !== false);
  toast(`${avail.length} available · ${list.length} total ${r.bloodGroup} donors in the directory`, 'info', 5200);
  const url = `donors.html?group=${encodeURIComponent(r.bloodGroup)}`;
  setTimeout(() => { location.href = url; }, 700);
}

/* ------------------------------------------------- post form */
export function initRequestForm() {
  const form = document.getElementById('requestForm');
  if (!form) return;

  form.querySelector('[name="bloodGroup"]').innerHTML =
    `<option value="">Select blood group</option>` + BLOOD_GROUPS.map((g) => `<option value="${g}">${g}</option>`).join('');
  form.querySelector('[name="district"]').innerHTML =
    `<option value="">Select district</option>` + DISTRICTS.map((d) => `<option value="${d}" ${d === 'Dhaka' ? 'selected' : ''}>${d}</option>`).join('');

  // Default "needed by" = 24h from now
  const by = form.querySelector('[name="neededBy"]');
  if (by) {
    const d = new Date(Date.now() + 24 * 36e5);
    by.min = new Date(Date.now() - 6e4).toISOString().slice(0, 16);
    by.value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  }

  form.querySelectorAll('[data-live-error]').forEach((f) => {
    f.addEventListener('blur', () => validateField(f));
    f.addEventListener('input', () => { if (f.dataset.touched === '1') validateField(f); });
    f.addEventListener('change', () => { f.dataset.touched = '1'; validateField(f); });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    let ok = true;
    form.querySelectorAll('[data-live-error]').forEach((f) => { if (!validateField(f)) ok = false; });
    if (!isValidPhone(data.phone)) { setError(form.elements.phone, 'Enter a valid Bangladeshi mobile number, e.g. 01712345678'); ok = false; }
    if (!ok) { toast('Please fix the highlighted fields.', 'error'); form.querySelector('.is-invalid')?.focus(); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = 'Posting…';

    const payload = {
      ...data,
      phone: normalizePhone(data.phone),
      neededBy: data.neededBy ? new Date(data.neededBy).toISOString() : null,
      urgency: data.urgency || 'urgent'
    };
    const saved = await addRequest(payload);
    btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = 'Post emergency request';
    form.reset();
    if (by) by.value = new Date(Date.now() + 24 * 36e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

    toast('Request submitted — a moderator reviews it and it goes live shortly.', 'success', 6000);
    dialog({
      title: 'Request sent for review',
      body: `<p>A moderator will approve it within minutes; approved requests appear on the live board and trigger alerts.
      Meanwhile, sharing this request multiplies your chances of finding a donor within the hour.</p>`,
      confirmText: 'Share on WhatsApp', variant: 'primary'
    }).then((yes) => { if (yes) shareRequest(saved); });
  });
}

function validateField(field) {
  const rules = JSON.parse(field.dataset.liveError || '{}');
  const val = String(field.value || '').trim();
  let msg = '';
  if (rules.required && !val) msg = rules.requiredMsg || 'This field is required';
  else if (rules.phone && val && !isValidPhone(val)) msg = 'Enter a valid mobile number (11 digits, starts with 01)';
  else if (rules.min && val.length < rules.min) msg = `Please use at least ${rules.min} characters`;
  else if (rules.future && val && new Date(val).getTime() < Date.now()) msg = 'Choose a time in the future';
  setError(field, msg);
  field.dataset.touched = '1';
  return !msg;
}

function setError(field, msg) {
  const wrap = field.closest('.field') || field.parentElement;
  wrap.classList.toggle('is-invalid', !!msg);
  wrap.classList.toggle('is-valid', !msg && String(field.value || '').trim().length > 0);
  let el = wrap.querySelector('.field-error');
  if (msg) {
    if (!el) { el = document.createElement('span'); el.className = 'field-error'; el.setAttribute('role', 'alert'); wrap.appendChild(el); }
    el.textContent = msg;
    field.setAttribute('aria-invalid', 'true');
  } else if (el) { el.remove(); field.removeAttribute('aria-invalid'); }
}

/* Admin: change status / delete from the emergency page list */
export async function adminRequestAction(id, action) {
  if (action === 'delete') { await deleteRequest(id); toast('Request deleted.', 'success'); return; }
  await updateRequest(id, { status: action });
  toast('Request updated.', 'success');
}

export { liveRows };
