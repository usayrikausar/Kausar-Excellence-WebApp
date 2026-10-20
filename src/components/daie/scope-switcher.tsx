"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ScopeOption {
  /** Value for `?scope=`; null = the page's default scope (no param). */
  value: string | null;
  label: string;
}

/**
 * Overall / My group switcher for KDEs (and Group Admin, who can also pick a
 * single unit). Writes `?scope=` on the current page, keeping other params
 * like `month` but dropping `daie` — a picked daie may not exist in the new
 * scope.
 */
export function ScopeSwitcher({ basePath, options, selected }: { basePath: string; options: ScopeOption[]; selected: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("daie");
    if (value) params.set("scope", value);
    else params.delete("scope");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div role="tablist" aria-label="View" className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value ?? "default"}
          type="button"
          role="tab"
          aria-selected={selected === o.value}
          onClick={() => go(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
            selected === o.value ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
