"use client";

// Firebase JS SDK for Client Components — mirrors rotan-pantang-spa's
// lib/supabase/client.ts split: this file is safe to import from the
// browser, lib/firebase/admin.ts (Admin SDK) never is.
//
// Phase 1 only ever points at the Firebase Emulator Suite (see .env.local) —
// no real/live Firebase project exists for this app yet.

import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Connecting an emulator twice throws, and this module can be evaluated more
// than once during Fast Refresh — guard with a flag on globalThis.
const g = globalThis as unknown as { __kausarEmulatorsConnected?: boolean };

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" && !g.__kausarEmulatorsConnected) {
  g.__kausarEmulatorsConnected = true;

  connectAuthEmulator(auth, `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(
    db,
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST!,
    Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT),
  );
  connectFunctionsEmulator(
    functions,
    process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST!,
    Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT),
  );
  connectStorageEmulator(
    storage,
    process.env.NEXT_PUBLIC_STORAGE_EMULATOR_HOST!,
    Number(process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT),
  );
}
