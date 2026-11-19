import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { getDownline, getOwnCasesForUid, getProspectsForUid, getUsersByUids } from "@/lib/data";
import { QuickAddForm } from "@/components/daie/quick-add-form";
import { isQuickAddType, QUICK_ADD_LABELS, safeReturnPath } from "@/lib/quick-add";

/**
 * Quick add: one entry form on its own screen, opened from the phone "+"
 * button. Saves exactly as the Sales / Activities pages do — always for the
 * signed-in daie — then returns to `from`.
 */
export default async function QuickAddPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireDaie();
  const [{ type }, { from }] = await Promise.all([params, searchParams]);
  if (!isQuickAddType(type)) notFound();
  const returnTo = safeReturnPath(from);
  const { title, hint } = QUICK_ADD_LABELS[type];

  // Same inputs the Sales and Activities pages give these forms: the daie's
  // own open prospects, and for JFW their uplines and own downline.
  const allProspects = await getProspectsForUid(user.uid);
  const open = allProspects.filter((p) => p.status === "active");
  const prospects = open.map((p) => ({ id: p.id, name: p.name }));
  const activityProspects = open.map((p) => ({ id: p.id, name: p.name, stage: p.stage, phone: p.phone }));
  const cases = type === "payment" ? await getOwnCasesForUid(user.uid) : [];
  let team: Array<{ uid: string; name: string; daieId: string; rank: typeof user.rank; unitId: string }> = [];
  if (type === "activity") {
    const [downline, uplines] = await Promise.all([getDownline(user), getUsersByUids(user.lineagePath)]);
    team = [...uplines.reverse(), ...downline.sort((a, b) => a.name.localeCompare(b.name))]
      .filter((m) => !m.isStaff)
      .map((m) => ({ uid: m.uid, name: m.name, daieId: m.daieId, rank: m.rank, unitId: m.unitId }));
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Link
          href={returnTo}
          aria-label="Cancel"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-ink hover:bg-muted"
        >
          <X className="h-5 w-5" aria-hidden />
        </Link>
      </div>
      <QuickAddForm type={type} uid={user.uid} returnTo={returnTo} prospects={prospects} activityProspects={activityProspects} team={team} cases={cases} />
    </div>
  );
}
