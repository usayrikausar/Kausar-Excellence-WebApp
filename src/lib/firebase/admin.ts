import "server-only";

// firebase-admin SDK — server-only, never imported into client code (mirrors
// rotan-pantang-spa's lib/supabase/server.ts / service.ts split, adapted for
// Firebase). Used by Server Components/Actions to verify the session cookie
// and read Firestore with full access (bypassing security rules), which is
// safe here only because every caller has already been through a guard in
// lib/auth/session.ts.
//
// Points at the local emulators via FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST (set in .env.local) — the Admin SDK auto-detects
// those env vars and never touches a real project.

import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  // Against the emulator, the Admin SDK just needs a projectId — it never
  // calls out to real GCP credentials as long as the *_EMULATOR_HOST env vars
  // are set (they are, via .env.local).
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  // Passing an explicit `credential: undefined` key (rather than omitting it)
  // trips firebase-admin's options validation, so build the options object
  // conditionally instead.
  return initializeApp(
    usingEmulator ? { projectId } : { projectId, credential: applicationDefault() },
  );
}

const app = getAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Re-exported only so a future real deployment can swap in a service-account
// cert without touching call sites.
export { cert };
