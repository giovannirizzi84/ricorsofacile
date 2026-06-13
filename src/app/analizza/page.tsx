import { PageHero } from "@/components/page-hero";
import { ScreeningFlow } from "@/components/screening-flow";

export default function AnalyzePage() {
  return (
    <>
      <PageHero
        eyebrow="Screening AI preliminare"
        title="Analizza la tua multa in pochi passaggi"
        description="Carica PDF o immagini e ricevi un report preliminare con possibili criticità, termini e aspetti da approfondire."
      />
      <ScreeningFlow />
    </>
  );
}
