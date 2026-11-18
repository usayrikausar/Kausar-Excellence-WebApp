"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CurrentUser } from "@/lib/types";
import { Sidebar } from "@/components/daie/sidebar";
import { Topbar } from "@/components/daie/topbar";
import { SessionSync } from "@/components/daie/session-sync";
import { BottomTabBar } from "@/components/daie/bottom-tab-bar";
import { QuickAddButton } from "@/components/daie/quick-add-button";
import { QuickAddSavedNotice } from "@/components/daie/quick-add-saved-notice";
import { cn } from "@/lib/utils";

/**
 * Sidebar is always shown from `lg` up. Below that (phones, small tablets)
 * it's a slide-in drawer opened from the topbar's menu button — a fixed
 * 256px sidebar on a 375px phone left the page itself barely 120px wide.
 * Phones and tablets also get a bottom tab bar for the most-used pages; its
 * "More" tab opens the same drawer, and a floating "+" for quick entries.
 */
export function AppShell({ user, onboardingComplete, children }: { user: CurrentUser; onboardingComplete: boolean | null; children: React.ReactNode }) {
  const pathname = usePathname();
  // Remembers which page the drawer was opened on, so it reads as closed
  // as soon as the user picks a different page — no effect needed.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const menuOpen = openedOn === pathname;
  const setMenuOpen = (open: boolean) => setOpenedOn(open ? pathname : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen w-full">
      <SessionSync />
      {menuOpen && (
        <div aria-hidden className="fixed inset-0 z-40 bg-ink/50 lg:hidden print:hidden" onClick={() => setMenuOpen(false)} />
      )}
      <div
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 print:hidden",
          menuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
        )}
      >
        <Sidebar user={user} onboardingComplete={onboardingComplete} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/40 p-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(9.5rem+env(safe-area-inset-bottom))] lg:p-8 print:overflow-visible print:bg-white print:p-0">{children}</main>
      </div>
      <BottomTabBar menuOpen={menuOpen} onMore={() => setMenuOpen(!menuOpen)} />
      <Suspense fallback={null}>
        <QuickAddButton hidden={menuOpen} />
      </Suspense>
      <QuickAddSavedNotice />
    </div>
  );
}
