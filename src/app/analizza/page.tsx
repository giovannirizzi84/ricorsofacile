import { PageHero } from "@/components/page-hero";
import { ScreeningFlow } from "@/components/screening-flow";
import { isFreeScreeningMode } from "@/lib/payments/freeScreeningMode";

export default function AnalyzePage() {
  const freeMode = isFreeScreeningMode();

  return (
    <>
      <PageHero
        eyebrow="Screening AI preliminare"
        title="Analizza la tua multa in pochi passaggi"
        description={
          freeMode
            ? "Carica il verbale e ricevi gratuitamente uno screening preliminare in pochi minuti. Nessun pagamento richiesto durante la fase di lancio."
            : "Carica PDF o immagini e ricevi un report preliminare con possibili criticità, termini e aspetti da approfondire."
        }
      />
      <ScreeningFlow freeMode={freeMode} />
    </>
  );
}
