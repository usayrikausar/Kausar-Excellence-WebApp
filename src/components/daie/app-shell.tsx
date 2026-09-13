import type { CurrentUser } from "@/lib/types";
import { Sidebar } from "@/components/daie/sidebar";
import { Topbar } from "@/components/daie/topbar";
import { SessionSync } from "@/components/daie/session-sync";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <SessionSync />
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto bg-muted/40 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
