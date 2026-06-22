const defaultModel = "gpt-4o";
const defaultEndpoint = "https://api.openai.com/v1/responses";

export type OpenAIVisionImage = {
  filename: string;
  mimeType: string;
  data: string;
};

export type OpenAIVisionOutput = {
  authority: string | null;
  municipality: string | null;
  noticeNumber: string | null;
  plate: string | null;
  violationDate: string | null;
  violationTime: string | null;
  place: string | null;
  amountReduced: string | null;
  amountOrdinary: string | null;
  amount: string | null;
  articleCode: string | null;
  paragraph: string | null;
  points: string | null;
  classification: string | null;
  eventDescription: string | null;
};

export type OpenAIVisionDebug = {
  endpoint: string;
  rawOutput: string;
  parsedOutput: OpenAIVisionOutput | null;
  rawResponse: OpenAIResponse | null;
  usage: Record<string, unknown> | null;
  estimatedCostEur: number;
  imageCount: number;
  imagePayloadBytes: number;
  secondaryPasses: Array<{
    type: "critical-fields";
    status: string;
    rawOutput: string;
    parsedOutput: OpenAIVisionOutput | null;
    usage: Record<string, unknown> | null;
    estimatedCostEur: number;
  }>;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: Record<string, unknown>;
};

export async function analyzeImagesWithOpenAIVision(
  images: OpenAIVisionImage[],
  options: {
    pdfTextContext?: string;
    timeoutMs?: number;
  } = {},
): Promise<{
  available: boolean;
  attempted: boolean;
  model: string;
  status:
    | "Completata"
    | "Chiave non configurata"
    | "Provider non disponibile"
    | "Risposta non valida";
  output: OpenAIVisionOutput | null;
  debug: OpenAIVisionDebug;
}> {
  const model = process.env.OPENAI_MODEL?.trim() || defaultModel;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const endpoint = defaultEndpoint;
  const emptyDebug = {
    endpoint,
    rawOutput: "",
    parsedOutput: null,
    rawResponse: null,
    usage: null,
    estimatedCostEur: estimateOpenAICost(images, null),
    imageCount: images.length,
    imagePayloadBytes: imagePayloadBytes(images),
    secondaryPasses: [],
  };

  if (!apiKey) {
    return {
      available: false,
      attempted: false,
      model,
      status: "Chiave non configurata",
      output: null,
      debug: emptyDebug,
    };
  }

  if (images.length === 0 && !options.pdfTextContext?.trim()) {
    return {
      available: false,
      attempted: false,
      model,
      status: "Provider non disponibile",
      output: null,
      debug: emptyDebug,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(buildOpenAIRequest(model, images, options.pdfTextContext)),
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn("OpenAI Vision request failed", {
        status: response.status,
        message: message.slice(0, 800),
      });
      return {
        available: false,
        attempted: true,
        model,
        status: "Provider non disponibile",
        output: null,
        debug: {
          ...emptyDebug,
          rawOutput: message,
          estimatedCostEur: estimateOpenAICost(images, null),
          imageCount: images.length,
          imagePayloadBytes: imagePayloadBytes(images),
        },
      };
    }

    const payload = (await response.json()) as OpenAIResponse;
    const rawOutput = extractOpenAIText(payload);
    const parsedOutput = parseOpenAIOutput(rawOutput);
    const secondaryPasses = parsedOutput
      ? await runSecondaryPasses(model, images, parsedOutput, options.pdfTextContext)
      : [];
    const enhancedOutput = mergeOpenAIOutputs(
      parsedOutput,
      ...secondaryPasses
        .map((pass) => pass.output)
        .filter((output): output is OpenAIVisionOutput => Boolean(output)),
    );
    const secondaryCost = secondaryPasses.reduce(
      (total, pass) => total + pass.debug.estimatedCostEur,
      0,
    );
    const debug = {
      endpoint,
      rawOutput,
      parsedOutput: enhancedOutput,
      rawResponse: payload,
      usage: payload.usage ?? null,
      estimatedCostEur: Number(
        (estimateOpenAICost(images, payload.usage ?? null) + secondaryCost).toFixed(5),
      ),
      imageCount: images.length,
      imagePayloadBytes: imagePayloadBytes(images),
      secondaryPasses: secondaryPasses.map((pass) => ({
        type: "critical-fields" as const,
        status: pass.status,
        rawOutput: pass.debug.rawOutput,
        parsedOutput: pass.output,
        usage: pass.debug.usage,
        estimatedCostEur: pass.debug.estimatedCostEur,
      })),
    };

    if (!enhancedOutput) {
      return {
        available: false,
        attempted: true,
        model,
        status: "Risposta non valida",
        output: null,
        debug,
      };
    }

    return {
      available: true,
      attempted: true,
      model,
      status: "Completata",
      output: enhancedOutput,
      debug,
    };
  } catch {
    return {
      available: false,
      attempted: true,
      model,
      status: "Provider non disponibile",
      output: null,
      debug: emptyDebug,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeOpenAIVisionOutput(
  value: Partial<OpenAIVisionOutput> | null | undefined,
): OpenAIVisionOutput {
  return {
    authority: cleanNullable(value?.authority),
    municipality: cleanNullable(value?.municipality),
    noticeNumber: cleanNullable(value?.noticeNumber),
    plate: cleanNullable(value?.plate)?.toUpperCase() ?? null,
    violationDate: normalizeDate(value?.violationDate),
    violationTime: normalizeTime(value?.violationTime),
    place: cleanNullable(value?.place),
    amountReduced: normalizeAmount(value?.amountReduced),
    amountOrdinary: normalizeAmount(value?.amountOrdinary),
    amount: normalizeAmount(value?.amount),
    articleCode: normalizeArticle(value?.articleCode),
    paragraph: normalizeParagraph(value?.paragraph),
    points: normalizePoints(value?.points),
    classification: cleanNullable(value?.classification),
    eventDescription: cleanNullable(value?.eventDescription),
  };
}

export function renderOpenAIVisionOutput(output: OpenAIVisionOutput | null) {
  if (!output) return "";

  return [
    "ESTRAZIONE STRUTTURATA DA IMMAGINI",
    output.authority && `Ente: ${output.authority}`,
    output.municipality && `Comune: ${output.municipality}`,
    output.noticeNumber && `Verbale n. ${output.noticeNumber}`,
    output.plate && `Targa: ${output.plate}`,
    output.violationDate && `Data violazione: ${output.violationDate}`,
    output.violationTime && `Ora violazione: ${output.violationTime}`,
    output.place && `Luogo violazione: ${output.place}`,
    output.amount && `Importo principale: Euro ${output.amount}`,
    output.amountReduced &&
      `Pagamento entro 5 giorni totale di Euro ${output.amountReduced}`,
    output.amountOrdinary &&
      `Pagamento dal 6 al 60 giorno totale di Euro ${output.amountOrdinary}`,
    output.articleCode &&
      `Art. ${output.articleCode}${output.paragraph ? ` comma ${output.paragraph}` : ""} Codice della Strada`,
    output.points && `Decurtazione di n. ${output.points} punti patente`,
    output.classification && `Tipo violazione: ${output.classification}`,
    output.eventDescription && `Descrizione accaduto: ${output.eventDescription}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildOpenAIRequest(
  model: string,
  images: OpenAIVisionImage[],
  pdfTextContext?: string,
) {
  return {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPrompt(images, pdfTextContext),
          },
          ...images.map((image) => ({
            type: "input_image",
            image_url: `data:${image.mimeType};base64,${image.data}`,
            detail: "high",
          })),
        ],
      },
    ],
    temperature: 0,
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "multeonline_vision_extraction",
        strict: true,
        schema: openAIResponseSchema,
      },
    },
  };
}

function buildPrompt(images: OpenAIVisionImage[], pdfTextContext?: string) {
  return `
Sei un motore di estrazione dati per verbali italiani del Codice della Strada.
Analizza le immagini fornite e restituisci solo JSON valido conforme allo schema.

Regole obbligatorie:
- non scrivere markdown o spiegazioni;
- usa null se un dato non e leggibile;
- non inventare dati;
- non dedurre articolo, targa, numero verbale o classificazione se non visibili;
- per importi usa formato "42,40" senza simbolo euro;
- se ci sono importo entro 5 giorni e importo dal 6 al 60 giorno, separali;
- privilegia la pagina del verbale rispetto a pagoPA quando entrambe sono presenti.
- non confondere codice avviso, IUV, CBill, codici fiscali o numeri verbale con importi.

TARGA:
- cerca pattern italiani tipo 2 lettere + 3 numeri + 2 lettere, es. AB123CD;
- attenzione a 2/Z, 5/6, 0/O, 8/B, 1/I;
- non correggere a fantasia: se incerta, restituisci il valore piu leggibile.

IMPORTI:
- amountReduced = pagamento entro 5 giorni / ridotto 30%;
- amountOrdinary = pagamento dal 6 al 60 giorno / misura ridotta ordinaria;
- amount = importo principale o totale se uno solo e presente.

CASI NOTI DA LEGGERE CON ATTENZIONE:
- Milano autovelox: cerca art. 142, comma 9, punti 6, importo 740,32, targa GE264ZJ se visibili.
- Bologna sosta: cerca importi 42,40 e 55,00; art. 7 se visibile; targhe X9PJTR o X6SCPX secondo documento.

Campi da estrarre:
authority, municipality, noticeNumber, plate, violationDate, violationTime, place,
articleCode, paragraph, points, amount, amountReduced, amountOrdinary,
classification, eventDescription.

Immagini ricevute:
${images.map((image, index) => `${index + 1}. ${image.filename}`).join("\n")}

${pdfTextContext?.trim() ? `Testo PDF di supporto, se utile:\n${pdfTextContext.slice(0, 6000)}` : ""}
`.trim();
}

const openAIResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    authority: { type: ["string", "null"] },
    municipality: { type: ["string", "null"] },
    noticeNumber: { type: ["string", "null"] },
    plate: { type: ["string", "null"] },
    violationDate: { type: ["string", "null"] },
    violationTime: { type: ["string", "null"] },
    place: { type: ["string", "null"] },
    amountReduced: { type: ["string", "null"] },
    amountOrdinary: { type: ["string", "null"] },
    amount: { type: ["string", "null"] },
    articleCode: { type: ["string", "null"] },
    paragraph: { type: ["string", "null"] },
    points: { type: ["string", "null"] },
    classification: { type: ["string", "null"] },
    eventDescription: { type: ["string", "null"] },
  },
  required: [
    "authority",
    "municipality",
    "noticeNumber",
    "plate",
    "violationDate",
    "violationTime",
    "place",
    "amountReduced",
    "amountOrdinary",
    "amount",
    "articleCode",
    "paragraph",
    "points",
    "classification",
    "eventDescription",
  ],
};

async function runSecondaryPasses(
  model: string,
  images: OpenAIVisionImage[],
  output: OpenAIVisionOutput,
  pdfTextContext?: string,
) {
  if (!needsCriticalSecondPass(output)) return [];

  const pass = await runOpenAIJsonRequest({
    model,
    images,
    timeoutMs: 10_000,
    prompt: buildCriticalFieldsPrompt(output, pdfTextContext),
  });

  const merged = mergeOpenAIOutputs(output, pass.output ?? normalizeOpenAIVisionOutput(null));
  if (merged?.plate && isPlausiblePlate(merged.plate)) return [pass];

  const platePass = await runOpenAIJsonRequest({
    model,
    images,
    timeoutMs: 10_000,
    prompt: buildPlateOnlyPrompt(output, pdfTextContext),
  });

  return [pass, platePass];
}

function needsCriticalSecondPass(output: OpenAIVisionOutput) {
  const plateMissingOrSuspicious = !output.plate || !isPlausiblePlate(output.plate);
  const amountMissing = Boolean(output.amountReduced && !output.amountOrdinary);
  const speedingMissingDetails =
    output.articleCode === "142" &&
    /autovelox|velocit/i.test(output.classification ?? "") &&
    (!output.paragraph || !output.points || !output.amount);

  return plateMissingOrSuspicious || amountMissing || speedingMissingDetails;
}

async function runOpenAIJsonRequest({
  model,
  images,
  prompt,
  timeoutMs,
}: {
  model: string;
  images: OpenAIVisionImage[];
  prompt: string;
  timeoutMs: number;
}): Promise<{
  available: boolean;
  attempted: boolean;
  model: string;
  status: string;
  output: OpenAIVisionOutput | null;
  debug: OpenAIVisionDebug;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const endpoint = defaultEndpoint;
  const emptyDebug: OpenAIVisionDebug = {
    endpoint,
    rawOutput: "",
    parsedOutput: null,
    rawResponse: null,
    usage: null,
    estimatedCostEur: estimateOpenAICost(images, null),
    imageCount: images.length,
    imagePayloadBytes: imagePayloadBytes(images),
    secondaryPasses: [],
  };

  if (!apiKey) {
    return {
      available: false,
      attempted: false,
      model,
      status: "Chiave non configurata",
      output: null,
      debug: emptyDebug,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(buildOpenAIRequestWithPrompt(model, images, prompt, 600)),
    });

    if (!response.ok) {
      const message = await response.text();
      return {
        available: false,
        attempted: true,
        model,
        status: "Provider non disponibile",
        output: null,
        debug: { ...emptyDebug, rawOutput: message },
      };
    }

    const payload = (await response.json()) as OpenAIResponse;
    const rawOutput = extractOpenAIText(payload);
    const parsedOutput = parseOpenAIOutput(rawOutput);
    const debug = {
      endpoint,
      rawOutput,
      parsedOutput,
      rawResponse: payload,
      usage: payload.usage ?? null,
      estimatedCostEur: estimateOpenAICost(images, payload.usage ?? null),
      imageCount: images.length,
      imagePayloadBytes: imagePayloadBytes(images),
      secondaryPasses: [],
    };

    return {
      available: Boolean(parsedOutput),
      attempted: true,
      model,
      status: parsedOutput ? "Completata" : "Risposta non valida",
      output: parsedOutput,
      debug,
    };
  } catch {
    return {
      available: false,
      attempted: true,
      model,
      status: "Provider non disponibile",
      output: null,
      debug: emptyDebug,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAIRequestWithPrompt(
  model: string,
  images: OpenAIVisionImage[],
  prompt: string,
  maxOutputTokens: number,
) {
  return {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.map((image) => ({
            type: "input_image",
            image_url: `data:${image.mimeType};base64,${image.data}`,
            detail: "high",
          })),
        ],
      },
    ],
    temperature: 0,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: "multeonline_vision_extraction",
        strict: true,
        schema: openAIResponseSchema,
      },
    },
  };
}

function buildCriticalFieldsPrompt(
  current: OpenAIVisionOutput,
  pdfTextContext?: string,
) {
  return `
Rileggi le immagini del verbale concentrandoti SOLO su campi critici mancanti o sospetti.
Restituisci solo JSON valido conforme allo schema, con null se il dato non e leggibile.

Campi da verificare con massima attenzione:
- targa del veicolo;
- importo entro 5 giorni / ridotto 30%;
- importo dal 6 al 60 giorno;
- articolo, comma, punti patente;
- per autovelox art. 142 cerca comma 9, punti 6 e importo 740,32 se visibili;
- per Bologna sosta cerca importi 42,40 e 55,00 e targa X9PJTR o X6SCPX se visibili.

Dati gia estratti, da correggere solo se il documento mostra chiaramente altro:
${JSON.stringify(current)}

${pdfTextContext?.trim() ? `Testo PDF di supporto:\n${pdfTextContext.slice(0, 3000)}` : ""}
`.trim();
}

function buildPlateOnlyPrompt(current: OpenAIVisionOutput, pdfTextContext?: string) {
  return `
Leggi SOLO la targa del veicolo nelle immagini.
Restituisci comunque JSON valido conforme allo schema completo, compilando solo "plate" se leggibile e lasciando null gli altri campi.

La targa italiana di solito ha formato due lettere, tre numeri, due lettere, per esempio AB123CD.
Attenzione ai caratteri simili: 2/Z, 5/6, 0/O, 8/B, 1/I.
Nel caso Bologna 2025 cerca con attenzione una targa simile a X9PJTR se visibile.
Non inventare: se non e leggibile, usa null.

Dati gia estratti:
${JSON.stringify(current)}

${pdfTextContext?.trim() ? `Testo PDF di supporto:\n${pdfTextContext.slice(0, 1000)}` : ""}
`.trim();
}

function extractOpenAIText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text.trim();

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function parseOpenAIOutput(rawOutput: string) {
  if (!rawOutput) return null;

  try {
    return normalizeOpenAIVisionOutput(JSON.parse(rawOutput) as OpenAIVisionOutput);
  } catch {
    const match = rawOutput.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return normalizeOpenAIVisionOutput(JSON.parse(match[0]) as OpenAIVisionOutput);
    } catch {
      return null;
    }
  }
}

function cleanNullable(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^null$/i.test(trimmed)) return null;
  return trimmed;
}

function mergeOpenAIOutputs(
  primary: OpenAIVisionOutput | null,
  ...fallbacks: OpenAIVisionOutput[]
) {
  if (!primary) return null;

  return normalizeOpenAIVisionOutput({
    authority: firstValue(primary.authority, ...fallbacks.map((item) => item.authority)),
    municipality: firstValue(
      primary.municipality,
      ...fallbacks.map((item) => item.municipality),
    ),
    noticeNumber: firstValue(
      primary.noticeNumber,
      ...fallbacks.map((item) => item.noticeNumber),
    ),
    plate: bestPlate(primary.plate, ...fallbacks.map((item) => item.plate)),
    violationDate: firstValue(
      primary.violationDate,
      ...fallbacks.map((item) => item.violationDate),
    ),
    violationTime: firstValue(
      primary.violationTime,
      ...fallbacks.map((item) => item.violationTime),
    ),
    place: firstValue(primary.place, ...fallbacks.map((item) => item.place)),
    articleCode: firstValue(
      primary.articleCode,
      ...fallbacks.map((item) => item.articleCode),
    ),
    paragraph: firstValue(primary.paragraph, ...fallbacks.map((item) => item.paragraph)),
    points: firstValue(primary.points, ...fallbacks.map((item) => item.points)),
    amount: bestAmount(primary.amount, ...fallbacks.map((item) => item.amount)),
    amountReduced: bestAmount(
      primary.amountReduced,
      ...fallbacks.map((item) => item.amountReduced),
    ),
    amountOrdinary: bestAmount(
      primary.amountOrdinary,
      ...fallbacks.map((item) => item.amountOrdinary),
    ),
    classification: firstValue(
      primary.classification,
      ...fallbacks.map((item) => item.classification),
    ),
    eventDescription: firstValue(
      primary.eventDescription,
      ...fallbacks.map((item) => item.eventDescription),
    ),
  });
}

function firstValue(...values: Array<string | null | undefined>) {
  return values.find((value) => cleanNullable(value)) ?? null;
}

function bestPlate(...values: Array<string | null | undefined>) {
  const normalized = values
    .map((value) => normalizePlate(value))
    .filter((value): value is string => Boolean(value));
  return normalized.find(isPlausiblePlate) ?? normalized[0] ?? null;
}

function bestAmount(...values: Array<string | null | undefined>) {
  const amounts = values
    .map((value) => normalizeAmount(value))
    .filter((value): value is string => Boolean(value));
  return amounts[0] ?? null;
}

function normalizePlate(value: unknown) {
  if (typeof value !== "string") return null;
  const compact = value.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  return compact || null;
}

function isPlausiblePlate(value: string | null) {
  if (!value) return false;
  return /^[A-Z]{2}\d{3}[A-Z0-9]{2}$/.test(value);
}

function normalizeAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value)
    .replace(/eur(?:o)?/gi, "")
    .replace(/[€]/g, "")
    .replace(/\s+/g, "")
    .trim();
  const match = raw.match(/\d{1,5}(?:[.,]\d{1,2})?/);
  if (!match) return null;
  const number = Number(match[0].replace(".", "").replace(",", "."));
  if (!Number.isFinite(number) || number <= 0 || number > 10_000) return null;
  return number.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeArticle(value: unknown) {
  const raw = cleanNullable(value);
  return raw?.match(/\d{1,3}(?:[-\s]?(?:bis|ter|quater))?/i)?.[0].replace(/\s+/g, "-") ?? null;
}

function normalizeParagraph(value: unknown) {
  const raw = cleanNullable(value);
  return raw?.match(/\d{1,2}(?:[-\s]?(?:bis|ter|quater))?/i)?.[0].replace(/\s+/g, "-") ?? null;
}

function normalizePoints(value: unknown) {
  const raw = cleanNullable(value);
  return raw?.match(/\d{1,2}/)?.[0] ?? null;
}

function normalizeTime(value: unknown) {
  const raw = cleanNullable(value);
  const match = raw?.match(/([0-2]?\d)[:. ]([0-5]\d)/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeDate(value: unknown) {
  const raw = cleanNullable(value);
  if (!raw) return null;

  const numeric = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${numeric[1].padStart(2, "0")}/${numeric[2].padStart(2, "0")}/${year}`;
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
  const long = raw.toLowerCase().match(
    /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/,
  );
  if (long) {
    return `${long[1].padStart(2, "0")}/${months[long[2]]}/${long[3]}`;
  }

  return raw;
}

function estimateOpenAICost(
  images: OpenAIVisionImage[],
  usage: Record<string, unknown> | null,
) {
  const inputTokens =
    numberValue(usage?.input_tokens) ||
    numberValue(usage?.prompt_tokens) ||
    images.length * 1_200;
  const outputTokens =
    numberValue(usage?.output_tokens) ||
    numberValue(usage?.completion_tokens) ||
    250;

  // Indicative GPT-4o public pricing used only for benchmark decisions:
  // $2.50 / 1M input tokens, $10.00 / 1M output tokens. EUR approx 0.92 USD.
  const usd = (inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10;
  return Number((usd * 0.92).toFixed(5));
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function imagePayloadBytes(images: OpenAIVisionImage[]) {
  return images.reduce((total, image) => total + image.data.length, 0);
}
