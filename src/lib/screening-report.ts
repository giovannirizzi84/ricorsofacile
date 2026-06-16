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
  | "Autovelox / Eccesso di velocità"
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

export type PageClassification =
  | "MAIN_VERBALE"
  | "PAYMENT_NOTICE"
  | "DRIVER_COMMUNICATION_FORM"
  | "WARNINGS"
  | "NOISE_OR_COVER";

export type ClassifiedDocumentPage = {
  pageNumber: number;
  classification: PageClassification;
  score: number;
  textPreview: string;
};

export type ExtractedDataField = {
  key:
    | "authority"
    | "municipality"
    | "reportNumber"
    | "registryNumber"
    | "plate"
    | "violationDate"
    | "violationTime"
    | "assessmentDate"
    | "assessmentTime"
    | "notificationDate"
    | "place"
    | "amount"
    | "reducedAmount"
    | "article"
    | "paragraph"
    | "speedDetected"
    | "speedLimit"
    | "speedExcess"
    | "licensePoints"
    | "minimumAmount"
    | "administrativeFees"
    | "deviceName"
    | "approvalDecree"
    | "calibrationCheck"
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
  registryNumber: string;
  plate: string;
  violationDate: string;
  violationTime: string;
  assessmentDate: string;
  assessmentTime: string;
  notificationDate: string;
  amount: string;
  reducedAmount: string;
  article: string;
  paragraph: string;
  speedDetected: string;
  speedLimit: string;
  speedExcess: string;
  licensePoints: string;
  minimumAmount: string;
  administrativeFees: string;
  deviceName: string;
  approvalDecree: string;
  calibrationCheck: string;
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
  aiEnhanced: boolean;
  rulesEngineUsed: boolean;
  aiExecution: {
    provider: "Google Gemini";
    model: string;
    attempted: boolean;
    promptExecuted: boolean;
    fallbackUsed: boolean;
    status:
      | "Non tentato"
      | "Completata"
      | "Chiave non configurata"
      | "Quota temporaneamente esaurita"
      | "Provider non disponibile"
      | "Risposta non valida";
  };
  identifiedData: IdentifiedFineData;
  extractedData: ExtractedDataField[];
  normalizedData: {
    articleCode: string;
    paragraph: string;
    violationTime: string;
    detectionTime: string;
    reducedAmount: string;
    standardAmount: string;
    speedDetected: number | null;
    speedLimit: number | null;
    speedExcess: number | null;
    points: number | null;
    classification: ViolationClassification;
  };
  extractionDebug: {
    pages: ClassifiedDocumentPage[];
    selectedMainVerbalePage: number | null;
    validationWarnings: string[];
  };
  extractionLog: {
    identified: { field: string; confidence: FieldConfidence }[];
    missing: { field: string; confidence: FieldConfidence }[];
    confidenceByField: Record<string, FieldConfidence>;
  };
  consistencyChecks: {
    title: string;
    status: "Coerente" | "Da verificare" | "Non verificabile";
    detail: string;
  }[];
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
