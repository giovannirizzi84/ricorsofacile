import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Banknote, BookOpenCheck, Check, ChevronRight,
  Clock3, FileCheck2, FileText, FolderLock, Gauge, Headphones, Laptop2,
  Scale, ShieldCheck, Sparkles, UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/section-heading";

const benefits = [
  [Laptop2, "Tutto online", "Carica i documenti e segui la pratica da qualsiasi dispositivo."],
  [Banknote, "Costi trasparenti", "Sai sempre cosa stai pagando, senza sorprese o formule poco chiare."],
  [Clock3, "Risparmi tempo", "Lo screening preliminare richiede pochi minuti e ti orienta subito."],
  [FolderLock, "Documenti protetti", "I file restano organizzati nella tua area riservata."],
  [BookOpenCheck, "Fonti tracciabili", "Normativa e giurisprudenza vengono collegate ai motivi individuati."],
  [Gauge, "Pratica monitorata", "Controlli stato, scadenze e prossime attività in un unico posto."],
];

const steps = [
  [UploadCloud, "Carica il verbale", "Inserisci i dati essenziali e allega foto o PDF della multa."],
  [Sparkles, "Avvia lo screening", "Il sistema legge i documenti e verifica le possibili criticità."],
  [FileCheck2, "Ricevi il report", "Ottieni esito, motivi rilevati, termini e percorso suggerito."],
  [Scale, "Decidi come procedere", "Puoi fermarti al report o affidare il ricorso al nostro team."],
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#0e3432] text-white">
        <div className="soft-grid absolute inset-0 opacity-60" />
        <div className="absolute -right-28 top-12 size-96 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="page-shell relative grid min-h-[720px] items-center gap-14 py-20 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80">
              <ShieldCheck className="size-4 text-lime-300" />
              Screening preliminare semplice, rapido, trasparente
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Hai ricevuto una multa? <span className="text-lime-300">Scopri se puoi fare ricorso.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
              Carica il verbale, ricevi uno screening AI preliminare e, se ci sono basi concrete, pensiamo noi al ricorso.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-14 rounded-full bg-lime-300 px-7 text-base font-semibold text-[#153a35] hover:bg-lime-200" asChild>
                <Link href="/analizza">Prova l’analisi AI <ArrowRight className="ml-1 size-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 rounded-full border-white/25 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/consulenza">Prenota una consulenza</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
              {["Analisi reale dei documenti", "Test senza pagamento", "Nessun abbonamento"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><Check className="size-4 text-lime-300" />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-white/5 blur-xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white p-3 text-[#102b2a] shadow-2xl">
              <div className="rounded-[1.4rem] bg-[#f5f8f7] p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e7773]">Anteprima report</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">RF-2026-01842</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Analisi completata</span>
                </div>
                <div className="mt-7 rounded-2xl border bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Esito preliminare</p>
                      <h3 className="mt-1 text-xl font-semibold">Ricorso potenzialmente fondato</h3>
                    </div>
                    <div className="grid size-16 shrink-0 place-items-center rounded-full border-[6px] border-emerald-100 text-lg font-bold text-emerald-700">78%</div>
                  </div>
                  <div className="my-6 h-px bg-slate-100" />
                  <p className="text-sm font-medium">2 motivi rilevati</p>
                  <div className="mt-3 space-y-3">
                    {["Possibile notifica oltre i termini", "Carenza nella motivazione"].map((item) => (
                      <div key={item} className="flex gap-3 rounded-xl bg-[#f2f7f5] p-3 text-sm">
                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#0f756d]" /> {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-[#123d3a] px-5 py-4 text-white">
                  <div>
                    <p className="text-xs text-white/60">Termine stimato</p>
                    <p className="font-semibold">24 giorni rimanenti</p>
                  </div>
                  <ChevronRight className="size-5 text-lime-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="page-shell grid gap-6 py-8 text-center sm:grid-cols-3">
          <div><p className="text-2xl font-semibold">2 minuti</p><p className="mt-1 text-sm text-slate-500">per caricare i documenti</p></div>
          <div className="border-y py-6 sm:border-x sm:border-y-0 sm:py-0"><p className="text-2xl font-semibold">Test attivo</p><p className="mt-1 text-sm text-slate-500">pagamento temporaneamente disattivato</p></div>
          <div><p className="text-2xl font-semibold">100% online</p><p className="mt-1 text-sm text-slate-500">dall’analisi al monitoraggio</p></div>
        </div>
      </section>

      <section className="section-space bg-white" id="come-funziona">
        <div className="page-shell">
          <SectionHeading eyebrow="Come funziona" title="Dal verbale a una decisione più consapevole" description="Un percorso guidato, costruito per rendere comprensibili documenti, scadenze e opzioni." align="center" />
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([Icon, title, text], index) => (
              <Card key={String(title)} className="relative border-0 bg-[#f3f7f5] shadow-none">
                <CardContent className="p-7">
                  <span className="absolute right-6 top-5 font-mono text-sm text-slate-400">0{index + 1}</span>
                  <div className="grid size-12 place-items-center rounded-2xl bg-white text-[#0f5752] shadow-sm"><Icon className="size-5" /></div>
                  <h3 className="mt-7 text-xl font-semibold">{title as string}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text as string}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="link" className="text-[#0f5752]" asChild><Link href="/come-funziona">Scopri il processo completo <ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="page-shell">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <SectionHeading eyebrow="Perché sceglierci" title="Meno incertezza, più controllo sulla tua pratica" />
            <p className="max-w-xl text-lg leading-8 text-slate-600 lg:justify-self-end">La tecnologia organizza e confronta le informazioni. Tu mantieni sempre il controllo sulle decisioni e puoi richiedere la revisione di un professionista.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([Icon, title, text]) => (
              <div key={String(title)} className="rounded-2xl border bg-white p-7 shadow-sm">
                <Icon className="size-6 text-[#0f756d]" />
                <h3 className="mt-5 text-lg font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell grid items-center gap-12 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#eaf2ef] p-7 sm:p-10">
            <div className="rounded-2xl bg-white p-6 shadow-soft">
              <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#103d3a] text-lime-300"><FileText className="size-5" /></div><div><p className="font-semibold">Fonti considerate</p><p className="text-xs text-slate-500">Aggiornamento e tracciabilità</p></div></div>
              <div className="mt-6 space-y-3">
                {["Codice della Strada e Regolamento", "Legge 689/1981", "Cassazione e Giudici di Pace", "Prassi prefettizie e orientamenti recenti"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border p-4 text-sm"><BookOpenCheck className="size-4 text-[#0f756d]" />{item}</div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">Ogni report indica le fonti utilizzate. Il collegamento a banche dati reali è predisposto come integrazione futura.</div>
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Tecnologia trasparente" title="L’AI cerca segnali. Le decisioni restano umane." description="OCR, recupero delle fonti e scoring lavorano insieme per produrre una valutazione leggibile, motivata e verificabile." />
            <Button className="mt-8 rounded-full bg-[#103d3a] px-6" asChild><Link href="/analizza">Inizia lo screening <ArrowRight className="size-4" /></Link></Button>
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="page-shell">
          <div className="overflow-hidden rounded-[2.2rem] bg-[#103d3a] px-6 py-14 text-center text-white sm:px-12 lg:py-20">
            <Headphones className="mx-auto size-8 text-lime-300" />
            <h2 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Non sei sicuro da dove iniziare?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">Carica la multa per uno screening rapido oppure raccontaci il caso e richiedi una consulenza personalizzata.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full bg-lime-300 text-[#153a35] hover:bg-lime-200" asChild><Link href="/analizza">Prova l’analisi AI</Link></Button>
              <Button size="lg" variant="outline" className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild><Link href="/consulenza">Parla con il team</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-[#fffdf7] py-8">
        <div className="page-shell flex gap-4 text-sm leading-6 text-slate-600">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#0f756d]" />
          <p><strong className="text-[#102b2a]">Nota importante.</strong> Il servizio di screening AI fornisce una valutazione preliminare automatizzata e non costituisce parere legale, consulenza professionale o garanzia di accoglimento del ricorso.</p>
        </div>
      </section>
    </>
  );
}
