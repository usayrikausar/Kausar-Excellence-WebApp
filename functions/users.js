// Callables backing the /admin panel: creating a daie (Auth account +
// Firestore profile + custom claims + Daie ID), and editing an existing
// daie's rank/unit/upline/structureType/subscriptionStatus.
//
// Every write to users/{uid} goes through here (never directly from the
// client — see firestore.rules) so rank, lineagePath, and the Auth account's
// disabled state can never drift out of sync with each other.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { nextDaieId } from './daieId.js';

const RANKS = ['KDE', 'DPM', 'DM'];
const STRUCTURE_TYPES = ['TS', 'OS'];

// A fresh random password per account (shown once to the admin, who relays
// it to the new daie) — never a shared/guessable default, since this runs
// against the live project, not just the emulator.
function generateTempPassword() {
  return randomBytes(9).toString('base64url'); // 12 chars, URL-safe
}

async function requireGroupAdmin(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const db = getFirestore();
  const callerDoc = await db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().isGroupAdmin !== true) {
    throw new HttpsError('permission-denied', 'Only a Group Admin can do this.');
  }
  return callerUid;
}

export const createUser = onCall(async (request) => {
  await requireGroupAdmin(request);
  const { name, email, rank, unitId, uplineId, structureType, isGroupAdmin } = request.data ?? {};

  if (!name || typeof name !== 'string') throw new HttpsError('invalid-argument', 'Name is required.');
  if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'Email is required.');
  if (!RANKS.includes(rank)) throw new HttpsError('invalid-argument', 'rank must be KDE, DPM, or DM.');
  if (!unitId || typeof unitId !== 'string') throw new HttpsError('invalid-argument', 'unitId is required.');
  if (!STRUCTURE_TYPES.includes(structureType)) {
    throw new HttpsError('invalid-argument', 'structureType must be TS or OS.');
  }
  if (rank !== 'KDE' && !uplineId) {
    throw new HttpsError('invalid-argument', 'DPM and DM must have an uplineId.');
  }

  const auth = getAuth();
  const db = getFirestore();

  const daieId = await nextDaieId(rank);
  const tempPassword = generateTempPassword();
  const authUser = await auth.createUser({ email, password: tempPassword, displayName: name });

  const claims = { rank, unitId, isGroupAdmin: isGroupAdmin === true };
  await auth.setCustomUserClaims(authUser.uid, claims);

  await db.collection('users').doc(authUser.uid).set({
    daieId,
    name,
    email,
    rank,
    unitId,
    uplineId: rank === 'KDE' ? null : uplineId,
    lineagePath: [], // filled in by recomputeLineageOnWrite, triggered by this very create
    structureType,
    subscriptionStatus: 'active',
    isGroupAdmin: isGroupAdmin === true,
    isLdpMember: false,
    dateLicensed: null, // set later by the introducer once onboarding (My Onboarding) is complete
    createdAt: FieldValue.serverTimestamp(),
  });

  return { uid: authUser.uid, daieId, email, password: tempPassword };
});

// Partial update — only the fields the admin panel actually exposes for
// editing. Anything touching rank/unitId/isGroupAdmin re-syncs custom claims;
// anything touching uplineId relies on recomputeLineageOnWrite (the Firestore
// trigger) to fix lineagePath and cascade to descendants.
const DATE_LICENSED_RE = /^\d{4}-\d{2}-\d{2}$/;

export const updateUser = onCall(async (request) => {
  await requireGroupAdmin(request);
  const { uid, rank, unitId, uplineId, structureType, subscriptionStatus, isGroupAdmin, isLdpMember, dateLicensed } =
    request.data ?? {};
  if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid is required.');

  const db = getFirestore();
  const auth = getAuth();
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');

  const patch = {};
  if (rank !== undefined) {
    if (!RANKS.includes(rank)) throw new HttpsError('invalid-argument', 'rank must be KDE, DPM, or DM.');
    patch.rank = rank;
  }
  if (unitId !== undefined) patch.unitId = unitId;
  if (uplineId !== undefined) patch.uplineId = uplineId || null;
  if (structureType !== undefined) {
    if (!STRUCTURE_TYPES.includes(structureType)) throw new HttpsError('invalid-argument', 'structureType must be TS or OS.');
    patch.structureType = structureType;
  }
  if (isGroupAdmin !== undefined) patch.isGroupAdmin = isGroupAdmin === true;
  if (isLdpMember !== undefined) patch.isLdpMember = isLdpMember === true;
  if (dateLicensed !== undefined) {
    // Set once the daie completes onboarding (My Onboarding) — entered by
    // their introducer/upline, not the daie themselves. null clears it
    // (e.g. correcting a mistaken entry); a non-null value must be a plain
    // YYYY-MM-DD date, matching every other date field the client sends.
    if (dateLicensed !== null && !DATE_LICENSED_RE.test(dateLicensed)) {
      throw new HttpsError('invalid-argument', 'dateLicensed must be a YYYY-MM-DD date or null.');
    }
    patch.dateLicensed = dateLicensed;
  }
  if (subscriptionStatus !== undefined) {
    if (!['active', 'inactive'].includes(subscriptionStatus)) {
      throw new HttpsError('invalid-argument', 'subscriptionStatus must be active or inactive.');
    }
    patch.subscriptionStatus = subscriptionStatus;
    // Actually block login, not just hide it in the UI — same convention as
    // beana-home-quran's setUserActive.
    await auth.updateUser(uid, { disabled: subscriptionStatus === 'inactive' });
  }

  if (Object.keys(patch).length === 0) return { uid };

  await userRef.set(patch, { merge: true });

  if (patch.rank !== undefined || patch.unitId !== undefined || patch.isGroupAdmin !== undefined) {
    const merged = { ...snap.data(), ...patch };
    await auth.setCustomUserClaims(uid, {
      rank: merged.rank,
      unitId: merged.unitId,
      isGroupAdmin: merged.isGroupAdmin === true,
    });
  }

  return { uid };
});

// Re-sync custom claims from the current users/{uid} doc. Exposed on its own
// in case claims and the doc ever drift (e.g. after a manual Firestore edit
// during development).
export const setUserClaims = onCall(async (request) => {
  await requireGroupAdmin(request);
  const { uid } = request.data ?? {};
  if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid is required.');

  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');
  const data = snap.data();

  await getAuth().setCustomUserClaims(uid, {
    rank: data.rank,
    unitId: data.unitId,
    isGroupAdmin: data.isGroupAdmin === true,
  });

  return { uid };
});
