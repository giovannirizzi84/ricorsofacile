import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import { getPath as getPdfWorkerPath } from "pdf-parse/worker";
import { createWorker, OEM, type Worker } from "tesseract.js";

const minimumNativePdfText = 120;
const maxOcrPdfPages = 5;

PDFParse.setWorker(pathToFileURL(getPdfWorkerPath()).href);

export type ExtractedDocument = {
  filename: string;
  text: string;
  method: "OCR" | "Testo PDF";
  pages?: number;
  warnings: string[];
};

export async function extractDocuments(files: File[]) {
  const documents: ExtractedDocument[] = [];
  const workerState: { current: Worker | null } = { current: null };

  async function recognize(buffer: Buffer) {
    workerState.current ??= await createItalianWorker();
    const result = await workerState.current.recognize(buffer);
    return normalizeText(result.data.text);
  }

  try {
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (file.type === "application/pdf") {
        documents.push(await extractPdf(buffer, file.name, recognize));
      } else {
        documents.push(await extractImage(buffer, file.name, recognize));
      }
    }
  } finally {
    await workerState.current?.terminate();
  }

  return documents;
}

async function extractImage(
  buffer: Buffer,
  filename: string,
  recognize: (buffer: Buffer) => Promise<string>,
) {
  return {
    filename,
    text: await recognize(buffer),
    method: "OCR" as const,
    warnings: [],
  };
}

async function extractPdf(
  buffer: Buffer,
  filename: string,
  recognize: (buffer: Buffer) => Promise<string>,
) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const nativeResult = await parser.getText();
    const nativeText = normalizeText(nativeResult.text);

    if (nativeText.length >= minimumNativePdfText) {
      return {
        filename,
        text: nativeText,
        method: "Testo PDF" as const,
        pages: nativeResult.total,
        warnings: [],
      };
    }

    const screenshots = await parser.getScreenshot({
      first: maxOcrPdfPages,
      desiredWidth: 1800,
      imageDataUrl: false,
      imageBuffer: true,
    });
    const pageTexts: string[] = [];

    for (const page of screenshots.pages) {
      pageTexts.push(await recognize(Buffer.from(page.data)));
    }

    const warnings =
      screenshots.pages.length >= maxOcrPdfPages
        ? [
            `Il PDF è scannerizzato: OCR limitato alle prime ${maxOcrPdfPages} pagine.`,
          ]
        : [];

    return {
      filename,
      text: normalizeText(pageTexts.join("\n\n")),
      method: "OCR" as const,
      pages: screenshots.pages.length,
      warnings,
    };
  } finally {
    await parser.destroy();
  }
}

async function createItalianWorker() {
  return createWorker("ita", OEM.LSTM_ONLY, {
    workerPath: path.join(
      process.cwd(),
      "node_modules/tesseract.js/src/worker-script/node/index.js",
    ),
    corePath: path.join(process.cwd(), "node_modules/tesseract.js-core"),
    langPath: path.join(
      process.cwd(),
      "node_modules/@tesseract.js-data/ita/4.0.0",
    ),
    gzip: true,
  });
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
