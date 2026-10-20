"use client";

import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const BUILD_VERSION = process.env.APP_VERSION;

// Phones keep the app open (installed PWA or a browser tab) for days, so after
// a deploy people can be left running an old copy. This asks /api/version
// every few minutes and whenever the app comes back to the foreground, and
// offers a refresh once a newer build is live. Same idea as beana-home-quran's
// UpdateBanner.
export function UpdateBanner() {
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !BUILD_VERSION) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = await res.json();
        if (!stopped && version && version !== BUILD_VERSION) setNewVersion(true);
      } catch {
        // offline or a passing network error — try again next time
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!newVersion) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-2.5 text-sm text-white shadow-md print:hidden"
      style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}
    >
      <span>A new version of the app is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-ink hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Refresh now
      </button>
    </div>
  );
}
