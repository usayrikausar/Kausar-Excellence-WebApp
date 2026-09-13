import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { CurrentUser } from "@/lib/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

// Re-exported so existing call sites (the session API route) can keep
// importing it from here alongside the guards, without pulling
// firebase-admin into anything that only needs the cookie name (Proxy does —
// see lib/auth/constants.ts).
export { SESSION_COOKIE_NAME };

/**
 * Verifies the session cookie (a Firebase ID token set by
 * app/api/auth/session/route.ts right after client-side sign-in) and loads
 * the matching users/{uid} doc via the Admin SDK. Returns null instead of
 * throwing so callers can decide how to react (guards below redirect).
 *
 * Reads role info from the Firestore doc rather than the token's custom
 * claims — the doc is what Cloud Functions keep in sync on every edit, and
 * reading it here avoids waiting on an ID-token refresh after an admin
 * changes someone's rank/unit (the same "mirror claims onto the doc for
 * instant reads" idea as beana-home-quran, combined with love-spark's
 * custom-claims-as-source-of-truth-for-rules approach).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!snap.exists) return null;

    const data = snap.data()!;
    if (data.subscriptionStatus === "inactive") return null;

    // Build a plain object explicitly rather than spreading the raw
    // Firestore doc — `createdAt` is a Timestamp class instance, and Next.js
    // Server Components can only pass plain objects/built-ins across to
    // Client Components (AppShell/Sidebar/Topbar all take `user` as a prop).
    return {
      uid: decoded.uid,
      daieId: data.daieId,
      name: data.name,
      email: data.email,
      rank: data.rank,
      unitId: data.unitId,
      uplineId: data.uplineId ?? null,
      lineagePath: data.lineagePath ?? [],
      structureType: data.structureType,
      subscriptionStatus: data.subscriptionStatus,
      isGroupAdmin: data.isGroupAdmin === true,
      isLdpMember: data.isLdpMember === true,
      dateLicensed: data.dateLicensed ?? null,
    } satisfies CurrentUser;
  } catch {
    return null;
  }
}

/** Any signed-in, active daie. Redirects to /login otherwise. */
export async function requireDaie(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Group-level admin only (the business owner + appointees). */
export async function requireGroupAdmin(): Promise<CurrentUser> {
  const user = await requireDaie();
  if (!user.isGroupAdmin) redirect("/");
  return user;
}

/**
 * Phase 1 has no separate unit-admin tier — per the approved plan, /admin is
 * gated on isGroupAdmin only. This alias exists so call sites (and a future
 * unit-admin rollout) don't have to change shape, but for now it's exactly
 * requireGroupAdmin.
 */
export const requireUnitAdmin = requireGroupAdmin;

/** KDEs and Kausar Leadership Programme members only (the LDP and Leaders Tool tabs). */
export async function requireLdpAccess(): Promise<CurrentUser> {
  const user = await requireDaie();
  if (user.rank !== "KDE" && !user.isLdpMember) redirect("/");
  return user;
}
