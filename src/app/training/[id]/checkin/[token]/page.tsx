import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getTrainingById, getAttendanceRecordForUid } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { QrCheckinAction } from "@/components/daie/qr-checkin-action";

export default async function TrainingCheckinPage({ params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/training/${id}/checkin/${token}`)}`);
  }

  const training = await getTrainingById(id);
  const tokenValid = training && training.provider === "kausar" && training.qrToken === token;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9ECF6] p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-sm">
        <div className="mb-5 font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight text-navy-900">
          Kausar<span className="text-accent">.</span> Group
        </div>

        {!tokenValid ? (
          <div>
            <p className="text-lg font-bold text-ink">Invalid QR code</p>
            <p className="mt-1 text-sm text-muted-foreground">This check-in link doesn&rsquo;t match a current training. Ask the organizer for the correct code.</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Training check-in</p>
            <p className="mt-1 text-lg font-bold text-ink">{training.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(training.date)} &middot; {training.cpdHours} CPD hr{training.cpdHours === 1 ? "" : "s"}{training.location ? ` · ${training.location}` : ""}
            </p>
            <div className="mt-6">
              <QrCheckinAction trainingId={training.id} qrToken={token} uid={user.uid} alreadyCheckedIn={!!(await getAttendanceRecordForUid(training.id, user.uid))} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
