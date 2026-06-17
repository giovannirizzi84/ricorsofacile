import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Confidence = "Alta" | "Media" | "Bassa" | "Non rilevato";

type GeminiVisionOutput = {
  structuredData: {
    authority: string;
    municipality: string;
    noticeNumber: string;
    plate: string;
    articleCode: string;
    paragraph: string;
    amount: string;
    reducedAmount: string;
    points: string;
    violationType: string;
    classification: string;
    deadlines: {
      prefetto: string;
      giudiceDiPace: string;
    };
    confidence: Record<string, Confidence>;
  };
  pages: Array<{
    filename: string;
    pageType:
      | "MAIN_VERBALE"
      | "PAYMENT_NOTICE"
      | "RECOURSE_INFORMATION"
      | "DRIVER_DATA_FORM"
      | "OTHER";
    evidence: string;
  }>;
  extractedData: Array<{
    key: string;
    value: string;
    confidence: Confidence;
    evidence: string;
  }>;
  summary: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: Record<string, unknown>;
};

const endpointBase = "https://generativelanguage.googleapis.com/v1beta/models";
const imagePaths = [
  "/Users/giovannirizzi/Downloads/IMG_6357.JPG",
  "/Users/giovannirizzi/Downloads/IMG_6358.JPG",
  "/Users/giovannirizzi/Downloads/IMG_6359.JPG",
  "/Users/giovannirizzi/Downloads/IMG_6360.JPG",
];
const expected = {
  municipality: "Milano",
  plate: "GE264ZJ",
  articleCode: "142",
  paragraph: "9",
  amount: 740.32,
  points: 6,
};
const outputPath = path.join(
  process.cwd(),
  "evaluation-results",
  "gemini-live-test.json",
);

async function main() {
await loadLocalEnv();

const apiKey = process.env.GEMINI_API_KEY?.trim();
assert.ok(
  apiKey,
  "GEMINI_API_KEY mancante. Inseriscila in .env.local prima di eseguire npm run test:vision.",
);

const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const endpoint = `${endpointBase}/${encodeURIComponent(model)}:generateContent`;
const images = await Promise.all(
  imagePaths.map(async (imagePath) => ({
    filename: path.basename(imagePath),
    mimeType: "image/jpeg",
    data: (await readFile(imagePath)).toString("base64"),
  })),
);
const startedAt = Date.now();
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  },
  body: JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(images.map((image) => image.filename)) },
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
      maxOutputTokens: 4_096,
      responseMimeType: "application/json",
      responseSchema: visionResponseSchema,
    },
  }),
});
const responseTimeMs = Date.now() - startedAt;
const responseText = await response.text();

if (!response.ok) {
  await saveResult({
    ok: false,
    endpoint,
    model,
    responseTimeMs,
    httpStatus: response.status,
    error: responseText,
  });
  throw new Error(
    `Gemini Vision live test fallito: HTTP ${response.status}. Dettagli salvati in ${outputPath}`,
  );
}

const rawResponse = JSON.parse(responseText) as GeminiResponse;
const rawOutput = rawResponse.candidates?.[0]?.content?.parts
  ?.map((part) => part.text ?? "")
  .join("")
  .trim();
assert.ok(rawOutput, "Gemini non ha restituito testo JSON nel primo candidato.");

const parsedOutput = JSON.parse(rawOutput) as GeminiVisionOutput;
const extracted = normalizeExtracted(parsedOutput);
const comparisons = {
  municipality: equalsLoose(extracted.municipality, expected.municipality),
  plate: equalsLoose(extracted.plate, expected.plate),
  articleCode: equalsLoose(extracted.articleCode, expected.articleCode),
  paragraph: equalsLoose(extracted.paragraph, expected.paragraph),
  amount: equalsNumber(extracted.amount, expected.amount),
  points: equalsNumber(extracted.points, expected.points),
};
const passed = Object.values(comparisons).filter(Boolean).length;
const total = Object.keys(comparisons).length;
const accuracy = Number(((passed / total) * 100).toFixed(2));
const result = {
  ok: true,
  endpoint,
  model,
  responseTimeMs,
  usageMetadata: rawResponse.usageMetadata ?? null,
  expected,
  extracted,
  comparisons,
  accuracy,
  rawGeminiJson: parsedOutput,
  rawGeminiResponse: rawResponse,
};

await saveResult(result);

console.log(`Endpoint: ${endpoint}`);
console.log(`Modello: ${model}`);
console.log(`Tempo risposta: ${responseTimeMs} ms`);
console.log(
  `Token utilizzati: ${JSON.stringify(rawResponse.usageMetadata ?? null)}`,
);
console.log("Output JSON Gemini:");
console.log(JSON.stringify(parsedOutput, null, 2));
console.log("Campi estratti:");
console.log(JSON.stringify(extracted, null, 2));
console.log(`Accuracy: ${accuracy}% (${passed}/${total})`);
console.log(`Risultato salvato in: ${outputPath}`);

if (accuracy < 100) {
  process.exitCode = 1;
}
}

async function loadLocalEnv() {
  try {
    const envFile = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // .env.local is optional; CI/Vercel can provide env vars directly.
  }
}

async function saveResult(result: unknown) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

function normalizeExtracted(output: GeminiVisionOutput) {
  const data = output.structuredData;
  const fallback = new Map(
    output.extractedData.map((field) => [field.key, field.value]),
  );

  return {
    municipality: pick(data.municipality, fallback.get("municipality")),
    plate: pick(data.plate, fallback.get("plate")),
    articleCode: pick(data.articleCode, fallback.get("article")),
    paragraph: pick(data.paragraph, fallback.get("paragraph")),
    amount: pick(data.amount, fallback.get("amount")),
    points: pick(data.points, fallback.get("licensePoints")),
    authority: pick(data.authority, fallback.get("authority")),
    noticeNumber: pick(data.noticeNumber, fallback.get("reportNumber")),
    violationType: data.violationType,
    classification: data.classification,
  };
}

function pick(primary?: string, fallback?: string) {
  const value = primary?.trim();
  if (value && !/non rilevato/i.test(value)) return value;
  return fallback?.trim() || value || "";
}

function equalsLoose(actual: string, expectedValue: string) {
  return normalizeToken(actual).includes(normalizeToken(expectedValue));
}

function equalsNumber(actual: string, expectedValue: number) {
  const parsed = parseItalianNumber(actual);
  return parsed !== null && Math.abs(parsed - expectedValue) < 0.01;
}

function normalizeToken(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function parseItalianNumber(value: string) {
  const match = value.match(/\d{1,3}(?:[.,]\d{2})?|\d+/);
  if (!match) return null;
  return Number(match[0].replace(",", "."));
}

function buildPrompt(filenames: string[]) {
  return `
Analizza realmente queste 4 immagini fotografiche di un verbale del Comune di Milano.
Non usare dati simulati. Non inventare dati mancanti.

Restituisci esclusivamente JSON conforme allo schema.

Obiettivo:
- classificare ogni immagine/pagina;
- estrarre dati strutturati;
- indicare confidenza per ogni campo;
- usare "Non rilevato nel documento caricato" quando un dato non è leggibile.

Campi richiesti in structuredData:
- authority
- municipality
- noticeNumber
- plate
- articleCode
- paragraph
- amount
- reducedAmount
- points
- violationType
- classification
- deadlines.prefetto
- deadlines.giudiceDiPace
- confidence

Immagini inviate:
${filenames.map((filename, index) => `${index + 1}. ${filename}`).join("\n")}
`.trim();
}

const confidenceEnum = ["Alta", "Media", "Bassa", "Non rilevato"];

const visionResponseSchema = {
  type: "object",
  properties: {
    structuredData: {
      type: "object",
      properties: {
        authority: { type: "string" },
        municipality: { type: "string" },
        noticeNumber: { type: "string" },
        plate: { type: "string" },
        articleCode: { type: "string" },
        paragraph: { type: "string" },
        amount: { type: "string" },
        reducedAmount: { type: "string" },
        points: { type: "string" },
        violationType: { type: "string" },
        classification: { type: "string" },
        deadlines: {
          type: "object",
          properties: {
            prefetto: { type: "string" },
            giudiceDiPace: { type: "string" },
          },
          required: ["prefetto", "giudiceDiPace"],
        },
        confidence: {
          type: "object",
          properties: {
            authority: { type: "string", enum: confidenceEnum },
            municipality: { type: "string", enum: confidenceEnum },
            noticeNumber: { type: "string", enum: confidenceEnum },
            plate: { type: "string", enum: confidenceEnum },
            articleCode: { type: "string", enum: confidenceEnum },
            paragraph: { type: "string", enum: confidenceEnum },
            amount: { type: "string", enum: confidenceEnum },
            reducedAmount: { type: "string", enum: confidenceEnum },
            points: { type: "string", enum: confidenceEnum },
            violationType: { type: "string", enum: confidenceEnum },
            classification: { type: "string", enum: confidenceEnum },
          },
          required: [
            "authority",
            "municipality",
            "noticeNumber",
            "plate",
            "articleCode",
            "paragraph",
            "amount",
            "reducedAmount",
            "points",
            "violationType",
            "classification",
          ],
        },
      },
      required: [
        "authority",
        "municipality",
        "noticeNumber",
        "plate",
        "articleCode",
        "paragraph",
        "amount",
        "reducedAmount",
        "points",
        "violationType",
        "classification",
        "deadlines",
        "confidence",
      ],
    },
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          filename: { type: "string" },
          pageType: {
            type: "string",
            enum: [
              "MAIN_VERBALE",
              "PAYMENT_NOTICE",
              "RECOURSE_INFORMATION",
              "DRIVER_DATA_FORM",
              "OTHER",
            ],
          },
          evidence: { type: "string" },
        },
        required: ["filename", "pageType", "evidence"],
      },
    },
    extractedData: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          confidence: { type: "string", enum: confidenceEnum },
          evidence: { type: "string" },
        },
        required: ["key", "value", "confidence", "evidence"],
      },
    },
    summary: { type: "string" },
  },
  required: ["structuredData", "pages", "extractedData", "summary"],
};

await main();
