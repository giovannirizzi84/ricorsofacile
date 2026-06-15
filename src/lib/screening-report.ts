export const SCREENING_DISCLAIMER =
  "Questa analisi è uno screening preliminare automatizzato e non costituisce parere legale, consulenza professionale o garanzia di accoglimento del ricorso.";

export const NOT_DETECTED = "Non rilevato nel documento caricato";
export const ARTICLE_NOT_IDENTIFIED =
  "Articolo non identificato con sufficiente certezza";
export const VIOLATION_NOT_CLASSIFIED =
  "Violazione non classificata con sufficiente certezza";

export type ScreeningOutcome =
  | "Basso interesse all’approfondimento"
  | "Medio interesse all’approfondimento"
  | "Alto interesse all’approfondimento";

export type ViolationClassification =
  | "ZTL / accesso area vietata"
  | "autovelox / eccesso di velocità"
  | "divieto di sosta"
  | "semaforo rosso"
  | "mancata revisione"
  | "mancata assicurazione"
  | "uso del telefono alla guida"
  | "circolazione in corsia riservata"
  | "mancata comunicazione dati conducente"
  | "altra violazione"
  | typeof VIOLATION_NOT_CLASSIFIED;

export type FieldConfidence = "Alta" | "Media" | "Bassa" | "Non rilevato";

export type ExtractedDataField = {
  key:
    | "authority"
    | "municipality"
    | "reportNumber"
    | "plate"
    | "violationDate"
    | "violationTime"
    | "assessmentDate"
    | "notificationDate"
    | "place"
    | "amount"
    | "reducedAmount"
    | "article"
    | "paragraph"
    | "eventSummary"
    | "violationType";
  label: string;
  value: string;
  confidence: FieldConfidence;
};

export type IdentifiedFineData = {
  authority: string;
  municipality: string;
  reportNumber: string;
  plate: string;
  violationDate: string;
  violationTime: string;
  assessmentDate: string;
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
  aiExecution: {
    provider: "Ollama locale";
    model: string;
    attempted: boolean;
    promptExecuted: boolean;
    fallbackUsed: boolean;
    status:
      | "Non tentato"
      | "Disattivato"
      | "Eseguito"
      | "Servizio non raggiungibile"
      | "Risposta non valida";
  };
  identifiedData: IdentifiedFineData;
  extractedData: ExtractedDataField[];
  violatedRule: {
    article: string;
    paragraph: string;
    classification: ViolationClassification;
    description: string;
    confidence: FieldConfidence;
  };
  legalRule: {
    article: string;
    paragraph: string;
    description: string;
    confidence: FieldConfidence;
  };
  violationClassification: {
    value: ViolationClassification;
    confidence: FieldConfidence;
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
  potentialIssues: string[];
  criticalities: string[];
  deadlines: {
    label: string;
    date: string;
    basis: string;
    caution: string;
  }[];
  appealDeadlines: {
    prefetto: string;
    giudiceDiPace: string;
    caution: string;
  };
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
  economicConvenience: {
    level: "Bassa" | "Media" | "Alta" | "Non valutabile";
    reason: string;
    possiblePackage: string;
  };
  finalRecommendation: string;
  suggestedNextStep: string;
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
  finalDisclaimer: string;
};
