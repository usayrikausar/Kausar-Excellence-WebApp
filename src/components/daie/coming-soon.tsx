import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title, phase }: { title: string; phase: 2 | 3 }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">
            Coming in Phase {phase}
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">{title}</h2>
          <p className="text-sm text-muted-foreground">
            This section is part of the full Kausar Excellence roadmap and will be built in Phase {phase}.
            The navigation item is here now so the whole product shape is visible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
