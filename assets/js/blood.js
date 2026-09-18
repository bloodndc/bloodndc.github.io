/* Blood group data, compatibility rules and shared helpers */

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/* Who each group can RECEIVE red cells from */
export const RECEIVES_FROM = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-']
};

/* Who each group can DONATE red cells to */
export const DONATES_TO = {
  'A+':  ['A+', 'AB+'],
  'A-':  ['A+', 'A-', 'AB+', 'AB-'],
  'B+':  ['B+', 'AB+'],
  'B-':  ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
  'O+':  ['A+', 'B+', 'AB+', 'O+'],
  'O-':  ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
};

export const GROUP_META = {
  'A+':  { label: 'A Positive',  hue: 355, note: '2nd most common group in Bangladesh' },
  'A-':  { label: 'A Negative',  hue: 348, note: 'Rare — about 1 in 100 people' },
  'B+':  { label: 'B Positive',  hue: 12,  note: 'Most common group in Bangladesh' },
  'B-':  { label: 'B Negative',  hue: 6,   note: 'Rare — about 1 in 100 people' },
  'AB+': { label: 'AB Positive', hue: 330, note: 'Universal plasma donor' },
  'AB-': { label: 'AB Negative', hue: 322, note: 'Rarest group — roughly 1 in 200' },
  'O+':  { label: 'O Positive',  hue: 0,   note: 'High demand in every hospital' },
  'O-':  { label: 'O Negative',  hue: 352, note: 'Universal red-cell donor — golden group' }
};

export function canDonateTo(from, to) {
  return Array.isArray(DONATES_TO[from]) && DONATES_TO[from].includes(to);
}
export function canReceiveFrom(to, from) {
  return Array.isArray(RECEIVES_FROM[to]) && RECEIVES_FROM[to].includes(from);
}
export function compatibleDonorGroups(needed) {
  return RECEIVES_FROM[needed] ? RECEIVES_FROM[needed].slice() : [];
}

/* ------------------------------------------------- validation */
export const PHONE_RE = /^(?:\+?880|0)1[3-9]\d{8}$/;

export function normalizePhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00880')) p = '+880' + p.slice(5);
  else if (p.startsWith('880')) p = '+' + p;
  else if (p.startsWith('0')) p = '+880' + p.slice(1);
  else if (!p.startsWith('+')) p = '+' + p;
  return p;
}

export function prettyPhone(raw) {
  const p = normalizePhone(raw);
  // +8801711223344 -> +880 1711-223-344
  const m = p.match(/^\+880(1\d{3})(\d{3})(\d{3})$/);
  return m ? `+880 ${m[1]}-${m[2]}-${m[3]}` : p;
}

export function isValidPhone(raw) { return PHONE_RE.test(String(raw || '').replace(/[\s-]/g, '')); }

export function isPlausibleDate(iso) {
  if (!iso) return true;
  const d = new Date(iso);
  if (isNaN(d)) return false;
  const t = Date.now();
  return d.getTime() <= t && d.getTime() > t - 40 * 365 * 864e5;
}

export function isValidBloodGroup(g) { return BLOOD_GROUPS.includes(String(g || '').toUpperCase().replace(/\s+/g, '')); }

/* --------------------------------------------------- helpers */
export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  return `${Math.floor(mo / 12)} yr ago`;
}

export function countdown(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  let s = Math.floor((t - Date.now()) / 1000);
  const overdue = s < 0;
  s = Math.abs(s);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  let text;
  if (d > 0) text = `${d}d ${h}h`;
  else if (h > 0) text = `${h}h ${m}m`;
  else if (m > 0) text = `${m}m ${sec}s`;
  else text = `${sec}s`;
  return { overdue, text };
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 864e5);
}
