// Follow-up time (agreed 2026-11-19): a follow-up can carry an optional time
// ("15:00"), so it shows as a timed appointment with a reminder in the
// daie's phone calendar instead of an all-day item. Client-safe.

import { formatDate } from "@/lib/utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(t: string | null | undefined): t is string {
  return !!t && TIME_RE.test(t);
}

/** "15:00" -> "3:00 pm". */
export function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "26 Nov 2026" or "26 Nov 2026, 3:00 pm". */
export function formatFollowUp(date: string, time?: string | null): string {
  return isValidTime(time) ? `${formatDate(date)}, ${formatTime(time)}` : formatDate(date);
}

/** The two fields written to a prospect / update: no date means no time either. */
export function followUpFields(date: string, time: string): { nextFollowUpDate: string | null; nextFollowUpTime: string | null } {
  return { nextFollowUpDate: date || null, nextFollowUpTime: date && isValidTime(time) ? time : null };
}

/** Sort key that puts timed follow-ups in time order within a day, untimed ones first. */
export function followUpSortKey(date: string | null, time?: string | null): string {
  return date ? `${date} ${isValidTime(time) ? time : "00:00"}` : "9999";
}
