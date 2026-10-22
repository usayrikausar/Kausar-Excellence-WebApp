import { getCurrentUser } from "@/lib/auth/session";
import { getDaieDirectory } from "@/lib/data";

// Name / Daie ID search across every daie in the group — for picking a JFW
// (joint field work) partner, who can be any KDE, DPM or DM in any unit.
// Returns at most 20 matches; signed-in daie only.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return Response.json({ results: [] });
  const all = await getDaieDirectory();
  const results = all
    .filter((d) => d.uid !== user.uid && (d.name.toLowerCase().includes(q) || d.daieId.toLowerCase().includes(q)))
    .slice(0, 20);
  return Response.json({ results });
}
