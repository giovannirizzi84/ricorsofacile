import { LegalPage } from "@/components/legal-page";

export default function PrivacyPage() {
  return <LegalPage eyebrow="Informativa" title="Privacy Policy" description="Una sintesi trasparente di come vengono trattati dati e documenti nel prototipo." sections={[
    { title: "1. Titolare e finalità", text: "MulteOnline tratta i dati forniti per erogare lo screening preliminare, gestire richieste di consulenza e consentire l’accesso all’area riservata. I riferimenti definitivi del titolare saranno inseriti prima della pubblicazione." },
    { title: "2. Dati trattati", text: "Dati anagrafici e di contatto, informazioni sul verbale, documenti allegati, dati di utilizzo del servizio e comunicazioni con il team." },
    { title: "3. Base giuridica e conservazione", text: "Il trattamento è fondato sull’esecuzione del servizio richiesto, sugli obblighi di legge e, quando necessario, sul consenso. I tempi di conservazione dovranno essere definiti in relazione alle finalità e agli obblighi applicabili." },
    { title: "4. Diritti dell’interessato", text: "L’utente può richiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione nei casi previsti dalla normativa." },
  ]} />;
}
