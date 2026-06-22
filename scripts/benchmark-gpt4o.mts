import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeImagesWithOpenAIVision,
  type OpenAIVisionOutput,
} from "../src/lib/ai/openaiClient.ts";
import { extractDocuments } from "../src/lib/documents/extractText.ts";

type DatasetCategory = "autovelox" | "ztl" | "sosta" | "misto";
type EvaluationField =
  | "noticeNumber"
  | "plate"
  | "violationDate"
  | "amountReduced"
  | "amountOrdinary"
  | "articleCode"
  | "classification";
type ExpectedField = string | { value: string; readable?: boolean; note?: string };
type ExpectedCase = {
  sourceFiles?: string[];
  fields: Partial<Record<EvaluationField, ExpectedField>>;
};
type FieldResult = {
  field: EvaluationField;
  expected: string;
  actual: string;
  readable: boolean;
  correct: boolean;
  confusion: string | null;
};
type CaseResult = {
  id: string;
  category: DatasetCategory;
  files: string[];
  provider: "openai";
  model: string;
  status: string;
  durationMs: number;
  estimatedCostEur: number;
  imageCount: number;
  imagePayloadBytes: number;
  usage: Record<string, unknown> | null;
  totalAccuracy: number;
  readableAccuracy: number;
  expectedFields: number;
  readableFields: number;
  correctFields: number;
  correctReadableFields: number;
  fields: FieldResult[];
  extracted: OpenAIVisionOutput | null;
  rawOutput: string;
  failureReason: string;
};

const categories: DatasetCategory[] = ["autovelox", "ztl", "sosta", "misto"];
const fields: EvaluationField[] = [
  "noticeNumber",
  "plate",
  "violationDate",
  "amountReduced",
  "amountOrdinary",
  "articleCode",
  "classification",
];
const supportedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
const datasetRoot = path.join(process.cwd(), "evaluation-dataset");
const resultsRoot = path.join(process.cwd(), "evaluation-results");
const jsonReportPath = path.join(resultsRoot, "gpt4o-benchmark-report.json");
const markdownReportPath = path.join(resultsRoot, "gpt4o-benchmark-report.md");

await main();

async function main() {
  await loadLocalEnv();
  const cases = await discoverCases();
  const results: CaseResult[] = [];

  for (const datasetCase of cases) {
    results.push(await evaluateCase(datasetCase));
  }

  const report = buildReport(results);
  await mkdir(resultsRoot, { recursive: true });
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownReportPath, renderMarkdown(report), "utf8");
  printReport(report);
}

async function discoverCases() {
  const discovered: Array<{
    id: string;
    category: DatasetCategory;
    directory: string;
    expectedPath: string;
  }> = [];

  for (const category of categories) {
    const categoryDir = path.join(datasetRoot, category);
    for (const entry of await safeReaddir(categoryDir)) {
      const directory = path.join(categoryDir, entry);
      if (!(await isDirectory(directory))) continue;
      const expectedPath = path.join(directory, "expected.json");
      if (!(await exists(expectedPath))) continue;
      discovered.push({ id: entry, category, directory, expectedPath });
    }
  }

  return discovered;
}

async function evaluateCase(datasetCase: {
  id: string;
  category: DatasetCategory;
  directory: string;
  expectedPath: string;
}): Promise<CaseResult> {
  const expected = JSON.parse(
    await readFile(datasetCase.expectedPath, "utf8"),
  ) as ExpectedCase;
  const filePaths = await resolveDocumentPaths(datasetCase.directory, expected);
  const startedAt = Date.now();

  if (filePaths.length === 0) {
    return buildCaseResult(datasetCase, [], expected, null, {
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
      status: "NO_DOCUMENTS",
      durationMs: Date.now() - startedAt,
      cost: 0,
      imageCount: 0,
      imagePayloadBytes: 0,
      usage: null,
      rawOutput: "",
      failureReason: "NO_DOCUMENTS",
    });
  }

  const files = await Promise.all(
    filePaths.map(async (filePath) => {
      const buffer = await readFile(filePath);
      return new File([buffer], path.basename(filePath), {
        type: mimeTypeFromPath(filePath),
      });
    }),
  );
  const documents = await extractDocuments(files, {
    deferOcrForVision: true,
    ocrEnabled: false,
  });
  const images = documents.flatMap((document) => document.visionImages);
  const pdfTextContext = documents.map((document) => document.text).join("\n\n");
  const result = await analyzeImagesWithOpenAIVision(images, {
    pdfTextContext,
    timeoutMs: 45_000,
  });

  return buildCaseResult(datasetCase, filePaths, expected, result.output, {
    model: result.model,
    status: result.status,
    durationMs: Date.now() - startedAt,
    cost: result.debug.estimatedCostEur,
    imageCount: images.length,
    imagePayloadBytes: images.reduce((total, image) => total + image.data.length, 0),
    usage: result.debug.usage,
    rawOutput: result.debug.rawOutput,
    failureReason: result.available ? "NONE" : result.status,
  });
}

function buildCaseResult(
  datasetCase: { id: string; category: DatasetCategory },
  filePaths: string[],
  expected: ExpectedCase,
  output: OpenAIVisionOutput | null,
  meta: {
    model: string;
    status: string;
    durationMs: number;
    cost: number;
    imageCount: number;
    imagePayloadBytes: number;
    usage: Record<string, unknown> | null;
    rawOutput: string;
    failureReason: string;
  },
): CaseResult {
  const fieldResults = compareFields(expected, output);
  const readableFields = fieldResults.filter((field) => field.readable);
  const correctFields = fieldResults.filter((field) => field.correct);
  const correctReadableFields = readableFields.filter((field) => field.correct);

  return {
    id: datasetCase.id,
    category: datasetCase.category,
    files: filePaths,
    provider: "openai",
    model: meta.model,
    status: meta.status,
    durationMs: meta.durationMs,
    estimatedCostEur: meta.cost,
    imageCount: meta.imageCount,
    imagePayloadBytes: meta.imagePayloadBytes,
    usage: meta.usage,
    totalAccuracy: percent(correctFields.length, fieldResults.length),
    readableAccuracy: percent(correctReadableFields.length, readableFields.length),
    expectedFields: fieldResults.length,
    readableFields: readableFields.length,
    correctFields: correctFields.length,
    correctReadableFields: correctReadableFields.length,
    fields: fieldResults,
    extracted: output,
    rawOutput: meta.rawOutput,
    failureReason: meta.failureReason,
  };
}

async function resolveDocumentPaths(directory: string, expected: ExpectedCase) {
  const localFiles = (expected.sourceFiles ?? []).filter(Boolean);
  if (localFiles.length > 0) return localFiles;

  return (await safeReaddir(directory))
    .map((name) => path.join(directory, name))
    .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
}

function compareFields(
  expected: ExpectedCase,
  output: OpenAIVisionOutput | null,
): FieldResult[] {
  return fields
    .map((field): FieldResult | null => {
      const expectation = normalizeExpected(expected.fields[field]);
      if (!expectation.value) return null;
      const actual = output ? actualValue(field, output) : "";
      const correct = valuesMatch(field, actual, expectation.value);
      return {
        field,
        expected: expectation.value,
        actual,
        readable: expectation.readable,
        correct,
        confusion: correct ? null : detectConfusion(expectation.value, actual),
      };
    })
    .filter((item): item is FieldResult => Boolean(item));
}

function actualValue(field: EvaluationField, output: OpenAIVisionOutput) {
  return output[field] ?? "";
}

function normalizeExpected(value: ExpectedField | undefined) {
  if (typeof value === "string") return { value: value.trim(), readable: true };
  return {
    value: value?.value?.trim() ?? "",
    readable: value?.readable !== false,
  };
}

function buildReport(caseResults: CaseResult[]) {
  const categoryAccuracy = Object.fromEntries(
    categories.map((category) => [
      category,
      summarizeCases(caseResults.filter((result) => result.category === category)),
    ]),
  );
  const fieldAccuracy = Object.fromEntries(
    fields.map((field) => [field, summarizeField(caseResults, field)]),
  );
  const averageCostEur = percentValue(
    caseResults.reduce((total, item) => total + item.estimatedCostEur, 0),
    caseResults.length,
  );
  const averageDurationMs = percentValue(
    caseResults.reduce((total, item) => total + item.durationMs, 0),
    caseResults.length,
  );

  return {
    generatedAt: new Date().toISOString(),
    provider: "openai",
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
    datasetRoot,
    cases: caseResults,
    totals: summarizeCases(caseResults),
    categoryAccuracy,
    fieldAccuracy,
    confusions: summarizeConfusions(caseResults),
    providerErrors: caseResults.filter((item) => item.failureReason !== "NONE").length,
    averageDurationMs,
    averageCostEur,
  };
}

function summarizeCases(caseResults: CaseResult[]) {
  const expected = caseResults.reduce((total, item) => total + item.expectedFields, 0);
  const readable = caseResults.reduce((total, item) => total + item.readableFields, 0);
  const correct = caseResults.reduce((total, item) => total + item.correctFields, 0);
  const correctReadable = caseResults.reduce(
    (total, item) => total + item.correctReadableFields,
    0,
  );

  return {
    cases: caseResults.length,
    expectedFields: expected,
    readableFields: readable,
    correctFields: correct,
    correctReadableFields: correctReadable,
    totalAccuracy: percent(correct, expected),
    readableAccuracy: percent(correctReadable, readable),
  };
}

function summarizeField(caseResults: CaseResult[], field: EvaluationField) {
  const matching = caseResults.flatMap((result) =>
    result.fields.filter((item) => item.field === field),
  );
  const readable = matching.filter((item) => item.readable);
  const correct = matching.filter((item) => item.correct);
  const correctReadable = readable.filter((item) => item.correct);
  return {
    expected: matching.length,
    readable: readable.length,
    correct: correct.length,
    correctReadable: correctReadable.length,
    totalAccuracy: percent(correct.length, matching.length),
    readableAccuracy: percent(correctReadable.length, readable.length),
  };
}

function summarizeConfusions(caseResults: CaseResult[]) {
  const counts: Record<string, number> = {};
  for (const result of caseResults) {
    for (const field of result.fields) {
      if (!field.confusion) continue;
      counts[field.confusion] = (counts[field.confusion] ?? 0) + 1;
    }
  }
  return counts;
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines = [
    "# Benchmark GPT-4o Vision",
    "",
    `Generato: ${report.generatedAt}`,
    `Modello: ${report.model}`,
    "",
    "## Risultati",
    "",
    `- Casi analizzati: ${report.totals.cases}`,
    `- Accuracy totale: ${report.totals.totalAccuracy}%`,
    `- Accuracy campi leggibili: ${report.totals.readableAccuracy}%`,
    `- Errori provider: ${report.providerErrors}`,
    `- Tempo medio: ${report.averageDurationMs} ms`,
    `- Costo stimato medio: ${report.averageCostEur} EUR/documento`,
    "",
    "## Accuracy Per Categoria",
    "",
    "| Categoria | Casi | Totale | Leggibili |",
    "|---|---:|---:|---:|",
    ...categories.map((category) => {
      const item = report.categoryAccuracy[category];
      return `| ${category} | ${item.cases} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Accuracy Per Campo",
    "",
    "| Campo | Attesi | Leggibili | Totale | Leggibili |",
    "|---|---:|---:|---:|---:|",
    ...fields.map((field) => {
      const item = report.fieldAccuracy[field];
      return `| ${field} | ${item.expected} | ${item.readable} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Casi",
    "",
    ...report.cases.map(
      (item) =>
        `- ${item.category}/${item.id}: ${item.readableAccuracy}% leggibili, ${item.status}, costo stimato ${item.estimatedCostEur} EUR`,
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function printReport(report: ReturnType<typeof buildReport>) {
  console.log("Benchmark GPT-4o Vision");
  console.log(`Casi analizzati: ${report.totals.cases}`);
  console.log(`Accuracy totale: ${report.totals.totalAccuracy}%`);
  console.log(`Accuracy campi leggibili: ${report.totals.readableAccuracy}%`);
  console.log(`Errori provider: ${report.providerErrors}`);
  console.log(`Costo stimato medio: ${report.averageCostEur} EUR/documento`);
  console.log(`Report JSON: ${jsonReportPath}`);
  console.log(`Report MD: ${markdownReportPath}`);
}

function valuesMatch(field: EvaluationField, actual: string, expected: string) {
  if (field === "amountReduced" || field === "amountOrdinary") {
    return normalizeAmount(actual) === normalizeAmount(expected);
  }
  if (field === "violationDate") {
    return normalizeDate(actual) === normalizeDate(expected);
  }
  return normalizeToken(actual).includes(normalizeToken(expected));
}

function detectConfusion(expected: string, actual: string) {
  const expectedToken = normalizeToken(expected).toUpperCase();
  const actualToken = normalizeToken(actual).toUpperCase();
  const pairs = [
    ["5", "6"],
    ["8", "B"],
    ["0", "O"],
    ["1", "I"],
  ] as const;
  for (const [left, right] of pairs) {
    if (hasPairConfusion(expectedToken, actualToken, left, right)) {
      return `${left} ↔ ${right}`;
    }
  }
  return null;
}

function hasPairConfusion(expected: string, actual: string, left: string, right: string) {
  if (expected.length !== actual.length) return false;
  let differences = 0;
  let matchingConfusion = false;
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] === actual[index]) continue;
    differences += 1;
    if (
      (expected[index] === left && actual[index] === right) ||
      (expected[index] === right && actual[index] === left)
    ) {
      matchingConfusion = true;
    }
  }
  return differences > 0 && differences <= 2 && matchingConfusion;
}

async function loadLocalEnv() {
  try {
    const envFile = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Env vars can be provided by the shell or CI.
  }
}

async function safeReaddir(directory: string) {
  try {
    return await readdir(directory);
  } catch {
    return [];
  }
}

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function mimeTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function normalizeAmount(value: string) {
  const match = value.match(/\d{1,5}(?:[.,]\d{2})/);
  return match?.[0].replace(".", ",") ?? "";
}

function normalizeDate(value: string) {
  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${year}`;
}

function percent(correct: number, total: number) {
  if (total === 0) return 0;
  return Number(((correct / total) * 100).toFixed(2));
}

function percentValue(value: number, total: number) {
  if (total === 0) return 0;
  return Number((value / total).toFixed(5));
}
