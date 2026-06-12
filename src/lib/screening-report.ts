export const SCREENING_DISCLAIMER =
  "Questa analisi è uno screening preliminare automatizzato e non costituisce parere legale, consulenza professionale o garanzia di accoglimento del ricorso.";

export type ScreeningOutcome =
  | "Ricorso potenzialmente fondato"
  | "Ricorso da approfondire"
  | "Ricorso debole"
  | "Documentazione insufficiente";

export type ScreeningReport = {
  outcome: ScreeningOutcome;
  score: number;
  confidence: number;
  summary: string;
  documentQuality: "Buona" | "Parziale" | "Insufficiente";
  analysisMethod: "OCR + regole" | "Testo PDF + regole";
  ollamaEnhanced: boolean;
  extractedFacts: string[];
  reasons: {
    title: string;
    relevance: "Alta" | "Media" | "Bassa";
    evidence: string;
    legalBasis: string;
    needsVerification: boolean;
    points: number;
  }[];
  criticalities: string[];
  deadlines: {
    label: string;
    date: string;
    basis: string;
    caution: string;
  }[];
  suggestedPath: {
    route:
      | "Prefetto"
      | "Giudice di Pace"
      | "Documentazione insufficiente"
      | "Valutazione professionale necessaria";
    rationale: string;
    risks: string;
  };
  estimatedCosts: {
    label: string;
    amount: string;
    note: string;
  }[];
  nextStep: string;
  sources: {
    title: string;
    reference: string;
    whyRelevant: string;
    verificationStatus: "Da verificare" | "Riferimento generale";
  }[];
  missingDocuments: string[];
  extractedTextPreview: string;
  disclaimer: string;
};
