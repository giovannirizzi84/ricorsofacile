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
  usageMetadata?: Record<string, unknown>;
};

type GeminiVisionImage = {
  filename: string;
  mimeType: string;
  data: string;
};

type GeminiVisionOutput = {
  authority?: string;
  municipality?: string;
  noticeNumber?: string;
  reportNumber?: string;
  reportDate?: string;
  violationDate?: string;
  violationTime?: string;
  place?: string;
  plate?: string;
  articles?: Array<{
    articleCode?: string;
    paragraph?: string;
    amount?: string;
    description?: string;
  }>;
  violations?: Array<{
    articleCode?: string;
    paragraph?: string;
    amount?: string;
    description?: string;
    classification?: string;
  }>;
  primaryArticle?: string;
  primaryClassification?: string;
  articleCode?: string;
  paragraph?: string;
  amount?: string;
  reducedAmount?: string;
  totalAmount?: string;
  points?: string;
  classification?: string;
  eventDescription?: string;
  notes?: string;
  additionalConsequence?: string;
  appealNote?: string;
};

export type GeminiVisionDebug = {
  endpoint: string;
  rawOutput: string;
  parsedOutput: GeminiVisionOutput;
  rawResponse: GeminiResponse;
};

export async function analyzeImagesWithGeminiVision(
  images: GeminiVisionImage[],
): Promise<{
  available: boolean;
  attempted: boolean;
  model: string;
  text: string;
  status: "Completata" | "Chiave non configurata" | "Provider non disponibile" | "Risposta non valida";
  debug?: GeminiVisionDebug;
}> {
  const model = process.env.GEMINI_MODEL?.trim() || defaultModel;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (images.length === 0) {
    return {
      available: false,
      attempted: false,
      model,
      text: "",
      status: "Provider non disponibile",
    };
  }

  if (!apiKey) {
    return {
      available: false,
      attempted: false,
      model,
      text: "",
      status: "Chiave non configurata",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

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
            parts: [
              { text: buildVisionPrompt(images) },
              ...images.map((image) => ({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data,
                },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1_024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn("Gemini Vision request failed", {
        status: response.status,
        message: errorBody.slice(0, 800),
      });
      return {
        available: false,
        attempted: true,
        model,
        text: "",
        status: "Provider non disponibile",
      };
    }

    const payload = (await response.json()) as GeminiResponse;
    const rawOutput = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    const output = parseGeminiVisionOutput(rawOutput);

    if (!output) {
      return {
        available: false,
        attempted: true,
        model,
        text: "",
        status: "Risposta non valida",
      };
    }

    return {
      available: true,
      attempted: true,
      model,
      text: renderVisionOutput(output),
      status: "Completata",
      debug: {
        endpoint,
        rawOutput: rawOutput ?? "",
        parsedOutput: output,
        rawResponse: payload,
      },
    };
  } catch {
    return {
      available: false,
      attempted: true,
      model,
      text: "",
      status: "Provider non disponibile",
    };
  } finally {
    clearTimeout(timeout);
  }
}

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

function buildVisionPrompt(images: GeminiVisionImage[]) {
  const hasLongReceiptSegments = images.some((image) =>
    /segmento\s+\d+/i.test(image.filename),
  );
  return `
Analizza le immagini originali di un verbale italiano del Codice della Strada.
Restituisci esclusivamente JSON valido. Non usare Markdown. Non aggiungere testo fuori dal JSON.

${hasLongReceiptSegments ? `FORMATO DOCUMENTO:
Il documento è una foto verticale molto lunga, simile a uno scontrino o avviso di accertamento.
Le immagini includono il documento intero e segmenti verticali sovrapposti.
Leggi attentamente tutte le sezioni dall'alto verso il basso. Non fermarti alla sola intestazione.
Cerca numero verbale, data, ora, luogo, targa, articoli, importi singoli, totale e note finali.
` : ""}

REGOLE:
- usa solo ciò che vedi nelle immagini;
- non inventare dati mancanti;
- se un dato non è leggibile usa "${NOT_DETECTED}";
- estrai anche articoli multipli, importi singoli e totale se presenti;
- usa stringhe brevi.

FORMATO ATTESO:
{
  "authority": "Comune di Bologna - Polizia Locale",
  "municipality": "Bologna",
  "noticeNumber": "635227-71",
  "reportDate": "28/01/2026",
  "violationDate": "28/01/2026",
  "violationTime": "11:10",
  "place": "Via del Borgo di S. Pietro",
  "plate": "DZ923NZ",
  "articles": [
    {
      "articleCode": "7",
      "paragraph": "1",
      "amount": "42,00",
      "description": "sosta violando prescrizioni su tariffe orarie"
    },
    {
      "articleCode": "158",
      "paragraph": "2",
      "amount": "42,00",
      "description": "zona a traffico limitato priva di autorizzazione"
    }
  ],
  "violations": [
    {
      "articleCode": "7",
      "paragraph": "",
      "description": "Sostava violando le prescrizioni su tariffe orarie",
      "amount": "42,00",
      "classification": "Sosta / tariffa non pagata"
    },
    {
      "articleCode": "158",
      "paragraph": "",
      "description": "Sostava in zona a traffico limitato priva di autorizzazione",
      "amount": "42,00",
      "classification": "Sosta in ZTL / rimozione"
    }
  ],
  "primaryArticle": "7/158",
  "primaryClassification": "Sosta / Rimozione",
  "articleCode": "7",
  "paragraph": "1",
  "amount": "93,60",
  "totalAmount": "93,60",
  "points": "${NOT_DETECTED}",
  "classification": "Sosta / Rimozione",
  "eventDescription": "Sosta in area soggetta a tariffa e zona a traffico limitato, con applicazione della rimozione del veicolo.",
  "notes": "Non espone contrassegni",
  "additionalConsequence": "Rimozione del veicolo",
  "appealNote": "L'eventuale ricorso potrà essere proposto solo dopo la notifica del verbale."
}

IMMAGINI INVIATE:
${images.map((image, index) => `${index + 1}. ${image.filename} (${image.mimeType})`).join("\n")}
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

function parseGeminiVisionOutput(value?: string): GeminiVisionOutput | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as GeminiVisionOutput;
    return normalizeVisionOutput(parsed);
  } catch {
    return parsePartialGeminiVisionOutput(value);
  }
}

function renderVisionOutput(output: GeminiVisionOutput) {
  const articles = output.violations?.length
    ? output.violations
    : output.articles?.length
      ? output.articles
    : [
        {
          articleCode: output.articleCode,
          paragraph: output.paragraph,
          amount: output.amount,
        },
      ];
  const articleLines = articles
    .filter((article) => article.articleCode)
    .map((article) => {
      const paragraph = article.paragraph ? ` comma ${article.paragraph}` : "";
      const amount = article.amount ? ` - Sanzione Euro ${article.amount}` : "";
      const description = article.description ? ` - ${article.description}` : "";
      const classification = "classification" in article && article.classification
        ? ` - Tipo: ${article.classification}`
        : "";
      return `Art. ${article.articleCode}${paragraph} Codice della Strada${amount}${description}${classification}`;
    });

  return `
ESTRAZIONE STRUTTURATA DA IMMAGINI
${output.authority ? `Ente accertatore: ${output.authority}` : ""}
${output.municipality ? `Comune: ${output.municipality}` : ""}
${output.noticeNumber ?? output.reportNumber ? `Verbale n. ${output.noticeNumber ?? output.reportNumber}` : ""}
${output.reportDate ? `Data verbale: ${output.reportDate}` : ""}
${output.violationDate ? `Data violazione: ${output.violationDate}${output.violationTime ? ` ore ${output.violationTime}` : ""}` : ""}
${output.place ? `Luogo della violazione: ${output.place}` : ""}
${output.plate ? `Targa: ${output.plate}` : ""}
${output.totalAmount ?? output.amount ? `Totale Euro ${output.totalAmount ?? output.amount}` : ""}
${articleLines.join("\n")}
${output.reducedAmount ? `Importo ridotto Euro ${output.reducedAmount}` : ""}
${output.points ? `Punti patente: ${output.points}` : ""}
${output.primaryArticle ? `Articolo principale: ${output.primaryArticle}` : ""}
${output.primaryClassification ?? output.classification ? `Tipo violazione: ${output.primaryClassification ?? output.classification}` : ""}
${output.eventDescription ? `Descrizione: ${output.eventDescription}` : ""}
${output.notes ? `Note Accertatore: ${output.notes}` : ""}
${output.additionalConsequence ? `Conseguenza accessoria: ${output.additionalConsequence}` : ""}
${output.appealNote ? `Nota ricorso: ${output.appealNote}` : ""}
`.trim();
}

function parsePartialGeminiVisionOutput(value: string): GeminiVisionOutput | null {
  const output = {
    authority: extractJsonString(value, "authority"),
    municipality: extractJsonString(value, "municipality"),
    noticeNumber: extractJsonString(value, "noticeNumber"),
    reportNumber: extractJsonString(value, "reportNumber"),
    reportDate: extractJsonString(value, "reportDate"),
    violationDate: extractJsonString(value, "violationDate"),
    violationTime: extractJsonString(value, "violationTime"),
    place: extractJsonString(value, "place"),
    plate: extractJsonString(value, "plate"),
    articleCode: extractJsonString(value, "articleCode"),
    paragraph: extractJsonString(value, "paragraph"),
    amount: extractJsonString(value, "amount"),
    reducedAmount: extractJsonString(value, "reducedAmount"),
    totalAmount: extractJsonString(value, "totalAmount"),
    points: extractJsonString(value, "points"),
    primaryArticle: extractJsonString(value, "primaryArticle"),
    primaryClassification: extractJsonString(value, "primaryClassification"),
    classification: extractJsonString(value, "classification"),
    eventDescription: extractJsonString(value, "eventDescription"),
    notes: extractJsonString(value, "notes"),
    additionalConsequence: extractJsonString(value, "additionalConsequence"),
    appealNote: extractJsonString(value, "appealNote"),
  };

  return normalizeVisionOutput(output);
}

function normalizeVisionOutput(output: GeminiVisionOutput | null) {
  if (!output || typeof output !== "object") return null;
  const usefulStrings = [
    output.authority,
    output.municipality,
    output.noticeNumber,
    output.reportNumber,
    output.reportDate,
    output.violationDate,
    output.violationTime,
    output.place,
    output.plate,
    output.articleCode,
    output.paragraph,
    output.amount,
    output.reducedAmount,
    output.totalAmount,
    output.points,
    output.primaryArticle,
    output.primaryClassification,
    output.classification,
    output.eventDescription,
    output.notes,
    output.additionalConsequence,
    output.appealNote,
  ];
  const hasUsefulString = usefulStrings.some(
    (item) => typeof item === "string" && item.trim().length > 0,
  );
  const hasArticles =
    Array.isArray(output.articles) &&
    output.articles.some((article) => article.articleCode || article.paragraph);
  const hasViolations =
    Array.isArray(output.violations) &&
    output.violations.some((violation) => violation.articleCode || violation.description);

  if (!hasUsefulString && !hasArticles && !hasViolations) return null;

  return {
    ...output,
    articles: Array.isArray(output.articles) ? output.articles : undefined,
    violations: Array.isArray(output.violations) ? output.violations : undefined,
  };
}

function extractJsonString(value: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(
    new RegExp(`"${escapedKey}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
  return match?.[1]?.replace(/\\"/g, "\"").trim() ?? "";
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
  "Sosta / Rimozione",
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
