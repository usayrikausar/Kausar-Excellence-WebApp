import Link from "next/link";
import { BarChart3, ChevronRight, FileText, Trophy, Users } from "lucide-react";
import type { BulletinEntry, CurrentUser } from "@/lib/types";
import { TRAFFIC_LIGHT_STYLES, type MonthlyScore } from "@/lib/scoring";
import { monthLabel } from "@/lib/period";
import { cn, formatRM } from "@/lib/utils";
import { HeroCarousel } from "@/components/daie/hero-carousel";
import { BulletinCard } from "@/components/daie/bulletin-card";
import { ProgressBar } from "@/components/daie/progress-bar";
import { ExpiryRemindersCard } from "@/components/daie/expiry-reminders-card";
import { ScopeSwitcher, type ScopeOption } from "@/components/daie/scope-switcher";

/**
 * Unit order and colours as on the desktop dashboard (group-sales-dashboard.tsx).
 * Copied, not imported: that file is a client module, and a server component
 * importing its constant gets a client reference instead of the array.
 */
export const PHONE_UNITS = [
  { id: "kausar-wealth", short: "KWM", color: "#001f64" },
  { id: "kausar-global", short: "KG", color: "#0029fc" },
  { id: "kausar-aspire", short: "KA", color: "#00c0fb" },
  { id: "kausar-intisar", short: "KI", color: "#f8c700" },
  { id: "kausar-nusrah", short: "KN", color: "#00c400" },
] as const;

/** Whole ringgit: "RM 12,300" reads faster on a phone than "RM 12,300.00". */
function rm(n: number) {
  return formatRM(Math.round(n)).replace(/\.00$/, "");
}

function rmShort(n: number) {
  if (n >= 999_500) return `RM${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `RM${Math.round(n / 1_000).toLocaleString()}k`;
  return `RM${Math.round(n)}`;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-extrabold leading-tight text-ink">{value}</p>
      {sub && <div className="mt-0.5 text-[11px] leading-tight">{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-primary">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export interface PhoneGroupSummary {
  scopeName: string;
  /** Only on the whole-group view: the FY target applies to Kausar Group, not a unit. */
  target: number | null;
  fyTotal: number;
  thisMonth: number;
  /** Per unit, whole-group view only. */
  units: Array<{ id: string; short: string; color: string; total: number }>;
  scope: { options: ScopeOption[]; selected: string | null };
}

/**
 * Home on a phone (below `lg`; desktop keeps its own layout). Your own month
 * first, then the banner, totals, reminders, goal, leader shortcuts, the
 * group summary for KDE/Admin, and the bulletin as a sideways row.
 */
export function PhoneHome({
  user,
  score,
  monthKey,
  monthSales,
  monthCollection,
  totals,
  team,
  bulletinsThisMonth,
  reminderMembers,
  goalSummary,
  group,
  bulletins,
}: {
  user: CurrentUser;
  score: MonthlyScore;
  monthKey: string;
  monthSales: number;
  monthCollection: number;
  totals: { sales: number; collection: number };
  team: { size: number; active: number; expired: number };
  bulletinsThisMonth: number;
  reminderMembers: CurrentUser[];
  goalSummary: { label: string; value: number; max: number } | null;
  group: PhoneGroupSummary | null;
  bulletins: BulletinEntry[];
}) {
  const light = TRAFFIC_LIGHT_STYLES[score.color];
  const month = monthLabel(monthKey);
  // HQ staff aren't daie: no traffic light, sales or goal of their own, so
  // the group summary comes straight after the greeting.
  const staff = user.isStaff;

  const groupCard = group ? (
      <div className="space-y-2">
        <ScopeSwitcher basePath="/" options={group.scope.options} selected={group.scope.selected} scrollable />
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.scopeName} · FY25/26</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{rmShort(group.fyTotal)}</p>
              <p className="text-xs text-muted-foreground">Perancangan to date · {rmShort(group.thisMonth)} in {monthLabel(monthKey, "short")}</p>
            </div>
            <Link href="/reports/analytics" className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-white">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Analytics
            </Link>
          </div>
          {group.target != null && (
            <ProgressBar label="FY target" value={group.fyTotal} max={group.target} formatValue={rmShort} accent="primary" />
          )}
          {group.units.length > 0 && (
            <ul className="space-y-1.5">
              {group.units.map((u) => {
                const max = Math.max(...group.units.map((x) => x.total), 1);
                return (
                  <li key={u.id} className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                    <span className="font-semibold text-ink">{u.short}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${(u.total / max) * 100}%`, backgroundColor: u.color }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-ink">{rmShort(u.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
  ) : null;

  return (
    <div className="space-y-5">
      {/* 1. Greeting + this month's traffic light */}
      {staff ? (
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-muted-foreground">Assalamualaikum,</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-snug text-ink">{user.name}</p>
        </div>
      ) : (
      <Link href="/activities" className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 active:bg-muted">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Assalamualaikum,</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-snug text-ink">{user.name}</p>
          <div className="mt-2 flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1">
            <span className={cn("h-3 w-3 rounded-full", light.dotClassName)} aria-hidden />
            <span className="text-sm font-bold text-ink">{score.total}/100</span>
            <span className="text-xs font-semibold text-muted-foreground">{light.label} · traffic light, {monthLabel(monthKey, "short")}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      )}

      {staff && groupCard}

      {/* 2. This month */}
      {!staff && (
      <Link href="/sales" className="block rounded-xl bg-[linear-gradient(135deg,var(--color-navy-900)_0%,var(--color-navy-700)_100%)] p-4 text-white active:opacity-95">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-100">{month}</p>
          <ChevronRight className="h-4 w-4 text-navy-100" aria-hidden />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-navy-100">My sales</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight">{rm(monthSales)}</p>
          </div>
          <div>
            <p className="text-xs text-navy-100">Collected</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight">{rm(monthCollection)}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-navy-100">Perancangan + Kes Pusaka this month. Tap + to record more.</p>
      </Link>
      )}

      {/* Banner, smaller and below your own figures */}
      <HeroCarousel compact />

      {/* 3. Totals, 2 × 2 */}
      <div className="grid grid-cols-2 gap-3">
        {!staff && <Tile label="Sales total" value={rm(totals.sales)} />}
        {!staff && <Tile label="Collection total" value={rm(totals.collection)} />}
        <Tile
          label="Team size"
          value={String(team.size)}
          sub={
            team.size > 0 ? (
              <>
                <span className="font-semibold text-success">{team.active} active</span>
                {" · "}
                <span className="font-semibold text-red-700">{team.expired} expired</span>
              </>
            ) : undefined
          }
        />
        <Tile label="New bulletins" value={String(bulletinsThisMonth)} sub={<span className="text-muted-foreground">this month</span>} />
      </div>

      {/* 4. Renewal reminders (renders nothing when none are due) */}
      <ExpiryRemindersCard self={user} downline={reminderMembers} where={user.isGroupAdmin ? "in Kausar Group" : undefined} />

      {/* 5. My Goal */}
      {goalSummary && !staff && (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <SectionTitle title="My Goal" href="/my-goal" linkLabel="View" />
          <ProgressBar label={goalSummary.label} value={goalSummary.value} max={goalSummary.max} formatValue={formatRM} accent="success" />
        </div>
      )}

      {/* 6. Leader shortcuts */}
      {team.size > 0 && (
        <div className="space-y-2">
          <SectionTitle title="My team" />
          <div className="grid grid-cols-3 gap-2">
            {[
              { href: "/team-report?view=producers", label: "Producers this month", icon: Trophy },
              { href: "/team-report", label: "Team report", icon: FileText },
              { href: "/team", label: "Report cards", icon: Users },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white px-2 py-3 text-center active:bg-muted">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-xs font-semibold leading-tight text-ink">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 7. Group summary (KDE; HQ staff see it at the top) */}
      {!staff && groupCard}

      {/* 8. Bulletin, sideways */}
      <div className="space-y-2">
        <SectionTitle title="Latest from Bulletin" href="/bulletin" linkLabel="View all" />
        {bulletins.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No bulletin posts yet.</p>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {bulletins.map((b) => (
              <div key={b.id} className="w-[85%] shrink-0 snap-start">
                <BulletinCard bulletin={b} canDelete={user.isGroupAdmin} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

