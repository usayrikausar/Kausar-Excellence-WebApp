import Link from "next/link";
import { FileText } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { getProspectsForUid, getMonthlyScoreForUid } from "@/lib/data";
import { currentMonthKey } from "@/lib/scoring";
import { TrafficLightSummary } from "@/components/daie/traffic-light-summary";
import { LogActivityForm } from "@/components/daie/log-activity-form";
import { NewProspectDialog } from "@/components/daie/new-prospect-dialog";
import { ActivitiesView } from "@/components/daie/activities-view";
import { ExportProspectsCsvButton } from "@/components/daie/export-prospects-csv-button";
import { ImportProspectsCsvDialog } from "@/components/daie/import-prospects-csv-dialog";

export default async function ActivitiesPage() {
  const user = await requireDaie();
  const monthKey = currentMonthKey();

  const [prospects, score] = await Promise.all([getProspectsForUid(user.uid), getMonthlyScoreForUid(user.uid, monthKey)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Activities</h1>
          <p className="text-sm text-muted-foreground">Your PIPPPAS working diary — from first contact to closed case.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportProspectsCsvButton prospects={prospects} />
          <ImportProspectsCsvDialog uid={user.uid} prospects={prospects} />
          <NewProspectDialog uid={user.uid} />
        </div>
      </div>

      <TrafficLightSummary score={score} />

      <Link href={`/report-card/${user.uid}?month=${monthKey}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <FileText className="h-4 w-4" /> Print my report card
      </Link>

      <LogActivityForm uid={user.uid} />

      <ActivitiesView prospects={prospects} />
    </div>
  );
}
