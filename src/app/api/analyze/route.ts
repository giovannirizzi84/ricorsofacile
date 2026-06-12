import { NextResponse } from "next/server";
import { enhanceReportWithOllama } from "@/lib/ai/ollamaClient";
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
    const extractedText = documents
      .map(
        (document) =>
          `DOCUMENTO: ${document.filename}\nMETODO: ${document.method}\n${document.text}`,
      )
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
    const report = await enhanceReportWithOllama(extractedText, ruleReport);

    return NextResponse.json({
      report,
      processing: {
        documents: documents.map((document) => ({
          filename: document.filename,
          method: document.method,
          characters: document.text.length,
          warnings: document.warnings,
        })),
        ollamaEnhanced: report.ollamaEnhanced,
      },
    });
  } catch (error) {
    console.error("Local screening analysis failed", error);
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
      return `Formato non supportato: ${file.name}. Usa PDF, JPG o PNG.`;
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
