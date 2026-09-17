"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserTable } from "@/components/admin/user-table";
import { ExportUsersCsvButton } from "@/components/admin/export-users-csv-button";
import { REGION_LABELS } from "@/lib/constants";
import { REGIONS, type CurrentUser, type Region } from "@/lib/types";

/** Owns the region filter so the CSV export and the table below it always agree on which daie are currently shown. */
export function DaieDirectoryCard({ users, units }: { users: CurrentUser[]; units: Record<string, string> }) {
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");

  const filtered = useMemo(
    () => (regionFilter === "all" ? users : users.filter((u) => u.region === regionFilter)),
    [users, regionFilter],
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>All daie ({filtered.length}{regionFilter !== "all" ? ` of ${users.length}` : ""})</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as Region | "all")}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{REGION_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportUsersCsvButton users={filtered} units={units} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <UserTable users={filtered} units={units} allUsers={users} />
      </CardContent>
    </Card>
  );
}
