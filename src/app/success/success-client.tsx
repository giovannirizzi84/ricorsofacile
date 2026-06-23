"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScreeningReportView } from "@/components/screening-flow";
import {
  deletePendingScreening,
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

  const generateReport = useCallback(async (currentSessionId: string) => {
    if (!currentSessionId) {
      setError("Sessione di pagamento non trovata.");
      return;
    }

    try {
      setStatus("Recupero documenti caricati…");
      const pending = await readPendingScreening(currentSessionId);
      if (!pending) {
        throw new Error(
          "Non trovo i documenti caricati prima del pagamento. Torna alla pagina di analisi e ricarica il verbale.",
        );
      }

      setStatus("Pagamento confermato. Analisi del verbale in corso…");
      const body = new FormData();
      for (const file of pending.files) body.append("files", file);
      for (const [key, value] of Object.entries(pending.caseData)) {
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
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Non è stato possibile completare l’analisi dopo il pagamento.",
      );
    }
  }, []);

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
