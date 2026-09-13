"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Invisible component mounted once in the protected layout. Firebase ID
 * tokens expire hourly; this keeps the httpOnly session cookie (read by
 * Server Components via lib/auth/session.ts) in sync whenever the client SDK
 * silently refreshes the token, so a long-open tab doesn't get logged out
 * from under the user.
 */
export function SessionSync() {
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
      } catch {
        // Best-effort — worst case the cookie expires and the user is asked
        // to sign in again.
      }
    });
    return unsubscribe;
  }, []);

  return null;
}
