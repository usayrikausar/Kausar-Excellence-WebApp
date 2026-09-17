"use client";

import { useEffect } from "react";

/** Registers public/sw.js — see that file for why it exists (PWA installability on Android only, no caching). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not a hard requirement — a
        // failed registration (e.g. unsupported browser) shouldn't surface
        // as an error to the user.
      });
    }
  }, []);

  return null;
}
