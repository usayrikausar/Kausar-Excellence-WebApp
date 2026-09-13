"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ContestTarget } from "@/lib/types";

/** Editable list of {label, amount} target rows — shared by the create and edit contest forms. */
export function ContestTargetRows({ targets, onChange }: { targets: ContestTarget[]; onChange: (targets: ContestTarget[]) => void }) {
  function update(i: number, patch: Partial<ContestTarget>) {
    onChange(targets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    onChange(targets.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <Label>Target table (e.g. rank/individu vs kumpulan tiers)</Label>
      {targets.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="Label, e.g. Dai'e Mawarith (Individu)"
            value={t.label}
            onChange={(e) => update(i, { label: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            placeholder="Amount (RM)"
            value={t.amount || ""}
            onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
            className="w-36"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => remove(i)} aria-label="Remove row">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...targets, { label: "", amount: 0 }])}>
        + Add target row
      </Button>
    </div>
  );
}
