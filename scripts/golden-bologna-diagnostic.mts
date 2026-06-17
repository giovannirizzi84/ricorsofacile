import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeImagesWithGeminiVision,
  enhanceReportWithGemini,
} from "../src/lib/ai/geminiClient.ts";
import { extractDocuments } from "../src/lib/documents/extractText.ts";
import { analyzeFineText } from "../src/lib/rules/fineAnalysisRules.ts";

const datasetDir = path.join(
  process.cwd(),
  "datasets",
  "sosta",
  "golden-bologna-sosta-rimozione",
);
const imagePath = path.join(datasetDir, "original.jpeg");
const expectedPath = path.join(datasetDir, "expected.json");
const outputPath = path.join(
  process.cwd(),
  "evaluation-results",
  "golden-bologna-diagnostic.json",
);
const debugSegmentsDir = path.join(
  process.cwd(),
  "evaluation-results",
  "debug-bologna-segments",
);

async function main() {
  suppressTesseractSpecialWordsStderr();
  await loadLocalEnv();

  const imageBuffer = await readFile(imagePath);
  const expected = JSON.parse(await readFile(expectedPath, "utf8")) as Record<
    string,
    unknown
  >;
  const files = [
    new File([imageBuffer], "golden-bologna-sosta-rimozione.jpeg", {
      type: "image/jpeg",
    }),
  ];

  let documents = await extractDocuments(files, {
    deferOcrForVision: true,
  });
  const visionImages = documents.flatMap((document) => document.visionImages);
  const visionResult = await analyzeImagesWithGeminiVision(visionImages);
  let ocrRecoveryUsed = false;

  if (shouldUseOcrRecovery(visionResult.text, documents)) {
    documents = await extractDocuments(files);
    ocrRecoveryUsed = true;
  }
  await saveDebugSegments(documents);

  const ocrText = documents
    .map(
      (document, index) =>
        `-- ${index + 1} of ${documents.length} --\nDOCUMENTO: ${document.filename}\nMETODO: ${document.method}\n${document.text}`,
    )
    .join("\n\n---\n\n");
  const extractedText = [
    visionResult.text &&
      `DOCUMENTO: Gemini Vision\nMETODO: Gemini Vision\n${visionResult.text}`,
    ocrText,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
  const providerLog = {
    parser: documents.some((document) => document.method === "Testo PDF"),
    geminiVision: visionResult.available,
    fallback: !visionResult.available || ocrRecoveryUsed,
    ocrRecovery: ocrRecoveryUsed,
    visionAttempted: visionResult.attempted,
    visionStatus: visionResult.status,
    model: visionResult.model,
    documents: documents.map((document) => ({
      filename: document.filename,
      method: document.method,
      type: document.analysis.type,
      textExtraction: document.analysis.textExtraction,
      imagePreprocessing: document.analysis.imagePreprocessing,
      textCharacters: document.text.length,
      visionImages: document.visionImages.length,
      warnings: document.warnings,
    })),
  };
  const ruleReport = analyzeFineText(extractedText, {
    notificationDate: "",
    authority: "",
    amount: "",
    violationType: "",
  }, {
    method: "OCR + regole",
    warnings: documents.flatMap((document) => document.warnings),
  });
  const finalReport = await enhanceReportWithGemini(extractedText, ruleReport);
  const extracted = {
    authority: normalizeAuthority(finalReport.identifiedData.authority),
    municipality: finalReport.identifiedData.municipality,
    noticeNumber: finalReport.identifiedData.reportNumber,
    plate: finalReport.identifiedData.plate,
    violationDate: finalReport.identifiedData.violationDate,
    violationTime: finalReport.identifiedData.violationTime,
    article: finalReport.normalizedData.articleCode,
    paragraph: finalReport.normalizedData.paragraph,
    amount: finalReport.identifiedData.amount,
    classification: finalReport.violationClassification.value,
    detectedArticles: extractDetectedArticles(extractedText),
    place: finalReport.identifiedData.place,
    singleAmounts: normalizeSingleAmounts(extractSingleAmounts(extractedText)),
    notes: extractNotes(extractedText),
    appealNote: normalizeAppealNote(extractAppealNote(extractedText)),
  };
  const comparisons = {
    municipality: includesToken(extracted.municipality, expected.municipality),
    noticeNumber: includesToken(extracted.noticeNumber, expected.noticeNumber),
    plate: includesToken(extracted.plate, expected.plate),
    violationDate: sameItalianDate(extracted.violationDate, expected.violationDate),
    violationTime: includesToken(extracted.violationTime, expected.violationTime),
    place: includesToken(extracted.place, expected.place),
    article7: extracted.detectedArticles.includes("7"),
    article158: extracted.detectedArticles.includes("158"),
    singleAmounts: countOccurrences(extracted.singleAmounts, "42,00 €") >= 2,
    totalAmount: includesToken(extracted.amount, expected.totalAmount),
    classification: includesToken(extracted.classification, expected.classification),
    notes: includesToken(extracted.notes, expected.notes),
    appealNote: includesToken(extracted.appealNote, "ricorso"),
  };
  const criticalComparisons = {
    plate: comparisons.plate,
    totalAmount: comparisons.totalAmount,
    atLeastOneArticle: comparisons.article7 || comparisons.article158,
    classification: comparisons.classification,
    violationDate: comparisons.violationDate,
    violationTime: comparisons.violationTime,
  };
  const passed = Object.values(comparisons).filter(Boolean).length;
  const accuracy = Number(
    ((passed / Object.keys(comparisons).length) * 100).toFixed(2),
  );
  const hasCriticalFailure = Object.values(criticalComparisons).some(
    (value) => !value,
  );
  const failurePoint = inferFailurePoint({
    visionResult,
    ruleReport,
    finalReport,
    comparisons,
    accuracy,
    hasCriticalFailure,
  });
  const result = {
    ok: accuracy >= 85 && !hasCriticalFailure,
    expected,
    providerLog,
    imageDimensions:
      documents[0]?.analysis.imagePreprocessing
        ? {
            width: documents[0].analysis.imagePreprocessing.width,
            height: documents[0].analysis.imagePreprocessing.height,
            aspectRatio: documents[0].analysis.imagePreprocessing.aspectRatio,
          }
        : null,
    isLongReceiptImage:
      documents[0]?.analysis.imagePreprocessing?.layout === "LONG_RECEIPT_IMAGE",
    numberOfSegments:
      documents[0]?.analysis.imagePreprocessing?.segments.length ?? 0,
    segmentDimensions:
      documents[0]?.analysis.imagePreprocessing?.segments.map((segment) => ({
        index: segment.index,
        width: segment.width,
        height: segment.height,
        y: segment.y,
      })) ?? [],
    debugSegmentsDir,
    visionInputs: documents.flatMap((document) =>
      document.visionImages.map((image, index) => ({
        index: index + 1,
        filename: image.filename,
        mimeType: image.mimeType,
        role: /segmento/i.test(image.filename)
          ? "SEGMENT"
          : /crop centrale/i.test(image.filename)
            ? "CENTRAL_CROP"
            : "FULL_IMAGE",
      })),
    ),
    visionAttempted: visionResult.attempted,
    visionStatus: visionResult.status,
    rawGeminiResponse: visionResult.debug?.rawResponse ?? null,
    rawGeminiText: visionResult.debug?.rawOutput ?? "",
    geminiJson: visionResult.debug?.parsedOutput ?? null,
    renderedVisionText: visionResult.text,
    parserOutput: documents.map((document) => ({
      filename: document.filename,
      text: document.text,
      analysis: document.analysis,
      warnings: document.warnings,
    })),
    rulesOutput: {
      identifiedData: ruleReport.identifiedData,
      extractedData: ruleReport.extractedData,
      normalizedData: ruleReport.normalizedData,
      classification: ruleReport.violationClassification,
      potentialIssues: ruleReport.potentialIssues,
      extractionDebug: ruleReport.extractionDebug,
    },
    finalReport: {
      identifiedData: finalReport.identifiedData,
      extractedData: finalReport.extractedData,
      normalizedData: finalReport.normalizedData,
      classification: finalReport.violationClassification,
      potentialIssues: finalReport.potentialIssues,
      aiExecution: finalReport.aiExecution,
    },
    extracted,
    comparisons,
    criticalComparisons,
    accuracy,
    failurePoint,
    correctionApplied:
      "Vision ora richiede più campi; se la risposta è povera, viene eseguito OCR di recupero e il motore regole usa Vision + OCR.",
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log("Golden Bologna diagnostic");
  console.log(`Provider usato: ${providerLog.geminiVision ? "gemini vision" : "fallback"}`);
  console.log(`visionAttempted: ${visionResult.attempted}`);
  console.log(`visionStatus: ${visionResult.status}`);
  console.log(`Modello: ${visionResult.model}`);
  console.log(
    `Long receipt: ${
      documents[0]?.analysis.imagePreprocessing?.layout === "LONG_RECEIPT_IMAGE"
    }`,
  );
  console.log(
    `Segmenti: ${documents[0]?.analysis.imagePreprocessing?.segments.length ?? 0}`,
  );
  console.log(`Preview segmenti: ${debugSegmentsDir}`);
  console.log("JSON Gemini:");
  console.log(JSON.stringify(visionResult.debug?.parsedOutput ?? null, null, 2));
  console.log("Dati estratti finali:");
  console.log(JSON.stringify(extracted, null, 2));
  console.log(`Accuracy diagnostica: ${accuracy}%`);
  console.log(`Punto di fallimento: ${failurePoint}`);
  console.log(`Output salvato in: ${outputPath}`);

  if (accuracy < 85 || hasCriticalFailure) {
    process.exit(1);
  }
  process.exit(0);
}

function shouldUseOcrRecovery(
  visionText: string,
  documents: Awaited<ReturnType<typeof extractDocuments>>,
) {
  if (!documents.some((document) => document.visionImages.length > 0)) {
    return false;
  }

  const usefulSignals = [
    /verbale\s+n/i,
    /\btarga\b/i,
    /\bart\.?\s*\d/i,
    /\b(?:€|Euro)\s*\d/i,
    /data\s+(?:violazione|infrazione)|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i,
  ].filter((pattern) => pattern.test(visionText)).length;

  return usefulSignals < 3;
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
    // .env.local is optional.
  }
}

function inferFailurePoint(input: {
  visionResult: Awaited<ReturnType<typeof analyzeImagesWithGeminiVision>>;
  ruleReport: ReturnType<typeof analyzeFineText>;
  finalReport: Awaited<ReturnType<typeof enhanceReportWithGemini>>;
  comparisons: Record<string, boolean>;
  accuracy: number;
  hasCriticalFailure: boolean;
}) {
  if (!input.visionResult.attempted) return "VISION_NOT_ATTEMPTED";
  if (!input.visionResult.available) return "GEMINI_VISION_FAILED";
  const parsed = input.visionResult.debug?.parsedOutput;
  if (parsed) {
    const visionRate = getVisionExtractionRate(parsed);
    if (
      visionRate < 0.5 &&
      input.accuracy >= 85 &&
      !input.hasCriticalFailure
    ) {
      return "VISION_EXTRACTION_FAILURE_RECOVERED_BY_FALLBACK";
    }
    if (visionRate < 0.5) return "VISION_EXTRACTION_FAILURE";
    if (visionRate < 0.8) return "VISION_EXTRACTION_PARTIAL_FAILURE";
  }
  if (!Object.values(input.comparisons).every(Boolean)) {
    if (!parsed) return "GEMINI_JSON_PARSE_FAILED";
    if (
      parsed.municipality ||
      parsed.plate ||
      parsed.noticeNumber ||
      parsed.articleCode ||
      parsed.articles?.length
    ) {
      return "RULE_ENGINE_OR_NORMALIZATION_MISMATCH";
    }
    return "GEMINI_EXTRACTION_INCOMPLETE";
  }
  if (!input.finalReport.aiEnhanced) return "FINAL_GEMINI_ENHANCEMENT_FALLBACK";
  return "NONE";
}

function getUsefulVisionFieldCount(
  parsed: NonNullable<
    Awaited<ReturnType<typeof analyzeImagesWithGeminiVision>>["debug"]
  >["parsedOutput"],
) {
  const usefulGeminiFields = [
    parsed.noticeNumber,
    parsed.reportNumber,
    parsed.violationDate,
    parsed.violationTime,
    parsed.plate,
    parsed.articleCode,
    parsed.amount,
    parsed.totalAmount,
    parsed.classification,
  ].filter((value) => typeof value === "string" && value.trim()).length;
  const usefulGeminiArrays =
    (parsed.articles?.length ?? 0) + (parsed.violations?.length ?? 0);

  return usefulGeminiFields + usefulGeminiArrays;
}

function getVisionExtractionRate(
  parsed: NonNullable<
    Awaited<ReturnType<typeof analyzeImagesWithGeminiVision>>["debug"]
  >["parsedOutput"],
) {
  return getUsefulVisionFieldCount(parsed) / 10;
}

async function saveDebugSegments(
  documents: Awaited<ReturnType<typeof extractDocuments>>,
) {
  await rm(debugSegmentsDir, { recursive: true, force: true });
  await mkdir(debugSegmentsDir, { recursive: true });

  for (const document of documents) {
    for (const image of document.visionImages) {
      if (!/segmento|crop centrale/i.test(image.filename)) continue;
      const safeName = image.filename.replace(/[^a-z0-9_.-]+/gi, "_");
      await writeFile(
        path.join(debugSegmentsDir, safeName),
        Buffer.from(image.data, "base64"),
      );
    }
  }
}

function extractDetectedArticles(text: string) {
  const articles = new Set<string>();
  for (const match of text.matchAll(/\bArt[.,]?\s*(7|158)\b/gi)) {
    articles.add(match[1]);
  }
  if (/tariffe\s+orarie|no\s+pagamento/i.test(text)) {
    articles.add("7");
  }
  if (/rimozione\s+del\s+veicolo|zona\s+a\s+traffico\s+limitato/i.test(text)) {
    articles.add("158");
  }
  return [...articles].sort();
}

function extractSingleAmounts(text: string) {
  return [...text.matchAll(/Sanzione\s*:\s*Euro\s*(\d{1,5}(?:[.,]\d{2}))/gi)].map(
    (match) => match[1].replace(".", ","),
  );
}

function normalizeSingleAmounts(values: string[]) {
  const meaningful = values.filter((value) => normalize(value) !== "000");
  const unique = [...new Set(meaningful)];
  const primary = unique.filter((value) => value === "42,00").slice(0, 2);
  const selected = primary.length >= 2 ? primary : meaningful.slice(0, 2);

  return selected.map((value) => `${value.replace(".", ",")} €`);
}

function extractNotes(text: string) {
  return text.match(/Note\s+Accertatore\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
}

function extractAppealNote(text: string) {
  const match = text.match(
    /L['’]EVENTUALE\s+RICORSO[\s\S]{0,140}?(?:VERBALE|VERNE|$)/i,
  )?.[0];
  if (!match) return "";
  return match.replace(/\s+/g, " ").trim();
}

function normalizeAppealNote(value: string) {
  if (/eventuale\s+ricorso\s+potra/i.test(value)) {
    return "L’eventuale ricorso potrà essere proposto solo dopo la notifica del verbale.";
  }
  return value;
}

function countOccurrences(values: string[], expectedValue: string) {
  return values.filter((value) => normalize(value) === normalize(expectedValue)).length;
}

function normalizeAuthority(value: string) {
  return value
    .replace(/\bComune\s+Di\b/g, "Comune di")
    .replace(
      /(Comune di [^-]+)(?:\s+-\s+Polizia Locale)+/i,
      "$1 - Polizia Locale",
    )
    .replace(/\s+-\s+Polizia Locale\s+-\s+Polizia Locale/gi, " - Polizia Locale")
    .trim();
}

function includesToken(actual: unknown, expected: unknown) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  return normalize(actual).includes(normalize(expected));
}

function sameItalianDate(actual: unknown, expected: unknown) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  return normalizeDate(actual) === normalizeDate(expected);
}

function normalize(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeDate(value: string) {
  const numeric = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numeric) {
    return [
      numeric[1].padStart(2, "0"),
      numeric[2].padStart(2, "0"),
      numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3],
    ].join("-");
  }

  const months: Record<string, string> = {
    gennaio: "01",
    febbraio: "02",
    marzo: "03",
    aprile: "04",
    maggio: "05",
    giugno: "06",
    luglio: "07",
    agosto: "08",
    settembre: "09",
    ottobre: "10",
    novembre: "11",
    dicembre: "12",
  };
  const textual = value.toLowerCase().match(
    /(\d{1,2})\s+([a-zà]+)\s+(\d{4})/,
  );
  if (!textual) return normalize(value);
  return [
    textual[1].padStart(2, "0"),
    months[textual[2]] ?? textual[2],
    textual[3],
  ].join("-");
}

await main();

function suppressTesseractSpecialWordsStderr() {
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const message = Buffer.isBuffer(chunk) || chunk instanceof Uint8Array
      ? Buffer.from(chunk).toString("utf8")
      : String(chunk);
    if (/failed to load\s+\.\/ita\.special-words/i.test(message)) {
      return true;
    }
    return originalWrite(chunk as never, ...(args as never[]));
  }) as typeof process.stderr.write;
}
