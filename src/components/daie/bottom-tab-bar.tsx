"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, LayoutGrid, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/activities", label: "Activities", icon: ClipboardList },
  { href: "/sales", label: "Sales", icon: Wallet },
  { href: "/team", label: "Team", icon: Users },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Phone and tablet navigation (below `lg`): the four pages a daie opens most,
 * plus "More", which opens the full menu drawer. Desktop keeps the sidebar.
 * Sits above the home indicator on iPhones (safe-area inset).
 */
export function BottomTabBar({ menuOpen, onMore }: { menuOpen: boolean; onMore: () => void }) {
  const pathname = usePathname();
  // Quick-add screens belong to no tab, so they don't light up "More" either.
  const onTab = TABS.some((t) => isActive(pathname, t.href)) || pathname.startsWith("/add/");

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href) && !menuOpen;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                  active ? "text-primary" : "text-muted-foreground active:text-ink",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/10")}>
                  <Icon className="h-5 w-5" aria-hidden strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            className={cn(
              "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
              menuOpen || !onTab ? "text-primary" : "text-muted-foreground active:text-ink",
            )}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", (menuOpen || !onTab) && "bg-primary/10")}>
              <LayoutGrid className="h-5 w-5" aria-hidden strokeWidth={menuOpen || !onTab ? 2.4 : 2} />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
