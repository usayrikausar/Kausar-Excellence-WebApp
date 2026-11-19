import { getCurrentUser } from "@/lib/auth/session";
import { resetFeedToken } from "@/lib/calendar-feed";

// Creates the signed-in daie's calendar link, or replaces it (the old link
// stops working). Always for the caller — never takes a uid.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });
  const token = await resetFeedToken(user.uid);
  return Response.json({ token });
}
