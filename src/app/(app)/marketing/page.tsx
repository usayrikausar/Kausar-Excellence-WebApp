import Link from "next/link";
import { requireDaie } from "@/lib/auth/session";
import { getMarketingMaterials } from "@/lib/data";
import { MarketingKit } from "@/components/daie/marketing-kit";
import { Button } from "@/components/ui/button";

export default async function MarketingPage() {
  const user = await requireDaie();
  const items = await getMarketingMaterials();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Marketing Kit</h1>
          <p className="text-sm text-muted-foreground">Posters, videos and PDFs from Kausar Group, ready to download and share.</p>
        </div>
        {user.isGroupAdmin && (
          <Button asChild>
            <Link href="/marketing/new">Add material</Link>
          </Button>
        )}
      </div>
      <MarketingKit items={items} canManage={user.isGroupAdmin} />
    </div>
  );
}
