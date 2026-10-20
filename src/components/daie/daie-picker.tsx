"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export interface DaieOption {
  uid: string;
  name: string;
  daieId: string;
  rank: string;
}

const MAX_SHOWN = 200;

/**
 * Lets an upline/mentor pick whose report to view — themself or anyone in
 * their downline. Sets `?daie=<uid>` on `basePath`, keeping other params
 * (e.g. `month`). A KDE or Group Admin can have hundreds of people below
 * them, so there's a name/ID filter in front of the list rather than one
 * enormous dropdown.
 */
export function DaiePicker({
  basePath,
  selfUid,
  selectedUid,
  options,
}: {
  basePath: string;
  selfUid: string;
  selectedUid: string;
  options: DaieOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q) || (o.daieId ?? "").toLowerCase().includes(q))
      : options;
    // Keep the current selection in the list even when the filter hides it.
    const shown = list.slice(0, MAX_SHOWN);
    if (!shown.some((o) => o.uid === selectedUid)) {
      const sel = options.find((o) => o.uid === selectedUid);
      if (sel) shown.unshift(sel);
    }
    return { shown, hidden: Math.max(0, list.length - MAX_SHOWN) };
  }, [filter, options, selectedUid]);

  function go(uid: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (uid === selfUid) params.delete("daie");
    else params.set("daie", uid);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Input
        id="daie-picker-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search name or Daie ID"
        className="sm:w-56"
        aria-label="Filter daie"
      />
      <select
        id="daie-picker"
        value={selectedUid}
        onChange={(e) => go(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-border bg-white px-2 text-sm text-ink sm:w-80"
        aria-label="Choose daie"
      >
        {filtered.shown.map((o) => (
          <option key={o.uid} value={o.uid}>
            {o.uid === selfUid ? `Me — ${o.name}` : `${o.name} (${o.daieId} · ${o.rank})`}
          </option>
        ))}
      </select>
      {filtered.hidden > 0 && (
        <span className="text-xs text-muted-foreground">+{filtered.hidden} more — type to narrow down</span>
      )}
    </div>
  );
}
