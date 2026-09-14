"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { PIPPPAS_STAGES } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ProspectDetailDialog } from "@/components/daie/prospect-detail-dialog";
import type { ProspectWithId } from "@/lib/data";

function daysInStage(prospect: ProspectWithId): number {
  const since = new Date(prospect.updatedAt || prospect.createdAt).getTime();
  return Math.max(0, Math.floor((Date.now() - since) / 86_400_000));
}

export function PipelineBoard({ prospects }: { prospects: ProspectWithId[] }) {
  // Holds just the id, not a snapshot of the prospect object — a snapshot
  // would go stale the moment something inside the open dialog saves and
  // triggers router.refresh(), since that only refreshes the `prospects`
  // prop passed down here, not any state already captured from it. Deriving
  // the prospect fresh from `prospects` on every render means the open
  // dialog always reflects the latest data without needing to be closed and
  // reopened.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (prospects.find((p) => p.id === selectedId) ?? null) : null;
  const active = useMemo(() => prospects.filter((p) => p.status === "active"), [prospects]);

  const byStage = useMemo(() => {
    const map = new Map<string, ProspectWithId[]>();
    for (const stage of PIPPPAS_STAGES) map.set(stage, []);
    for (const p of active) map.get(p.stage)?.push(p);
    return map;
  }, [active]);

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {PIPPPAS_STAGES.map((stage) => {
          const items = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-ink">{STAGE_LABELS[stage]}</h3>
                <Badge variant="muted">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Empty</p>}
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="w-full rounded-lg border border-border bg-white p-3 text-left shadow-sm transition-colors hover:border-primary"
                  >
                    <p className="font-semibold text-ink">{p.name}</p>
                    <Badge variant="outline" className="mt-1">{SOURCE_LABELS[p.source]}</Badge>
                    <p className="mt-1.5 text-xs text-muted-foreground">{daysInStage(p)}d in this stage</p>
                    {p.nextFollowUpDate && (
                      <p className="text-xs font-medium text-primary">Follow up {formatDate(p.nextFollowUpDate)}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <ProspectDetailDialog key={selected.id} prospect={selected} open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)} />
      )}
    </div>
  );
}
