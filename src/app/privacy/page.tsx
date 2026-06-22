import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Informativa privacy MulteOnline: dati trattati, documenti caricati, uso di GPT-4o, Stripe e diritti GDPR.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Informativa privacy"
      title="Privacy Policy"
      description="Come MulteOnline tratta i dati personali e i documenti caricati per generare lo screening preliminare."
      sections={[
        {
          title: "1. Titolare del trattamento",
          text: "Il titolare del trattamento è MulteOnline. In attesa della completa formalizzazione societaria, le richieste privacy possono essere inviate all’indirizzo email indicato nella pagina Contatti. I dati identificativi completi del titolare saranno aggiornati non appena disponibili.",
        },
        {
          title: "2. Dati raccolti",
          text: "Possiamo trattare dati di contatto, indirizzo email, informazioni tecniche di utilizzo del sito, dati relativi al pagamento e informazioni inserite dall’utente nel percorso di analisi. Quando l’utente carica un verbale o altri allegati, i documenti possono contenere dati personali quali nome, indirizzo, targa, codice fiscale, informazioni sul veicolo, luogo e data della violazione, dati del conducente o del proprietario e riferimenti amministrativi.",
        },
        {
          title: "3. Dati caricati nei verbali",
          text: "I documenti caricati vengono utilizzati esclusivamente per generare il report preliminare richiesto dall’utente, per verificare il pagamento associato e per conservare lo storico dell’analisi quando la persistenza è attiva. L’utente deve caricare solo documenti che è autorizzato a condividere. MulteOnline non vende i documenti o i dati personali a terzi.",
        },
        {
          title: "4. Finalità del trattamento",
          text: "I dati sono trattati per: erogare lo Screening AI preliminare; gestire il pagamento tramite Stripe Checkout; generare e salvare il report; fornire assistenza tecnica o commerciale; prevenire abusi o utilizzi impropri; adempiere a obblighi fiscali, contabili o normativi; migliorare l’affidabilità del servizio in forma aggregata o pseudonimizzata, quando possibile.",
        },
        {
          title: "5. Base giuridica",
          text: "La base giuridica principale è l’esecuzione del servizio richiesto dall’utente. Alcuni trattamenti possono essere necessari per adempiere obblighi di legge, per il legittimo interesse alla sicurezza del servizio e alla prevenzione di abusi, oppure sulla base del consenso quando richiesto dalla normativa applicabile.",
        },
        {
          title: "6. Conservazione dei dati",
          text: "I dati vengono conservati per il tempo necessario a fornire il servizio, consentire il recupero del report, gestire richieste di assistenza e adempiere agli obblighi applicabili. I documenti e i report potranno essere cancellati o anonimizzati quando non più necessari. I tempi effettivi potranno variare in base a obblighi fiscali, contabili, difensivi o tecnici.",
        },
        {
          title: "7. Utilizzo di OpenAI GPT-4o",
          text: "Per generare l’analisi automatizzata, MulteOnline utilizza GPT-4o tramite API OpenAI. I contenuti dei documenti caricati e le immagini necessarie all’estrazione possono essere trasmessi a OpenAI al solo fine di ottenere l’output strutturato necessario allo screening. OpenAI opera come provider tecnico esterno secondo i propri termini e le proprie misure di sicurezza. Non inviamo i documenti a OpenAI per venderli o per finalità pubblicitarie.",
        },
        {
          title: "8. Utilizzo di Stripe",
          text: "I pagamenti sono gestiti tramite Stripe Checkout Hosted. MulteOnline non raccoglie né conserva direttamente i dati completi della carta di pagamento. Stripe tratta i dati necessari alla transazione, alla prevenzione frodi e agli adempimenti connessi al pagamento. Nel sistema MulteOnline possono essere conservati identificativo della sessione Stripe, importo, valuta, stato del pagamento e data.",
        },
        {
          title: "9. Provider tecnici e responsabili esterni",
          text: "Per il funzionamento del servizio possono essere coinvolti provider tecnici come hosting, database, strumenti di pagamento, API di intelligenza artificiale e servizi di monitoraggio. Tali soggetti possono trattare dati personali come responsabili esterni o autonomi titolari, secondo i rispettivi ruoli e accordi applicabili.",
        },
        {
          title: "10. Cookie e analytics",
          text: "Il sito può utilizzare cookie tecnici necessari al funzionamento delle pagine e dei flussi di pagamento. Eventuali strumenti di analytics o marketing saranno indicati in modo trasparente e, quando necessario, attivati solo previo consenso. Al momento il servizio non richiede cookie di profilazione per generare lo screening.",
        },
        {
          title: "11. Diritti GDPR",
          text: "Nei limiti previsti dal GDPR, l’utente può richiedere accesso, rettifica, cancellazione, limitazione del trattamento, portabilità dei dati e opposizione. L’utente può inoltre proporre reclamo all’autorità di controllo competente. Le richieste saranno gestite nei tempi previsti dalla normativa.",
        },
        {
          title: "12. Modalità di contatto",
          text: "Per richieste privacy, assistenza o cancellazione dati è possibile utilizzare la pagina Contatti o scrivere all’indirizzo email di supporto indicato sul sito. Per consentire l’identificazione della richiesta, può essere necessario indicare l’email usata nel pagamento o l’identificativo del report.",
        },
      ]}
    />
  );
}
