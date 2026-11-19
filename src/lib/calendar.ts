// Calendar helpers (agreed 2026-11-19): a one-off "Add to Google Calendar"
// link (cara 1) and the shapes of the per-daie calendar feed (cara 2, see
// lib/calendar-feed.ts). Client-safe. App dates are whole days, so every
// event is an all-day event.

function compactDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** The day after an ISO date, as YYYYMMDD — all-day events end on the next day (exclusive). */
export function nextDayCompact(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10).replace(/-/g, "");
}

/** "15:00" + 60 min -> "160000"; follow-ups at a time last an hour. */
function compactTime(time: string, addMinutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const t = Math.min(h * 60 + m + addMinutes, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}${String(t % 60).padStart(2, "0")}00`;
}

/** Google Calendar's "create event" page, pre-filled. The person still presses Save. With a time, a one-hour appointment. */
export function googleCalendarEventUrl(e: { title: string; date: string; time?: string | null; details?: string | null; location?: string | null }): string {
  const d = compactDate(e.date);
  const timed = !!e.time && /^\d{2}:\d{2}$/.test(e.time);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: timed ? `${d}T${compactTime(e.time!)}/${d}T${compactTime(e.time!, 60)}` : `${d}/${nextDayCompact(e.date)}`,
    ctz: "Asia/Kuala_Lumpur",
  });
  if (e.details) params.set("details", e.details);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Subscribe links for a feed URL (https://…/api/calendar/<token>.ics). */
export function subscribeLinks(feedUrl: string) {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  return {
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
  };
}
