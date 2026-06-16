import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  SCREENING_DISCLAIMER,
  VIOLATION_NOT_CLASSIFIED,
  type FieldConfidence,
  type ScreeningOutcome,
  type ScreeningReport,
  type ViolationClassification,
} from "../screening-report.ts";

const defaultModel = "gemini-2.5-flash";
const defaultEndpoint =
  "https://generativelanguage.googleapis.com/v1beta/models";
const missingValues = new Set([
  NOT_DETECTED,
  ARTICLE_NOT_IDENTIFIED,
  VIOLATION_NOT_CLASSIFIED,
]);
const forbiddenLanguage =
  /ricorso\s+fondato|multa\s+annullabile|probabilit[aà]\s+di\s+(?:successo|vittoria)|vittoria|annullamento\s+garantito|vincerai/i;

type GeminiExtractedField = {
  key: ScreeningReport["extractedData"][number]["key"];
  value: string;
  confidence: FieldConfidence;
  evidence: string;
};

type GeminiScreeningOutput = {
  preliminaryOutcome: ScreeningOutcome;
  extractedData: GeminiExtractedField[];
  articleCds: {
    article: string;
    paragraph: string;
    confidence: FieldConfidence;
    evidence: string;
  };
  violationType: {
    value: ViolationClassification;
    confidence: FieldConfidence;
    evidence: string;
  };
  eventDescription: string;
  potentialIssues: string[];
  appealDeadlines: {
    prefetto: string;
    giudiceDiPace: string;
    caution: string;
  };
  economicConvenience: {
    level: ScreeningReport["economicConvenience"]["level"];
    reason: string;
    possiblePackage: string;
  };
  suggestedPath: {
    route: ScreeningReport["suggestedPath"]["route"];
    rationale: string;
    risks: string;
  };
  summary: string;
  finalRecommendation: string;
  disclaimer: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function enhanceReportWithGemini(
  extractedText: string,
  report: ScreeningReport,
): Promise<ScreeningReport> {
  const model = process.env.GEMINI_MODEL?.trim() || defaultModel;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return withUnavailableStatus(report, model, false, "Chiave non configurata");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const endpoint = `${defaultEndpoint}/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(extractedText, report) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4_096,
          responseMimeType: "application/json",
          responseSchema: screeningResponseSchema,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn("Gemini screening request failed", {
        status: response.status,
        message: errorBody.slice(0, 800),
      });
      return withUnavailableStatus(
        report,
        model,
        true,
        response.status === 429 ? "Quota temporaneamente esaurita" : "Provider non disponibile",
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const rawOutput = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    const output = parseGeminiOutput(rawOutput);

    if (!output) {
      return withUnavailableStatus(report, model, true, "Risposta non valida");
    }

    return mergeGeminiOutput(report, output, extractedText, model);
  } catch {
    return withUnavailableStatus(report, model, true, "Provider non disponibile");
  } finally {
    clearTimeout(timeout);
  }
}

function withUnavailableStatus(
  report: ScreeningReport,
  model: string,
  attempted: boolean,
  status: ScreeningReport["aiExecution"]["status"],
): ScreeningReport {
  return {
    ...report,
    aiEnhanced: false,
    rulesEngineUsed: true,
    aiExecution: {
      provider: "Google Gemini",
      model,
      attempted,
      promptExecuted: false,
      fallbackUsed: true,
      status,
    },
  };
}

function mergeGeminiOutput(
  report: ScreeningReport,
  output: GeminiScreeningOutput,
  extractedText: string,
  model: string,
): ScreeningReport {
  const safeSummary = safeNarrative(output.summary, report.summary, 1_200);
  const safeRecommendation = safeNarrative(
    output.finalRecommendation,
    report.finalRecommendation,
    900,
  );
  const safeEventDescription = acceptGroundedEventDescription(
    output.eventDescription,
    extractedText,
    report.eventSummary,
  );
  const groundedFields = new Map(
    output.extractedData
      .filter((field) => isGroundedField(field, extractedText))
      .map((field) => [field.key, field]),
  );
  const extractedData = report.extractedData.map((field) => {
    const candidate = groundedFields.get(field.key);
    if (!candidate || field.confidence !== "Non rilevato") return field;
    return {
      ...field,
      value: candidate.value.trim(),
      confidence: capAiConfidence(candidate.confidence),
    };
  });
  const eventField = extractedData.find((field) => field.key === "eventSummary");
  if (eventField && safeEventDescription !== report.eventSummary) {
    eventField.value = safeEventDescription;
    eventField.confidence = "Bassa";
  }
  const identifiedData = syncIdentifiedData(report, extractedData);
  const articleField = extractedData.find((field) => field.key === "article");
  const paragraphField = extractedData.find((field) => field.key === "paragraph");
  const legalRule =
    report.legalRule.confidence === "Non rilevato" &&
    articleField &&
    articleField.confidence !== "Non rilevato"
      ? {
          ...report.legalRule,
          article: articleField.value,
          paragraph: paragraphField?.value ?? NOT_DETECTED,
          confidence: articleField.confidence,
        }
      : report.legalRule;

  return {
    ...report,
    summary: safeSummary,
    eventSummary: safeEventDescription,
    extractedData,
    identifiedData,
    legalRule,
    violatedRule: {
      ...report.violatedRule,
      article: legalRule.article,
      paragraph: legalRule.paragraph,
      confidence: legalRule.confidence,
    },
    preliminaryAssessment: safeSummary,
    finalRecommendation: safeRecommendation,
    suggestedNextStep: safeRecommendation,
    nextStep: safeRecommendation,
    aiEnhanced: true,
    rulesEngineUsed: true,
    aiExecution: {
      provider: "Google Gemini",
      model,
      attempted: true,
      promptExecuted: true,
      fallbackUsed: false,
      status: "Completata",
    },
  };
}

function syncIdentifiedData(
  report: ScreeningReport,
  fields: ScreeningReport["extractedData"],
): ScreeningReport["identifiedData"] {
  const value = (key: ScreeningReport["extractedData"][number]["key"]) =>
    fields.find((field) => field.key === key)?.value;

  return {
    ...report.identifiedData,
    authority: value("authority") ?? report.identifiedData.authority,
    municipality: value("municipality") ?? report.identifiedData.municipality,
    reportNumber: value("reportNumber") ?? report.identifiedData.reportNumber,
    registryNumber:
      value("registryNumber") ?? report.identifiedData.registryNumber,
    plate: value("plate") ?? report.identifiedData.plate,
    violationDate:
      value("violationDate") ?? report.identifiedData.violationDate,
    violationTime:
      value("violationTime") ?? report.identifiedData.violationTime,
    assessmentDate:
      value("assessmentDate") ?? report.identifiedData.assessmentDate,
    assessmentTime:
      value("assessmentTime") ?? report.identifiedData.assessmentTime,
    notificationDate:
      value("notificationDate") ?? report.identifiedData.notificationDate,
    amount: value("amount") ?? report.identifiedData.amount,
    reducedAmount:
      value("reducedAmount") ?? report.identifiedData.reducedAmount,
    article: value("article") ?? report.identifiedData.article,
    paragraph: value("paragraph") ?? report.identifiedData.paragraph,
    speedDetected:
      value("speedDetected") ?? report.identifiedData.speedDetected,
    speedLimit: value("speedLimit") ?? report.identifiedData.speedLimit,
    speedExcess: value("speedExcess") ?? report.identifiedData.speedExcess,
    licensePoints:
      value("licensePoints") ?? report.identifiedData.licensePoints,
    minimumAmount:
      value("minimumAmount") ?? report.identifiedData.minimumAmount,
    administrativeFees:
      value("administrativeFees") ?? report.identifiedData.administrativeFees,
    deviceName: value("deviceName") ?? report.identifiedData.deviceName,
    approvalDecree:
      value("approvalDecree") ?? report.identifiedData.approvalDecree,
    calibrationCheck:
      value("calibrationCheck") ?? report.identifiedData.calibrationCheck,
    violationType: report.identifiedData.violationType,
    place: value("place") ?? report.identifiedData.place,
  };
}

function buildPrompt(extractedText: string, report: ScreeningReport) {
  return `
Esegui uno screening preliminare automatizzato di un verbale del Codice della
Strada italiano. Restituisci esclusivamente il JSON conforme allo schema.

REGOLE OBBLIGATORIE:
- usa solo il testo OCR e i dati del motore di regole forniti;
- non inventare dati, articoli, commi, date, fatti, termini o criticità;
- per ogni dato estratto indica una prova testuale letterale nel campo evidence;
- se un dato manca usa esattamente "${NOT_DETECTED}";
- se l'articolo è incerto usa esattamente "${ARTICLE_NOT_IDENTIFIED}";
- non dedurre articoli o commi dalla sola tipologia di violazione;
- mantieni un linguaggio prudente e informativo;
- non promettere annullamento, vittoria o probabilità di successo;
- i termini di ricorso sono indicativi e vanno verificati sul caso concreto;
- il disclaimer deve essere esattamente quello fornito.

DATI GIA RILEVATI DAL MOTORE DI REGOLE:
${JSON.stringify(
  {
    preliminaryOutcome: report.outcome,
    extractedData: report.extractedData,
    articleCds: report.violatedRule,
    violationType: report.violationClassification,
    eventDescription: report.eventSummary,
    potentialIssues: report.potentialIssues,
    appealDeadlines: report.appealDeadlines,
    economicConvenience: report.economicConvenience,
    suggestedPath: report.suggestedPath,
    disclaimer: SCREENING_DISCLAIMER,
  },
  null,
  2,
)}

TESTO OCR / PDF:
${extractedText.slice(0, 14_000)}
`.trim();
}

function parseGeminiOutput(value?: string): GeminiScreeningOutput | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as GeminiScreeningOutput;
    if (
      !parsed ||
      typeof parsed.summary !== "string" ||
      typeof parsed.finalRecommendation !== "string" ||
      typeof parsed.eventDescription !== "string" ||
      !Array.isArray(parsed.extractedData) ||
      !Array.isArray(parsed.potentialIssues) ||
      parsed.disclaimer !== SCREENING_DISCLAIMER
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isGroundedField(field: GeminiExtractedField, source: string) {
  if (
    !field ||
    typeof field.key !== "string" ||
    typeof field.value !== "string" ||
    typeof field.evidence !== "string" ||
    missingValues.has(field.value)
  ) {
    return false;
  }

  const evidence = normalize(field.evidence);
  const normalizedSource = normalize(source);
  if (evidence.length < 3 || !normalizedSource.includes(evidence)) return false;

  const valueTokens = normalize(field.value)
    .split(" ")
    .filter((token) => token.length > 1 && !["art", "comma", "codice", "della", "strada"].includes(token));
  return valueTokens.length > 0 && valueTokens.every((token) => evidence.includes(token));
}

function acceptGroundedEventDescription(
  value: string,
  source: string,
  fallback: string,
) {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate === NOT_DETECTED ||
    forbiddenLanguage.test(candidate)
  ) {
    return fallback;
  }

  const meaningfulTokens = normalize(candidate)
    .split(" ")
    .filter((token) => token.length >= 5);
  const sourceTokens = new Set(normalize(source).split(" "));
  const groundedTokens = meaningfulTokens.filter((token) => sourceTokens.has(token));
  return meaningfulTokens.length > 0 &&
    groundedTokens.length / meaningfulTokens.length >= 0.55
    ? candidate.slice(0, 900)
    : fallback;
}

function safeNarrative(value: string, fallback: string, maxLength: number) {
  const candidate = value.trim();
  if (!candidate || forbiddenLanguage.test(candidate)) return fallback;
  return candidate.slice(0, maxLength);
}

function capAiConfidence(confidence: FieldConfidence): FieldConfidence {
  if (confidence === "Alta") return "Media";
  return confidence;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const confidenceEnum = ["Alta", "Media", "Bassa", "Non rilevato"];
const extractedKeys = [
  "authority",
  "municipality",
  "reportNumber",
  "registryNumber",
  "plate",
  "violationDate",
  "violationTime",
  "assessmentDate",
  "assessmentTime",
  "notificationDate",
  "place",
  "amount",
  "reducedAmount",
  "article",
  "paragraph",
  "speedDetected",
  "speedLimit",
  "speedExcess",
  "licensePoints",
  "minimumAmount",
  "administrativeFees",
  "deviceName",
  "approvalDecree",
  "calibrationCheck",
  "eventSummary",
  "violationType",
];
const violationTypes = [
  "ZTL / accesso area vietata",
  "Autovelox / Eccesso di velocità",
  "divieto di sosta",
  "semaforo rosso",
  "mancata revisione",
  "mancata assicurazione",
  "uso del telefono alla guida",
  "circolazione in corsia riservata",
  "mancata comunicazione dati conducente",
  "altra violazione",
  VIOLATION_NOT_CLASSIFIED,
];

const screeningResponseSchema = {
  type: "object",
  properties: {
    preliminaryOutcome: {
      type: "string",
      enum: [
        "Basso interesse all’approfondimento",
        "Medio interesse all’approfondimento",
        "Alto interesse all’approfondimento",
      ],
    },
    extractedData: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: extractedKeys },
          value: { type: "string" },
          confidence: { type: "string", enum: confidenceEnum },
          evidence: { type: "string" },
        },
        required: ["key", "value", "confidence", "evidence"],
      },
    },
    articleCds: {
      type: "object",
      properties: {
        article: { type: "string" },
        paragraph: { type: "string" },
        confidence: { type: "string", enum: confidenceEnum },
        evidence: { type: "string" },
      },
      required: ["article", "paragraph", "confidence", "evidence"],
    },
    violationType: {
      type: "object",
      properties: {
        value: { type: "string", enum: violationTypes },
        confidence: { type: "string", enum: confidenceEnum },
        evidence: { type: "string" },
      },
      required: ["value", "confidence", "evidence"],
    },
    eventDescription: { type: "string" },
    potentialIssues: { type: "array", items: { type: "string" } },
    appealDeadlines: {
      type: "object",
      properties: {
        prefetto: { type: "string" },
        giudiceDiPace: { type: "string" },
        caution: { type: "string" },
      },
      required: ["prefetto", "giudiceDiPace", "caution"],
    },
    economicConvenience: {
      type: "object",
      properties: {
        level: {
          type: "string",
          enum: ["Bassa", "Media-bassa", "Media", "Alta", "Non valutabile"],
        },
        reason: { type: "string" },
        possiblePackage: { type: "string" },
      },
      required: ["level", "reason", "possiblePackage"],
    },
    suggestedPath: {
      type: "object",
      properties: {
        route: {
          type: "string",
          enum: [
            "Prefetto",
            "Giudice di Pace",
            "Documentazione insufficiente",
            "Valutazione professionale necessaria",
          ],
        },
        rationale: { type: "string" },
        risks: { type: "string" },
      },
      required: ["route", "rationale", "risks"],
    },
    summary: { type: "string" },
    finalRecommendation: { type: "string" },
    disclaimer: { type: "string" },
  },
  required: [
    "preliminaryOutcome",
    "extractedData",
    "articleCds",
    "violationType",
    "eventDescription",
    "potentialIssues",
    "appealDeadlines",
    "economicConvenience",
    "suggestedPath",
    "summary",
    "finalRecommendation",
    "disclaimer",
  ],
};
