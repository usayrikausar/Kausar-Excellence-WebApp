import { requireDaie } from "@/lib/auth/session";
import { getTrainings, getCpdSummaryForUid, getAllUsers, getAllTrainingAttendance } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTrainingForm } from "@/components/admin/create-training-form";
import { TrainingQrDialog } from "@/components/admin/training-qr-dialog";
import { TrainingAttendancePanel } from "@/components/admin/training-attendance-panel";
import { ExportCpdCsvButtons } from "@/components/admin/export-cpd-csv-buttons";
import { AvailableTrainingsList } from "@/components/daie/available-trainings-list";
import { formatDate } from "@/lib/utils";

export default async function CpdPage() {
  const user = await requireDaie();

  const [trainings, cpd] = await Promise.all([getTrainings(), getCpdSummaryForUid(user.uid)]);
  const attendedTrainingIds = new Set(cpd.records.map((r) => r.training.id));

  const [allUsers, allAttendance] = user.isGroupAdmin
    ? await Promise.all([getAllUsers(), getAllTrainingAttendance()])
    : [null, null];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">CPD &amp; Training</h1>
        <p className="text-sm text-muted-foreground">Continuing professional development hours, for Wasiyyah&rsquo;s Maintenance of Contract requirement.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My CPD hours</CardTitle>
          <CardDescription>Total across everything you&rsquo;ve attended — no target set yet, this is just an accurate running total.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-2xl font-bold text-ink">{cpd.totalHours}</p>
              <p className="text-xs text-muted-foreground">Total hours</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-2xl font-bold text-ink">{cpd.kausarHours}</p>
              <p className="text-xs text-muted-foreground">Kausar Group</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-2xl font-bold text-ink">{cpd.wasiyyahHours}</p>
              <p className="text-xs text-muted-foreground">Wasiyyah</p>
            </div>
          </div>

          {cpd.records.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {cpd.records.map((r) => (
                <div key={r.training.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{r.training.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.training.date)} &middot; {r.training.cpdHours} hr{r.training.cpdHours === 1 ? "" : "s"} &middot; {r.training.provider === "kausar" ? "Kausar Group" : "Wasiyyah"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available trainings</CardTitle>
          <CardDescription>Kausar sessions: scan the QR displayed at the venue. Wasiyyah sessions: mark yourself attended below.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvailableTrainingsList trainings={trainings} uid={user.uid} attendedTrainingIds={attendedTrainingIds} />
        </CardContent>
      </Card>

      {user.isGroupAdmin && allUsers && allAttendance && (
        <div className="space-y-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Manage trainings</h2>
          <CreateTrainingForm createdBy={user.uid} />

          <ExportCpdCsvButtons trainings={trainings} attendance={allAttendance} users={allUsers} />

          <div className="space-y-2">
            {trainings.map((t) => {
              const attendance = allAttendance.filter((a) => a.trainingId === t.id);
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4">
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                      {t.title} <Badge variant={t.provider === "kausar" ? "default" : "accent"}>{t.provider === "kausar" ? "Kausar Group" : "Wasiyyah"}</Badge>
                      {t.requiredForOnboarding && <Badge variant="success">Onboarding</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)} &middot; {t.cpdHours} CPD hr{t.cpdHours === 1 ? "" : "s"}{t.location ? ` · ${t.location}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.provider === "kausar" && t.qrToken && <TrainingQrDialog trainingId={t.id} qrToken={t.qrToken} title={t.title} />}
                    <TrainingAttendancePanel trainingId={t.id} attendance={attendance} allUsers={allUsers} adminUid={user.uid} />
                  </div>
                </div>
              );
            })}
            {trainings.length === 0 && <p className="text-sm text-muted-foreground">No trainings created yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
