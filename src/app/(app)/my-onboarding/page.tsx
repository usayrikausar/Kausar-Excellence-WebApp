import { requireDaie } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ONBOARDING_STAGES = [
  { name: "Onboarding Programme", description: "Introduction to Kausar Group, brand, and the daie role." },
  { name: "Start Training", description: "Foundational product and process training for new daie." },
  { name: "Advance Training", description: "Deeper product, compliance, and case-handling training." },
  { name: "Kunci Pewarisan", description: "The capstone training required before a daie can be licensed." },
];

// A daie must complete all 4 stages before their introducer/upline can mark
// them licensed (see the "Date licensed" field on My Team / Admin) — this is
// a MUST-attend requirement, not optional CPD. Real tracking/completion
// state needs the LMS integration (Phase 3); for now this shows the required
// sequence so the roadmap is visible.
export default async function MyOnboardingPage() {
  await requireDaie();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Required training every daie must complete before they can be licensed with Wasiyyah.
        </p>
      </div>

      <div className="space-y-3">
        {ONBOARDING_STAGES.map((stage, i) => (
          <Card key={stage.name}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {stage.name}
                </CardTitle>
                <CardDescription className="pl-8">{stage.description}</CardDescription>
              </div>
              <Badge variant="muted">Not started</Badge>
            </CardHeader>
            <CardContent className="pl-14 text-xs text-muted-foreground">
              Tracking arrives with the LMS integration (Phase 3). The sequence is shown now so the full requirement is visible.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
