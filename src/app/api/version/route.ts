// The build id of the server currently live — see next.config.ts.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.APP_VERSION ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
