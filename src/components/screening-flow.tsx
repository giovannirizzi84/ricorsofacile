"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FileText,
  Gavel,
  LoaderCircle,
  Printer,
  Scale,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ScreeningReport } from "@/lib/screening-report";

const stepLabels = [
  "Dati della multa",
  "Documenti",
  "Consenso e analisi",
  "Il tuo report",
];

type CaseData = {
  notificationDate: string;
  authority: string;
  amount: string;
  violationType: string;
};

const initialCaseData: CaseData = {
  notificationDate: "",
  authority: "",
  amount: "",
  violationType: "",
};

export function ScreeningFlow() {
  const [step, setStep] = useState(0);
  const [caseData, setCaseData] = useState(initialCaseData);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("Analisi OCR in corso…");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [error, setError] = useState("");

  function updateCaseData(key: keyof CaseData, value: string) {
    setCaseData((current) => ({ ...current, [key]: value }));
  }

  function advance(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setStep((current) => Math.min(current + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function analyze() {
    if (!privacyAccepted || !disclaimerAccepted || files.length === 0) return;

    setError("");
    setProcessing(true);
    setProcessingStage("Analisi OCR in corso…");
    const stageTimers = [
      window.setTimeout(
        () => setProcessingStage("Testo estratto dal verbale…"),
        2500,
      ),
      window.setTimeout(
        () => setProcessingStage("Applicazione regole preliminari…"),
        5000,
      ),
      window.setTimeout(
        () => setProcessingStage("Generazione report…"),
        7500,
      ),
    ];

    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      for (const [key, value] of Object.entries(caseData)) {
        body.append(key, value);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        report?: ScreeningReport;
        error?: string;
      };

      if (!response.ok || !payload.report) {
        throw new Error(payload.error || "Analisi non completata.");
      }

      setReport(payload.report);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Non è stato possibile completare l'analisi.",
      );
    } finally {
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      setProcessing(false);
    }
  }

  return (
    <section className="bg-[#f4f7f6] py-10 sm:py-14">
      <div className="page-shell">
        <div className="mb-8 rounded-2xl border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#0f5752]">
              Passaggio {Math.min(step + 1, 4)} di 4
            </span>
            <span className="hidden text-slate-500 sm:block">
              {stepLabels[step]}
            </span>
          </div>
          <Progress
            value={(step + 1) * 25}
            className="mt-4 h-2 [&>div]:bg-[#0f756d]"
          />
          <div className="mt-4 hidden grid-cols-4 text-xs text-slate-500 md:grid">
            {stepLabels.map((label, index) => (
              <span
                key={label}
                className={index === step ? "font-semibold text-[#0f5752]" : ""}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {step < 3 ? (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
            <Card className="border-0 shadow-soft">
              <CardContent className="p-6 sm:p-9">
                {step === 0 && (
                  <form onSubmit={advance}>
                    <StepTitle
                      icon={FileText}
                      title="Raccontaci della multa"
                      text="Inserisci i dati essenziali. L’AI li confronterà con ciò che riesce a leggere nei documenti."
                    />
                    <div className="mt-8 grid gap-5 sm:grid-cols-2">
                      <Field label="Data di notifica">
                        <Input
                          required
                          type="date"
                          value={caseData.notificationDate}
                          onChange={(event) =>
                            updateCaseData("notificationDate", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Ente accertatore">
                        <Input
                          required
                          placeholder="Polizia Locale di..."
                          value={caseData.authority}
                          onChange={(event) =>
                            updateCaseData("authority", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Importo della multa">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400">
                            €
                          </span>
                          <Input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className="pl-8"
                            placeholder="98,00"
                            value={caseData.amount}
                            onChange={(event) =>
                              updateCaseData("amount", event.target.value)
                            }
                          />
                        </div>
                      </Field>
                      <Field label="Tipo di violazione">
                        <select
                          required
                          className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                          value={caseData.violationType}
                          onChange={(event) =>
                            updateCaseData("violationType", event.target.value)
                          }
                        >
                          <option value="">Seleziona una categoria</option>
                          <option>Eccesso di velocità / Autovelox</option>
                          <option>ZTL o corsia riservata</option>
                          <option>Divieto di sosta</option>
                          <option>Mancata contestazione immediata</option>
                          <option>Documenti, revisione o assicurazione</option>
                          <option>Altra violazione</option>
                        </select>
                      </Field>
                    </div>
                    <Actions step={step} onBack={() => setStep(0)} />
                  </form>
                )}

                {step === 1 && (
                  <div>
                    <StepTitle
                      icon={UploadCloud}
                      title="Carica verbale e allegati"
                      text="I PDF vengono letti come testo e immagini; per le foto usa file nitidi e completi."
                    />
                    <label className="mt-8 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#9cbcb6] bg-[#f3f8f6] p-8 text-center hover:bg-[#edf5f2]">
                      <input
                        className="sr-only"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        onChange={(event) => {
                          setError("");
                          setFiles(Array.from(event.target.files ?? []));
                        }}
                      />
                      <span className="grid size-14 place-items-center rounded-full bg-white text-[#0f756d] shadow-sm">
                        <UploadCloud className="size-6" />
                      </span>
                      <span className="mt-5 font-semibold">
                        Trascina qui i documenti o clicca per selezionarli
                      </span>
                      <span className="mt-2 text-sm text-slate-500">
                        PDF, JPG o PNG · fino a 5 file · massimo 10 MB ciascuno
                      </span>
                    </label>
                    {files.length > 0 && (
                      <div className="mt-5 space-y-2">
                        {files.map((file) => (
                          <div
                            key={`${file.name}-${file.size}`}
                            className="flex items-center gap-3 rounded-xl border p-4 text-sm"
                          >
                            <FileText className="size-4 text-[#0f756d]" />
                            <span className="min-w-0 flex-1 truncate">
                              {file.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-7 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      <strong>Documenti utili:</strong> tutte le pagine del
                      verbale, busta o PEC di notifica, foto della segnaletica,
                      ricevute e comunicazioni dell’ente.
                    </div>
                    <Actions
                      step={step}
                      onBack={() => setStep(0)}
                      onNext={() => advance()}
                      nextDisabled={files.length === 0 || files.length > 5}
                    />
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <StepTitle
                      icon={FileSearch}
                      title="Avvia l’analisi automatizzata"
                      text="Il documento viene elaborato tramite OCR, motore di regole e Gemini, quando disponibile."
                    />
                    <div className="mt-8 rounded-2xl border bg-[#f5f8f7] p-5">
                      <div className="flex items-start gap-4">
                        <Sparkles className="mt-1 size-5 shrink-0 text-[#0f756d]" />
                        <div>
                          <p className="font-semibold">
                            Analisi preliminare automatizzata
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Il sistema leggerà {files.length} document
                            {files.length === 1 ? "o" : "i"}, estrarrà i fatti e
                            applicherà regole preliminari. I file non vengono
                            salvati da questa applicazione; quando Gemini è
                            disponibile, il testo estratto viene inviato a
                            Google per completare l’analisi. In caso contrario
                            il report viene prodotto dal motore di regole.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-7 space-y-4">
                      <Consent
                        checked={privacyAccepted}
                        onCheckedChange={setPrivacyAccepted}
                        text="Acconsento all’elaborazione temporanea dei documenti e all’invio del testo estratto a Google Gemini, quando disponibile, per effettuare lo screening preliminare."
                      />
                      <Consent
                        checked={disclaimerAccepted}
                        onCheckedChange={setDisclaimerAccepted}
                        text="Comprendo che il risultato è preliminare, può contenere errori e non costituisce parere legale né garanzia di accoglimento."
                      />
                    </div>
                    {error && (
                      <div
                        role="alert"
                        className="mt-6 flex gap-3 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800"
                      >
                        <AlertCircle className="mt-0.5 size-5 shrink-0" />
                        {error}
                      </div>
                    )}
                    <Actions
                      step={step}
                      onBack={() => setStep(1)}
                      onNext={analyze}
                      nextDisabled={
                        !privacyAccepted ||
                        !disclaimerAccepted ||
                        processing
                      }
                      nextLabel="Avvia analisi"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            <AsideSummary step={step} files={files.length} />
          </div>
        ) : report ? (
          <Report report={report} />
        ) : null}
      </div>

      {processing && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0d2f2d]/90 p-6 text-white backdrop-blur-sm">
          <div className="max-w-md text-center">
            <LoaderCircle className="mx-auto size-12 animate-spin text-lime-300" />
            <h2 className="mt-6 text-2xl font-semibold">{processingStage}</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Lettura del verbale, estrazione dei fatti e valutazione tramite
              regole deterministiche. L’OCR può richiedere circa un minuto.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StepTitle({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6f2ee] text-[#0f756d]">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Consent({
  checked,
  onCheckedChange,
  text,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1"
      />
      <span>{text}</span>
    </label>
  );
}

function Actions({
  step,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continua",
}: {
  step: number;
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-9 flex items-center justify-between border-t pt-6">
      <Button
        type="button"
        variant="ghost"
        disabled={step === 0}
        onClick={onBack}
      >
        <ArrowLeft className="size-4" /> Indietro
      </Button>
      <Button
        type={step === 0 ? "submit" : "button"}
        disabled={nextDisabled}
        onClick={onNext}
        className="rounded-full bg-[#103d3a] px-6"
      >
        {nextLabel} <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function AsideSummary({ step, files }: { step: number; files: number }) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <div className="rounded-2xl bg-[#103d3a] p-6 text-white">
        <Sparkles className="size-6 text-lime-300" />
        <h3 className="mt-5 text-lg font-semibold">Cosa analizzerà il sistema</h3>
        <ul className="mt-5 space-y-4 text-sm text-white/70">
          {[
            "Dati e date leggibili",
            "Possibili vizi del verbale",
            "Documenti o informazioni mancanti",
            "Termini indicativi",
            "Percorso da approfondire",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <Check className="mt-0.5 size-4 shrink-0 text-lime-300" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-white p-6 text-sm">
        <p className="font-semibold">Riepilogo</p>
        <div className="mt-4 flex justify-between border-b py-3 text-slate-600">
          <span>Documenti</span>
          <span>{files || "Da caricare"}</span>
        </div>
        <div className="flex justify-between border-b py-3 text-slate-600">
          <span>Avanzamento</span>
          <span>{(step + 1) * 25}%</span>
        </div>
        <div className="flex justify-between pt-3 font-semibold">
          <span>Modalità</span>
          <span>OCR + regole + AI</span>
        </div>
      </div>
    </aside>
  );
}

function Report({ report }: { report: ScreeningReport }) {
  const accent =
    report.outcome === "Alto interesse all’approfondimento"
      ? "border-amber-200 bg-amber-50/40 text-amber-950"
      : report.outcome === "Medio interesse all’approfondimento"
        ? "border-sky-200 bg-sky-50/40 text-sky-950"
        : "border-emerald-200 bg-emerald-50/40 text-emerald-900";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <CheckCircle2 className="size-3.5" /> Analisi completata
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Il tuo report preliminare
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Generato il{" "}
            {new Intl.DateTimeFormat("it-IT", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date())}
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="size-4" /> Stampa report
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className={accent}>
            <CardContent className="p-7">
              <div>
                <p className="text-sm opacity-70">1. Esito preliminare</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {report.outcome}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {report.summary}
                </p>
              </div>
            </CardContent>
          </Card>

          <ReportSection
            title="2. Dati estratti dal verbale"
            icon={ClipboardList}
          >
            <ExtractedDataGrid items={report.extractedData} />
            <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-4">
              <InfoBox
                label="Metodo"
                value={report.analysisMethod}
                note="OCR e regole, con Gemini quando disponibile"
              />
              <InfoBox
                label="Qualità estrazione"
                value={`${report.confidence}%`}
                note="Misura tecnica, non probabilità di esito"
              />
              <InfoBox
                label="Analisi AI"
                value={
                  report.aiExecution.promptExecuted
                    ? "Completata"
                    : "Non disponibile"
                }
                note={
                  report.aiExecution.promptExecuted
                    ? `${report.aiExecution.provider} · ${report.aiExecution.model}`
                    : "Il report è stato prodotto senza interrompere l’analisi."
                }
              />
              <InfoBox
                label="Motore regole"
                value={report.rulesEngineUsed ? "Usato: sì" : "Usato: no"}
                note="Controlli deterministici applicati al testo estratto"
              />
            </div>
          </ReportSection>

          <ReportSection title="3. Norma individuata" icon={Gavel}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBox
                label="Articolo"
                value={report.violatedRule.article}
                note={`Affidabilità: ${report.violatedRule.confidence}`}
              />
              <InfoBox
                label="Comma"
                value={report.violatedRule.paragraph}
                note={`Affidabilità: ${
                  report.extractedData.find((item) => item.key === "paragraph")
                    ?.confidence ?? "Non rilevato"
                }`}
              />
            </div>
            <div className="rounded-xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Classificazione preliminare
                  </p>
                  <p className="mt-2 font-semibold">
                    {report.violationClassification.value}
                  </p>
                </div>
                <ConfidenceBadge
                  confidence={report.violationClassification.confidence}
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {report.violatedRule.description}
              </p>
            </div>
          </ReportSection>

          <ReportSection
            title="4. Descrizione dell’accaduto"
            icon={FileText}
          >
            <p className="rounded-xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
              {report.eventSummary}
            </p>
          </ReportSection>

          <ReportSection
            title="5. Possibili elementi da approfondire"
            icon={BadgeCheck}
          >
            {report.reasons.length > 0 ? (
              report.reasons.map((reason) => (
                <Reason
                  key={`${reason.title}-${reason.evidence}`}
                  title={reason.title}
                  strength={`Rilevanza ${reason.relevance.toLowerCase()}`}
                  text={reason.evidence}
                  legalBasis={reason.legalBasis}
                  needsVerification={reason.needsVerification}
                />
              ))
            ) : (
              <p className="text-sm text-slate-600">
                Dal solo documento caricato non emergono criticità evidenti.
                Potrebbe comunque essere utile una verifica professionale in
                presenza di ulteriori documenti o circostanze.
              </p>
            )}
          </ReportSection>

          <ReportSection
            title="6. Termini di ricorso"
            icon={CalendarDays}
          >
            {report.deadlines.map((deadline) => (
              <div
                key={`${deadline.label}-${deadline.date}`}
                className="rounded-xl border p-5 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{deadline.label}</strong>
                  <span className="font-medium text-[#0f756d]">
                    {deadline.date}
                  </span>
                </div>
                <p className="mt-2 leading-6 text-slate-600">
                  {deadline.basis}
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  {deadline.caution}
                </p>
              </div>
            ))}
          </ReportSection>

          <ReportSection
            title="7. Convenienza economica preliminare"
            icon={FileSearch}
          >
            <InfoBox
              label="Livello"
              value={`Convenienza ${report.economicConvenience.level.toLowerCase()}`}
              note={report.economicConvenience.reason}
            />
            <p className="rounded-xl border border-[#dbe8e4] bg-[#eef5f3] p-5 text-sm font-medium leading-7 text-[#174c48]">
              {report.economicConvenience.possiblePackage}
            </p>
          </ReportSection>

          <ReportSection title="8. Raccomandazione finale" icon={Scale}>
            <p className="rounded-xl bg-[#eef5f3] p-5 text-sm leading-7 text-slate-700">
              {report.finalRecommendation}
            </p>
            <InfoBox
              label="Qualità documenti"
              value={report.documentQuality}
              note={report.suggestedPath.risks}
            />
          </ReportSection>

          <ReportSection title="Fonti da verificare" icon={BookOpen}>
            {report.sources.length > 0 ? (
              report.sources.map((source) => (
                <div
                  key={`${source.reference}-${source.title}`}
                  className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="text-slate-900">{source.title}</strong>
                    <Badge variant="secondary">
                      {source.verificationStatus}
                    </Badge>
                  </div>
                  <p className="mt-1">{source.reference}</p>
                  <p className="mt-2 leading-6">{source.whyRelevant}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                Nessuna fonte specifica indicata.
              </p>
            )}
          </ReportSection>

          {(report.criticalities.length > 0 ||
            report.missingDocuments.length > 0) && (
            <ReportSection title="Criticità e integrazioni" icon={AlertCircle}>
              <BulletList
                items={[
                  ...report.criticalities,
                  ...report.missingDocuments.map(
                    (item) => `Documento utile: ${item}`,
                  ),
                ]}
              />
            </ReportSection>
          )}

          <ReportSection title="Testo estratto dal verbale" icon={FileText}>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200">
              {report.extractedTextPreview ||
                "Nessun testo sufficientemente leggibile."}
            </pre>
          </ReportSection>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl bg-[#103d3a] p-6 text-white">
            <Scale className="size-6 text-lime-300" />
            <h3 className="mt-5 text-lg font-semibold">
              Prossimo step consigliato
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {report.nextStep}
            </p>
            <Button
              className="mt-6 w-full rounded-full bg-lime-300 text-[#153a35] hover:bg-lime-200"
              asChild
            >
              <Link href="/consulenza">Richiedi una revisione</Link>
            </Button>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <p className="font-semibold">Costi orientativi</p>
            <div className="mt-4 space-y-4 text-sm">
              {report.estimatedCosts.map((cost) => (
                <div key={`${cost.label}-${cost.amount}`}>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{cost.label}</span>
                    <span className="text-right font-medium">{cost.amount}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {cost.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-amber-50 p-5 text-xs leading-5 text-amber-900">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            {report.disclaimer}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReportSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#e6f2ee] text-[#0f756d]">
            <Icon className="size-5" />
          </span>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function Reason({
  title,
  strength,
  text,
  legalBasis,
  needsVerification,
}: {
  title: string;
  strength: string;
  text: string;
  legalBasis: string;
  needsVerification: boolean;
}) {
  return (
    <div className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <Badge variant="secondary">{strength}</Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        <strong>Base indicata:</strong> {legalBasis}
      </p>
      {needsVerification && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Riferimento da verificare prima di procedere.
        </p>
      )}
    </div>
  );
}

function InfoBox({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#0f756d]">{note}</p>
    </div>
  );
}

function BulletList({
  items,
  empty = "Nessun elemento.",
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"
        >
          <Check className="mt-1 size-4 shrink-0 text-[#0f756d]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ExtractedDataGrid({
  items,
}: {
  items: ScreeningReport["extractedData"];
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-xl border p-4">
          <dt className="flex items-start justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {item.label}
            </span>
            <ConfidenceBadge confidence={item.confidence} />
          </dt>
          <dd className="mt-3 font-medium leading-6">{item.value}</dd>
          <dd className="mt-2 text-xs text-slate-500">
            Affidabilità: {item.confidence}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: ScreeningReport["extractedData"][number]["confidence"];
}) {
  const className =
    confidence === "Alta"
      ? "bg-emerald-100 text-emerald-800"
      : confidence === "Media"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return (
    <Badge variant="secondary" className={className}>
      {confidence}
    </Badge>
  );
}
