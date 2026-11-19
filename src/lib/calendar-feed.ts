import "server-only";

// Per-daie calendar feed (cara 2, agreed 2026-11-19): a secret link that
// Google Calendar, iPhone or Outlook subscribes to. It holds the daie's own
// active prospects' follow-up dates (name, stage, phone) and every training
// from last month on. One-way: the app is the source.
//
// Token storage is server-only (no firestore.rules match = no client access):
//   calendarFeeds/{token}      -> { uid, createdAt }   lookup by the link
//   calendarFeedOwners/{uid}   -> { token }            the daie's current link
// Not on the users doc: uplines can read that, and the link must stay the
// daie's own. A new link deletes the old one, so a leaked link can be cut off.

import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { STAGE_LABELS } from "@/lib/constants";
import { nextDayCompact } from "@/lib/calendar";
import type { PipppasStage } from "@/lib/types";

export const FEED_TOKEN_RE = /^[a-f0-9]{40}$/;

export async function getFeedToken(uid: string): Promise<string | null> {
  const snap = await adminDb.collection("calendarFeedOwners").doc(uid).get();
  const token = snap.get("token");
  return typeof token === "string" && FEED_TOKEN_RE.test(token) ? token : null;
}

/** Creates the daie's link, or replaces it (the old one stops working at once). */
export async function resetFeedToken(uid: string): Promise<string> {
  const token = randomBytes(20).toString("hex");
  const old = await getFeedToken(uid);
  const batch = adminDb.batch();
  if (old) batch.delete(adminDb.collection("calendarFeeds").doc(old));
  batch.set(adminDb.collection("calendarFeeds").doc(token), { uid, createdAt: FieldValue.serverTimestamp() });
  batch.set(adminDb.collection("calendarFeedOwners").doc(uid), { token, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  feedCache.delete(old ?? "");
  return token;
}

// --- iCalendar (RFC 5545) -----------------------------------------------

/** A Malaysia-time (UTC+8, no daylight saving) date + "HH:MM" as a UTC stamp, plus `addMinutes`. */
function utcStamp(date: string, time: string, addMinutes: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h - 8, mi + addMinutes));
  return t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines over 75 octets continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, "utf8") > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

interface FeedEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  /** "HH:MM" Malaysia time: a one-hour appointment with a 30-minute reminder; none = all-day. */
  time?: string | null;
  summary: string;
  description?: string;
  location?: string | null;
}

function buildIcs(calName: string, events: FeedEvent[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kausar Group//Excellence WebApp//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-WR-TIMEZONE:Asia/Kuala_Lumpur",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@kausar-excellence`,
      `DTSTAMP:${stamp}`,
      ...(e.time && /^\d{2}:\d{2}$/.test(e.time)
        ? [`DTSTART:${utcStamp(e.date, e.time, 0)}`, `DTEND:${utcStamp(e.date, e.time, 60)}`]
        : [`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${nextDayCompact(e.date)}`]),
      `SUMMARY:${esc(e.summary)}`,
      e.time ? "TRANSP:OPAQUE" : "TRANSP:TRANSPARENT",
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.time) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.summary)}`, "TRIGGER:-PT30M", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Calendar apps poll every few hours; a short cache keeps Firestore reads low.
const FEED_CACHE_MS = 2 * 60 * 60 * 1000;
const feedCache = new Map<string, { at: number; body: string }>();

/** The .ics text for a feed link, or null when the link isn't (or is no longer) valid. */
export async function feedForToken(token: string, appUrl: string): Promise<string | null> {
  if (!FEED_TOKEN_RE.test(token)) return null;
  const hit = feedCache.get(token);
  if (hit && Date.now() - hit.at < FEED_CACHE_MS) return hit.body;

  const feedDoc = await adminDb.collection("calendarFeeds").doc(token).get();
  const uid = feedDoc.get("uid");
  if (typeof uid !== "string") return null;

  const since = new Date();
  since.setMonth(since.getMonth() - 1);
  const sinceIso = since.toISOString().slice(0, 10);
  const [userSnap, prospectsSnap, trainingsSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("prospects").where("uid", "==", uid).select("name", "stage", "phone", "status", "nextFollowUpDate", "nextFollowUpTime").get(),
    adminDb.collection("trainings").where("date", ">=", sinceIso).select("title", "date", "location", "provider", "cpdHours").get(),
  ]);
  if (!userSnap.exists || userSnap.get("subscriptionStatus") === "inactive") return null;

  const events: FeedEvent[] = [];
  for (const d of prospectsSnap.docs) {
    const p = d.data();
    if (p.status !== "active" || typeof p.nextFollowUpDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(p.nextFollowUpDate)) continue;
    const stage = STAGE_LABELS[p.stage as PipppasStage] ?? p.stage;
    events.push({
      uid: `followup-${d.id}-${p.nextFollowUpDate.slice(0, 10)}`,
      date: p.nextFollowUpDate.slice(0, 10),
      time: typeof p.nextFollowUpTime === "string" && /^\d{2}:\d{2}$/.test(p.nextFollowUpTime) ? p.nextFollowUpTime : null,
      summary: `Follow-up: ${p.name} (${stage})`,
      description: [p.phone ? `Phone: ${p.phone}` : null, `Stage: ${stage}`, `Open in the app: ${appUrl}/activities`].filter(Boolean).join("\n"),
    });
  }
  for (const d of trainingsSnap.docs) {
    const t = d.data();
    if (typeof t.date !== "string") continue;
    events.push({
      uid: `training-${d.id}`,
      date: t.date.slice(0, 10),
      summary: `Training: ${t.title}`,
      description: `${t.provider === "kausar" ? "Kausar Group" : "Wasiyyah"} · ${t.cpdHours} CPD hour${t.cpdHours === 1 ? "" : "s"}\n${appUrl}/cpd`,
      location: t.location ?? null,
    });
  }

  const body = buildIcs(`Kausar · ${userSnap.get("name") ?? "My calendar"}`, events);
  feedCache.set(token, { at: Date.now(), body });
  return body;
}
