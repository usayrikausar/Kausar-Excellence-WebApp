import { feedForToken } from "@/lib/calendar-feed";

// A daie's calendar feed, fetched by Google Calendar / iPhone / Outlook with
// no login — the unguessable token in the link is the only key (see
// lib/calendar-feed.ts). Public in proxy.ts for that reason.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const body = await feedForToken(token.replace(/\.ics$/, ""), `https://${host}`);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kausar.ics"',
      // Private to whoever holds the link: never cached by a shared cache / CDN.
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
