"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Prev/Next + a "go to page" jump box — shared by every large paginated table (My Team List view, Admin's All Daie), since clicking Next repeatedly to reach page 10+ isn't a real navigation option once a list runs into the hundreds. */
export function PaginationFooter({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  const [jumpValue, setJumpValue] = useState("");

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(jumpValue);
    if (!target || target < 1 || target > totalPages) return;
    onPageChange(target);
    setJumpValue("");
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
      {totalPages > 3 && (
        <form onSubmit={handleJump} className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Go to</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={String(page)}
            className="h-8 w-16"
          />
          <Button type="submit" variant="outline" size="sm">Go</Button>
        </form>
      )}
    </div>
  );
}
