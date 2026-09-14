"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function TrainingQrDialog({ trainingId, qrToken, title }: { trainingId: string; qrToken: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const checkinUrl = typeof window !== "undefined" ? `${window.location.origin}/training/${trainingId}/checkin/${qrToken}` : "";

  useEffect(() => {
    if (!open || !checkinUrl) return;
    QRCode.toDataURL(checkinUrl, { width: 320, margin: 1 }).then(setDataUrl);
  }, [open, checkinUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><QrCode className="mr-1.5 h-4 w-4" /> Show QR</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Display this at the venue — daie scan it with their own phone to check themselves in instantly.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a locally-generated data URL, not an optimizable remote image
            <img src={dataUrl} alt="Training check-in QR code" width={320} height={320} />
          ) : (
            <p className="text-sm text-muted-foreground">Generating…</p>
          )}
          <p className="break-all text-center text-xs text-muted-foreground">{checkinUrl}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
