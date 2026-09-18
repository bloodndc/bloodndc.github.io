/* =============================================================
   Firebase bootstrap (modular SDK v10, loaded from Google CDN)
   Everything degrades gracefully: if Firebase cannot be reached
   the app keeps working from a local cache + demo dataset.
   ============================================================= */

import { FIREBASE_CONFIG } from './config.js';

const CDN = 'https://www.gstatic.com/firebasejs/10.12.2';

export const state = {
  ok: false,          // Firebase app + Firestore reachable
  authOk: false,
  app: null,
  db: null,
  auth: null,
  fs: null,
  fa: null,
  error: null
};

let bootPromise = null;

/** Initialise Firebase once. Never throws. */
export function initFirebase() {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

async function boot() {
  try {
    const [{ initializeApp }, firestore, auth] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`),
      import(`${CDN}/firebase-auth.js`)
    ]);

    state.app = initializeApp(FIREBASE_CONFIG);
    state.db = firestore.getFirestore(state.app);
    state.fs = firestore;
    state.auth = auth.getAuth(state.app);
    state.fa = auth;
    state.ok = true;
    state.authOk = true;
  } catch (err) {
    state.ok = false;
    state.error = err && err.message ? err.message : String(err);
    console.warn('[One Drop] Firebase unavailable → local mode.', state.error);
  }
  return state;
}

/** Anonymous session. Re-used across pages via localStorage. */
export async function ensureAuth() {
  // Wait for any restored session first — signing in during restore would
  // create a second anonymous account and break owner-only writes.
  const restored = await waitForAuth(4000);
  if (restored) return restored;
  if (!state.authOk) return null;
  try {
    if (state.auth.currentUser) return state.auth.currentUser;
    const cred = await state.fa.signInAnonymously(state.auth);
    return cred.user;
  } catch (err) {
    console.warn('[One Drop] Anonymous sign-in failed.', err);
    return null;
  }
}

/** Wait for the auth state to settle (returns user or null). */
export function waitForAuth(timeoutMs = 6000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (u) => { if (!done) { done = true; resolve(u); } };
    const timer = setTimeout(() => finish(state.auth ? state.auth.currentUser : null), timeoutMs);
    initFirebase().then((s) => {
      if (!s.authOk) { clearTimeout(timer); return finish(null); }
      if (s.auth.currentUser) { clearTimeout(timer); return finish(s.auth.currentUser); }
      s.fa.onAuthStateChanged(s.auth, (user) => { clearTimeout(timer); finish(user); });
    });
  });
}
