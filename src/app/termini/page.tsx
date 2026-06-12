import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return <LegalPage eyebrow="Condizioni d’uso" title="Termini e condizioni" description="Le regole essenziali per l’uso del servizio e dei contenuti generati." sections={[
    { title: "1. Oggetto del servizio", text: "Il servizio fornisce uno screening automatizzato preliminare dei documenti caricati e, per i pacchetti successivi, attività di supporto da definire nel relativo incarico." },
    { title: "2. Obblighi dell’utente", text: "L’utente garantisce che i dati forniti siano corretti, completi e riferiti a documenti che è autorizzato a condividere. L’utente resta responsabile del rispetto delle scadenze comunicate dalle autorità." },
    { title: "3. Pagamenti e costi vivi", text: "Il prezzo del servizio è indicato prima dell’acquisto. Contributi, marche, spese postali e altri costi della procedura sono separati e restano a carico dell’utente." },
    { title: "4. Limitazioni", text: "Lo screening non costituisce garanzia di accoglimento. L’esito delle procedure dipende dalle autorità competenti e dalle circostanze specifiche del caso." },
  ]} />;
}
