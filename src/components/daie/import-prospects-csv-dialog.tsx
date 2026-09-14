"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, writeBatch, serverTimestamp, type DocumentReference, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { parseProspectCsv, type ParsedProspectRow, type ProspectRowError } from "@/lib/prospect-csv";
import type { ProspectWithId } from "@/lib/data";

// Firestore's writeBatch caps at 500 operations — each imported row can
// produce up to 2 (the prospect doc + a stage-change "updates" doc), so we
// flush well under that ceiling rather than trying to land exactly on it.
const MAX_OPS_PER_BATCH = 400;

type Step = "pick" | "review" | "importing" | "done";

export function ImportProspectsCsvDialog({ uid, prospects }: { uid: string; prospects: ProspectWithId[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedProspectRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ProspectRowError[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function reset() {
    setStep("pick");
    setFileName("");
    setParsed([]);
    setParseErrors([]);
    setResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    const { parsed: p, errors } = parseProspectCsv(rows);
    setParsed(p);
    setParseErrors(errors);
    setStep("review");
  }

  const existingById = new Map(prospects.map((p) => [p.id, p]));
  const toCreate = parsed.filter((r) => !r.prospectId || !existingById.has(r.prospectId));
  const toUpdate = parsed.filter((r) => r.prospectId && existingById.has(r.prospectId));
  const rowWarnings = parsed.flatMap((r) => r.warnings.map((w) => `Row ${r.rowNumber}: ${w}`));

  async function handleImport() {
    setStep("importing");
    setImportError(null);
    try {
      type Op = { ref: DocumentReference; data: Record<string, unknown>; kind: "set" | "update" };
      const ops: Op[] = [];

      for (const row of toCreate) {
        const prospectRef = doc(collection(db, "prospects"));
        const updateRef = doc(collection(db, "prospects", prospectRef.id, "updates"));
        ops.push({
          kind: "set",
          ref: prospectRef,
          data: {
            uid,
            ...row.fields,
            linkedSaleId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        });
        ops.push({
          kind: "set",
          ref: updateRef,
          data: {
            uid,
            stage: row.fields.stage,
            note: "Added via CSV import.",
            nextFollowUpDate: row.fields.nextFollowUpDate,
            createdAt: serverTimestamp(),
          },
        });
      }

      for (const row of toUpdate) {
        const existing = existingById.get(row.prospectId!)!;
        const prospectRef = doc(db, "prospects", existing.id);
        ops.push({
          kind: "update",
          ref: prospectRef,
          data: { ...row.fields, updatedAt: serverTimestamp() },
        });
        if (row.fields.stage !== existing.stage) {
          const updateRef = doc(collection(db, "prospects", existing.id, "updates"));
          ops.push({
            kind: "set",
            ref: updateRef,
            data: {
              uid,
              stage: row.fields.stage,
              note: "Stage updated via CSV import.",
              nextFollowUpDate: row.fields.nextFollowUpDate,
              createdAt: serverTimestamp(),
            },
          });
        }
      }

      for (let i = 0; i < ops.length; i += MAX_OPS_PER_BATCH) {
        const chunk = ops.slice(i, i + MAX_OPS_PER_BATCH);
        const batch: WriteBatch = writeBatch(db);
        for (const op of chunk) {
          if (op.kind === "set") batch.set(op.ref, op.data);
          else batch.update(op.ref, op.data);
        }
        await batch.commit();
      }

      setResult({ created: toCreate.length, updated: toUpdate.length });
      setStep("done");
      router.refresh();
    } catch {
      setImportError("Import failed partway through — please check the prospect list and try again.");
      setStep("review");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1.5 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import prospects from CSV</DialogTitle>
          <DialogDescription>
            Use a file exported from &ldquo;Export CSV&rdquo; so the columns line up. Rows with a matching Prospect ID update
            that prospect; rows without one (or with an unrecognized id) create a new prospect.
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm" />
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{fileName}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-ink">{toCreate.length}</p>
                <p className="text-xs text-muted-foreground">New prospects</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-ink">{toUpdate.length}</p>
                <p className="text-xs text-muted-foreground">Prospects to update</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-2xl font-bold text-ink">{parseErrors.length}</p>
                <p className="text-xs text-muted-foreground">Rows skipped</p>
              </div>
            </div>

            {(parseErrors.length > 0 || rowWarnings.length > 0) && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/50 p-3 text-xs">
                {parseErrors.map((e, i) => (
                  <p key={`err-${i}`} className="text-red-600">Row {e.rowNumber}: {e.error}</p>
                ))}
                {rowWarnings.map((w, i) => (
                  <p key={`warn-${i}`} className="text-muted-foreground">{w}</p>
                ))}
              </div>
            )}

            {toUpdate.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Stage changes detected on update will also be recorded as a stage-history entry, same as moving a card on the board
                (stages: {[...new Set(toUpdate.map((r) => STAGE_LABELS[r.fields.stage]))].join(", ")}).
              </p>
            )}

            {importError && <p className="text-sm font-medium text-red-600">{importError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>Choose a different file</Button>
              <Button size="sm" disabled={toCreate.length + toUpdate.length === 0} onClick={handleImport}>
                Import {toCreate.length + toUpdate.length} row{toCreate.length + toUpdate.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && <p className="py-6 text-center text-sm text-muted-foreground">Importing…</p>}

        {step === "done" && result && (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Done — created {result.created} new prospect{result.created === 1 ? "" : "s"} and updated {result.updated}.
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
