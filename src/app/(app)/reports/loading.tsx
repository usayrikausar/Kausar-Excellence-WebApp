import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading reports">
      <Skeleton className="h-24 max-w-xs" />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <TableSkeleton rows={4} columns={3} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
