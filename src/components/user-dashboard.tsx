import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileCheck2,
  FilePlus2,
  FileSearch,
  FileText,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const practiceStatuses = [
  "Caricato",
  "Analizzato",
  "Da approfondire",
  "Consulenza richiesta",
  "Chiuso",
];

const sections = [
  [FileSearch, "Le mie analisi", "0", "Screening preliminari avviati"],
  [FileText, "Verbali caricati", "0", "Documenti presenti nell’area"],
  [FileCheck2, "Report disponibili", "0", "Report pronti da consultare"],
];

export function UserDashboard() {
  return (
    <section className="min-h-[70vh] bg-[#f4f7f6] py-10 sm:py-14">
      <div className="page-shell">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-[#103d3a] p-7 text-white sm:flex-row sm:items-end sm:justify-between sm:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">
              Area MulteOnline
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Le tue analisi, in un unico posto
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Consulta i verbali caricati, i report disponibili e lo stato di
              eventuali richieste di approfondimento professionale.
            </p>
          </div>
          <Button
            className="h-12 shrink-0 rounded-full bg-lime-300 px-6 font-semibold text-[#153a35] hover:bg-lime-200"
            asChild
          >
            <Link href="/analizza">
              <FilePlus2 className="size-4" /> Carica una multa
            </Link>
          </Button>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {sections.map(([Icon, title, value, note]) => (
            <article key={String(title)} className="rounded-2xl border bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">{title as string}</p>
                  <p className="mt-3 text-4xl font-semibold">{value as string}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-xl bg-[#e8f2ef] text-[#0f756d]">
                  <Icon className="size-5" />
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-500">{note as string}</p>
            </article>
          ))}
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-[1.75rem] border bg-white p-7 sm:p-9">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Le mie analisi</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Verbali caricati e report generati compariranno qui.
                </p>
              </div>
              <Badge variant="secondary">0 analisi</Badge>
            </div>

            <div className="mt-8 grid min-h-80 place-items-center rounded-2xl border border-dashed bg-[#f8faf9] px-6 py-12 text-center">
              <div className="max-w-md">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white text-[#0f756d] shadow-sm">
                  <FolderOpen className="size-7" />
                </span>
                <h3 className="mt-6 text-xl font-semibold">
                  Non hai ancora caricato nessuna multa.
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Carica il tuo primo verbale e ricevi uno screening
                  preliminare.
                </p>
                <Button className="mt-6 h-11 rounded-full bg-[#103d3a] px-6" asChild>
                  <Link href="/analizza">
                    Carica una multa <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border bg-white p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#e8f2ef] text-[#0f756d]">
                  <BarChart3 className="size-5" />
                </span>
                <h2 className="font-semibold">Stato pratica</h2>
              </div>
              <div className="mt-6 space-y-3">
                {practiceStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl bg-[#f7f9f8] px-4 py-3 text-sm"
                  >
                    <span>{status}</span>
                    <span className="font-mono text-xs text-slate-400">0</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-[#e8f2ef] p-7">
              <BriefcaseBusiness className="size-6 text-[#0f756d]" />
              <h2 className="mt-5 text-lg font-semibold">
                Richiedi approfondimento professionale
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Dopo lo screening puoi sottoporre il verbale e il report a un
                professionista per una valutazione del caso concreto.
              </p>
              <Button variant="outline" className="mt-6 rounded-full bg-white" asChild>
                <Link href="/consulenza">Scopri il servizio</Link>
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
