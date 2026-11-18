"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Banknote, CircleDollarSign, Gem, Landmark, Plus, UserPlus, type LucideIcon } from "lucide-react";
import { QUICK_ADD_LABELS, QUICK_ADD_TYPES, type QuickAddType } from "@/lib/quick-add";
import { cn } from "@/lib/utils";

const ICONS: Record<QuickAddType, LucideIcon> = {
  activity: Activity,
  prospect: UserPlus,
  perancangan: CircleDollarSign,
  payment: Banknote,
  wasitah: Gem,
  pusaka: Landmark,
};

/**
 * Phone/tablet "+" button (below `lg`), floating above the bottom tab bar.
 * Tapping it opens the quick-add choices; each opens that one form on its
 * own screen and comes back here after saving.
 */
export function QuickAddButton({ hidden }: { hidden: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Remembers the page it was opened on, so it reads as closed after navigating.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedOn(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden || pathname.startsWith("/add/")) return null;

  const query = searchParams.toString();
  const from = encodeURIComponent(query ? `${pathname}?${query}` : pathname);

  return (
    <div className="lg:hidden print:hidden">
      {open && <div aria-hidden className="fixed inset-0 z-30 bg-ink/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} />}

      {open && (
        <div
          id="quick-add-menu"
          className="fixed right-4 z-40 grid w-[min(20rem,calc(100vw-2rem))] grid-cols-2 gap-3"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 5.25rem)" }}
        >
          {QUICK_ADD_TYPES.map((type, i) => {
            const Icon = ICONS[type];
            return (
              <Link
                key={type}
                href={`/add/${type}?from=${from}`}
                className="quick-add-in flex flex-col items-center gap-2 rounded-2xl bg-white px-3 py-4 text-center shadow-lg ring-1 ring-black/5 transition-transform active:scale-95"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">{QUICK_ADD_LABELS[type].label}</span>
              </Link>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close quick add" : "Quick add: record an activity, prospect, sale or payment"}
        aria-expanded={open}
        aria-controls="quick-add-menu"
        className={cn(
          "fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          open ? "bg-white text-ink" : "bg-primary text-white active:bg-primary/90",
        )}
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Plus className={cn("h-7 w-7 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-45")} aria-hidden />
      </button>
    </div>
  );
}
