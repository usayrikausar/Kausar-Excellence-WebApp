"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * The report card and team report pages sit outside the app shell (no
 * sidebar, so they print cleanly). In the installed phone app there is no
 * browser back button either, so without this a daie gets stuck there.
 * Goes back when there's an in-app page to return to, else to Home.
 */
export function BackToAppButton() {
  const router = useRouter();
  function goBack() {
    // A page opened in a new tab/window (or launched directly) has no history to go back to.
    if (window.history.length > 1) router.back();
    else router.push("/");
  }
  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold text-primary hover:bg-muted"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
}
