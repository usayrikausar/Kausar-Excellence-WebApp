import { requireDaie } from "@/lib/auth/session";
import { getTeamReportRows, getUnits } from "@/lib/data";
import { currentMonthKey, type MonthKey } from "@/lib/scoring";
import { ReportCardPrintButton } from "@/components/daie/report-card-print-button";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";
import { TeamReportTable } from "@/components/daie/team-report-table";

function monthLabel(monthKey: MonthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default async function TeamReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireDaie();
  const { month: monthParam } = await searchParams;
  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  const [rows, units] = await Promise.all([getTeamReportRows(user, monthKey), getUnits()]);
  const unitCount = new Set(rows.map((r) => r.unitId)).size;

  return (
    <div className="min-h-full bg-[#E9ECF6] px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[1100px] flex-wrap items-center justify-between gap-3 print:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Team report
        </span>
        <div className="flex items-center gap-2">
          <ReportCardMonthSelect basePath="/team-report" monthKey={monthKey} />
          <ReportCardPrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] overflow-hidden rounded-md bg-white text-[#1c1e26] shadow-sm print:shadow-none">
        <div className="bg-[linear-gradient(135deg,var(--color-navy-900)_0%,var(--color-navy-700)_100%)] px-9 py-6 text-white">
          <div className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
            Kausar<span className="text-accent">.</span> Group
          </div>
          <div className="mt-3.5 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Team Report</div>
          <div className="mt-1 text-[13px] text-navy-100">
            {user.name}, {user.rank} &middot; {unitCount > 1 ? `${unitCount} units` : unitCount === 1 ? "1 unit" : "No downline"} &middot; {monthLabel(monthKey)}
          </div>
        </div>

        <TeamReportTable rows={rows} units={units} showUnit={unitCount > 1} />
      </div>
    </div>
  );
}
