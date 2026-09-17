import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

// Cheap first line of defense: no session cookie at all → bounce to /login
// immediately, before any Server Component runs. This does NOT verify the
// token — that verification, plus all role-based gating (DM can't see
// /team, non-admins can't see /admin), happens in lib/auth/session.ts's
// requireDaie()/requireGroupAdmin(), called from every protected layout/page.
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isApiAuth = pathname.startsWith("/api/auth/");
  if (isPublic || isApiAuth) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|kausar-logo.png|apple-icon.png).*)",
  ],
};
