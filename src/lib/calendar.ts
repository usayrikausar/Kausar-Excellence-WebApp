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

/** Google Calendar's "create event" page, pre-filled. The person still presses Save. */
export function googleCalendarEventUrl(e: { title: string; date: string; details?: string | null; location?: string | null }): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${compactDate(e.date)}/${nextDayCompact(e.date)}`,
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
