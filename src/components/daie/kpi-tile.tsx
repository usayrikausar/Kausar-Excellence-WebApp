import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiTile({
  label,
  value,
  icon: Icon,
  accent = "primary",
  subtitle,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: "primary" | "accent" | "success";
  /** Small line under the value — e.g. an active/expired breakdown for a team-size tile. */
  subtitle?: React.ReactNode;
}) {
  const iconBg =
    accent === "accent" ? "bg-accent text-accent-foreground" : accent === "success" ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">{value}</p>
          {subtitle && <div className="mt-0.5 text-[11px] leading-tight">{subtitle}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
