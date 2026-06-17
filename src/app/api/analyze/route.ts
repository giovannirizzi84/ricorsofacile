import { NextResponse } from "next/server.js";
import {
  analyzeImagesWithGeminiVision,
  enhanceReportWithGemini,
} from "../../../lib/ai/geminiClient.ts";
import { extractDocuments } from "../../../lib/documents/extractText.ts";
import {
  analyzeFineText,
  type FineCaseData,
} from "../../../lib/rules/fineAnalysisRules.ts";
import {
  isOcrRecoveryEnabled,
  isProductionRuntime,
} from "../../../lib/runtime/environment.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxFiles = 5;
const maxFileSize = 10 * 1024 * 1024;
const maxTotalSize = 30 * 1024 * 1024;

export async function POST(request: Request) {
  const analysisStart = Date.now();
  const analysisId = crypto.randomUUID();
  const productionRuntime = isProductionRuntime();
  const ocrRecoveryEnabled = isOcrRecoveryEnabled();
  let providerLog: AnalysisProviderLog | null = null;

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const validationError = validateFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    let documents = await extractDocuments(files, {
      deferOcrForVision: true,
      ocrEnabled: !productionRuntime,
    });
    const visionImages = documents.flatMap((document) => document.visionImages);
    const geminiStart = Date.now();
    const visionResult = await analyzeImagesWithGeminiVision(visionImages);
    const geminiDurationMs = Date.now() - geminiStart;
    let ocrRecoveryUsed = false;
    let ocrRecoveryAttempted = false;
    let ocrRecoverySkippedReason = "";
    let failureReason = "";

    if (shouldUseOcrRecovery(visionResult.text, documents)) {
      if (productionRuntime) {
        ocrRecoverySkippedReason = "disabled_in_production";
        failureReason = "GEMINI_FAILED_NO_OCR_IN_PRODUCTION";
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

    providerLog = {
      analysisId,
      inputType: getInputType(files),
      documentCount: files.length,
      parser: documents.some((document) => document.method === "Testo PDF"),
      geminiVision: visionResult.available,
      fallback: !visionResult.available || ocrRecoveryUsed,
      ocrRecovery: ocrRecoveryUsed,
      ocrRecoveryAttempted,
      ocrRecoverySkippedReason,
      visionAttempted: visionResult.attempted,
      visionStatus: visionResult.status,
      geminiDurationMs,
      providerUsed: getProviderUsed(visionResult.available, ocrRecoveryUsed, documents),
      failureReason,
      documents: documents.map((document) => ({
        filename: document.filename,
        type: document.analysis.type,
        textExtraction: document.analysis.textExtraction,
        imagePreprocessing: document.analysis.imagePreprocessing,
        visionImages: document.visionImages.length,
      })),
    };
    console.info("Document analysis providers", {
      ...providerLog,
      durationMs: Date.now() - analysisStart,
    });
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

    const caseData: FineCaseData = {
      notificationDate: readText(formData, "notificationDate"),
      authority: readText(formData, "authority"),
      amount: readText(formData, "amount"),
      violationType: readText(formData, "violationType"),
    };
    const usedOcr = documents.some((document) => document.method === "OCR");
    const warnings = documents.flatMap((document) => document.warnings);

    const ruleReport = analyzeFineText(extractedText, caseData, {
      method: usedOcr ? "OCR + regole" : "Testo PDF + regole",
      warnings,
    });
    const unreliableProductionAnalysis =
      productionRuntime &&
      providerLog.failureReason === "GEMINI_FAILED_NO_OCR_IN_PRODUCTION";
    const report = unreliableProductionAnalysis
      ? createControlledUnreliableReport(ruleReport)
      : await enhanceReportWithGemini(extractedText, ruleReport);
    logExtractionResult(report);

    const durationMs = Date.now() - analysisStart;
    console.info("Document analysis completed", {
      ...providerLog,
      durationMs,
    });

    return NextResponse.json({
      report,
      processing: {
        documents: documents.map((document) => ({
          filename: document.filename,
          method: document.method,
          characters: document.text.length,
          analysis: document.analysis,
          visionImages: document.visionImages.length,
          warnings: document.warnings,
        })),
        aiEnhanced: report.aiEnhanced,
        vision: {
          attempted: visionResult.attempted,
          available: visionResult.available,
          model: visionResult.model,
          status: visionResult.status,
        },
        providerLog,
        durationMs,
        rulesEngineUsed: report.rulesEngineUsed,
        aiExecution: report.aiExecution,
      },
    });
  } catch (error) {
    console.error("Local screening analysis failed", {
      analysisId,
      durationMs: Date.now() - analysisStart,
      providerLog,
      error,
    });
    if (error instanceof Error && error.name === "OCR_TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "L'OCR sta impiegando troppo tempo su questo documento. Prova a caricare una foto più nitida, ritagliata sul verbale, oppure un PDF.",
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Non è stato possibile leggere i documenti. Prova con immagini più nitide o con un PDF non protetto.",
      },
      { status: 500 },
    );
  }
}

type AnalysisProviderLog = {
  analysisId: string;
  inputType: string;
  documentCount: number;
  parser: boolean;
  geminiVision: boolean;
  fallback: boolean;
  ocrRecovery: boolean;
  ocrRecoveryAttempted: boolean;
  ocrRecoverySkippedReason: string;
  visionAttempted: boolean;
  visionStatus: string;
  geminiDurationMs: number;
  providerUsed: "geminiVision" | "parser" | "ocrFallback" | "none";
  failureReason: string;
  documents: Array<{
    filename: string;
    type: string;
    textExtraction: string;
    imagePreprocessing: unknown;
    visionImages: number;
  }>;
};

function shouldUseOcrRecovery(
  visionText: string,
  documents: Awaited<ReturnType<typeof extractDocuments>>,
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
  visionAvailable: boolean,
  ocrRecoveryUsed: boolean,
  documents: Awaited<ReturnType<typeof extractDocuments>>,
): AnalysisProviderLog["providerUsed"] {
  if (visionAvailable) return "geminiVision";
  if (ocrRecoveryUsed) return "ocrFallback";
  if (documents.some((document) => document.method === "Testo PDF")) return "parser";
  return "none";
}

function createControlledUnreliableReport(
  report: ReturnType<typeof analyzeFineText>,
) {
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

function validateFiles(files: File[]) {
  if (files.length === 0) {
    return "Carica almeno un PDF o un'immagine del verbale.";
  }
  if (files.length > maxFiles) {
    return `Puoi caricare al massimo ${maxFiles} documenti.`;
  }

  let totalSize = 0;
  for (const file of files) {
    totalSize += file.size;
    if (!allowedTypes.has(file.type)) {
      return `Formato non supportato: ${file.name}. Usa PDF, JPG, PNG o WEBP.`;
    }
    if (file.size > maxFileSize) {
      return `${file.name} supera il limite di 10 MB.`;
    }
  }

  if (totalSize > maxTotalSize) {
    return "I documenti superano il limite complessivo di 30 MB.";
  }

  return null;
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

function logExtractionResult(
  report: ReturnType<typeof analyzeFineText>,
) {
  const identifiedData = report.extractedData
    .filter((field) => field.confidence !== "Non rilevato")
    .map((field) => ({
      field: field.key,
      confidence: field.confidence,
    }));
  const missingData = report.extractedData
    .filter((field) => field.confidence === "Non rilevato")
    .map((field) => ({
      field: field.key,
      confidence: field.confidence,
    }));

  console.info("Fine analysis extraction log", {
    identifiedData,
    missingData,
    overallConfidence: report.confidence,
  });
}
