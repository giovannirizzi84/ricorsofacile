import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  CircleDollarSign,
  FileCheck2,
  FileDown,
  FileSearch,
  FileText,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { packages } from "@/lib/content";

const steps = [
  {
    icon: UploadCloud,
    title: "Carica il verbale",
    description: "Allega una foto o il PDF della multa in pochi passaggi.",
  },
  {
    icon: ScanSearch,
    title: "L’AI analizza il documento",
    description:
      "L’intelligenza artificiale analizza automaticamente il documento.",
  },
  {
    icon: FileCheck2,
    title: "Ricevi il report preliminare",
    description:
      "Consulta criticità, termini e aspetti che potrebbero meritare verifica.",
  },
];

const reportItems = [
  "Sintesi del verbale",
  "Possibili criticità rilevate",
  "Termine per il ricorso",
  "Valutazione preliminare",
  "Report PDF scaricabile",
];

const faqs = [
  {
    question: "Lo screening garantisce l’annullamento della multa?",
    answer:
      "No. Lo screening individua esclusivamente elementi che potrebbero meritare approfondimento.",
  },
  {
    question: "Lo screening sostituisce il parere di un avvocato?",
    answer: "No. Lo screening è uno strumento informativo preliminare.",
  },
  {
    question: "Quanto tempo richiede?",
    answer: "Circa 60 secondi.",
  },
  {
    question: "Posso richiedere assistenza professionale successivamente?",
    answer:
      "Sì. Dopo lo screening potrai valutare se richiedere una consulenza o un ricorso professionale.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#0d3431] text-white">
        <div className="soft-grid absolute inset-0 opacity-50" />
        <div className="absolute -left-32 top-20 size-96 rounded-full bg-[#85d7c8]/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 size-[32rem] rounded-full bg-lime-300/10 blur-3xl" />
        <div className="page-shell relative grid min-h-[680px] items-center gap-14 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-medium text-white/85">
              <Sparkles className="size-4 text-lime-300" />
              Screening AI preliminare di verbali stradali
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.05em] sm:text-6xl lg:text-[4.25rem]">
              Scopri in 60 secondi se la tua multa presenta{" "}
              <span className="text-lime-300">elementi da approfondire</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
              Carica il verbale e ricevi un’analisi preliminare automatizzata
              con possibili criticità, termini per il ricorso e valutazione
              della convenienza economica.
            </p>
            <Button
              size="lg"
              className="mt-9 h-14 rounded-full bg-lime-300 px-7 text-base font-semibold text-[#153a35] shadow-[0_14px_40px_rgba(198,242,100,.2)] hover:bg-lime-200"
              asChild
            >
              <Link href="/analizza">
                Analizza la tua multa
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/68">
              <span className="inline-flex items-center gap-2">
                <LockKeyhole className="size-4 text-lime-300" />
                Documenti trattati in modo riservato
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleDollarSign className="size-4 text-lime-300" />
                €0,99 una tantum
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheck className="size-4 text-lime-300" />
                Nessun abbonamento
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[31rem] lg:justify-self-end">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-white/7 blur-xl" />
            <div className="relative rotate-[1.5deg] rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-sm">
              <div className="rounded-[1.45rem] bg-white p-6 text-[#102b2a] sm:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0f756d]">
                      Screening completato
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      Analisi preliminare
                    </p>
                  </div>
                  <div className="grid size-11 place-items-center rounded-xl bg-[#eaf3f0] text-[#0f756d]">
                    <FileSearch className="size-5" />
                  </div>
                </div>
                <div className="mt-6 rounded-2xl border border-[#dce9e5] bg-[#f5f8f7] p-5">
                  <p className="text-xs font-medium text-slate-500">
                    Valutazione generale
                  </p>
                  <p className="mt-1 font-semibold text-[#123d3a]">
                    Interesse medio all’approfondimento
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#dce9e5]">
                    <div className="h-full w-3/5 rounded-full bg-[#e9a23b]" />
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                    Importo identificato
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleCheck className="size-4 shrink-0 text-emerald-600" />
                    Termine di ricorso individuato
                  </div>
                  <div className="flex items-center gap-3">
                    <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                    Possibile criticità nella motivazione
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t pt-5">
                  <div>
                    <p className="text-xs text-slate-500">Termini rilevati</p>
                    <p className="mt-1 text-sm font-semibold">
                      30 e 60 giorni
                    </p>
                  </div>
                  <span className="rounded-full bg-[#123d3a] px-4 py-2 text-xs font-semibold text-white">
                    Report pronto
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="page-shell flex flex-col items-center justify-center gap-4 py-7 text-center text-sm text-slate-600 sm:flex-row sm:gap-8">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#0f756d]" />
            Screening informativo preliminare
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Risposta chiara, senza tecnicismi inutili</span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" />
          <span>Nessuna garanzia di esito del ricorso</span>
        </div>
      </section>

      <section className="section-space bg-white" id="come-funziona">
        <div className="page-shell">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
              Come funziona
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Dal verbale a un quadro più chiaro
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Tre passaggi semplici per capire quali elementi potrebbero
              meritare un approfondimento.
            </p>
          </div>
          <div className="relative mt-14 grid gap-5 md:grid-cols-3">
            <div className="absolute left-[17%] right-[17%] top-10 hidden border-t border-dashed border-[#a9c9c2] md:block" />
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="relative rounded-3xl border bg-[#f7faf9] p-7 text-center"
                >
                  <div className="relative mx-auto grid size-20 place-items-center rounded-2xl border bg-white text-[#0f756d] shadow-sm">
                    <Icon className="size-7" />
                    <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-[#103d3a] font-mono text-xs font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-7 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space overflow-hidden bg-[#edf4f1]">
        <div className="page-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
              Esempio di report
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Sai cosa riceverai, prima di iniziare
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Un report leggibile che organizza i dati del verbale e mette in
              evidenza gli aspetti da verificare.
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#0f756d]/8 blur-3xl" />
            <article className="relative overflow-hidden rounded-[2rem] border border-[#d5e4df] bg-white shadow-[0_28px_90px_rgba(13,52,49,.13)]">
              <div className="flex flex-col gap-5 border-b bg-[#103d3a] px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-300">
                    Analisi preliminare verbale
                  </p>
                  <p className="mt-2 font-mono text-xs text-white/55">
                    Documento di esempio · MO-2026-0142
                  </p>
                </div>
                <span className="w-fit rounded-full border border-lime-300/35 bg-lime-300/12 px-4 py-2 text-xs font-semibold text-lime-200">
                  Anteprima illustrativa
                </span>
              </div>

              <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-12">
                <div>
                  <section className="rounded-2xl border border-[#dce9e5] bg-[#f6f9f8] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Valutazione generale
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                        <FileSearch className="size-5" />
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-[#123d3a]">
                          Interesse medio all’approfondimento
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Sono emersi elementi che meritano una verifica.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="mt-8">
                    <h3 className="text-base font-semibold">
                      Elementi rilevati
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {[
                        "Importo identificato",
                        "Termine di ricorso individuato",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/65 p-4 text-sm"
                        >
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          {item}
                        </div>
                      ))}
                      {[
                        "Possibile criticità nella motivazione",
                        "Opportuno approfondire la documentazione allegata",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-sm"
                        >
                          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="mt-8 rounded-2xl bg-[#f6f9f8] p-6">
                    <h3 className="text-base font-semibold">
                      Possibili aspetti da approfondire
                    </h3>
                    <ul className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      {[
                        "Correttezza procedurale",
                        "Motivazione del verbale",
                        "Documentazione probatoria",
                      ].map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#0f756d]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <aside className="space-y-5">
                  <div className="rounded-2xl border p-6">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-[#eaf3f0] text-[#0f756d]">
                        <CalendarClock className="size-5" />
                      </div>
                      <h3 className="font-semibold">Termini rilevati</h3>
                    </div>
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between border-b pb-4 text-sm">
                        <span className="text-slate-600">Prefetto</span>
                        <strong>60 giorni</strong>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          Giudice di Pace
                        </span>
                        <strong>30 giorni</strong>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#103d3a] p-6 text-white">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-lime-300">
                      Conclusione
                    </p>
                    <p className="mt-4 leading-7 text-white/82">
                      L’analisi automatizzata ha individuato alcuni elementi
                      che potrebbero meritare approfondimento.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-5 text-amber-900">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    Esempio dimostrativo. Il contenuto effettivo dipende dai
                    dati presenti nel verbale caricato.
                  </div>
                </aside>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell grid items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
              Cosa ricevi
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Le informazioni essenziali, organizzate per decidere con calma
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Lo screening trasforma il contenuto del verbale in una sintesi
              comprensibile e consultabile.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reportItems.map((item, index) => {
              const icons = [
                FileText,
                FileSearch,
                CalendarClock,
                ScanSearch,
                FileDown,
              ];
              const Icon = icons[index];
              return (
                <div
                  key={item}
                  className={`flex items-center gap-4 rounded-2xl border bg-[#f8faf9] p-5 ${
                    index === reportItems.length - 1
                      ? "sm:col-span-2"
                      : ""
                  }`}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e3efeb] text-[#0f756d]">
                    <Icon className="size-5" />
                  </div>
                  <p className="font-semibold">{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space bg-[#f6f9f8]" id="prezzo">
        <div className="page-shell">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
              Soluzioni disponibili
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Inizia dallo screening, approfondisci solo se serve
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Scegli il livello di supporto più adatto al tuo caso.
            </p>
          </div>

          <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
            {packages.map((item) => (
              <article
                key={item.name}
                className={`relative flex flex-col rounded-[2rem] border p-7 sm:p-8 ${
                  item.featured
                    ? "border-[#0f756d] bg-[#103d3a] text-white shadow-[0_24px_70px_rgba(13,52,49,.18)] lg:-translate-y-3"
                    : "bg-white"
                }`}
              >
                {item.featured && (
                  <span className="absolute right-6 top-6 rounded-full bg-lime-300 px-3 py-1 text-xs font-bold text-[#153a35]">
                    {item.badge}
                  </span>
                )}
                <p
                  className={`text-sm font-bold uppercase tracking-[0.15em] ${
                    item.featured ? "text-lime-300" : "text-[#0f756d]"
                  }`}
                >
                  {item.name}
                </p>
                <div className="mt-7 flex items-end gap-2">
                  {"previousPrice" in item && item.previousPrice && (
                    <span
                      className={`pb-1 text-lg line-through ${
                        item.featured ? "text-white/45" : "text-slate-400"
                      }`}
                    >
                      {item.previousPrice}
                    </span>
                  )}
                  <span className="text-5xl font-semibold tracking-[-0.05em]">
                    {item.price}
                  </span>
                </div>
                <p
                  className={`mt-5 min-h-16 text-sm leading-6 ${
                    item.featured ? "text-white/68" : "text-slate-600"
                  }`}
                >
                  {item.description}
                </p>
                <div
                  className={`my-6 h-px ${
                    item.featured ? "bg-white/12" : "bg-slate-200"
                  }`}
                />
                <ul className="flex-1 space-y-4 text-sm">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full ${
                          item.featured
                            ? "bg-lime-300/15 text-lime-300"
                            : "bg-[#e3efeb] text-[#0f756d]"
                        }`}
                      >
                        <Check className="size-4" />
                      </span>
                      <span className={item.featured ? "text-white/85" : ""}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={item.featured ? "default" : "outline"}
                  className={`mt-8 h-12 w-full rounded-full ${
                    item.featured
                      ? "bg-lime-300 font-semibold text-[#153a35] hover:bg-lime-200"
                      : ""
                  }`}
                  asChild
                >
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-white" id="faq">
        <div className="page-shell grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
              Domande frequenti
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Prima di iniziare
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
              Risposte chiare sui tempi e sui limiti dello screening.
            </p>
          </div>
          <Accordion
            type="single"
            collapsible
            className="overflow-hidden rounded-2xl border px-6 sm:px-8"
          >
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.question} value={`faq-${index}`}>
                <AccordionTrigger className="py-6 text-base font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pr-8 text-base leading-7 text-slate-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="pb-20 sm:pb-24">
        <div className="page-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#103d3a] px-6 py-14 text-center text-white sm:px-12 lg:py-20">
            <div className="soft-grid absolute inset-0 opacity-35" />
            <div className="relative">
              <FileSearch className="mx-auto size-8 text-lime-300" />
              <h2 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Non sai quale soluzione scegliere?
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
                Inizia dallo Screening AI a €0,99. Riceverai una valutazione
                preliminare e potrai decidere successivamente se approfondire
                con un professionista.
              </p>
              <Button
                size="lg"
                className="mt-8 h-14 rounded-full bg-lime-300 px-7 text-base font-semibold text-[#153a35] hover:bg-lime-200"
                asChild
              >
                <Link href="/analizza">
                  Analizza la tua multa
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-[#fffdf7] py-8">
        <div className="page-shell flex gap-4 text-sm leading-6 text-slate-600">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#0f756d]" />
          <p>
            <strong className="text-[#102b2a]">Nota importante.</strong> Questa
            analisi è uno screening preliminare automatizzato e non costituisce
            parere legale, consulenza professionale o garanzia di accoglimento
            del ricorso.
          </p>
        </div>
      </section>
    </>
  );
}
