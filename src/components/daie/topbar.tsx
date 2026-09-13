import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/daie/logout-button";
import { UNIT_LABELS } from "@/lib/constants";
import type { CurrentUser, UnitId } from "@/lib/types";

export function Topbar({ user }: { user: CurrentUser }) {
  const unitLabel = UNIT_LABELS[user.unitId as UnitId] ?? user.unitId;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-primary px-6 text-white">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{user.name}</span>
          <span className="text-xs text-white/70">
            {user.daieId} · {unitLabel}
          </span>
        </div>
        {user.isGroupAdmin && <Badge variant="accent">Group Admin</Badge>}
        <Badge variant="outline" className="border-white/30 text-white">
          {user.rank}
        </Badge>
        <Badge variant="muted" className="bg-white/10 text-white">
          {user.structureType}
        </Badge>
      </div>
      <LogoutButton />
    </header>
  );
}
