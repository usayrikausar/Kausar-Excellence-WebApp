import { requireDaie } from "@/lib/auth/session";
import { getOnboardingStatusForUid } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { OnboardingChecklist } from "@/components/daie/onboarding-checklist";

export default async function MyOnboardingPage() {
  const user = await requireDaie();
  const status = await getOnboardingStatusForUid(user.uid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Onboarding</h1>
          <p className="text-sm text-muted-foreground">Must-attend training every new daie needs to complete — set up by your admin under CPD &amp; Training.</p>
        </div>
        {status.requirements.length > 0 && (
          <Badge variant={status.complete ? "success" : "muted"}>{status.complete ? "All complete" : "In progress"}</Badge>
        )}
      </div>

      <OnboardingChecklist requirements={status.requirements} uid={user.uid} />
    </div>
  );
}
