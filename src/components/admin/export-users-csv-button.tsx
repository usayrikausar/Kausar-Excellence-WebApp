"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unitLabel } from "@/lib/constants";
import { contractExpiryDate, formatDate, isActiveStatus } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import type { CurrentUser } from "@/lib/types";

export function ExportUsersCsvButton({ users, units }: { users: CurrentUser[]; units: Record<string, string> }) {
  function exportCsv() {
    const nameByUid = new Map(users.map((u) => [u.uid, u.name]));

    const headers = [
      "Status",
      "Daie ID",
      "Name",
      "Email",
      "Rank",
      "Unit",
      "Structure",
      "Upline",
      "Date Licensed",
      "Date Expiry",
    ];
    const rows = users.map((user) => {
      const active = isActiveStatus(user);
      const expiry = user.dateLicensed ? contractExpiryDate(user.dateLicensed, user.rank) : null;
      return [
        active ? "Active" : "Non-Active (Expired)",
        user.daieId,
        user.name,
        user.email,
        user.rank,
        unitLabel(user.unitId, units),
        user.structureType,
        user.uplineId ? (nameByUid.get(user.uplineId) ?? "—") : "—",
        user.dateLicensed ? formatDate(user.dateLicensed) : "",
        expiry ? formatDate(expiry) : "",
      ];
    });
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`kausar-all-daie-${today}.csv`, headers, rows);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCsv}>
      <Download className="mr-1.5 h-4 w-4" />
      Export CSV
    </Button>
  );
}
