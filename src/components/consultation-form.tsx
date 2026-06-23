"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, FileUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ConsultationResponse = {
  ok?: boolean;
  consultationId?: string | null;
  saved?: boolean;
  persistenceReason?: string;
  emailSent?: boolean;
  emailReason?: string;
  error?: string;
};

const consultationTypes = [
  "Videochiamata",
  "Consulenza scritta",
  "Ricorso Prefetto",
  "Ricorso Giudice di Pace",
];

export function ConsultationForm() {
  const searchParams = useSearchParams();
  const screeningId = searchParams.get("screeningId") ?? "";
  const [result, setResult] = useState<ConsultationResponse | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const screeningIdLabel = useMemo(
    () => (screeningId ? `Screening collegato: ${screeningId}` : ""),
    [screeningId],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      if (screeningId) formData.set("screeningId", screeningId);

      const response = await fetch("/api/consultation", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as
        ConsultationResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Non è stato possibile inviare la richiesta.",
        );
      }

      setResult(payload);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Non è stato possibile inviare la richiesta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[1.7rem] border bg-white p-6 shadow-soft sm:p-9"
    >
      {result ? (
        <div className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Richiesta consulenza inviata</p>
              <p>
                ID richiesta:{" "}
                <span className="font-mono">
                  {result.consultationId ?? "non salvato"}
                </span>
              </p>
              {(!result.saved || !result.emailSent) && (
                <p className="mt-2 text-amber-800">
                  Invio ricevuto, ma alcune integrazioni non sono ancora
                  configurate: Supabase {result.saved ? "OK" : "non attivo"},
                  email {result.emailSent ? "OK" : "non attiva"}.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-7 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {screeningIdLabel ? (
        <p className="mb-5 rounded-xl bg-[#eef5f3] px-4 py-3 text-sm font-medium text-[#174c48]">
          {screeningIdLabel}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome">
          <Input name="firstName" required placeholder="Mario" />
        </Field>
        <Field label="Cognome">
          <Input name="lastName" required placeholder="Rossi" />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            required
            type="email"
            placeholder="mario@email.it"
          />
        </Field>
        <Field label="Tipo consulenza">
          <select
            name="consultationType"
            required
            className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Seleziona
            </option>
            {consultationTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Numero verbale">
          <Input name="noticeNumber" placeholder="Es. 659881/2025" />
        </Field>
        <Field label="Comune / Ente">
          <Input name="authority" placeholder="Comune di Bologna" />
        </Field>
        <Field label="Importo sanzione">
          <Input name="amount" placeholder="Es. 93,60 €" />
        </Field>
        <Field label="Preferenza oraria" className="sm:col-span-2">
          <Input
            name="preferredTime"
            placeholder="Es. mattina, pomeriggio, dopo le 18"
          />
        </Field>
        <Field label="Descrizione del caso" className="sm:col-span-2">
          <Textarea
            name="description"
            required
            className="min-h-32"
            placeholder="Descrivi brevemente cosa è successo, cosa vuoi verificare e se hai scadenze imminenti..."
          />
        </Field>
        <Field label="Verbale, report e altri allegati" className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-slate-600 hover:bg-slate-50">
            <FileUp className="size-5 text-[#0f756d]" />
            <span>Carica PDF, immagini del verbale, report o allegati</span>
            <input
              type="file"
              name="attachments"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
            />
          </label>
        </Field>
      </div>

      <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
        <input
          type="checkbox"
          name="privacyAccepted"
          required
          className="mt-1 size-4 rounded border-slate-300 accent-[#103d3a]"
        />
        <span>
          Accetto la Privacy Policy e autorizzo il trattamento dei dati per la
          gestione della richiesta di consulenza.
        </span>
      </label>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-7 h-12 w-full rounded-full bg-[#103d3a] sm:w-auto sm:px-7"
      >
        {isSubmitting ? "Invio in corso..." : "Richiedi consulenza"}
        <Send className="size-4" />
      </Button>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
