import { NextResponse } from "next/server";
import {
  analyzeImagesWithGeminiVision,
  enhanceReportWithGemini,
} from "@/lib/ai/geminiClient";
import { extractDocuments } from "@/lib/documents/extractText";
import {
  analyzeFineText,
  type FineCaseData,
} from "@/lib/rules/fineAnalysisRules";

export const runtime = "nodejs";
export const maxDuration = 180;

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
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    const validationError = validateFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const documents = await extractDocuments(files);
    const visionImages = documents.flatMap((document) => document.visionImages);
    const visionResult = await analyzeImagesWithGeminiVision(visionImages);
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
    const report = await enhanceReportWithGemini(extractedText, ruleReport);
    logExtractionResult(report);

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
        rulesEngineUsed: report.rulesEngineUsed,
        aiExecution: report.aiExecution,
      },
    });
  } catch (error) {
    console.error("Local screening analysis failed", error);
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
