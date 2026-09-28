import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on every tab tap while the server builds the next page —
// the sidebar stays put (it lives in the layout), only this content area
// swaps. Without it the screen froze on the old page until the new one
// was fully ready, which read as the app not responding.
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
