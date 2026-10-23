import { notFound } from "next/navigation";
import { requireGroupAdmin } from "@/lib/auth/session";
import { getMarketingMaterial } from "@/lib/data";
import { MarketingForm } from "@/components/daie/marketing-form";

export default async function EditMarketingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGroupAdmin();
  const { id } = await params;
  const item = await getMarketingMaterial(id);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Edit marketing material</h1>
      <MarketingForm existing={item} />
    </div>
  );
}
