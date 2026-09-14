import { requireDaie } from "@/lib/auth/session";
import { getOnboardingStatusForUid } from "@/lib/data";
import { AppShell } from "@/components/daie/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDaie();
  // null = no onboarding requirements exist yet, so the sidebar shows no badge at all.
  const onboarding = await getOnboardingStatusForUid(user.uid);
  const onboardingComplete = onboarding.requirements.length > 0 ? onboarding.complete : null;
  return (
    <AppShell user={user} onboardingComplete={onboardingComplete}>
      {children}
    </AppShell>
  );
}
