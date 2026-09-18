/* Moderator dashboard — email/password sign-in */

import { APP, VAPID_KEY, FIREBASE_CONFIG } from './config.js';
import { initData, listDonors, listRequests, listMessages, markMessageRead, listAnnouncements,
         saveAnnouncement, deleteAnnouncement, updateDonor, deleteDonor, updateRequest, deleteRequest,
         clearLocalData, seedDemo, getStatSnapshot, isLive } from './data.js';
import { bootUI, icon, toast, dialog, copyText, escapeHtml as _e, bloodBadge, avatar } from './ui.js';
import { formatDate, formatDateTime, timeAgo, prettyPhone } from './blood.js';
import { computeStats } from './stats.js';
import { state as fb, waitForAuth } from './firebase.js';

let ctx = { donors: [], requests: [], messages: [], announcements: [] };

const providerOf = (u) =>
  (u && u.providerData && u.providerData[0] && u.providerData[0].providerId) ||
  (u && u.isAnonymous ? 'anonymous' : '');

function friendlyAuthError(err) {
  const code = String((err && err.code) || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Wrong email or password.';
  if (code.includes('user-not-found')) return 'No moderator account with that email. Create one in the Firebase console (Authentication → Users → Add user).';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes and try again.';
  if (code.includes('network')) return 'Network problem while signing in. Check your connection.';
  if (code.includes('invalid-email')) return 'That does not look like a valid email address.';
  return 'Sign-in failed. ' + ((err && err.message) || '');
}

export async function initAdmin() {
  bootUI('about');
  await initData();

  const gate = document.getElementById('adminGate');
  const panel = document.getElementById('adminPanel');
  const note = document.getElementById('gateNote');
  const form = document.getElementById('adminLogin');

  function openSession(user) {
    gate.hidden = true;
    panel.hidden = false;
    const emailOut = document.getElementById('adminEmailOut');
    if (emailOut) emailOut.textContent = user.email || 'moderator';
    const so = document.getElementById('adminSignOut');
    if (so && !so.dataset.wired) {
      so.dataset.wired = '1';
      so.addEventListener('click', async () => {
        try { await fb.fa.signOut(fb.auth); } catch {}
        panel.hidden = true;
        form.reset();
        gate.hidden = false;
        note.textContent = 'Signed out.';
      });
    }
    loadAll().then(() => wireTabs());
  }

  // Firebase restores sessions asynchronously — wait for it, then require a
  // password-provider (moderator) session. Everyone else sees the login card.
  let user = await waitForAuth();
  if (user && providerOf(user) !== 'password') user = null;

  if (user) { openSession(user); return; }

  if (!fb.ok) note.textContent = 'Firebase could not be reached from this device — check your connection and reload.';
  gate.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.adminEmail.value.trim();
    const pass = form.adminPass.value;
    if (!email || !pass) { note.textContent = 'Enter the moderator email and password.'; return; }
    const btn = document.getElementById('adminLoginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    note.textContent = '';
    try {
      const cred = await fb.fa.signInWithEmailAndPassword(fb.auth, email, pass);
      openSession(cred.user);
    } catch (err) {
      note.textContent = friendlyAuthError(err);
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
  wireAnnouncements();
  renderOverview();
}

async function loadAll() {
  const [donors, requests, messages, announcements] = await Promise.all([
    listDonors(), listRequests(), listMessages(), listAnnouncements()
  ]);
  ctx = { donors, requests, messages, announcements };
}

function wireTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('is-active', x === t));
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    if (t.dataset.tab === 'donors') renderDonors();
    if (t.dataset.tab === 'requests') renderRequests();
    if (t.dataset.tab === 'messages') renderMessages();
    if (t.dataset.tab === 'announcements') renderAnnouncements();
    if (t.dataset.tab === 'overview') renderOverview();
  }));
}

/* ---------------------------------------------------- overview */
async function renderOverview() {
  const s = computeStats(ctx.donors);
  const stats = await getStatSnapshot();
  const activeReqs = ctx.requests.filter((r) => r.status === 'active').length;
  const pending = ctx.donors.filter((d) => d.status === 'pending').length;
  const unread = ctx.messages.filter((m) => !m.read).length;

  document.getElementById('overviewHost').innerHTML = `
    <div class="stat-grid stat-grid-sm">
      ${miniStat('Donors', s.total, `${s.active} available`)}
      ${miniStat('Pending review', pending, pending ? 'needs attention' : 'all clear')}
      ${miniStat('Active requests', activeReqs, `${ctx.requests.length} total`)}
      ${miniStat('Unread messages', unread, unread ? 'open the inbox tab' : 'all read')}
      ${miniStat('Visits', stats ? stats.visits : '—', 'all time')}
      ${miniStat('Registrations', stats ? stats.donations_registered : '—', 'all time')}
      ${miniStat('Requests posted', stats ? stats.requests_posted : '—', 'all time')}
      ${miniStat('Connection', isLive() ? 'Live' : 'Local', isLive() ? FIREBASE_CONFIG.projectId : 'Firebase unreachable')}
    </div>

    <div class="admin-tools">
      <h3>Tools</h3>
      <div class="tool-row">
        <button class="btn btn-ghost btn-sm" id="btnRefresh">${icon('clock')} Refresh data</button>
        <button class="btn btn-ghost btn-sm" id="btnCopyRules">${icon('shield')} Copy Firestore rules</button>
        <button class="btn btn-ghost btn-sm" id="btnSeed">${icon('plus')} Load demo dataset</button>
        <button class="btn btn-ghost btn-sm danger" id="btnClearLocal">${icon('trash')} Clear local cache</button>
        ${VAPID_KEY ? '<button class="btn btn-ghost btn-sm" id="btnPush">' + icon('bell') + ' Subscribe to push</button>' : ''}
      </div>
      <p class="muted small">Firestore rules protect the database from anonymous writes to fields you do not want public to edit. Paste them into Firebase console → Firestore → Rules.</p>
      <div class="admin-note">
        <strong>Moderation checklist:</strong> verify a donor only after you have confirmed the number by a call or a photo of the donor's ID. Suspend rather than delete when a listing is simply wrong — it keeps the record for auditing.
      </div>
    </div>`;

  document.getElementById('btnRefresh').onclick = async () => { await loadAll(); renderOverview(); toast('Data refreshed.', 'success'); };
  document.getElementById('btnCopyRules').onclick = async () => {
    const ok = await copyText(FIRESTORE_RULES);
    toast(ok ? 'Rules copied — paste them into the Firebase console.' : 'Copy failed.', ok ? 'success' : 'error');
  };
  document.getElementById('btnSeed').onclick = async () => {
    const ok = await dialog({ title: 'Load demo dataset?', body: '<p>This writes 24 sample donors and 3 sample requests into this browser\'s local cache (useful for demos and screenshots).</p>', confirmText: 'Load demo data' });
    if (ok) { clearLocalData(); seedDemo(); await loadAll(); renderOverview(); toast('Demo data loaded locally.', 'success'); }
  };
  document.getElementById('btnClearLocal').onclick = async () => {
    const ok = await dialog({ title: 'Clear local cache?', body: '<p>Removes cached donors, requests and the demo flag from this browser. Cloud data is untouched.</p>', confirmText: 'Clear', variant: 'danger' });
    if (ok) { clearLocalData(); await loadAll(); renderOverview(); toast('Local cache cleared.', 'success'); }
  };
  document.getElementById('btnPush')?.addEventListener('click', async () => subscribePush());
}

function miniStat(label, value, sub) {
  return `<div class="stat-card stat-mini"><span class="stat-value">${_e(String(value))}</span><span class="stat-label">${_e(label)}</span><span class="stat-sub">${_e(sub)}</span></div>`;
}

/* ------------------------------------------------------ donors */
function renderDonors() {
  const host = document.getElementById('adminDonors');
  const rows = ctx.donors.slice().sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || (a.createdAt < b.createdAt ? 1 : -1));
  host.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Donor</th><th>Group</th><th>Location</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows.map((d) => `<tr data-row="${d.id}">
      <td><div class="cell-user">${avatar(d.name, d.bloodGroup)}<div><strong>${_e(d.name)}</strong><span class="muted small">${timeAgo(d.createdAt)}</span></div></div></td>
      <td>${bloodBadge(d.bloodGroup, 'sm')}</td>
      <td>${_e([d.area, d.district].filter(Boolean).join(', '))}</td>
      <td class="mono">${_e(prettyPhone(d.phone))}</td>
      <td><span class="pill pill-${d.status}">${d.status}</span>${d.available === false ? ' <span class="pill pill-off">busy</span>' : ''}</td>
      <td class="cell-actions">
        <button class="btn btn-ghost btn-xs" data-a="edit">Edit</button>
        <button class="btn btn-ghost btn-xs" data-a="verify">${d.status === 'verified' ? 'Unverify' : 'Verify'}</button>
        <button class="btn btn-ghost btn-xs" data-a="toggle">${d.available !== false ? 'Set busy' : 'Set available'}</button>
        <button class="btn btn-ghost btn-xs danger" data-a="delete">Delete</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;

  host.querySelectorAll('tr[data-row]').forEach((tr) => {
    const d = ctx.donors.find((x) => x.id === tr.dataset.row);
    tr.querySelector('[data-a="edit"]').onclick = () => openEditDonor(d);
    tr.querySelector('[data-a="verify"]').onclick = async () => { await updateDonor(d.id, { status: d.status === 'verified' ? 'pending' : 'verified' }); await loadAll(); renderDonors(); toast('Status updated.', 'success'); };
    tr.querySelector('[data-a="toggle"]').onclick = async () => { await updateDonor(d.id, { available: !(d.available !== false) }); await loadAll(); renderDonors(); toast('Availability updated.', 'success'); };
    tr.querySelector('[data-a="delete"]').onclick = async () => {
      const ok = await dialog({ title: `Delete ${d.name}?`, body: '<p>This removes the donor permanently.</p>', confirmText: 'Delete', variant: 'danger' });
      if (ok) { await deleteDonor(d.id); await loadAll(); renderDonors(); toast('Deleted.', 'success'); }
    };
  });
}

function openEditDonor(d) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card" role="dialog" aria-modal="true">
      <h2>Edit donor — ${_e(d.name)}</h2>
      <div class="modal-body">
        <form id="editDonorForm" style="display:grid;gap:.7rem">
          <div class="field"><label>Full name</label><input class="input" name="name" value="${_e(d.name)}" required></div>
          <div class="field"><label>Mobile number</label><input class="input" name="phone" value="${_e(prettyPhone(d.phone))}" required></div>
          <div class="field"><label>Blood group</label><select class="input" name="bloodGroup">${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((g) => `<option ${g === d.bloodGroup ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label>District</label><input class="input" name="district" value="${_e(d.district || '')}"></div>
          <div class="field"><label>Area</label><input class="input" name="area" value="${_e(d.area || '')}"></div>
          <div class="field"><label>Public note</label><input class="input" name="note" value="${_e(d.note || '')}"></div>
        </form>
        <p class="gate-error" id="editErr" role="alert"></p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close>Cancel</button>
        <button class="btn btn-primary" data-save>Save changes</button>
      </div>
    </div>`;
  document.getElementById('modalRoot').appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
  wrap.querySelector('[data-save]').addEventListener('click', async () => {
    const f = wrap.querySelector('#editDonorForm');
    const v = Object.fromEntries(new FormData(f).entries());
    const phone = String(v.phone).replace(/[^\d+]/g, '');
    if (!v.name.trim() || !/^(\+880|0)1[3-9]\d{8}$/.test(phone)) {
      wrap.querySelector('#editErr').textContent = 'Enter a valid name and a Bangladeshi mobile number.';
      return;
    }
    await updateDonor(d.id, { name: v.name.trim(), phone, bloodGroup: v.bloodGroup, district: v.district.trim(), area: v.area.trim(), note: v.note.trim() });
    close();
    await loadAll(); renderDonors(); toast('Donor updated.', 'success');
  });
}

/* ---------------------------------------------------- requests */
function renderRequests() {
  const host = document.getElementById('adminRequests');
  const rows = ctx.requests.slice().sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
  host.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Patient / hospital</th><th>Group</th><th>Units</th><th>Needed by</th><th>State</th><th>Actions</th></tr></thead>
    <tbody>${rows.map((r) => `<tr data-row="${r.id}">
      <td><div class="cell-user"><div><strong>${_e(r.patient || 'Patient')}</strong><span class="muted small">${_e([r.hospital, r.district].filter(Boolean).join(' · '))}</span></div></div></td>
      <td>${bloodBadge(r.bloodGroup, 'sm')}</td>
      <td>${r.units || 1}</td>
      <td>${r.neededBy ? formatDate(r.neededBy) : 'ASAP'}</td>
      <td><span class="pill pill-${r.status === 'active' ? 'pending' : r.status}">${r.status}</span></td>
      <td class="cell-actions">
        ${r.status === 'pending'
          ? `<button class="btn btn-primary btn-xs" data-a="active">Approve</button>
             <button class="btn btn-ghost btn-xs danger" data-a="cancelled">Reject</button>`
          : `<button class="btn btn-ghost btn-xs" data-a="fulfilled">Fulfilled</button>
             <button class="btn btn-ghost btn-xs" data-a="cancelled">Cancel</button>
             <button class="btn btn-ghost btn-xs" data-a="active">Reopen</button>`}
        <button class="btn btn-ghost btn-xs danger" data-a="delete">Delete</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;

  host.querySelectorAll('tr[data-row]').forEach((tr) => {
    const r = ctx.requests.find((x) => x.id === tr.dataset.row);
    tr.querySelectorAll('[data-a]').forEach((b) => {
      b.onclick = async () => {
        const a = b.dataset.a;
        if (a === 'delete') {
          const ok = await dialog({ title: 'Delete request?', body: '<p>This removes the request permanently.</p>', confirmText: 'Delete', variant: 'danger' });
          if (!ok) return;
          await deleteRequest(r.id);
        } else await updateRequest(r.id, { status: a });
        await loadAll(); renderRequests(); toast('Updated.', 'success');
      };
    });
  });
}

/* ---------------------------------------------------- messages */
function renderMessages() {
  const host = document.getElementById('adminMessages');
  if (!ctx.messages.length) { host.innerHTML = '<p class="muted">No messages yet. Visitors can write from the Contact section of the Privacy page.</p>'; return; }
  host.innerHTML = ctx.messages.map((m) => `
    <article class="msg-card ${m.read ? '' : 'is-unread'}" data-msg="${m.id}">
      <header><strong>${_e(m.subject || 'Message')}</strong><span class="muted small">${formatDateTime(m.createdAt)}</span></header>
      <p>${_e(m.message)}</p>
      <footer><span>${_e(m.name)} · ${_e(m.contact)}</span>
      ${m.read ? '' : `<button class="link-btn" data-a="read">Mark read</button>`}</footer>
    </article>`).join('');
  host.querySelectorAll('[data-a="read"]').forEach((b) => {
    b.onclick = async () => { await markMessageRead(b.closest('[data-msg]').dataset.msg); await loadAll(); renderMessages(); };
  });
}

/* ------------------------------------------------ announcements */
function renderAnnouncements() {
  const list = document.getElementById('announceList');
  list.innerHTML = ctx.announcements.length
    ? ctx.announcements.map((a) => `<div class="ann-row" data-ann="${a.id}">
        <span class="pill pill-${a.level === 'alert' ? 'cancelled' : 'pending'}">${_e(a.level)}</span>
        <div><strong>${_e(a.title)}</strong><span class="muted small">${_e(a.body)}</span></div>
        <button class="btn btn-ghost btn-xs" data-a="toggle">${a.active ? 'Hide' : 'Show'}</button>
        <button class="btn btn-ghost btn-xs danger" data-a="delete">Delete</button>
      </div>`).join('')
    : '<p class="muted">No announcements yet.</p>';

  list.querySelectorAll('[data-ann]').forEach((row) => {
    const a = ctx.announcements.find((x) => x.id === row.dataset.ann);
    row.querySelector('[data-a="toggle"]').onclick = async () => { await saveAnnouncement({ ...a, active: !a.active }); await loadAll(); renderAnnouncements(); };
    row.querySelector('[data-a="delete"]').onclick = async () => { await deleteAnnouncement(a.id); await loadAll(); renderAnnouncements(); };
  });
}

function wireAnnouncements() {
  const form = document.getElementById('announceForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.elements.title.value.trim();
    const body = form.elements.body.value.trim();
    if (!title || !body) { toast('Both a title and a message are required.', 'error'); return; }
    await saveAnnouncement({ title, body, level: form.level.value, active: true });
    form.reset();
    await loadAll(); renderAnnouncements();
    toast('Announcement published to every visitor.', 'success');
  });
}

/* --------------------------------------------------- web push */
async function subscribePush() {
  try {
    if (!VAPID_KEY) { toast('Add VAPID_KEY to config.js first.', 'error'); return; }
    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
    const messaging = getMessaging(fb.app);
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notification permission denied.', 'error'); return; }
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    const ok = await copyText(token);
    toast(ok ? `Push token copied — add it to a Cloud Messaging topic: ${token.slice(0, 18)}…` : 'Subscribed.', 'success', 8000);
    onMessage(messaging, (p) => toast(p.notification?.body || 'New alert', 'info', 8000));
  } catch (err) {
    toast('Push setup failed: ' + (err.message || err), 'error');
  }
}

/* ------------------------------------------------------ rules */
export const FIRESTORE_RULES = `rules_version = '2';

// Firebase console -> Firestore Database -> Rules -> paste this whole file -> Publish.
//
// Access model
//   * READ the directory: anyone.
//   * CREATE / edit own records: any signed-in visitor (anonymous session).
//   * MODERATOR powers (verify/suspend/delete any record, publish
//     announcements, read the inbox, settings): ONLY Email/Password
//     accounts - the users YOU create in the Firebase console under
//     Authentication -> Users. Anonymous visitors can never get these.

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // Moderator = an account created in the Firebase console with the
    // Email/Password provider (this app never registers such accounts).
    function isModerator() {
      return request.auth != null
        && request.auth.token.firebase.sign_in_provider == 'password';
    }

    // Phone numbers must look like a real Bangladeshi mobile number.
    function validPhone(v) {
      return v is string && v.matches('^(\\+880|0)1[3-9][0-9]{8}$');
    }

    function validGroup(v) {
      return v in ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
    }

    match /donors/{donorId} {
      allow read: if true;

      allow create: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.name is string
        && request.resource.data.name.size() > 1
        && request.resource.data.name.size() < 80
        && validPhone(request.resource.data.phone)
        && validGroup(request.resource.data.bloodGroup);

      allow update, delete: if isModerator()
        || (isSignedIn() && resource.data.uid == request.auth.uid);
    }

    match /requests/{requestId} {
      allow read: if true;

      allow create: if isSignedIn()
        && validPhone(request.resource.data.phone)
        && validGroup(request.resource.data.bloodGroup);

      // Owners may edit details or close their own request, but only a
      // moderator can publish (pending -> active) or reopen it.
      allow update, delete: if isModerator()
        || (isSignedIn() && resource.data.uid == request.auth.uid
            && (request.resource.data.status == resource.data.status
                || request.resource.data.status in ['fulfilled', 'cancelled']));
    }

    // Visitor inbox: anyone can write a message; only moderators read it.
    match /messages/{messageId} {
      allow read: if isModerator();
      allow create: if request.resource.data.message is string
                    && request.resource.data.message.size() < 1000;
      allow update, delete: if isModerator();
    }

    // Announcements, audit trail and settings: moderators only.
    match /announcements/{id} {
      allow read: if true;
      allow write: if isModerator();
    }

    // Daily counters, best effort.
    match /analytics/{day} {
      allow read: if true;
      allow write: if true;
    }

    match /audit/{id} {
      allow read, write: if isModerator();
    }

    match /settings/{id} {
      allow read: if true;
      allow write: if isModerator();
    }

    // Everything else: closed.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;
