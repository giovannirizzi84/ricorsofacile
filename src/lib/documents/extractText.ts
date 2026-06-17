import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import { getPath as getPdfWorkerPath } from "pdf-parse/worker";
import {
  prepareImageForVision,
  type ImagePreprocessingMetadata,
} from "./longReceiptImages.ts";

const minimumNativePdfText = 120;
const usefulDataPattern =
  /verbale|codice della strada|art\.?|articolo|targa|polizia locale|comune|violazione|sanzione|importo|prefetto|giudice di pace/i;
const maxOcrPdfPages = 5;
const ocrTimeoutMs = 75_000;

PDFParse.setWorker(pathToFileURL(getPdfWorkerPath()).href);

export type VisionDocumentImage = {
  filename: string;
  mimeType: string;
  data: string;
};

export type DocumentExtractionAnalysis = {
  type: "PDF" | "IMAGE";
  characters: number;
  quality: "Buona" | "Parziale" | "Insufficiente";
  hasUsefulData: boolean;
  textExtraction: "native" | "ocr";
  imagePreprocessing?: ImagePreprocessingMetadata;
};

export type ExtractedDocument = {
  filename: string;
  text: string;
  method: "OCR" | "Testo PDF" | "Gemini Vision";
  pages?: number;
  warnings: string[];
  analysis: DocumentExtractionAnalysis;
  visionImages: VisionDocumentImage[];
};

export type ExtractDocumentsOptions = {
  deferOcrForVision?: boolean;
  ocrEnabled?: boolean;
};

type TesseractWorker = Awaited<
  ReturnType<typeof import("tesseract.js")["createWorker"]>
>;

export async function extractDocuments(
  files: File[],
  options: ExtractDocumentsOptions = {},
) {
  const documents: ExtractedDocument[] = [];
  const workerState: { current: TesseractWorker | null } = { current: null };
  const ocrEnabled = options.ocrEnabled ?? true;

  async function recognize(buffer: Buffer) {
    if (!ocrEnabled) {
      const error = new Error("OCR_DISABLED");
      error.name = "OCR_DISABLED";
      throw error;
    }
    workerState.current ??= await createItalianWorker();
    const result = await suppressTesseractSpecialWordsWarning(() =>
      withTimeout(
        workerState.current!.recognize(buffer),
        ocrTimeoutMs,
        "OCR_TIMEOUT",
      ),
    );
    return normalizeText(result.data.text);
  }

  return suppressTesseractSpecialWordsWarning(async () => {
    try {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (file.type === "application/pdf") {
          documents.push(await extractPdf(buffer, file.name, recognize, options));
        } else {
          documents.push(await extractImage(buffer, file.name, recognize, options));
        }
      }
    } finally {
      await workerState.current?.terminate();
    }

    return documents;
  });
}

async function extractImage(
  buffer: Buffer,
  filename: string,
  recognize: (buffer: Buffer) => Promise<string>,
  options: ExtractDocumentsOptions,
) {
  const mimeType = mimeTypeFromFilename(filename) ?? "image/jpeg";
  const prepared = prepareImageForVision(buffer, filename, mimeType);
  const imagesForOcr =
    prepared.metadata.layout === "LONG_RECEIPT_IMAGE"
      ? prepared.visionImages.filter(
          (image) => !/crop centrale/i.test(image.filename),
        )
      : prepared.visionImages;
  const text = options.deferOcrForVision
    ? ""
    : normalizeText(
        (
          await Promise.all(
            imagesForOcr.map((image) =>
              recognize(Buffer.from(image.data, "base64")),
            ),
          )
        ).join("\n\n"),
      );
  const analysis = buildAnalysis("IMAGE", text, "ocr");

  return {
    filename,
    text,
    method: options.deferOcrForVision ? "Gemini Vision" as const : "OCR" as const,
    warnings: options.deferOcrForVision
      ? ["OCR non eseguito in fase iniziale: analisi immagini affidata al motore visivo."]
      : [],
    analysis: {
      ...analysis,
      imagePreprocessing: prepared.metadata,
    },
    visionImages: prepared.visionImages,
  };
}

async function extractPdf(
  buffer: Buffer,
  filename: string,
  recognize: (buffer: Buffer) => Promise<string>,
  options: ExtractDocumentsOptions,
) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const nativeResult = await parser.getText();
    const nativeText = normalizeText(nativeResult.text);
    const nativeAnalysis = buildAnalysis("PDF", nativeText, "native");

    const screenshots = await parser.getScreenshot({
      first: maxOcrPdfPages,
      desiredWidth: 1800,
      imageDataUrl: false,
      imageBuffer: true,
    });
    const pageTexts: string[] = [];
    const visionImages: VisionDocumentImage[] = [];

    for (const [index, page] of screenshots.pages.entries()) {
      const pageBuffer = Buffer.from(page.data);
      if (!options.deferOcrForVision) {
        pageTexts.push(await recognize(pageBuffer));
      }
      visionImages.push({
        filename: `${filename} - pagina ${index + 1}.png`,
        mimeType: "image/png",
        data: pageBuffer.toString("base64"),
      });
    }

    const warnings =
      screenshots.pages.length >= maxOcrPdfPages
        ? [
            `Il PDF è scannerizzato: OCR limitato alle prime ${maxOcrPdfPages} pagine.`,
          ]
        : [];
    const ocrWarnings = options.deferOcrForVision
      ? ["OCR non eseguito in fase iniziale: PDF scannerizzato affidato al motore visivo."]
      : [];
    const extractedText = isNativePdfTextUseful(nativeAnalysis)
      ? nativeText
      : normalizeText(pageTexts.join("\n\n"));
    const method = isNativePdfTextUseful(nativeAnalysis)
      ? "Testo PDF" as const
      : options.deferOcrForVision
        ? "Gemini Vision" as const
        : "OCR" as const;

    return {
      filename,
      text: extractedText,
      method,
      pages: nativeResult.total || screenshots.pages.length,
      warnings: isNativePdfTextUseful(nativeAnalysis)
        ? warnings
        : [...warnings, ...ocrWarnings],
      analysis: isNativePdfTextUseful(nativeAnalysis)
        ? nativeAnalysis
        : buildAnalysis(
            "PDF",
            extractedText,
            "ocr",
          ),
      visionImages,
    };
  } finally {
    await parser.destroy();
  }
}

function isNativePdfTextUseful(analysis: DocumentExtractionAnalysis) {
  return (
    analysis.characters >= minimumNativePdfText &&
    analysis.quality !== "Insufficiente" &&
    analysis.hasUsefulData
  );
}

function buildAnalysis(
  type: DocumentExtractionAnalysis["type"],
  text: string,
  textExtraction: DocumentExtractionAnalysis["textExtraction"],
): DocumentExtractionAnalysis {
  const characters = text.length;
  const hasUsefulData = usefulDataPattern.test(text);

  return {
    type,
    characters,
    quality: getExtractionQuality(characters, hasUsefulData),
    hasUsefulData,
    textExtraction,
  };
}

function getExtractionQuality(
  characters: number,
  hasUsefulData: boolean,
): DocumentExtractionAnalysis["quality"] {
  if (characters >= 600 && hasUsefulData) {
    return "Buona";
  }
  if (characters >= minimumNativePdfText && hasUsefulData) {
    return "Parziale";
  }
  return "Insufficiente";
}

function mimeTypeFromFilename(filename: string) {
  const extension = filename.toLowerCase().split(".").at(-1);
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  return null;
}

async function createItalianWorker() {
  const { createWorker, OEM } = await import("tesseract.js");
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

function withTimeout<T>(promise: Promise<T>, ms: number, code: string) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(code);
        error.name = code;
        reject(error);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function suppressTesseractSpecialWordsWarning<T>(
  operation: () => Promise<T>,
) {
  const originalError = console.error;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (/failed to load\s+\.\/ita\.special-words/i.test(message)) {
      return;
    }
    originalError(...args);
  };
  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const message = Buffer.isBuffer(chunk) || chunk instanceof Uint8Array
      ? Buffer.from(chunk).toString("utf8")
      : String(chunk);
    if (/failed to load\s+\.\/ita\.special-words/i.test(message)) {
      return true;
    }
    return originalStderrWrite(chunk as never, ...(args as never[]));
  }) as typeof process.stderr.write;

  try {
    return await operation();
  } finally {
    console.error = originalError;
    process.stderr.write = originalStderrWrite as typeof process.stderr.write;
  }
}
