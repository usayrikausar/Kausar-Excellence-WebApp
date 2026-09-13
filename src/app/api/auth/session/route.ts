import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// The Firebase JS SDK keeps its signed-in session in IndexedDB, which Server
// Components can't read. This route lets the client hand its ID token to the
// server right after sign-in (and again whenever the token refreshes) so it
// can live in an httpOnly cookie that Server Components/middleware CAN read.
//
// The token itself (not a separate Admin-SDK session cookie) is stored — it's
// verified with adminAuth.verifyIdToken() on every read in lib/auth/session.ts,
// which works against the Auth emulator the same way it would in production.
// Good enough for a ~1 hour Phase 1 session; the client refreshes it via
// onIdTokenChanged (see components/daie/session-sync.tsx).

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // matches Firebase ID token lifetime
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
