import { requireDaie } from "@/lib/auth/session";
import { AppShell } from "@/components/daie/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDaie();
  return <AppShell user={user}>{children}</AppShell>;
}
