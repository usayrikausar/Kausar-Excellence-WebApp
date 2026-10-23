import { requireGroupAdmin } from "@/lib/auth/session";
import { MarketingForm } from "@/components/daie/marketing-form";

export default async function NewMarketingPage() {
  await requireGroupAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Add marketing material</h1>
      <MarketingForm />
    </div>
  );
}
