import Link from "next/link";
import { Banknote, CircleDollarSign, Gem, Landmark, type LucideIcon } from "lucide-react";
import { QUICK_ADD_LABELS, type QuickAddType } from "@/lib/quick-add";

const BUTTONS: Array<{ type: QuickAddType; icon: LucideIcon }> = [
  { type: "perancangan", icon: CircleDollarSign },
  { type: "payment", icon: Banknote },
  { type: "wasitah", icon: Gem },
  { type: "pusaka", icon: Landmark },
];

/** Phone: the Sales page's entry forms as four buttons, each opening the quick-add screen. */
export function RecordButtons({ from }: { from: string }) {
  return (
    <div className="space-y-2">
      <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">Record</h2>
      <div className="grid grid-cols-4 gap-2">
        {BUTTONS.map(({ type, icon: Icon }) => (
          <Link
            key={type}
            href={`/add/${type}?from=${encodeURIComponent(from)}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-white px-1 py-3 text-center active:bg-muted"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-ink">{QUICK_ADD_LABELS[type].label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
