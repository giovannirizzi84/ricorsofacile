import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GeminiVisionOutput = {
  municipality: string;
  plate: string;
  articleCode: string;
  paragraph: string;
  amount: string;
  points: string;
  classification: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: Record<string, unknown>;
};

type GeminiAttempt = {
  model: string;
  endpoint: string;
  attempt: number;
  responseTimeMs: number;
  httpStatus: number | null;
  ok: boolean;
  error?: string;
  rawOutputSnippet?: string;
};

const endpointBase = "https://generativelanguage.googleapis.com/v1beta/models";
const temporaryErrorStatuses = new Set([429, 500, 502, 503, 504]);
const attemptsPerModel = 3;
const requestTimeoutMs = 45_000;
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
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY mancante. Inseriscila in .env.local prima di eseguire npm run test:vision.",
    );
  }

  const images = await Promise.all(
    imagePaths.map(async (imagePath) => ({
      filename: path.basename(imagePath),
      mimeType: "image/jpeg",
      data: (await readFile(imagePath)).toString("base64"),
    })),
  );
  const models = getModelsToTry();
  console.log("Gemini Vision live test");
  console.log(`Immagini: ${images.map((image) => image.filename).join(", ")}`);
  console.log(`Modelli: ${models.join(", ")}`);
  console.log(`Timeout per tentativo: ${requestTimeoutMs / 1000}s`);
  console.log(
    `Schema Gemini: ${shouldUseResponseSchema() ? "attivo" : "disattivato"}`,
  );
  console.log("");
  const liveResult = await callGeminiWithRetries(apiKey, models, images);

  if (!liveResult.ok) {
    await saveResult({
      ok: false,
      models,
      attempts: liveResult.attempts,
      error:
        liveResult.lastError ??
        "Gemini Vision non ha restituito una risposta valida.",
    });
    throw new Error(
      `Gemini Vision live test fallito dopo ${liveResult.attempts.length} tentativi. Dettagli salvati in ${outputPath}`,
    );
  }

  const { endpoint, model, responseTimeMs, rawResponse, rawOutput, parsedOutput } =
    liveResult;
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
    attempts: liveResult.attempts,
    usageMetadata: rawResponse.usageMetadata ?? null,
    expected,
    extracted,
    comparisons,
    accuracy,
    rawGeminiText: rawOutput,
    rawGeminiJson: parsedOutput,
    rawGeminiResponse: rawResponse,
  };

  await saveResult(result);

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Modello: ${model}`);
  console.log(`Tempo risposta: ${responseTimeMs} ms`);
  console.log(`Tentativi: ${liveResult.attempts.length}`);
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

function getModelsToTry() {
  const configured = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const fallbackModels = (
    process.env.GEMINI_VISION_FALLBACK_MODELS ??
    "gemini-2.0-flash"
  )
      .split(",")
      .map((model) => model.trim())
      .filter((model) => model && model !== "gemini-1.5-flash");

  return Array.from(new Set([configured, ...fallbackModels]));
}

function buildGenerationConfig() {
  return {
    temperature: 0,
    maxOutputTokens: 1_024,
    responseMimeType: "application/json",
    ...(shouldUseResponseSchema() ? { responseSchema: visionResponseSchema } : {}),
  };
}

function shouldUseResponseSchema() {
  return process.env.GEMINI_VISION_USE_SCHEMA === "1";
}

async function callGeminiWithRetries(
  apiKey: string,
  models: string[],
  images: Array<{ filename: string; mimeType: string; data: string }>,
): Promise<
  | {
      ok: true;
      endpoint: string;
      model: string;
      responseTimeMs: number;
      rawResponse: GeminiResponse;
      rawOutput: string;
      parsedOutput: GeminiVisionOutput;
      attempts: GeminiAttempt[];
    }
  | {
      ok: false;
      attempts: GeminiAttempt[];
      lastError: string | null;
    }
> {
  const attempts: GeminiAttempt[] = [];
  let lastError: string | null = null;

  for (const model of models) {
    const endpoint = `${endpointBase}/${encodeURIComponent(model)}:generateContent`;

    for (let attempt = 1; attempt <= attemptsPerModel; attempt += 1) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      console.log(
        `Tentativo ${attempt}/${attemptsPerModel} con ${model}...`,
      );

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
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
            generationConfig: buildGenerationConfig(),
          }),
        });
        const responseTimeMs = Date.now() - startedAt;
        const responseText = await response.text();
        clearTimeout(timeout);

        attempts.push({
          model,
          endpoint,
          attempt,
          responseTimeMs,
          httpStatus: response.status,
          ok: response.ok,
          ...(response.ok ? {} : { error: responseText }),
        });
        await saveProgress({
          models,
          attempts,
          lastError: response.ok ? null : responseText,
        });
        console.log(
          `Risposta ${response.status} in ${responseTimeMs} ms (${model}, tentativo ${attempt})`,
        );

        if (response.ok) {
          const rawResponse = JSON.parse(responseText) as GeminiResponse;
          const rawOutput = extractGeminiText(rawResponse);
          const parsedOutput = parseVisionJson(rawOutput);

          if (!parsedOutput) {
            const error =
              "Risposta Gemini non valida: JSON mancante, troncato o non parseabile";
            lastError = error;
            attempts[attempts.length - 1] = {
              ...attempts[attempts.length - 1],
              ok: false,
              error,
              rawOutputSnippet: rawOutput?.slice(0, 1_500),
            };
            await saveProgress({
              models,
              attempts,
              lastError,
              rawOutput,
            });
            console.log(`${error}. Passo al prossimo tentativo disponibile.`);
            await wait(getBackoffMs(attempt));
            continue;
          }

          return {
            ok: true,
            endpoint,
            model,
            responseTimeMs,
            rawResponse,
            rawOutput,
            parsedOutput,
            attempts,
          };
        }

        lastError = responseText;
        if (!temporaryErrorStatuses.has(response.status)) {
          break;
        }

        const backoffMs = getBackoffMs(attempt);
        console.log(`Errore temporaneo. Nuovo tentativo tra ${backoffMs / 1000}s.`);
        await wait(backoffMs);
      } catch (error) {
        clearTimeout(timeout);
        const responseTimeMs = Date.now() - startedAt;
        lastError =
          error instanceof Error && error.name === "AbortError"
            ? `Timeout dopo ${requestTimeoutMs / 1000}s`
            : error instanceof Error
              ? error.message
              : "Errore fetch sconosciuto";
        attempts.push({
          model,
          endpoint,
          attempt,
          responseTimeMs,
          httpStatus: null,
          ok: false,
          error: lastError,
        });
        await saveProgress({
          models,
          attempts,
          lastError,
        });
        console.log(
          `Errore in ${responseTimeMs} ms (${model}, tentativo ${attempt}): ${lastError}`,
        );
        const backoffMs = getBackoffMs(attempt);
        console.log(`Nuovo tentativo tra ${backoffMs / 1000}s.`);
        await wait(backoffMs);
      }
    }
  }

  return {
    ok: false,
    attempts,
    lastError,
  };
}

async function saveProgress(result: unknown) {
  await saveResult({
    ok: false,
    inProgress: true,
    updatedAt: new Date().toISOString(),
    ...asObject(result),
  });
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null ? value : {};
}

function getBackoffMs(attempt: number) {
  return attempt * 2_000;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractGeminiText(response: GeminiResponse) {
  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function parseVisionJson(rawOutput: string) {
  if (!rawOutput) return null;

  try {
    return JSON.parse(rawOutput) as GeminiVisionOutput;
  } catch {
    return parsePartialVisionJson(rawOutput);
  }
}

function parsePartialVisionJson(rawOutput: string): GeminiVisionOutput | null {
  const output = {
    municipality: extractJsonString(rawOutput, "municipality"),
    plate: extractJsonString(rawOutput, "plate"),
    articleCode: extractJsonString(rawOutput, "articleCode"),
    paragraph: extractJsonString(rawOutput, "paragraph"),
    amount: extractJsonString(rawOutput, "amount"),
    points: extractJsonString(rawOutput, "points"),
    classification: extractJsonString(rawOutput, "classification"),
  };

  if (
    output.municipality &&
    output.plate &&
    output.articleCode &&
    output.paragraph &&
    output.amount &&
    output.points
  ) {
    return {
      ...output,
      classification:
        output.classification || "Non rilevato nel documento caricato",
    };
  }

  return null;
}

function extractJsonString(rawOutput: string, key: keyof GeminiVisionOutput) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rawOutput.match(
    new RegExp(`"${escapedKey}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );

  return match?.[1]?.replace(/\\"/g, "\"").trim() ?? "";
}

function normalizeExtracted(output: GeminiVisionOutput) {
  return {
    municipality: output.municipality,
    plate: output.plate,
    articleCode: output.articleCode,
    paragraph: output.paragraph,
    amount: output.amount,
    points: output.points,
    classification: output.classification,
  };
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
Non usare Markdown. Non aggiungere testo fuori dal JSON.

Obiettivo:
- estrarre solo i campi richiesti dal benchmark;
- usare "Non rilevato nel documento caricato" quando un dato non è leggibile.
- usa stringhe brevi, senza frasi lunghe.

Campi richiesti:
- municipality
- plate
- articleCode
- paragraph
- amount
- points
- classification

Formato atteso:
{
  "municipality": "Milano",
  "plate": "GE264ZJ",
  "articleCode": "142",
  "paragraph": "9",
  "amount": "740,32",
  "points": "6",
  "classification": "Autovelox / Eccesso di velocità"
}

Immagini inviate:
${filenames.map((filename, index) => `${index + 1}. ${filename}`).join("\n")}
`.trim();
}

const visionResponseSchema = {
  type: "object",
  properties: {
    municipality: { type: "string" },
    plate: { type: "string" },
    articleCode: { type: "string" },
    paragraph: { type: "string" },
    amount: { type: "string" },
    points: { type: "string" },
    classification: { type: "string" },
  },
  required: [
    "municipality",
    "plate",
    "articleCode",
    "paragraph",
    "amount",
    "points",
    "classification",
  ],
};

await main();
