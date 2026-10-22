import Link from "next/link";
import { requireDaie } from "@/lib/auth/session";
import { getAllBulletins } from "@/lib/data";
import { BulletinCard } from "@/components/daie/bulletin-card";
import { Button } from "@/components/ui/button";
import { PageLinks } from "@/components/ui/page-links";

const PAGE_SIZE = 12;

export default async function BulletinPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireDaie();
  const { page: pageParam } = await searchParams;
  const bulletins = await getAllBulletins();
  const totalPages = Math.max(1, Math.ceil(bulletins.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(pageParam) || 1));
  const pageBulletins = bulletins.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Bulletin</h1>
          <p className="text-sm text-muted-foreground">Latest updates from Kausar Group, newest first.</p>
        </div>
        {user.isGroupAdmin && (
          <Button asChild>
            <Link href="/bulletin/new">New post</Link>
          </Button>
        )}
      </div>

      {bulletins.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No bulletin posts yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageBulletins.map((b) => (
              <BulletinCard key={b.id} bulletin={b} canDelete={user.isGroupAdmin} />
            ))}
          </div>
          <PageLinks basePath="/bulletin" page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
