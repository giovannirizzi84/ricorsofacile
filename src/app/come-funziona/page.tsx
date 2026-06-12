import Link from "next/link";
import { ArrowRight, BrainCircuit, Database, FileSearch, ScanText, ShieldCheck, UserCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const stages = [
  ["01", "Raccolta dei dati", "Compili un percorso guidato con data di notifica, ente, importo e tipo di violazione."],
  ["02", "Acquisizione documenti", "Carichi il verbale e gli allegati utili in PDF o immagine."],
  ["03", "Lettura e classificazione", "Il modulo OCR mock estrae dati, date, riferimenti e possibili anomalie."],
  ["04", "Ricerca delle fonti", "L’architettura RAG recupera norme, prassi e orientamenti collegati al caso."],
  ["05", "Scoring e report", "Il sistema assegna un indicatore di sostenibilità e spiega i motivi rilevati."],
  ["06", "Revisione e ricorso", "Se scegli di proseguire, il team verifica i documenti e prepara la pratica."],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="Il processo" title="Una procedura chiara, dall’upload alla decisione" description="Ogni passaggio è pensato per ridurre l’incertezza e rendere visibili fonti, scadenze e prossime azioni.">
        <Button className="rounded-full bg-lime-300 text-[#153a35] hover:bg-lime-200" asChild><Link href="/analizza">Prova lo screening <ArrowRight className="size-4" /></Link></Button>
      </PageHero>
      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading eyebrow="Passo dopo passo" title="Sai sempre cosa sta succedendo" description="Lo screening non restituisce solo un numero: ordina le informazioni e motiva l’esito." />
          <div className="mt-14 grid gap-x-10 gap-y-5 lg:grid-cols-2">
            {stages.map(([number, title, text]) => (
              <div key={number} className="grid grid-cols-[54px_1fr] gap-5 rounded-2xl border p-6">
                <span className="font-mono text-lg font-semibold text-[#0f756d]">{number}</span>
                <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-space">
        <div className="page-shell">
          <SectionHeading eyebrow="Architettura predisposta" title="Modulare oggi, integrabile domani" align="center" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [Database, "Database delle fonti", "Norme, sentenze e prassi catalogate per argomento e data."],
              [ScanText, "Modulo OCR", "Estrazione strutturata dei dati dal verbale e dagli allegati."],
              [FileSearch, "Motore RAG", "Recupero delle fonti più pertinenti rispetto al caso."],
              [BrainCircuit, "Scoring ricorso", "Valutazione ponderata di motivi, criticità e documenti."],
              [ShieldCheck, "Log e tracciabilità", "Registro delle fonti e dei passaggi usati nel report."],
              [UserCheck, "Revisione professionale", "Punto di controllo umano prima della gestione operativa."],
            ].map(([Icon, title, text]) => (
              <div key={String(title)} className="rounded-2xl bg-white p-7 shadow-sm">
                <Icon className="size-6 text-[#0f756d]" />
                <h3 className="mt-5 font-semibold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
