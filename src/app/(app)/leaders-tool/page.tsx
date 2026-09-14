import { requireLdpAccess } from "@/lib/auth/session";
import { ComingSoon } from "@/components/daie/coming-soon";

export default async function LeadersToolPage() {
  await requireLdpAccess();
  return <ComingSoon title="Forms and Tools" phase={2} />;
}
