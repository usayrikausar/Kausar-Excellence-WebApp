"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, TriangleAlert } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sidebar({ user, onboardingComplete }: { user: CurrentUser; onboardingComplete: boolean | null }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !user.isGroupAdmin) return false;
    if (item.ldpOnly && user.rank !== "KDE" && !user.isLdpMember) return false;
    return true;
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
        <Image
          src="/kausar-logo.png"
          alt="Kausar Group"
          width={1600}
          height={837}
          priority
          className="h-10 w-auto object-contain"
        />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-sidebar-muted hover:bg-white/10 hover:text-white",
              )}
              style={!isActive ? { color: "var(--color-navy-100)" } : undefined}
            >
              <span className="flex items-center gap-1.5">
                {item.label}
                {item.href === "/my-onboarding" && onboardingComplete === true && (
                  <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-label="Onboarding complete" />
                )}
                {item.href === "/my-onboarding" && onboardingComplete === false && (
                  <TriangleAlert className="h-3.5 w-3.5 text-red-400" aria-label="Onboarding incomplete" />
                )}
              </span>
              {item.phase && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  P{item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
