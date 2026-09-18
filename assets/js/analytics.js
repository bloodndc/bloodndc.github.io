/* Lightweight, privacy-friendly analytics.
   No third-party trackers. One counter per visitor per day, stored in
   Firestore under analytics/<YYYY-MM-DD>. */

import { bumpStat } from './data.js';

const DAY_KEY = 'lifeline:visitDay';

export function trackVisit() {
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(DAY_KEY) === today) return;
  localStorage.setItem(DAY_KEY, today);
  bumpStat('visits');
}

export function trackEvent(key) { bumpStat(key); }
