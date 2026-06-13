export const SCREENING_DISCLAIMER =
  "Questa analisi è uno screening preliminare automatizzato e non costituisce parere legale, consulenza professionale o garanzia di accoglimento del ricorso.";

export const NOT_DETECTED = "Non rilevato nel documento caricato";
export const ARTICLE_NOT_IDENTIFIED =
  "Articolo non identificato con sufficiente certezza";

export type ScreeningOutcome =
  | "Elementi da approfondire"
  | "Verifica consigliata"
  | "Nessuna criticità evidente"
  | "Documentazione insufficiente";

export type ViolationClassification =
  | "ZTL / accesso area vietata"
  | "Autovelox / eccesso velocità"
  | "Divieto di sosta"
  | "Semaforo rosso"
  | "Mancata revisione"
  | "Assicurazione"
  | "Uso telefono"
  | "Altro";

export type IdentifiedFineData = {
  authority: string;
  municipality: string;
  reportNumber: string;
  plate: string;
  violationDate: string;
  violationTime: string;
  notificationDate: string;
  amount: string;
  reducedAmount: string;
  article: string;
  paragraph: string;
  violationType: ViolationClassification;
  place: string;
};

export type ScreeningReport = {
  outcome: ScreeningOutcome;
  score: number;
  confidence: number;
  summary: string;
  documentQuality: "Buona" | "Parziale" | "Insufficiente";
  analysisMethod: "OCR + regole" | "Testo PDF + regole";
  ollamaEnhanced: boolean;
  identifiedData: IdentifiedFineData;
  violatedRule: {
    article: string;
    paragraph: string;
    classification: ViolationClassification;
    description: string;
  };
  eventSummary: string;
  preliminaryAssessment: string;
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
