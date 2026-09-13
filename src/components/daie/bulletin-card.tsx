import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { BulletinDoc } from "@/lib/types";

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number | Date);
}

export function BulletinCard({ bulletin }: { bulletin: BulletinDoc & { id: string } }) {
  return (
    <Card>
      {bulletin.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- emulator-hosted Storage URLs, next/image optimizer isn't configured for them in Phase 1
        <img src={bulletin.imageUrl} alt="" className="h-40 w-full rounded-t-xl object-cover" />
      )}
      <CardHeader>
        <CardTitle className="text-base">{bulletin.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{formatDate(toDate(bulletin.publishAt))}</p>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground/80">{bulletin.body}</p>
      </CardContent>
    </Card>
  );
}
