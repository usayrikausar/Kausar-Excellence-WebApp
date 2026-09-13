// Cloud Functions backing the /admin panel and the hierarchy's data integrity.
// Client-side Firebase can't create other users' Auth accounts, set custom
// claims, or be trusted to hand-edit its own rank/upline/lineagePath — all of
// that happens here with the Admin SDK, which bypasses firestore.rules.
//
// Flat ESM files (not folders-per-function), firebase-functions v2
// (onCall/HttpsError), firebase-admin v12, Node 20 — mirrors the
// beana-home-quran functions/ convention.
//
// Run locally (emulator only — see scripts/seed-emulator.mjs for how these
// are exercised):
//   firebase emulators:start --only auth,firestore,functions

import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { createUser, updateUser, setUserClaims } from './users.js';
export { recomputeLineageOnWrite } from './lineage.js';
