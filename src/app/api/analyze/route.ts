import { NextResponse } from "next/server.js";
import {
  analyzeUploadedDocuments,
  type AnalyzeUploadedDocumentsResult,
} from "../../../lib/analysis/analyzeDocument.ts";
import type { FineCaseData } from "../../../lib/rules/fineAnalysisRules.ts";

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
  const analysisId = crypto.randomUUID();

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const validationError = validateFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const caseData: FineCaseData = {
      notificationDate: readText(formData, "notificationDate"),
      authority: readText(formData, "authority"),
      amount: readText(formData, "amount"),
      violationType: readText(formData, "violationType"),
    };

    const result = await analyzeUploadedDocuments(files, caseData, {
      analysisId,
      debug: process.env.DEBUG_ANALYSIS === "true",
    });
    logAnalysisResult(result);

    return NextResponse.json({
      report: result.report,
      processing: result.processing,
    });
  } catch (error) {
    console.error("Local screening analysis failed", {
      analysisId,
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

function logAnalysisResult(result: AnalyzeUploadedDocumentsResult) {
  const { diagnostics, processing } = result;
  const fileMetadata = diagnostics.documents.map((document) => ({
    ...diagnostics.inputFiles.find((file) => file.fileName === document.filename),
    fileName: document.filename,
    mimeType:
      diagnostics.inputFiles.find((file) => file.fileName === document.filename)
        ?.mimeType ??
      document.visionImages[0]?.mimeType ??
      "application/pdf",
    fileSize:
      diagnostics.inputFiles.find((file) => file.fileName === document.filename)
        ?.fileSize ?? null,
    imageDimensions: document.analysis.imagePreprocessing
      ? {
          width: document.analysis.imagePreprocessing.width,
          height: document.analysis.imagePreprocessing.height,
        }
      : null,
    aspectRatio: document.analysis.imagePreprocessing?.aspectRatio ?? null,
    isLongReceiptImage:
      document.analysis.imagePreprocessing?.layout === "LONG_RECEIPT_IMAGE",
    segmentsGenerated: document.analysis.imagePreprocessing?.segments.length ?? 0,
  }));

  console.info("Document analysis completed", {
    analysisId: diagnostics.analysisId,
    inputType: processing.providerLog.inputType,
    files: fileMetadata,
    providerUsed: processing.providerLog.providerUsed,
    visionAttempted: processing.providerLog.visionAttempted,
    visionStatus: processing.providerLog.visionStatus,
    geminiRawJson: diagnostics.geminiRawJson,
    geminiExtractedFields: diagnostics.geminiExtractedFields,
    finalExtractedFields: diagnostics.finalExtractedFields,
    failureReason: processing.providerLog.failureReason,
    ocrRecoveryAttempted: processing.providerLog.ocrRecoveryAttempted,
    ocrRecoverySkippedReason: processing.providerLog.ocrRecoverySkippedReason,
    durationMs: processing.durationMs,
  });
}
