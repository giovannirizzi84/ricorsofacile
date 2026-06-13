import Link from "next/link";
import {
  ArrowRight,
  BadgeEuro,
  CalendarClock,
  Check,
  CircleSlash2,
  FileCheck2,
  FileSearch,
  FileText,
  Gavel,
  Landmark,
  ScanSearch,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Carica il verbale",
    text: "Puoi caricare il verbale in formato PDF, come fotografia o come scansione. Per una lettura migliore, includi tutte le pagine e verifica che date, importi e testo siano nitidi.",
    items: ["PDF", "Foto JPG o PNG", "Scansioni da smartphone"],
  },
  {
    number: "02",
    icon: ScanSearch,
    title: "Estrazione dati",
    text: "Il sistema legge il documento e prova a trasformare le informazioni presenti in dati strutturati, senza completare automaticamente ciò che non è leggibile.",
    items: [
      "Ente accertatore e Comune",
      "Numero verbale e targa, se presente",
      "Data e ora della violazione",
      "Data di notifica",
      "Importo della sanzione",
      "Articolo CdS e comma, se presente",
      "Luogo della violazione",
      "Descrizione dell’accaduto",
    ],
  },
  {
    number: "03",
    icon: FileSearch,
    title: "Analisi preliminare",
    text: "Le informazioni estratte vengono sottoposte a controlli automatici orientativi. Ogni segnalazione resta una possibile criticità da verificare sul documento originale.",
    items: [
      "Termini principali",
      "Possibili criticità formali",
      "Coerenza dei dati identificati",
      "Convenienza economica dell’approfondimento",
      "Opportunità di coinvolgere il team legale",
    ],
  },
  {
    number: "04",
    icon: FileCheck2,
    title: "Report finale",
    text: "Ricevi una sintesi ordinata e prudenziale, utile per capire se raccogliere altri documenti o richiedere un approfondimento professionale.",
    items: [
      "Dati estratti",
      "Norma individuata",
      "Descrizione sintetica dell’accaduto",
      "Possibili profili da approfondire",
      "Termini per Prefetto e Giudice di Pace",
      "Raccomandazione prudenziale",
    ],
  },
];

const checks = [
  [CalendarClock, "Notifica", "Date rilevate e termine indicativo tra violazione e notifica."],
  [BadgeEuro, "Importo", "Sanzione ordinaria ed eventuale importo ridotto leggibile."],
  [Gavel, "Articolo CdS", "Articolo e comma indicati nel testo, senza ricostruzioni arbitrarie."],
  [FileText, "Motivazione", "Presenza di una descrizione comprensibile dell’accertamento."],
  [FileCheck2, "Documentazione allegata", "Riferimenti a fotografie, dispositivi o altri allegati utili."],
  [Landmark, "Termini di ricorso", "Scadenze indicative per Prefetto e Giudice di Pace."],
];

const limitations = [
  "Non garantiamo l’annullamento della multa.",
  "Non sostituiamo il parere di un avvocato o di altro professionista.",
  "Non presentiamo automaticamente il ricorso.",
  "Non promettiamo probabilità di vittoria o certezze di successo.",
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="Il processo"
        title="Come funziona MulteOnline"
        description="Carichi il verbale, il sistema estrae le informazioni principali e ricevi un report preliminare con gli elementi che potrebbero meritare approfondimento."
      >
        <Button
          className="h-12 rounded-full bg-lime-300 px-6 font-semibold text-[#153a35] hover:bg-lime-200"
          asChild
        >
          <Link href="/analizza">
            Analizza la tua multa <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHero>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Passo dopo passo"
            title="Dal documento a un quadro più leggibile"
            description="Il percorso è progettato per rendere trasparente cosa viene letto, cosa viene controllato e quali limiti conserva lo screening."
          />
          <div className="mt-14 space-y-5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.number}
                  className="grid gap-7 rounded-[1.75rem] border bg-[#f8faf9] p-6 sm:p-8 lg:grid-cols-[110px_1fr_1fr] lg:items-center"
                >
                  <div className="flex items-center gap-4 lg:block">
                    <span className="font-mono text-sm font-semibold text-[#0f756d]">
                      STEP {step.number}
                    </span>
                    <span className="mt-4 hidden size-14 place-items-center rounded-2xl bg-white text-[#0f756d] shadow-sm lg:grid">
                      <Icon className="size-6" />
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {step.title}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                      {step.text}
                    </p>
                  </div>
                  <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
                    {step.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#e4f0ec] text-[#0f756d]">
                          <Check className="size-3.5" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space bg-[#edf4f1]">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Controlli automatici"
            title="Cosa controlliamo"
            description="Lo screening cerca indicatori leggibili nel verbale e segnala quando un dato importante non viene rilevato."
            align="center"
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map(([Icon, title, text]) => (
              <article key={String(title)} className="rounded-2xl border bg-white p-7">
                <span className="grid size-12 place-items-center rounded-xl bg-[#e5f0ed] text-[#0f756d]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Due livelli distinti"
            title="Automazione per iniziare, team legale quando serve"
            description="MulteOnline mantiene chiaro chi svolge ogni attività e in quale momento del percorso."
            align="center"
          />
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            <article className="rounded-[1.75rem] border bg-[#f7faf9] p-7 sm:p-9">
              <ScanSearch className="size-7 text-[#0f756d]" />
              <h3 className="mt-5 text-2xl font-semibold">Screening AI</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Estrae i dati leggibili e produce un’analisi preliminare
                automatizzata con possibili elementi da approfondire.
              </p>
            </article>
            <article className="rounded-[1.75rem] bg-[#103d3a] p-7 text-white sm:p-9">
              <Gavel className="size-7 text-lime-300" />
              <h3 className="mt-5 text-2xl font-semibold">Team legale</h3>
              <p className="mt-3 text-sm leading-7 text-white/70">
                Esamina le richieste di consulenza o ricorso e valuta caso per
                caso il percorso più appropriato tra Prefetto e Giudice di
                Pace.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-space bg-[#f7faf9]">
        <div className="page-shell grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <span className="grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <ShieldAlert className="size-6" />
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Cosa NON facciamo
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              MulteOnline è uno strumento informativo preliminare. Manteniamo
              chiara la distinzione tra screening automatico e assistenza
              professionale.
            </p>
          </div>
          <div className="grid gap-4">
            {limitations.map((item) => (
              <div key={item} className="flex gap-4 rounded-2xl border p-5">
                <CircleSlash2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <p className="font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 sm:pb-24">
        <div className="page-shell">
          <div className="rounded-[2rem] bg-[#103d3a] px-6 py-14 text-center text-white sm:px-12 lg:py-20">
            <FileSearch className="mx-auto size-8 text-lime-300" />
            <h2 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Inizia dal tuo verbale
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">
              Carica il documento e ricevi una prima lettura strutturata degli
              elementi che potrebbero meritare approfondimento.
            </p>
            <Button
              size="lg"
              className="mt-8 h-14 rounded-full bg-lime-300 px-7 text-base font-semibold text-[#153a35] hover:bg-lime-200"
              asChild
            >
              <Link href="/analizza">
                Analizza la tua multa <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
