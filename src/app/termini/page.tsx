import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Termini e Condizioni",
  description:
    "Termini di utilizzo MulteOnline: screening AI, pagamenti, limiti del servizio, rimborsi e responsabilità.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Condizioni d’uso"
      title="Termini e Condizioni"
      description="Le regole applicabili all’utilizzo dello Screening AI preliminare e dei servizi MulteOnline."
      sections={[
        {
          title: "1. Oggetto del servizio",
          text: "MulteOnline consente all’utente di caricare un verbale o documenti collegati a una sanzione amministrativa e di ricevere uno screening preliminare automatizzato. Il servizio ha finalità informativa e aiuta l’utente a individuare dati, termini e possibili elementi da approfondire.",
        },
        {
          title: "2. Funzionamento dello screening AI",
          text: "Il sistema utilizza strumenti automatici di lettura documentale e modelli di intelligenza artificiale, incluso GPT-4o, per estrarre informazioni e generare un report. Il report può indicare dati rilevati, elementi mancanti, possibili criticità, termini indicativi e una valutazione preliminare della convenienza dell’approfondimento.",
        },
        {
          title: "3. Natura preliminare del report",
          text: "Il report generato costituisce una valutazione preliminare automatizzata a scopo informativo e non sostituisce il parere di un professionista. Lo screening non equivale a consulenza legale personalizzata, non comporta assunzione di incarico professionale e non garantisce l’annullamento della multa o l’accoglimento di un ricorso.",
        },
        {
          title: "4. Limitazioni del servizio",
          text: "La qualità dell’analisi dipende dalla leggibilità dei documenti, dalla completezza delle pagine caricate, dalla qualità delle immagini, dalla correttezza delle informazioni inserite dall’utente e dai limiti tecnici dei sistemi automatici. MulteOnline non garantisce accuratezza del 100% né l’individuazione di ogni possibile vizio o profilo giuridico.",
        },
        {
          title: "5. Assenza di consulenza legale personalizzata",
          text: "Lo Screening AI non fornisce automaticamente consulenza legale personalizzata. Eventuali servizi premium, consulenze professionali o assistenza nella predisposizione di ricorsi saranno oggetto di separata valutazione, conferma e, se necessario, incarico specifico.",
        },
        {
          title: "6. Responsabilità dell’utente",
          text: "L’utente è responsabile della correttezza dei dati inseriti, della legittimità del caricamento dei documenti e del rispetto delle scadenze ufficiali. Prima di assumere decisioni, presentare istanze o proporre ricorsi, l’utente deve verificare documenti, termini, competenza dell’autorità e normativa applicabile.",
        },
        {
          title: "7. Pagamenti Stripe",
          text: "Il pagamento dello Screening AI avviene tramite Stripe Checkout Hosted. L’analisi viene avviata solo dopo verifica del pagamento. MulteOnline non conserva i dati completi della carta. Il prezzo del servizio è mostrato prima del checkout e può variare per eventuali servizi successivi o premium.",
        },
        {
          title: "8. Politica rimborsi",
          text: "Poiché lo Screening AI è un servizio digitale erogato dopo il pagamento e avviato su richiesta dell’utente, il rimborso non è normalmente previsto una volta generato il report. In caso di errore tecnico che impedisca completamente l’erogazione del servizio, l’utente può contattare l’assistenza per una verifica del caso.",
        },
        {
          title: "9. Servizi successivi e costi esterni",
          text: "Eventuali servizi di consulenza, assistenza o ricorso sono separati dallo Screening AI e possono avere condizioni e prezzi differenti. Contributi, marche, diritti, spese di notifica, contributo unificato o altri costi previsti dalla normativa restano a carico dell’utente, salvo diversa indicazione scritta.",
        },
        {
          title: "10. Proprietà intellettuale",
          text: "Il sito, il software, i testi, il layout, i marchi, i template e i report generati secondo il formato MulteOnline sono protetti dalle norme applicabili in materia di proprietà intellettuale. L’utente può utilizzare il report per finalità personali connesse alla propria valutazione, senza riprodurre o sfruttare commercialmente il servizio.",
        },
        {
          title: "11. Limitazione di responsabilità",
          text: "Nei limiti consentiti dalla legge, MulteOnline non risponde di decisioni assunte esclusivamente sulla base del report automatico, di errori derivanti da documenti incompleti o illeggibili, di ritardi dell’utente, di esiti delle autorità competenti o di servizi di terzi come provider di pagamento, hosting o intelligenza artificiale.",
        },
        {
          title: "12. Legge applicabile",
          text: "I presenti termini sono regolati dalla legge italiana. Per eventuali controversie si applicano le regole di competenza previste dalla normativa vigente, inclusa la disciplina a tutela dei consumatori quando applicabile.",
        },
      ]}
    />
  );
}
