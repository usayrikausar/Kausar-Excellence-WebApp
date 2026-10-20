import type { CurrentUser } from "@/lib/types";
import { Sidebar } from "@/components/daie/sidebar";
import { Topbar } from "@/components/daie/topbar";
import { SessionSync } from "@/components/daie/session-sync";

export function AppShell({ user, onboardingComplete, children }: { user: CurrentUser; onboardingComplete: boolean | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <SessionSync />
      <Sidebar user={user} onboardingComplete={onboardingComplete} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/40 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
