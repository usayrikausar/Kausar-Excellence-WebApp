import { requireLdpAccess } from "@/lib/auth/session";
import { ComingSoon } from "@/components/daie/coming-soon";

export default async function LdpPage() {
  await requireLdpAccess();
  return <ComingSoon title="LDP" phase={2} />;
}
