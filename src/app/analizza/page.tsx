import { PageHero } from "@/components/page-hero";
import { ScreeningFlow } from "@/components/screening-flow";

export default function AnalyzePage() {
  return (
    <>
      <PageHero
        eyebrow="Screening locale gratuito"
        title="Analizza la tua multa senza servizi a pagamento"
        description="Carica PDF o immagini: OCR, regole preliminari e Ollama opzionale generano il report senza dipendere da OpenAI."
      />
      <ScreeningFlow />
    </>
  );
}
