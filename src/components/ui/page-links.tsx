import Link from "next/link";

/**
 * Prev/Next links for a server-rendered list paged with `?page=N` (e.g. the
 * Bulletin feed). The client-side tables use <PaginationFooter> instead.
 */
export function PageLinks({ basePath, page, totalPages }: { basePath: string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => (n <= 1 ? basePath : `${basePath}?page=${n}`);
  const linkClass = "rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted";
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2">
      {page > 1 ? <Link href={href(page - 1)} className={linkClass}>Previous</Link> : <span className={`${linkClass} pointer-events-none opacity-50`}>Previous</span>}
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)} className={linkClass}>Next</Link> : <span className={`${linkClass} pointer-events-none opacity-50`}>Next</span>}
    </nav>
  );
}
