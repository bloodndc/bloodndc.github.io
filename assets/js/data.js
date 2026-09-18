/* =============================================================
   Data layer
   Primary: Cloud Firestore.  Fallback: localStorage (+ demo seed)
   Every public function below works in both modes, so the site is
   never blank and never throws at the user.
   ============================================================= */

import { COL, LS, SEED_DEMO_DATA, DONATION_COOLDOWN_DAYS } from './config.js';
import { state as fb, initFirebase, ensureAuth } from './firebase.js';

/* -------------------------------------------------- utilities */
const now = () => new Date().toISOString();
const rid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const serverTs = () => (fb.ok && fb.fs ? fb.fs.serverTimestamp() : now());

export function isLive() { return mode === 'live'; }
export let mode = 'local';

function readLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

/* Normalise a Firestore Timestamp into an ISO string */
function plain(v) {
  if (v && typeof v.toDate === 'function') { const d = v.toDate(); return isNaN(d) ? null : d.toISOString(); }
  return v === undefined ? null : v;
}
function docToObj(snap) {
  const d = snap.data() || {};
  const out = { id: snap.id };
  for (const k in d) out[k] = plain(d[k]);
  return out;
}

/* ------------------------------------------------- boot / seed */
let readyPromise = null;
export function initData() { if (!readyPromise) readyPromise = boot(); return readyPromise; }

async function boot() {
  await initFirebase();
  mode = fb.ok ? 'live' : 'local';
  try { localStorage.setItem(LS.MODE, mode); } catch {}
  if (mode === 'local' && SEED_DEMO_DATA && !readLS(LS.SEEDED, false)) seedDemo();
  return { mode };
}

/* Firestore helper with automatic fallback */
async function tx(label, fn) {
  if (!fb.ok) throw new Error('offline');
  try {
    return await fn();
  } catch (err) {
    console.warn(`[One Drop] ${label} failed, using cache.`, err);
    mode = 'local';
    try { localStorage.setItem(LS.MODE, 'local'); } catch {}
    throw err;
  }
}

/* ===========================================================
   DONORS
   =========================================================== */
export async function listDonors() {
  await initData();
  try {
    const out = await tx('listDonors', async () => {
      const q = fb.fs.query(fb.fs.collection(fb.db, COL.DONORS), fb.fs.orderBy('createdAt', 'desc'));
      const snap = await fb.fs.getDocs(q);
      return snap.docs.map(docToObj);
    });
    if (out.length) writeLS(LS.DONORS, out);
    return ovDonors.merge(out.length ? out : mergeSeed(out));
  } catch {
    return ovDonors.merge(mergeSeed(readLS(LS.DONORS, [])));
  }
}

export function subscribeDonors(cb) {
  initData().then(() => {
    if (!fb.ok) { cb(ovDonors.merge(readLS(LS.DONORS, [])), 'local'); window.addEventListener('lifeline:local-change', () => cb(ovDonors.merge(readLS(LS.DONORS, [])), 'local')); return; }
    const q = fb.fs.query(fb.fs.collection(fb.db, COL.DONORS), fb.fs.orderBy('createdAt', 'desc'));
    fb.fs.onSnapshot(q, (snap) => {
      const rows = snap.docs.map(docToObj);
      if (rows.length) writeLS(LS.DONORS, rows);
      cb(ovDonors.merge(rows.length ? rows : mergeSeed([])), 'live');
    }, () => cb(ovDonors.merge(mergeSeed(readLS(LS.DONORS, []))), 'local'));
  });
}

function cleanDonor(d) {
  const blood = String(d.bloodGroup || '').toUpperCase().replace(/\s+/g, '');
  return {
    uid: d.uid || rid('anon'),
    name: String(d.name || '').trim(),
    phone: String(d.phone || '').replace(/[^\d+]/g, ''),
    bloodGroup: blood,
    district: String(d.district || '').trim(),
    area: String(d.area || '').trim(),
    available: d.available !== false,
    lastDonation: d.lastDonation || null,
    lat: d.lat === '' || d.lat === undefined || d.lat === null ? null : Number(d.lat),
    lng: d.lng === '' || d.lng === undefined || d.lng === null ? null : Number(d.lng),
    locationSource: d.locationSource || (d.lat ? 'gps' : 'district'),
    note: String(d.note || '').trim().slice(0, 240),
    age: d.age ? Math.min(80, Math.max(16, Number(d.age))) : null,
    donations: Number(d.donations) || 0,
    status: d.status || 'pending',   // pending | verified | suspended
    createdAt: d.createdAt || now(),
    updatedAt: now()
  };
}

export function nextEligibleDate(donor) {
  if (!donor.lastDonation) return null;
  const d = new Date(donor.lastDonation);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + DONATION_COOLDOWN_DAYS);
  return d.toISOString();
}

export async function addDonor(raw) {
  await initData();
  const user = await ensureAuth();
  const data = cleanDonor({ ...raw, uid: user ? user.uid : rid('anon'), status: raw.status || 'pending' });
  try {
    const ref = await tx('addDonor', async () => {
      const r = await fb.fs.addDoc(fb.fs.collection(fb.db, COL.DONORS), { ...data, createdAt: serverTs(), updatedAt: serverTs() });
      return r.id;
    });
    bumpStat('donations_registered');
    return { id: ref, ...data };
  } catch {
    const local = { id: rid('donor'), ...data };
    const rows = readLS(LS.DONORS, []);
    rows.unshift(local); writeLS(LS.DONORS, rows);
    ovDonors.add(local); ping();
    return local;
  }
}

export async function updateDonor(id, patch) {
  await initData();
  await ensureAuth(); // owner / moderator writes need a session
  try {
    await tx('updateDonor', async () => fb.fs.updateDoc(fb.fs.doc(fb.db, COL.DONORS, id), { ...patch, updatedAt: serverTs() }));
    return true;
  } catch {
    ovDonors.patch(id, { ...patch, updatedAt: now() });
    const rows = readLS(LS.DONORS, []);
    const i = rows.findIndex((r) => r.id === id);
    if (i > -1) { rows[i] = { ...rows[i], ...patch, updatedAt: now() }; writeLS(LS.DONORS, rows); }
    ping();
    return false;
  }
}

export async function deleteDonor(id) {
  await initData();
  await ensureAuth();
  try { await tx('deleteDonor', async () => fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.DONORS, id))); return true; }
  catch {
    ovDonors.del(id);
    writeLS(LS.DONORS, readLS(LS.DONORS, []).filter((r) => r.id !== id)); ping(); return false;
  }
}

/* ===========================================================
   EMERGENCY REQUESTS
   =========================================================== */
export async function listRequests() {
  await initData();
  try {
    const out = await tx('listRequests', async () => {
      const q = fb.fs.query(fb.fs.collection(fb.db, COL.REQUESTS), fb.fs.orderBy('createdAt', 'desc'));
      const snap = await fb.fs.getDocs(q);
      return snap.docs.map(docToObj);
    });
    if (out.length) writeLS(LS.REQUESTS, out);
    return ovRequests.merge(out);
  } catch { return ovRequests.merge(readLS(LS.REQUESTS, [])); }
}

/* Local overlay: writes that fell back to cache (server denied / offline)
   still show up instantly, and survive live snapshots until synced. */
function makeOverlay() {
  const patches = new Map();   // id -> patch
  const adds = [];             // rows created locally
  const deletes = new Set();   // ids removed locally
  return {
    merge(rows) {
      const out = rows
        .filter((r) => !deletes.has(r.id))
        .map((r) => (patches.has(r.id) ? { ...r, ...patches.get(r.id) } : r));
      for (const a of adds) if (!out.some((r) => r.id === a.id)) out.unshift(a);
      return out;
    },
    patch(id, patch) { patches.set(id, patch); },
    add(row) { adds.unshift(row); },
    del(id) { deletes.add(id); }
  };
}
const ovDonors = makeOverlay();
const ovRequests = makeOverlay();
const ovMessages = makeOverlay();

export function subscribeRequests(cb) {
  initData().then(() => {
    if (!fb.ok) { cb(ovRequests.merge(readLS(LS.REQUESTS, [])), 'local'); window.addEventListener('lifeline:local-change', () => cb(ovRequests.merge(readLS(LS.REQUESTS, [])), 'local')); return; }
    const q = fb.fs.query(fb.fs.collection(fb.db, COL.REQUESTS), fb.fs.orderBy('createdAt', 'desc'));
    fb.fs.onSnapshot(q, (snap) => {
      const rows = snap.docs.map(docToObj);
      writeLS(LS.REQUESTS, rows);
      cb(ovRequests.merge(rows), 'live');
    }, () => cb(ovRequests.merge(readLS(LS.REQUESTS, [])), 'local'));
  });
}

function cleanRequest(r) {
  return {
    patient: String(r.patient || '').trim(),
    bloodGroup: String(r.bloodGroup || '').toUpperCase().replace(/\s+/g, ''),
    units: Math.min(10, Math.max(1, Number(r.units) || 1)),
    hospital: String(r.hospital || '').trim(),
    district: String(r.district || '').trim(),
    area: String(r.area || '').trim(),
    contactName: String(r.contactName || '').trim(),
    phone: String(r.phone || '').replace(/[^\d+]/g, ''),
    neededBy: r.neededBy || null,
    note: String(r.note || '').trim().slice(0, 300),
    urgency: r.urgency === 'critical' ? 'critical' : 'urgent',
    status: r.status || 'active',     // active | fulfilled | expired | cancelled
    uid: r.uid || null,
    createdAt: r.createdAt || now(),
    updatedAt: now()
  };
}

export async function addRequest(raw) {
  await initData();
  const user = await ensureAuth();
  const data = cleanRequest({ ...raw, uid: user ? user.uid : rid('anon') });
  try {
    const ref = await tx('addRequest', async () => {
      const r = await fb.fs.addDoc(fb.fs.collection(fb.db, COL.REQUESTS), { ...data, createdAt: serverTs(), updatedAt: serverTs() });
      return r.id;
    });
    bumpStat('requests_posted');
    return { id: ref, ...data };
  } catch {
    const local = { id: rid('req'), ...data };
    const rows = readLS(LS.REQUESTS, []);
    rows.unshift(local); writeLS(LS.REQUESTS, rows);
    ovRequests.add(local); ping();
    return local;
  }
}

export async function updateRequest(id, patch) {
  await initData();
  await ensureAuth(); // owner / moderator writes need a session
  try { await tx('updateRequest', async () => fb.fs.updateDoc(fb.fs.doc(fb.db, COL.REQUESTS, id), { ...patch, updatedAt: serverTs() })); return true; }
  catch {
    ovRequests.patch(id, { ...patch, updatedAt: now() });
    const rows = readLS(LS.REQUESTS, []);
    const i = rows.findIndex((r) => r.id === id);
    if (i > -1) { rows[i] = { ...rows[i], ...patch, updatedAt: now() }; writeLS(LS.REQUESTS, rows); }
    ping();
    return false;
  }
}

export async function deleteRequest(id) {
  await initData();
  await ensureAuth();
  try { await tx('deleteRequest', async () => fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.REQUESTS, id))); return true; }
  catch {
    ovRequests.del(id);
    writeLS(LS.REQUESTS, readLS(LS.REQUESTS, []).filter((r) => r.id !== id));
    ping();
    return false;
  }
}

/* ===========================================================
   ANNOUNCEMENTS / MESSAGES / STATS
   =========================================================== */
export async function listAnnouncements() {
  await initData();
  try {
    const out = await tx('listAnnouncements', async () => {
      const snap = await fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, COL.ANNOUNCE), fb.fs.where('active', '==', true)));
      return snap.docs.map(docToObj);
    });
    writeLS(LS.ANNOUNCE, out);
    return out;
  } catch { return readLS(LS.ANNOUNCE, []); }
}

export function subscribeAnnouncements(cb) {
  initData().then(() => {
    if (!fb.ok) { cb(readLS(LS.ANNOUNCE, [])); return; }
    fb.fs.onSnapshot(fb.fs.collection(fb.db, COL.ANNOUNCE), (snap) => {
      const rows = snap.docs.map(docToObj).filter((r) => r.active);
      writeLS(LS.ANNOUNCE, rows); cb(rows);
    }, () => cb(readLS(LS.ANNOUNCE, [])));
  });
}

export async function saveAnnouncement(doc) {
  await initData();
  const data = { title: String(doc.title || '').trim(), body: String(doc.body || '').trim(), level: doc.level || 'info', active: doc.active !== false, updatedAt: now() };
  try {
    if (doc.id) { await tx('saveAnnouncement', async () => fb.fs.updateDoc(fb.fs.doc(fb.db, COL.ANNOUNCE, doc.id), { ...data, updatedAt: serverTs() })); return doc.id; }
    return await tx('saveAnnouncement', async () => (await fb.fs.addDoc(fb.fs.collection(fb.db, COL.ANNOUNCE), { ...data, createdAt: serverTs() })).id);
  } catch {
    const rows = readLS(LS.ANNOUNCE, []);
    const id = doc.id || rid('ann');
    const i = rows.findIndex((r) => r.id === id);
    const row = { id, ...data };
    if (i > -1) rows[i] = row; else rows.unshift(row);
    writeLS(LS.ANNOUNCE, rows); ping(); return id;
  }
}

export async function deleteAnnouncement(id) {
  await initData();
  try { await tx('deleteAnnouncement', async () => fb.fs.deleteDoc(fb.fs.doc(fb.db, COL.ANNOUNCE, id))); return true; }
  catch { writeLS(LS.ANNOUNCE, readLS(LS.ANNOUNCE, []).filter((r) => r.id !== id)); ping(); return false; }
}

export async function sendMessage(doc) {
  await initData();
  const data = {
    name: String(doc.name || '').trim(),
    contact: String(doc.contact || '').trim(),
    subject: String(doc.subject || '').trim(),
    message: String(doc.message || '').trim().slice(0, 1000),
    createdAt: now(), read: false
  };
  try {
    return await tx('sendMessage', async () => (await fb.fs.addDoc(fb.fs.collection(fb.db, COL.MESSAGES), { ...data, createdAt: serverTs() })).id);
  } catch {
    const rows = readLS('lifeline:cache:messages', []);
    rows.unshift({ id: rid('msg'), ...data }); writeLS('lifeline:cache:messages', rows); ping();
    return 'local';
  }
}

export async function listMessages() {
  await initData();
  try {
    const out = await tx('listMessages', async () => {
      const snap = await fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, COL.MESSAGES), fb.fs.orderBy('createdAt', 'desc')));
      return snap.docs.map(docToObj);
    });
    if (out.length) writeLS('lifeline:cache:messages', out);
    return ovMessages.merge(out);
  } catch { return ovMessages.merge(readLS('lifeline:cache:messages', [])); }
}

export async function markMessageRead(id) {
  await initData();
  await ensureAuth();
  try { await tx('markMessageRead', async () => fb.fs.updateDoc(fb.fs.doc(fb.db, COL.MESSAGES, id), { read: true })); }
  catch {
    ovMessages.patch(id, { read: true });
    const rows = readLS('lifeline:cache:messages', []);
    const i = rows.findIndex((r) => r.id === id);
    if (i > -1) { rows[i].read = true; writeLS('lifeline:cache:messages', rows); }
    ping();
  }
}

/* Lightweight daily counters (best effort, low write volume) */
export async function bumpStat(key, by = 1) {
  await initData();
  if (!fb.ok) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    await fb.fs.setDoc(fb.fs.doc(fb.db, COL.ANALYTICS, day), { [key]: fb.fs.increment(by) }, { merge: true });
  } catch { /* non-critical */ }
}

export async function logAudit(action, target) {
  await initData();
  if (!fb.ok) return;
  try {
    await fb.fs.addDoc(fb.fs.collection(fb.db, COL.AUDIT), { action, target: target || '', at: serverTs() });
  } catch {}
}

export async function getStatSnapshot() {
  await initData();
  if (!fb.ok) return null;
  try {
    const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, COL.ANALYTICS));
    const acc = { visits: 0, requests_posted: 0, donations_registered: 0 };
    snap.forEach((d) => { const o = d.data(); for (const k in acc) acc[k] += Number(o[k] || 0); });
    return acc;
  } catch { return null; }
}

/* ===========================================================
   DEMO DATASET (local / offline / empty-project mode)
   =========================================================== */
export function seedDemo() {
  const base = Date.now();
  const mk = (i, name, phone, bloodGroup, district, area, avail, daysAgoDonated, lat, lng, note) => ({
    id: `demo_${i}`, uid: `demo_${i}`, name, phone, bloodGroup, district, area,
    available: avail,
    lastDonation: daysAgoDonated === null ? null : new Date(base - daysAgoDonated * 864e5).toISOString(),
    lat, lng, locationSource: lat ? 'gps' : 'district',
    note, age: 18 + (i % 7), donations: i % 5, status: i % 4 === 3 ? 'pending' : 'verified',
    createdAt: new Date(base - (60 - i) * 864e5).toISOString(), updatedAt: now()
  });

  const donors = [
    mk(1,  'Tanvir Ahmed',    '+8801711223344', 'O+',  'Dhaka',       'Motijheel',      true,  null, 23.7330, 90.4172, 'Available any day after 6 PM. Two previous donations.'),
    mk(2,  'Sadia Islam',     '+8801812334455', 'A+',  'Dhaka',       'Dhanmondi',      true,  120,   23.7461, 90.3742, 'Female donor, comfortable with female patients.'),
    mk(3,  'Mahmudul Hasan',  '+8801913445566', 'B+',  'Dhaka',       'Mirpur 10',      true,  null, 23.8060, 90.3685, 'Can reach any hospital inside Dhaka within an hour.'),
    mk(4,  'Nusrat Jahan',    '+8801614556677', 'AB+', 'Dhaka',       'Uttara',         false, 21,    23.8759, 90.3795, 'Donated recently — back after the cooling-off period.'),
    mk(5,  'Rafiul Karim',    '+8801515667788', 'O-',  'Dhaka',       'Mohakhali',      true,  null, 23.7772, 90.4034, 'Rare group O−. Call anytime, including night emergencies.'),
    mk(6,  'Arif Hossain',    '+8801716778899', 'A-',  'Gazipur',     'Tongi',          true,  200,   23.8900, 90.4060, 'Weekend donor. Own transport available.'),
    mk(7,  'Fariha Rahman',   '+8801817889900', 'B-',  'Dhaka',       'Bashundhara R/A', true, null,  23.8138, 90.4265, 'Medical student — happy to help with paperwork too.'),
    mk(8,  'Shakib Al Amin',  '+8801918990011', 'O+',  'Narayanganj', 'Fatullah',       true,  95,    23.6948, 90.4590, 'Group of 4 friends from the same area can donate together.'),
    mk(9,  'Mehedi Hasan',    '+8801619001122', 'A+',  'Chattogram',  'Panchlaish',     true,  null,  22.3569, 91.7832, 'Available across Chattogram city.'),
    mk(10, 'Jannatul Ferdous','+8801520112233', 'AB-', 'Dhaka',       'Banani',         true,  75,    23.7936, 90.4066, 'AB− donor, verified by the campus team.'),
    mk(11, 'Imran Kabir',     '+8801721223344', 'B+',  'Dhaka',       'Khilgaon',       true,  null,  23.7462, 90.4213, 'First-time donor, very eager to start.'),
    mk(12, 'Rumana Akter',    '+8801822334455', 'O+',  'Sylhet',      'Zindabazar',     false, 8,     24.8949, 91.8687, 'Just donated — available next month.'),
    mk(13, 'Hasibur Rahman',  '+8801923445566', 'A+',  'Rajshahi',    'Boalia',         true,  140,   24.3745, 88.6042, 'Can donate at Rajshahi Medical College Hospital.'),
    mk(14, 'Tasnim Noshin',   '+8801624556677', 'B+',  'Khulna',      'Sonadanga',      true,  null,  22.8158, 89.5562, 'Available on weekdays after office hours.'),
    mk(15, 'Sabbir Ahmed',    '+8801525667788', 'O+',  'Dhaka',       'Mohammadpur',    true,  190,   23.7639, 90.3589, 'Regular donor, five donations so far.'),
    mk(16, 'Ayesha Siddiqua', '+8801726778899', 'AB+', 'Dhaka',       'Badda',          true,  null,  23.7806, 90.4254, 'Prefer daytime donations.'),
    mk(17, 'Rakibul Islam',   '+8801827889900', 'A+',  'Mymensingh',  'Charpara',       true,  60,    24.7471, 90.4203, 'Available across Mymensingh town.'),
    mk(18, 'Sharmin Sultana', '+8801928990011', 'O-',  'Dhaka',       'Shyamoli',       true,  null,  23.7781, 90.3654, 'Rare group — please call only for genuine emergencies.'),
    mk(19, 'Naimul Haque',    '+8801629001122', 'B-',  'Barishal',    'Nathullabad',    true,  110,   22.7010, 90.3535, 'Barishal city and nearby upazilas.'),
    mk(20, 'Sumaiya Islam',   '+8801530112233', 'A-',  'Dhaka',       'Bashundhara R/A', true, null,   23.8151, 90.4271, 'NDC Batch 27 volunteer.'),
    mk(21, 'Fahim Shahriar',  '+8801731223344', 'O+',  'Dhaka',       'Rampura',        true,  160,   23.7588, 90.4166, 'Can arrange two donors at short notice.'),
    mk(22, 'Maliha Tabassum', '+8801832334455', 'AB+', 'Dhaka',       'Gulshan',        true,  null,  23.7925, 90.4078, 'Prefers scheduled appointments.'),
    mk(23, 'Zahidul Islam',   '+8801933445566', 'B+',  'Cumilla',     'Kandirpar',      false, 30,    23.4607, 91.1809, 'Recovering — back soon.'),
    mk(24, 'Rifat Chowdhury', '+8801634556677', 'A+',  'Dhaka',       'Jatrabari',      true,  null,  23.7104, 90.4346, 'Ready for emergency night calls.')
  ];

  const requests = [
    { id: 'demo_req_1', patient: 'Md. Abdul Malek (58)', bloodGroup: 'O-', units: 2, hospital: 'Dhaka Medical College Hospital', district: 'Dhaka', area: 'Shahbagh', contactName: 'Rony', phone: '+8801799887766', neededBy: new Date(base + 9 * 36e5).toISOString(), note: 'Emergency surgery, need donors at the blood bank before morning.', urgency: 'critical', status: 'active', uid: 'demo_req_1', createdAt: new Date(base - 3 * 36e5).toISOString(), updatedAt: now() },
    { id: 'demo_req_2', patient: 'Baby of Sumaiya (3 days)', bloodGroup: 'AB+', units: 1, hospital: 'Square Hospitals, West Panthapath', district: 'Dhaka', area: 'Panthapath', contactName: 'Sumaiya', phone: '+8801888776655', neededBy: new Date(base + 30 * 36e5).toISOString(), note: 'Newborn jaundice — exchange transfusion advised.', urgency: 'urgent', status: 'active', uid: 'demo_req_2', createdAt: new Date(base - 20 * 36e5).toISOString(), updatedAt: now() },
    { id: 'demo_req_3', patient: 'Anowara Begum (64)', bloodGroup: 'B+', units: 3, hospital: 'National Heart Foundation', district: 'Dhaka', area: 'Agargaon', contactName: 'Sabbir', phone: '+8801677665544', neededBy: new Date(base + 50 * 36e5).toISOString(), note: 'Open-heart surgery scheduled for Friday.', urgency: 'urgent', status: 'active', uid: 'demo_req_3', createdAt: new Date(base - 30 * 36e5).toISOString(), updatedAt: now() }
  ];

  writeLS(LS.DONORS, donors);
  writeLS(LS.REQUESTS, requests);
  writeLS(LS.ANNOUNCE, []);
  writeLS(LS.SEEDED, true);
}

/** When Firestore is live but the project is still empty, show demo rows
 *  (clearly marked) so the site never looks broken. */
function mergeSeed(rows) {
  if (!SEED_DEMO_DATA) return rows;
  if (rows.length) return rows;
  if (!readLS(LS.SEEDED, false)) seedDemo();
  return readLS(LS.DONORS, []);
}

export function clearLocalData() {
  [LS.DONORS, LS.REQUESTS, LS.ANNOUNCE, LS.SEEDED, 'lifeline:cache:messages', LS.REVEALS].forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
  ping();
}

function ping() { window.dispatchEvent(new Event('lifeline:local-change')); }
