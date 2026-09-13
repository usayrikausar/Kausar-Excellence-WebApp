import Link from "next/link";
import { requireDaie } from "@/lib/auth/session";
import { getAllBulletins } from "@/lib/data";
import { BulletinCard } from "@/components/daie/bulletin-card";
import { Button } from "@/components/ui/button";

export default async function BulletinPage() {
  const user = await requireDaie();
  const bulletins = await getAllBulletins();

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bulletins.map((b) => (
            <BulletinCard key={b.id} bulletin={b} />
          ))}
        </div>
      )}
    </div>
  );
}
