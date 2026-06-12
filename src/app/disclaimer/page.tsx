import { LegalPage } from "@/components/legal-page";

export default function DisclaimerPage() {
  return <LegalPage eyebrow="Avvertenza importante" title="Disclaimer legale" description="Limiti e natura della valutazione preliminare automatizzata." sections={[
    { title: "Natura dello screening", text: "Il servizio di screening AI fornisce una valutazione preliminare automatizzata e non costituisce parere legale, consulenza professionale o garanzia di accoglimento del ricorso." },
    { title: "Fonti e documenti", text: "Le informazioni sono elaborate sulla base dei documenti caricati dall’utente e delle fonti disponibili. Dati incompleti, illeggibili o inesatti possono incidere significativamente sul risultato." },
    { title: "Valutazione definitiva", text: "Per una valutazione definitiva è possibile richiedere una consulenza personalizzata. Prima di depositare o inviare un ricorso è opportuno verificare motivi, prove, competenza e termini applicabili al caso concreto." },
    { title: "Scadenze", text: "Le date indicate dal sistema hanno carattere orientativo. L’utente deve verificare le scadenze ufficiali riportate negli atti ricevuti e nella normativa applicabile." },
  ]} />;
}
