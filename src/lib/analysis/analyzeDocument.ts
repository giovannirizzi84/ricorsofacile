import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeImagesWithGeminiVision,
  type GeminiVisionDebug,
} from "../ai/geminiClient.ts";
import {
  analyzeImagesWithOpenAIVision,
  renderOpenAIVisionOutput,
  type OpenAIVisionDebug,
} from "../ai/openaiClient.ts";
import {
  extractDocuments,
  type ExtractedDocument,
} from "../documents/extractText.ts";
import {
  analyzeFineText,
  type FineCaseData,
} from "../rules/fineAnalysisRules.ts";
import type { ScreeningReport } from "../screening-report.ts";
import {
  isOcrRecoveryEnabled,
  isProductionRuntime,
} from "../runtime/environment.ts";

export type AnalysisProviderLog = {
  analysisId: string;
  inputType: string;
  documentCount: number;
  parser: boolean;
  geminiVision: boolean;
  openaiVision: boolean;
  fallback: boolean;
  ocrRecovery: boolean;
  ocrRecoveryAttempted: boolean;
  ocrRecoverySkippedReason: string;
  visionAttempted: boolean;
  visionStatus: string;
  geminiDurationMs: number;
  openaiAttempted: boolean;
  openaiStatus: string;
  openaiDurationMs: number;
  openaiCostEstimate: number;
  openaiUsage: Record<string, unknown> | null;
  openaiImageCount: number;
  openaiImagePayloadBytes: number;
  geminiFallbackAttempted: boolean;
  geminiFallbackStatus: string;
  providerUsed: "openaiVision" | "geminiVision" | "parser" | "ocrFallback" | "none";
  failureReason: string;
  documents: Array<{
    filename: string;
    type: string;
    textExtraction: string;
    imagePreprocessing: unknown;
    visionImages: number;
  }>;
};

export type AnalyzeUploadedDocumentsResult = {
  report: ScreeningReport;
  processing: {
    documents: Array<{
      filename: string;
      method: ExtractedDocument["method"];
      characters: number;
      analysis: ExtractedDocument["analysis"];
      visionImages: number;
      warnings: string[];
    }>;
    aiEnhanced: boolean;
    vision: {
      attempted: boolean;
      available: boolean;
      model: string;
      status: string;
    };
    providerLog: AnalysisProviderLog;
    durationMs: number;
    rulesEngineUsed: boolean;
    aiExecution: ScreeningReport["aiExecution"];
  };
  diagnostics: {
    analysisId: string;
    inputFiles: Array<{
      fileName: string;
      mimeType: string;
      fileSize: number;
    }>;
    extractedText: string;
    documents: ExtractedDocument[];
    providerLog: AnalysisProviderLog;
    visionDebug?: GeminiVisionDebug;
    openaiDebug?: OpenAIVisionDebug;
    ruleReport: ScreeningReport;
    finalReport: ScreeningReport;
    openaiRawJson: unknown;
    openaiExtractedFields: Record<string, unknown>;
    geminiRawJson: unknown;
    geminiExtractedFields: Record<string, unknown>;
    finalExtractedFields: Record<string, string>;
  };
};

export async function analyzeUploadedDocuments(
  files: File[],
  caseData: FineCaseData,
  options: {
    analysisId?: string;
    productionRuntime?: boolean;
    debug?: boolean;
  } = {},
): Promise<AnalyzeUploadedDocumentsResult> {
  const analysisStart = Date.now();
  const analysisId = options.analysisId ?? crypto.randomUUID();
  const inputFiles = files.map((file) => ({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  }));
  const productionRuntime = options.productionRuntime ?? isProductionRuntime();
  const ocrRecoveryEnabled = !productionRuntime && isOcrRecoveryEnabled();

  let documents = await extractDocuments(files, {
    deferOcrForVision: true,
    ocrEnabled: !productionRuntime,
  });
  const visionImages = documents.flatMap((document) => document.visionImages);
  const pdfTextContext = documents.map((document) => document.text).join("\n\n");
  const openaiStart = Date.now();
  const openaiResult = await analyzeImagesWithOpenAIVision(visionImages, {
    pdfTextContext,
    timeoutMs: 45_000,
  });
  const openaiDurationMs = Date.now() - openaiStart;
  let geminiDurationMs = 0;
  let geminiFallbackAttempted = false;
  let visionResult: Awaited<ReturnType<typeof analyzeImagesWithGeminiVision>> = {
    available: false,
    attempted: false,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    text: "",
    status: "Provider non disponibile",
  };
  let providerText = openaiResult.available
    ? renderOpenAIVisionOutput(openaiResult.output)
    : "";

  if (!openaiResult.available && visionImages.length > 0) {
    geminiFallbackAttempted = true;
    const geminiStart = Date.now();
    visionResult = await analyzeImagesWithGeminiVision(visionImages);
    geminiDurationMs = Date.now() - geminiStart;
    providerText = visionResult.available ? visionResult.text : "";
  }

  let ocrRecoveryUsed = false;
  let ocrRecoveryAttempted = false;
  let ocrRecoverySkippedReason = "";
  let failureReason = "";

  if (shouldUseOcrRecovery(providerText, documents)) {
    if (productionRuntime) {
      ocrRecoverySkippedReason = "disabled_in_production";
      failureReason = openaiResult.available
        ? "OCR_RECOVERY_DISABLED_IN_PRODUCTION"
        : geminiFallbackAttempted
          ? "OPENAI_AND_GEMINI_FAILED_NO_OCR_IN_PRODUCTION"
          : "OPENAI_FAILED_NO_OCR_IN_PRODUCTION";
    } else if (ocrRecoveryEnabled) {
      ocrRecoveryAttempted = true;
      documents = await extractDocuments(files, {
        ocrEnabled: true,
      });
      ocrRecoveryUsed = true;
    } else {
      ocrRecoverySkippedReason = "disabled";
      failureReason = "OCR_RECOVERY_DISABLED";
    }
  }

  const providerLog: AnalysisProviderLog = {
    analysisId,
    inputType: getInputType(files),
    documentCount: files.length,
    parser: documents.some((document) => document.method === "Testo PDF"),
    openaiVision: openaiResult.available,
    geminiVision: visionResult.available,
    fallback: !openaiResult.available || visionResult.available || ocrRecoveryUsed,
    ocrRecovery: ocrRecoveryUsed,
    ocrRecoveryAttempted,
    ocrRecoverySkippedReason,
    visionAttempted: openaiResult.attempted || visionResult.attempted,
    visionStatus: openaiResult.status,
    geminiDurationMs,
    openaiAttempted: openaiResult.attempted,
    openaiStatus: openaiResult.status,
    openaiDurationMs,
    openaiCostEstimate: openaiResult.debug.estimatedCostEur,
    openaiUsage: openaiResult.debug.usage,
    openaiImageCount: openaiResult.debug.imageCount,
    openaiImagePayloadBytes: openaiResult.debug.imagePayloadBytes,
    geminiFallbackAttempted,
    geminiFallbackStatus: visionResult.status,
    providerUsed: getProviderUsed(
      openaiResult.available,
      visionResult.available,
      ocrRecoveryUsed,
      documents,
    ),
    failureReason,
    documents: documents.map((document) => ({
      filename: document.filename,
      type: document.analysis.type,
      textExtraction: document.analysis.textExtraction,
      imagePreprocessing: document.analysis.imagePreprocessing,
      visionImages: document.visionImages.length,
    })),
  };

  const extractedText = buildExtractedText(documents, providerText, providerLog.providerUsed);
  const usedOcr = documents.some((document) => document.method === "OCR");
  const warnings = documents.flatMap((document) => document.warnings);
  const ruleReport = analyzeFineText(extractedText, caseData, {
    method: usedOcr ? "OCR + regole" : "Testo PDF + regole",
    warnings,
  });
  const unreliableProductionAnalysis =
    productionRuntime &&
    /NO_OCR_IN_PRODUCTION|OCR_RECOVERY_DISABLED_IN_PRODUCTION/.test(
      providerLog.failureReason,
    ) &&
    !hasMinimumUsefulData(ruleReport);
  const finalReport = unreliableProductionAnalysis
    ? createControlledUnreliableReport(ruleReport)
    : markAiExecution(ruleReport, openaiResult, visionResult, providerLog);
  const durationMs = Date.now() - analysisStart;
  const diagnostics = {
    analysisId,
    inputFiles,
    extractedText,
    documents,
    providerLog,
    visionDebug: visionResult.debug,
    openaiDebug: openaiResult.debug,
    ruleReport,
    finalReport,
    openaiRawJson: openaiResult.debug.parsedOutput ?? null,
    openaiExtractedFields: flattenOpenAIFields(openaiResult.debug.parsedOutput),
    geminiRawJson: visionResult.debug?.parsedOutput ?? null,
    geminiExtractedFields: flattenGeminiFields(visionResult.debug?.parsedOutput),
    finalExtractedFields: flattenReportFields(finalReport),
  };

  if (shouldSaveDebug(options.debug)) {
    await saveLiveDebug(diagnostics, durationMs);
  }

  return {
    report: finalReport,
    processing: {
      documents: documents.map((document) => ({
        filename: document.filename,
        method: document.method,
        characters: document.text.length,
        analysis: document.analysis,
        visionImages: document.visionImages.length,
        warnings: document.warnings,
      })),
      aiEnhanced: finalReport.aiEnhanced,
      vision: {
        attempted: openaiResult.attempted || visionResult.attempted,
        available: openaiResult.available || visionResult.available,
        model: openaiResult.available ? openaiResult.model : visionResult.model,
        status: openaiResult.available ? openaiResult.status : visionResult.status,
      },
      providerLog,
      durationMs,
      rulesEngineUsed: finalReport.rulesEngineUsed,
      aiExecution: finalReport.aiExecution,
    },
    diagnostics,
  };
}

export function shouldUseOcrRecovery(
  visionText: string,
  documents: ExtractedDocument[],
) {
  if (!documents.some((document) => document.visionImages.length > 0)) {
    return false;
  }
  if (
    documents.some(
      (document) =>
        document.method === "Testo PDF" && document.analysis.hasUsefulData,
    )
  ) {
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

function buildExtractedText(
  documents: ExtractedDocument[],
  visionText: string,
  providerUsed: AnalysisProviderLog["providerUsed"],
) {
  const documentText = documents
    .map(
      (document, index) =>
        `-- ${index + 1} of ${documents.length} --\nDOCUMENTO: ${document.filename}\nMETODO: ${document.method}\n${document.text}`,
    )
    .join("\n\n---\n\n");

  return [
    visionText &&
      `DOCUMENTO: Analisi visiva\nMETODO: ${providerUsed === "openaiVision" ? "OpenAI Vision" : "Gemini Vision"}\n${visionText}`,
    documentText,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function getInputType(files: File[]) {
  const types = new Set(files.map((file) => file.type));
  if (types.size === 1) {
    const [type] = [...types];
    if (type === "application/pdf") return "pdf";
    if (type.startsWith("image/")) return "image";
  }
  return "mixed";
}

function getProviderUsed(
  openaiAvailable: boolean,
  visionAvailable: boolean,
  ocrRecoveryUsed: boolean,
  documents: ExtractedDocument[],
): AnalysisProviderLog["providerUsed"] {
  if (openaiAvailable) return "openaiVision";
  if (visionAvailable) return "geminiVision";
  if (ocrRecoveryUsed) return "ocrFallback";
  if (documents.some((document) => document.method === "Testo PDF")) return "parser";
  return "none";
}

function markAiExecution(
  report: ScreeningReport,
  openaiResult: Awaited<ReturnType<typeof analyzeImagesWithOpenAIVision>>,
  geminiResult: Awaited<ReturnType<typeof analyzeImagesWithGeminiVision>>,
  providerLog: AnalysisProviderLog,
): ScreeningReport {
  const usedOpenAI = providerLog.providerUsed === "openaiVision";
  const usedGemini = providerLog.providerUsed === "geminiVision";

  return {
    ...report,
    aiEnhanced: usedOpenAI || usedGemini,
    rulesEngineUsed: true,
    aiExecution: {
      provider: usedOpenAI ? "OpenAI GPT-4o" : "Google Gemini",
      model: usedOpenAI ? openaiResult.model : geminiResult.model,
      attempted: openaiResult.attempted || geminiResult.attempted,
      promptExecuted: usedOpenAI || usedGemini,
      fallbackUsed: !usedOpenAI,
      status: usedOpenAI
        ? openaiResult.status
        : usedGemini
          ? geminiResult.status
          : openaiResult.status === "Chiave non configurata"
            ? "Chiave non configurata"
            : "Provider non disponibile",
    },
  };
}

function hasMinimumUsefulData(report: ScreeningReport) {
  const data = report.identifiedData;
  const hasDate =
    hasValue(data.violationDate) ||
    hasValue(data.assessmentDate) ||
    hasValue(data.notificationDate);
  const hasAmount =
    hasValue(data.amount) ||
    hasValue(data.reducedAmount) ||
    hasValue(report.normalizedData.standardAmount) ||
    hasValue(report.normalizedData.reducedAmount);

  return (
    hasValue(data.reportNumber) &&
    hasValue(data.plate) &&
    hasDate &&
    hasAmount
  );
}

function hasValue(value: string) {
  return Boolean(
    value &&
      !/Non rilevato|non identificato|non classificata/i.test(value),
  );
}

function createControlledUnreliableReport(report: ScreeningReport) {
  const message =
    "Non è stato possibile analizzare il documento con sufficiente affidabilità. Ti consigliamo di caricare una foto più nitida, ritagliata sul verbale, oppure un PDF leggibile.";

  return {
    ...report,
    outcome: "Basso interesse all’approfondimento" as const,
    score: 0,
    confidence: 0,
    summary: message,
    documentQuality: "Insufficiente" as const,
    aiEnhanced: false,
    rulesEngineUsed: true,
    aiExecution: {
      ...report.aiExecution,
      provider: "OpenAI GPT-4o" as const,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
      attempted: true,
      promptExecuted: false,
      fallbackUsed: true,
      status: "Provider non disponibile" as const,
    },
    preliminaryAssessment: message,
    finalRecommendation: message,
    suggestedPath: {
      route: "Documentazione insufficiente" as const,
      rationale: message,
      risks:
        "Lo screening non può valutare la convenienza di un approfondimento senza dati leggibili.",
    },
    economicConvenience: {
      ...report.economicConvenience,
      level: "Non valutabile" as const,
      reason: message,
      possiblePackage: "Carica un documento più leggibile prima di scegliere un servizio.",
    },
    potentialIssues: [message],
    criticalities: [message],
    missingDocuments: [
      "Documento leggibile o foto ritagliata sul verbale",
      "Eventuali pagine integrative del verbale",
    ],
  };
}

function flattenGeminiFields(parsed: GeminiVisionDebug["parsedOutput"] | undefined) {
  if (!parsed) return {};
  return {
    authority: parsed.authority,
    municipality: parsed.municipality,
    noticeNumber: parsed.noticeNumber,
    reportNumber: parsed.reportNumber,
    violationDate: parsed.violationDate,
    violationTime: parsed.violationTime,
    plate: parsed.plate,
    articleCode: parsed.articleCode,
    paragraph: parsed.paragraph,
    amount: parsed.amount,
    reducedAmount: parsed.reducedAmount,
    standardAmount: parsed.standardAmount,
    totalAmount: parsed.totalAmount,
    classification: parsed.classification,
    articles: parsed.articles,
    violations: parsed.violations,
  };
}

function flattenOpenAIFields(parsed: OpenAIVisionDebug["parsedOutput"] | null) {
  if (!parsed) return {};
  return {
    authority: parsed.authority,
    municipality: parsed.municipality,
    noticeNumber: parsed.noticeNumber,
    plate: parsed.plate,
    violationDate: parsed.violationDate,
    violationTime: parsed.violationTime,
    place: parsed.place,
    amountReduced: parsed.amountReduced,
    amountOrdinary: parsed.amountOrdinary,
    amount: parsed.amount,
    articleCode: parsed.articleCode,
    paragraph: parsed.paragraph,
    points: parsed.points,
    classification: parsed.classification,
    eventDescription: parsed.eventDescription,
  };
}

function flattenReportFields(report: ScreeningReport) {
  return Object.fromEntries(
    report.extractedData.map((field) => [field.key, field.value]),
  );
}

function shouldSaveDebug(debug?: boolean) {
  return (
    debug === true ||
    process.env.DEBUG_ANALYSIS === "true" ||
    !isProductionRuntime()
  );
}

async function saveLiveDebug(
  diagnostics: AnalyzeUploadedDocumentsResult["diagnostics"],
  durationMs: number,
) {
  const baseDir = path.join(process.cwd(), "evaluation-results", "live-debug");
  const analysisDir = path.join(baseDir, diagnostics.analysisId);
  await mkdir(analysisDir, { recursive: true });

  await writeFile(
    path.join(analysisDir, "analysis.json"),
    `${JSON.stringify(
      {
        inputMetadata: diagnostics.documents.map((document) => ({
          filename: document.filename,
          method: document.method,
          analysis: document.analysis,
          warnings: document.warnings,
          visionImages: document.visionImages.length,
        })),
        providerLog: diagnostics.providerLog,
        openaiRawJson: diagnostics.openaiRawJson,
        openaiExtractedFields: diagnostics.openaiExtractedFields,
        geminiRawJson: diagnostics.geminiRawJson,
        geminiExtractedFields: diagnostics.geminiExtractedFields,
        rulesOutput: {
          identifiedData: diagnostics.ruleReport.identifiedData,
          extractedData: diagnostics.ruleReport.extractedData,
          normalizedData: diagnostics.ruleReport.normalizedData,
          classification: diagnostics.ruleReport.violationClassification,
          potentialIssues: diagnostics.ruleReport.potentialIssues,
          consistencyChecks: diagnostics.ruleReport.consistencyChecks,
        },
        finalOutput: {
          identifiedData: diagnostics.finalReport.identifiedData,
          extractedData: diagnostics.finalReport.extractedData,
          normalizedData: diagnostics.finalReport.normalizedData,
          classification: diagnostics.finalReport.violationClassification,
          potentialIssues: diagnostics.finalReport.potentialIssues,
          consistencyChecks: diagnostics.finalReport.consistencyChecks,
          summary: diagnostics.finalReport.summary,
        },
        durationMs,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  for (const document of diagnostics.documents) {
    for (const image of document.visionImages) {
      if (!/segmento|crop centrale/i.test(image.filename)) continue;
      const safeName = image.filename.replace(/[^a-z0-9_.-]+/gi, "_");
      await writeFile(
        path.join(analysisDir, safeName),
        Buffer.from(image.data, "base64"),
      );
    }
  }
}
