"use client";

import { Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/daie/logout-button";
import { UNIT_LABELS } from "@/lib/constants";
import type { CurrentUser, UnitId } from "@/lib/types";

export function Topbar({ user, menuOpen, onMenuToggle }: { user: CurrentUser; menuOpen: boolean; onMenuToggle: () => void }) {
  const unitLabel = user.isStaff ? "Kausar Group HQ" : (UNIT_LABELS[user.unitId as UnitId] ?? user.unitId);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-primary px-4 text-white sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:hidden"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="truncate text-xs text-white/70">
            {user.isStaff ? "Staff" : user.daieId} · {unitLabel}
          </span>
        </div>
        {user.isGroupAdmin && <Badge variant="accent" className="hidden sm:inline-flex">Group Admin</Badge>}
        {!user.isStaff && (
          <>
            <Badge variant="outline" className="hidden border-white/30 text-white sm:inline-flex">
              {user.rank}
            </Badge>
            <Badge variant="muted" className="hidden bg-white/10 text-white sm:inline-flex">
              {user.structureType}
            </Badge>
          </>
        )}
      </div>
      <LogoutButton />
    </header>
  );
}
