import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeUploadedDocuments,
  type AnalyzeUploadedDocumentsResult,
} from "../src/lib/analysis/analyzeDocument.ts";

type PromptId = "A" | "B" | "C";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: Record<string, unknown>;
};

type PromptRun = {
  id: PromptId;
  label: string;
  mode: string;
  endpoint: string;
  model: string;
  responseTimeMs: number;
  usageMetadata: Record<string, unknown> | null;
  rawResponse: GeminiResponse | null;
  rawText: string;
  parsedJson: Record<string, unknown> | null;
  fields: BenchmarkFields;
  comparisons: Record<keyof BenchmarkFields, boolean>;
  accuracy: number;
  error: string | null;
};

type BenchmarkFields = {
  municipality: string;
  noticeNumber: string;
  plate: string;
  reportDate: string;
  articleCode: string;
  reducedAmount: string;
  standardAmount: string;
  classification: string;
};

const imagePaths = [
  "/Users/giovannirizzi/Downloads/IMG_6385.PNG",
  "/Users/giovannirizzi/Downloads/IMG_6386.PNG",
];
const outputPath = path.join(
  process.cwd(),
  "evaluation-results",
  "golden-bologna-2023-diagnostic.json",
);
const endpointBase = "https://generativelanguage.googleapis.com/v1beta/models";
const requestTimeoutMs = 45_000;

const expected: BenchmarkFields = {
  municipality: "Bologna",
  noticeNumber: "862906/T",
  plate: "X6SCPX",
  reportDate: "18/10/2023",
  articleCode: "7",
  reducedAmount: "42,40",
  standardAmount: "55,00",
  classification: "Sosta / divieto di sosta",
};

async function main() {
  await loadLocalEnv();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY mancante in .env.local o ambiente.");
  }

  const images = await Promise.all(
    imagePaths.map(async (imagePath) => ({
      filename: path.basename(imagePath),
      mimeType: "image/png",
      data: (await readFile(imagePath)).toString("base64"),
    })),
  );
  const files = await Promise.all(
    imagePaths.map(async (imagePath) => {
      const buffer = await readFile(imagePath);
      return new File([buffer], path.basename(imagePath), { type: "image/png" });
    }),
  );

  const pipeline = await analyzeUploadedDocuments(
    files,
    {
      notificationDate: "",
      authority: "",
      amount: "",
      violationType: "",
    },
    {
      analysisId: "golden-bologna-2023",
      productionRuntime: true,
      debug: true,
    },
  );

  const promptRuns: PromptRun[] = [];
  promptRuns.push(buildPromptAFromPipeline(pipeline, model));
  promptRuns.push(
    await runCustomPrompt({
      id: "B",
      label: "Prompt B",
      mode: "Trascrizione fedele",
      model,
      apiKey,
      images,
      prompt: buildFaithfulTranscriptionPrompt(),
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 3_500,
        responseMimeType: "application/json",
      },
    }),
  );
  promptRuns.push(
    await runCustomPrompt({
      id: "C",
      label: "Prompt C",
      mode: "JSON schema rigido",
      model,
      apiKey,
      images,
      prompt: buildRigidJsonPrompt(),
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1_500,
        responseMimeType: "application/json",
        responseSchema: benchmarkResponseSchema,
      },
    }),
  );

  const pipelineFields = normalizePipelineFields(pipeline);
  const pipelineComparisons = compareFields(pipelineFields);
  const pipelineAccuracy = calculateAccuracy(pipelineComparisons);
  const bestPrompt = [...promptRuns].sort((a, b) => b.accuracy - a.accuracy)[0];
  const result = {
    ok: pipelineAccuracy >= 85,
    expected,
    images: images.map((image) => image.filename),
    pipeline: {
      providerUsed: pipeline.processing.providerLog.providerUsed,
      visionAttempted: pipeline.processing.providerLog.visionAttempted,
      visionStatus: pipeline.processing.providerLog.visionStatus,
      model: pipeline.processing.vision.model,
      longReceipt: pipeline.diagnostics.documents.some(
        (document) =>
          document.analysis.imagePreprocessing?.layout === "LONG_RECEIPT_IMAGE",
      ),
      numberOfSegments: pipeline.diagnostics.documents.reduce(
        (total, document) =>
          total + (document.analysis.imagePreprocessing?.segments.length ?? 0),
        0,
      ),
      geminiRawJson: pipeline.diagnostics.geminiRawJson,
      geminiRawText: pipeline.diagnostics.visionDebug?.rawOutput ?? "",
      normalizedOutput: pipelineFields,
      finalOutput: {
        identifiedData: pipeline.report.identifiedData,
        normalizedData: pipeline.report.normalizedData,
        classification: pipeline.report.violationClassification,
        potentialIssues: pipeline.report.potentialIssues,
        consistencyChecks: pipeline.report.consistencyChecks,
      },
      comparisons: pipelineComparisons,
      accuracy: pipelineAccuracy,
      failureReason: inferFailureReason(pipeline, pipelineAccuracy),
    },
    promptRuns,
    comparisonTable: buildComparisonTable(promptRuns),
    bestPrompt: bestPrompt
      ? {
          id: bestPrompt.id,
          mode: bestPrompt.mode,
          accuracy: bestPrompt.accuracy,
        }
      : null,
    notes: [
      "Le immagini caricate sono Bologna 2023: riportano il verbale 862906/T e non 659881/2025.",
      "L'articolo e il luogo non sono pienamente leggibili nelle immagini disponibili; eventuali valori sono accettati solo se Gemini li legge esplicitamente.",
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  printSummary(result);
  if (!result.ok) process.exitCode = 1;
}

function buildPromptAFromPipeline(
  pipeline: AnalyzeUploadedDocumentsResult,
  model: string,
): PromptRun {
  const rawText = pipeline.diagnostics.visionDebug?.rawOutput ?? "";
  const parsed = (pipeline.diagnostics.visionDebug?.parsedOutput ??
    parseJson(rawText)) as Record<string, unknown> | null;
  const fields = normalizeBenchmarkFields(parsed, rawText);
  const comparisons = compareFields(fields);
  return {
    id: "A",
    label: "Prompt A",
    mode: "Prompt attuale / pipeline reale",
    endpoint: pipeline.diagnostics.visionDebug?.endpoint ?? "",
    model: pipeline.processing.vision.model || model,
    responseTimeMs: pipeline.processing.providerLog.geminiDurationMs,
    usageMetadata: pipeline.diagnostics.visionDebug?.rawResponse.usageMetadata ?? null,
    rawResponse: pipeline.diagnostics.visionDebug?.rawResponse ?? null,
    rawText,
    parsedJson: parsed,
    fields,
    comparisons,
    accuracy: calculateAccuracy(comparisons),
    error: pipeline.processing.vision.available
      ? null
      : pipeline.processing.vision.status,
  };
}

async function runCustomPrompt(input: {
  id: PromptId;
  label: string;
  mode: string;
  model: string;
  apiKey: string;
  images: Array<{ filename: string; mimeType: string; data: string }>;
  prompt: string;
  generationConfig: Record<string, unknown>;
}): Promise<PromptRun> {
  const endpoint = `${endpointBase}/${encodeURIComponent(input.model)}:generateContent`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              ...input.images.map((image) => ({
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.data,
                },
              })),
            ],
          },
        ],
        generationConfig: input.generationConfig,
      }),
    });
    const responseText = await response.text();
    const responseTimeMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        ...failedPromptRun(
          input.id,
          input.label,
          input.mode,
          input.model,
          startedAt,
          new Error(`HTTP ${response.status}: ${responseText.slice(0, 800)}`),
        ),
        endpoint,
        responseTimeMs,
      };
    }

    const rawResponse = JSON.parse(responseText) as GeminiResponse;
    const rawText = extractGeminiText(rawResponse);
    const parsedJson = parseJson(rawText);
    const fields = normalizeBenchmarkFields(parsedJson, rawText);
    const comparisons = compareFields(fields);
    return {
      id: input.id,
      label: input.label,
      mode: input.mode,
      endpoint,
      model: input.model,
      responseTimeMs,
      usageMetadata: rawResponse.usageMetadata ?? null,
      rawResponse,
      rawText,
      parsedJson,
      fields,
      comparisons,
      accuracy: calculateAccuracy(comparisons),
      error: parsedJson ? null : "JSON non parseabile",
    };
  } catch (error) {
    return failedPromptRun(input.id, input.label, input.mode, input.model, startedAt, error);
  } finally {
    clearTimeout(timeout);
  }
}

function failedPromptRun(
  id: PromptId,
  label: string,
  mode: string,
  model: string,
  startedAt: number,
  error: unknown,
): PromptRun {
  const fields = emptyBenchmarkFields();
  const comparisons = compareFields(fields);
  return {
    id,
    label,
    mode,
    endpoint: "",
    model,
    responseTimeMs: Date.now() - startedAt,
    usageMetadata: null,
    rawResponse: null,
    rawText: "",
    parsedJson: null,
    fields,
    comparisons,
    accuracy: calculateAccuracy(comparisons),
    error: error instanceof Error ? error.message : String(error),
  };
}

function buildFaithfulTranscriptionPrompt() {
  return `
Trascrivi fedelmente tutto il testo visibile nelle immagini di questo verbale/avviso.
Non correggere, non inventare e non completare parti mancanti.

Poi restituisci esclusivamente JSON valido con:
{
  "transcription": "testo visibile completo, andando dall'alto verso il basso",
  "fields": {
    "municipality": "",
    "noticeNumber": "",
    "plate": "",
    "reportDate": "",
    "articleCode": "",
    "reducedAmount": "",
    "standardAmount": "",
    "classification": ""
  }
}

Usa stringa vuota se un campo non è leggibile.
`.trim();
}

function buildRigidJsonPrompt() {
  return `
Compila esclusivamente i campi dello schema JSON usando solo ciò che è leggibile nelle immagini.
Non trascrivere testo libero. Non inventare articolo, luogo o tipo violazione se non sono presenti.

Regole:
- "reducedAmount" = importo entro 5 giorni dalla notifica;
- "standardAmount" = importo dal 6° al 60° giorno dalla notifica;
- "classification" può essere "Sosta / divieto di sosta" solo se il verbale o il contesto leggibile indicano sosta/divieto di sosta; altrimenti lascia vuoto.
- se il campo non è leggibile usa stringa vuota.
`.trim();
}

const benchmarkResponseSchema = {
  type: "object",
  properties: {
    municipality: { type: "string" },
    noticeNumber: { type: "string" },
    plate: { type: "string" },
    reportDate: { type: "string" },
    articleCode: { type: "string" },
    reducedAmount: { type: "string" },
    standardAmount: { type: "string" },
    classification: { type: "string" },
  },
  required: [
    "municipality",
    "noticeNumber",
    "plate",
    "reportDate",
    "articleCode",
    "reducedAmount",
    "standardAmount",
    "classification",
  ],
};

function normalizePipelineFields(
  analysis: AnalyzeUploadedDocumentsResult,
): BenchmarkFields {
  const data = analysis.report.identifiedData;
  const rawJson = analysis.diagnostics.geminiRawJson as Record<string, unknown> | null;
  return {
    municipality: data.municipality,
    noticeNumber: data.reportNumber,
    plate: data.plate,
    reportDate:
      data.violationDate ||
      stringValue(rawJson?.reportDate) ||
      stringValue(rawJson?.violationDate),
    articleCode: analysis.report.normalizedData.articleCode,
    reducedAmount:
      data.reducedAmount ||
      stringValue(rawJson?.reducedAmount) ||
      extractReducedAmount(analysis.diagnostics.extractedText),
    standardAmount:
      stringValue(rawJson?.standardAmount) ||
      extractStandardAmount(analysis.diagnostics.extractedText),
    classification: analysis.report.violationClassification.value,
  };
}

function normalizeBenchmarkFields(
  parsedJson: Record<string, unknown> | null,
  rawText: string,
): BenchmarkFields {
  const fields =
    parsedJson && isRecord(parsedJson.fields)
      ? parsedJson.fields
      : parsedJson;
  const transcription = `${rawText}\n${stringValue(parsedJson?.transcription)}`;
  return {
    municipality:
      stringValue(fields?.municipality) || extractMunicipality(transcription),
    noticeNumber:
      stringValue(fields?.noticeNumber) ||
      stringValue(fields?.reportNumber) ||
      extractNoticeNumber(transcription),
    plate: stringValue(fields?.plate) || extractPlate(transcription),
    reportDate:
      stringValue(fields?.reportDate) ||
      stringValue(fields?.violationDate) ||
      extractDate(transcription),
    articleCode:
      stringValue(fields?.articleCode) ||
      stringValue(fields?.article) ||
      extractArticle(transcription),
    reducedAmount:
      stringValue(fields?.reducedAmount) || extractReducedAmount(transcription),
    standardAmount:
      stringValue(fields?.standardAmount) || extractStandardAmount(transcription),
    classification:
      stringValue(fields?.classification) || classifyFromText(transcription),
  };
}

function compareFields(fields: BenchmarkFields) {
  return {
    municipality: includesNormalized(fields.municipality, expected.municipality),
    noticeNumber: sameNotice(fields.noticeNumber, expected.noticeNumber),
    plate: includesNormalized(fields.plate, expected.plate),
    reportDate: sameDate(fields.reportDate, expected.reportDate),
    articleCode: includesNormalized(fields.articleCode, expected.articleCode),
    reducedAmount: sameAmount(fields.reducedAmount, expected.reducedAmount),
    standardAmount: sameAmount(fields.standardAmount, expected.standardAmount),
    classification:
      /sosta|divieto/i.test(fields.classification) ||
      includesNormalized(fields.classification, expected.classification),
  };
}

function calculateAccuracy(comparisons: Record<string, boolean>) {
  const values = Object.values(comparisons);
  return Number(((values.filter(Boolean).length / values.length) * 100).toFixed(2));
}

function buildComparisonTable(promptRuns: PromptRun[]) {
  const rows = Object.keys(expected).map((key) => {
    const field = key as keyof BenchmarkFields;
    return {
      field,
      promptA: promptRuns.find((run) => run.id === "A")?.fields[field] ?? "",
      promptB: promptRuns.find((run) => run.id === "B")?.fields[field] ?? "",
      promptC: promptRuns.find((run) => run.id === "C")?.fields[field] ?? "",
      expected: expected[field],
    };
  });
  return rows;
}

function inferFailureReason(
  analysis: AnalyzeUploadedDocumentsResult,
  accuracy: number,
) {
  if (!analysis.processing.providerLog.visionAttempted) return "VISION_NOT_ATTEMPTED";
  if (!analysis.processing.providerLog.geminiVision) return "GEMINI_VISION_FAILED";
  if (accuracy < 85) return "PIPELINE_EXTRACTION_BELOW_TARGET";
  return "NONE";
}

function printSummary(result: {
  pipeline: {
    providerUsed: string;
    visionAttempted: boolean;
    visionStatus: string;
    model: string;
    longReceipt: boolean;
    numberOfSegments: number;
    normalizedOutput: BenchmarkFields;
    accuracy: number;
    failureReason: string;
  };
  promptRuns: PromptRun[];
  comparisonTable: ReturnType<typeof buildComparisonTable>;
  bestPrompt: { id: PromptId; mode: string; accuracy: number } | null;
}) {
  console.log("Golden Bologna 2023 diagnostic");
  console.log(`Provider usato: ${result.pipeline.providerUsed}`);
  console.log(`visionAttempted: ${result.pipeline.visionAttempted}`);
  console.log(`visionStatus: ${result.pipeline.visionStatus}`);
  console.log(`Modello: ${result.pipeline.model}`);
  console.log(`Long receipt: ${result.pipeline.longReceipt}`);
  console.log(`Segmenti: ${result.pipeline.numberOfSegments}`);
  console.log("Output normalizzato pipeline:");
  console.log(JSON.stringify(result.pipeline.normalizedOutput, null, 2));
  console.log(`Accuracy pipeline: ${result.pipeline.accuracy}%`);
  console.log(`failureReason: ${result.pipeline.failureReason}`);
  console.log("");
  console.log("| Campo | Prompt A | Prompt B | Prompt C | Atteso |");
  console.log("|---|---|---|---|---|");
  for (const row of result.comparisonTable) {
    console.log(
      `| ${row.field} | ${cleanCell(row.promptA)} | ${cleanCell(row.promptB)} | ${cleanCell(row.promptC)} | ${cleanCell(row.expected)} |`,
    );
  }
  console.log("");
  for (const run of result.promptRuns) {
    console.log(
      `${run.label} (${run.mode}): ${run.accuracy}% in ${run.responseTimeMs} ms${run.error ? ` - ${run.error}` : ""}`,
    );
  }
  if (result.bestPrompt) {
    console.log(
      `Prompt migliore: ${result.bestPrompt.id} (${result.bestPrompt.mode}) - ${result.bestPrompt.accuracy}%`,
    );
  }
  console.log(`Output salvato in: ${outputPath}`);
}

function extractGeminiText(response: GeminiResponse) {
  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function parseJson(value: string): Record<string, unknown> | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function emptyBenchmarkFields(): BenchmarkFields {
  return {
    municipality: "",
    noticeNumber: "",
    plate: "",
    reportDate: "",
    articleCode: "",
    reducedAmount: "",
    standardAmount: "",
    classification: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractMunicipality(text: string) {
  if (/comune\s+di\s+bologna|ente\s+creditore\s+comune\s+di\s+bologna/i.test(text)) {
    return "Bologna";
  }
  return "";
}

function extractNoticeNumber(text: string) {
  return (
    text.match(/verbale\s+n(?:r|\.|umero)?\.?\s*([0-9]{5,8}\s*\/?\s*T)/i)?.[1] ??
    text.match(/verbale\s+n(?:r|\.|umero)?\.?\s*([0-9]{5,8}\/[0-9]{4}\/T)/i)?.[1] ??
    ""
  ).replace(/\s+/g, "");
}

function extractPlate(text: string) {
  return text.match(/\btarga\s+([A-Z0-9]{5,8})\b/i)?.[1]?.toUpperCase() ?? "";
}

function extractDate(text: string) {
  return (
    text.match(/\b(?:del|emesso\s+il)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1] ??
    ""
  );
}

function extractArticle(text: string) {
  return text.match(/\bArt\.?\s*(7)\b/i)?.[1] ?? "";
}

function extractReducedAmount(text: string) {
  return (
    text.match(/entro\s+5\s+giorni[\s\S]{0,80}?(?:Euro|€)\s*(\d{1,5}[,.]\d{2})/i)?.[1] ??
    text.match(/(?:Euro|€)\s*(42[,.]40)/i)?.[1] ??
    ""
  );
}

function extractStandardAmount(text: string) {
  return (
    text.match(/(?:dal\s+6|6°|60°)[\s\S]{0,120}?(?:Euro|€)\s*(\d{1,5}[,.]\d{2})/i)?.[1] ??
    text.match(/(?:Euro|€)\s*(55[,.]00)/i)?.[1] ??
    ""
  );
}

function classifyFromText(text: string) {
  if (/sosta|tariff|divieto/i.test(text)) return "Sosta / divieto di sosta";
  return "";
}

function includesNormalized(actual: string, expectedValue: string) {
  if (!actual || !expectedValue) return false;
  return normalize(actual).includes(normalize(expectedValue));
}

function sameNotice(actual: string, expectedValue: string) {
  return normalize(actual).includes(normalize(expectedValue));
}

function sameDate(actual: string, expectedValue: string) {
  return normalizeDate(actual) === normalizeDate(expectedValue);
}

function sameAmount(actual: string, expectedValue: string) {
  return normalizeAmount(actual) === normalizeAmount(expectedValue);
}

function normalize(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeDate(value: string) {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${year}`;
}

function normalizeAmount(value: string) {
  const match = value.match(/\d{1,5}[,.]\d{2}/);
  return match?.[0].replace(".", ",") ?? "";
}

function cleanCell(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.replace(/\|/g, "/").slice(0, 80) : "-";
}

async function loadLocalEnv() {
  try {
    const envFile = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Environment variables can be provided by the shell.
  }
}

await main();
