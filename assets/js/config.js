/* =============================================================
   One Drop — A Drop of Life
   Notre Dame College · Batch 27 · Group 11
   Global configuration
   ============================================================= */

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA1cYpcameCImAE4pTbD8aa3uZivrgrPN0',
  authDomain: 'blood-donate-ndc.firebaseapp.com',
  projectId: 'blood-donate-ndc',
  storageBucket: 'blood-donate-ndc.firebasestorage.app',
  messagingSenderId: '1062995040448',
  appId: '1:1062995040448:web:946760282dc16ce4b63525',
  measurementId: 'G-XQKW1QTBFB'
};

/* ---------------------------------------------------------------
   ADMIN ACCESS
   Add the Firebase Auth UID of every person allowed to open the
   admin panel. Open /admin.html while signed in — the page shows
   your UID with a copy button. Paste it here, commit, redeploy.
   --------------------------------------------------------------- */
export const ADMIN_UIDS = [
  // 'PASTE-YOUR-UID-HERE'
];

/* Deploy the site to its real address and update these three, so
   canonical tags, Open Graph cards and the sitemap point correctly. */
export const SITE_URL  = 'https://onedropndc.github.io';
export const SITE_NAME = 'One Drop — A Drop of Life';
export const APP_VERSION = '1.1.0';

/* Optional: Web push (Firebase Cloud Messaging).
   1. Firebase console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair
   2. Paste the public key below
   3. admin.html → Overview → "Subscribe to push"
   With an empty key the app still shows in-app + browser alerts. */
export const VAPID_KEY = '';

/* Firestore collection names */
export const COL = {
  DONORS:     'donors',
  REQUESTS:   'requests',
  ANNOUNCE:   'announcements',
  MESSAGES:   'messages',
  SETTINGS:   'settings',
  ANALYTICS:  'analytics',
  AUDIT:      'audit'
};

/* Donor becomes "available again" this many days after a donation.
   (Whole-blood donation: 8 weeks ≈ 56 days. Change if you prefer 90.) */
export const DONATION_COOLDOWN_DAYS = 56;

/* Seed the very first visit with realistic sample donors so the site
   never looks empty. Flip to false once real data starts coming in —
   already-seeded browsers can clear it in admin.html → Data tools. */
export const SEED_DEMO_DATA = true;

/* Local cache keys */
export const LS = {
  UID:       'lifeline:uid',
  DONORS:    'lifeline:cache:donors',
  REQUESTS:  'lifeline:cache:requests',
  ANNOUNCE:  'lifeline:cache:announcements',
  MODE:      'lifeline:mode',
  REVEALS:   'lifeline:reveals',
  SEEDED:    'lifeline:seeded',
  NOTIFY:    'lifeline:notify',
  MY_DONOR:  'lifeline:myDonorId',
  SW_VER:    'lifeline:swVersion'
};

export const APP = {
  name: 'One Drop',
  tagline: 'A Drop of Life',
  org: 'Notre Dame College · Batch 27 · Group 11',
  developer: 'Foysal Mahmud',
  developerUrl: 'https://foysalcyber.github.io/',
  emergencyHotline: '' // e.g. '+8801700000000' — shown in the footer when set
};
