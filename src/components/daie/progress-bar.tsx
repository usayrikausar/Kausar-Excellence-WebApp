import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max,
  label,
  formatValue,
  accent = "primary",
}: {
  value: number;
  max: number;
  label?: string;
  /** Formats the value/max pair shown above the bar — defaults to plain numbers. */
  formatValue?: (n: number) => string;
  accent?: "primary" | "accent" | "success";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());
  const barColor = accent === "accent" ? "bg-accent" : accent === "success" ? "bg-success" : "bg-primary";

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">{label}</span>
          <span className="font-semibold text-ink">
            {fmt(value)} / {fmt(max)} ({pct}%)
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
