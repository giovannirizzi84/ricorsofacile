"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScreeningReportView } from "@/components/screening-flow";
import {
  deletePendingScreening,
  readPendingScreeningMetadata,
  readPendingScreening,
} from "@/lib/payments/pendingScreening";
import type { ScreeningReport } from "@/lib/screening-report";

type AnalyzePayload = {
  report?: ScreeningReport;
  screeningId?: string | null;
  error?: string;
};

export function SuccessClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const started = useRef(false);
  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Verifica pagamento in corso…");
  const [needsReupload, setNeedsReupload] = useState(false);
  const [recoveryFiles, setRecoveryFiles] = useState<File[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  const submitAnalysis = useCallback(async (
    currentSessionId: string,
    files: File[],
    caseData: Record<string, string>,
  ) => {
    setStatus("Pagamento confermato. Analisi del verbale in corso…");
    console.info("MulteOnline success return: analysis started", {
      checkoutSessionId: currentSessionId,
      fileCount: files.length,
      paymentVerified: "server_side",
    });

    const body = new FormData();
    for (const file of files) body.append("files", file);
    for (const [key, value] of Object.entries(caseData)) {
      body.append(key, value);
    }
    body.append("paymentSessionId", currentSessionId);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body,
    });
    const payload = await readAnalyzePayload(response);

    if (!response.ok || !payload.report) {
      throw new Error(payload.error || "Analisi non completata.");
    }

    await deletePendingScreening(currentSessionId);
    setReport(payload.report);
    setScreeningId(payload.screeningId ?? null);
    setStatus("Analisi completata");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const generateReport = useCallback(async (currentSessionId: string) => {
    if (!currentSessionId) {
      setError("Sessione di pagamento non trovata.");
      return;
    }

    try {
      console.info("MulteOnline success return detected", {
        checkoutSessionId: currentSessionId,
        successReturnDetected: true,
      });
      setStatus("Recupero documenti caricati…");
      const pending = await readPendingScreening(currentSessionId);
      const files = pending?.files.filter((file) => file.size > 0) ?? [];
      if (!pending || files.length === 0) {
        const metadata = readPendingScreeningMetadata(currentSessionId);
        console.warn("MulteOnline pending upload missing after checkout return", {
          checkoutSessionId: currentSessionId,
          pendingUploadFound: false,
          pendingUploadMissing: true,
          metadataFound: Boolean(metadata),
          expectedFileCount: metadata?.fileCount ?? null,
        });
        setNeedsReupload(true);
        setStatus("Pagamento completato. Ricarica il verbale per completare l’analisi.");
        return;
      }

      console.info("MulteOnline pending upload found after checkout return", {
        checkoutSessionId: currentSessionId,
        pendingUploadFound: true,
        fileCount: files.length,
      });
      await submitAnalysis(currentSessionId, files, pending.caseData);
    } catch (analysisError) {
      console.warn("MulteOnline analysis blocked after checkout return", {
        checkoutSessionId: currentSessionId,
        analysisBlockedReason:
          analysisError instanceof Error ? analysisError.message : "unknown",
      });
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Non è stato possibile completare l’analisi dopo il pagamento.",
      );
    }
  }, [submitAnalysis]);

  async function recoverWithUploadedFiles() {
    if (!sessionId || recoveryFiles.length === 0 || isRecovering) return;

    setError("");
    setIsRecovering(true);
    try {
      const metadata = readPendingScreeningMetadata(sessionId);
      await submitAnalysis(sessionId, recoveryFiles, metadata?.caseData ?? {});
    } catch (recoveryError) {
      console.warn("MulteOnline wallet return recovery failed", {
        checkoutSessionId: sessionId,
        analysisBlockedReason:
          recoveryError instanceof Error ? recoveryError.message : "unknown",
      });
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Non è stato possibile completare l’analisi dopo il pagamento.",
      );
    } finally {
      setIsRecovering(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void generateReport(sessionId);
  }, [generateReport, sessionId]);

  if (report) {
    return (
      <section className="bg-[#f4f7f6] py-10 sm:py-14">
        <div className="page-shell">
          <ScreeningReportView report={report} screeningId={screeningId} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f4f7f6] py-14">
      <div className="page-shell">
        <Card className="mx-auto max-w-2xl border-0 shadow-soft">
          <CardContent className="p-8 text-center">
            {error ? (
              <>
                <AlertCircle className="mx-auto size-12 text-red-600" />
                <h1 className="mt-5 text-2xl font-semibold">
                  Analisi non completata
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
                <Button asChild className="mt-7 rounded-full bg-[#103d3a]">
                  <Link href="/analizza">Torna all’analisi</Link>
                </Button>
              </>
            ) : needsReupload ? (
              <>
                <UploadCloud className="mx-auto size-12 text-[#0f756d]" />
                <h1 className="mt-5 text-2xl font-semibold">
                  Pagamento completato
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Non riusciamo a recuperare automaticamente il verbale dopo il
                  ritorno dal pagamento. Ricarica il documento per completare
                  l’analisi: non dovrai pagare di nuovo.
                </p>
                <label className="mt-7 block cursor-pointer rounded-2xl border-2 border-dashed border-[#9cbcb6] bg-[#f3f8f6] p-6 text-sm text-slate-600">
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setRecoveryFiles(Array.from(event.currentTarget.files ?? []))
                    }
                  />
                  Seleziona PDF o immagini del verbale
                </label>
                {recoveryFiles.length > 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {recoveryFiles.length} document
                    {recoveryFiles.length === 1 ? "o" : "i"} selezionat
                    {recoveryFiles.length === 1 ? "o" : "i"}.
                  </p>
                ) : null}
                <Button
                  className="mt-7 rounded-full bg-[#103d3a]"
                  disabled={recoveryFiles.length === 0 || isRecovering}
                  onClick={() => void recoverWithUploadedFiles()}
                >
                  {isRecovering ? "Analisi in corso..." : "Completa analisi"}
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                <h1 className="mt-5 text-2xl font-semibold">
                  Pagamento riuscito
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{status}</p>
                <LoaderCircle className="mx-auto mt-7 size-8 animate-spin text-[#0f756d]" />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function readAnalyzePayload(response: Response): Promise<AnalyzePayload> {
  const raw = await response.text();
  if (!raw.trim()) {
    return {
      error: "Il server non ha restituito una risposta valida. Riprova tra poco.",
    };
  }

  try {
    return JSON.parse(raw) as AnalyzePayload;
  } catch {
    return {
      error:
        response.ok
          ? "La risposta dell’analisi non è leggibile."
          : "Il server ha interrotto l’analisi. Riprova con un file più nitido o in formato PDF.",
    };
  }
}
