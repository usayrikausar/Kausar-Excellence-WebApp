"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Copy, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { subscribeLinks } from "@/lib/calendar";

/**
 * "Connect to your phone's calendar" (cara 2): the daie's private feed link,
 * with one-tap subscribe for Google Calendar and iPhone, copy for anything
 * else, and a reset that cuts off an old link.
 */
export function CalendarSyncCard({ feedUrl: initialUrl, origin }: { feedUrl: string | null; origin: string }) {
  const router = useRouter();
  const [feedUrl, setFeedUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function makeLink() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/calendar-link", { method: "POST" });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) throw new Error(json.error ?? "Could not create the link.");
      setFeedUrl(`${origin}/api/calendar/${json.token}.ics`);
      setConfirmReset(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Press and hold the link to copy it.");
    }
  }

  const links = feedUrl ? subscribeLinks(feedUrl) : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <CalendarPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">Connect to your phone&rsquo;s calendar</h3>
            <p className="text-sm text-muted-foreground">
              Your follow-ups (name, stage, phone) and every training show up in Google Calendar or your iPhone calendar, and stay updated. Calendar apps refresh it every few hours.
            </p>
          </div>
        </div>

        {!links ? (
          <Button onClick={makeLink} disabled={busy}>{busy ? "Creating…" : "Create my calendar link"}</Button>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <a href={links.google} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                Add to Google Calendar
              </a>
              <a href={links.apple} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-muted">
                Add to iPhone Calendar
              </a>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-muted">
                {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">{feedUrl}</p>
            <p className="text-xs text-muted-foreground">
              This link is private: anyone who has it can see your follow-ups. Don&rsquo;t share it. If it has been shared, make a new one and the old one stops working.
            </p>
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink">The old link will stop working, and you&rsquo;ll need to add the new one again.</span>
                <Button size="sm" variant="outline" onClick={makeLink} disabled={busy}>{busy ? "Creating…" : "Make new link"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Make a new link
              </button>
            )}
          </>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
