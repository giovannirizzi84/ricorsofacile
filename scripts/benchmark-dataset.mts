import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeUploadedDocuments,
  type AnalyzeUploadedDocumentsResult,
} from "../src/lib/analysis/analyzeDocument.ts";
import { NOT_DETECTED, type ScreeningReport } from "../src/lib/screening-report.ts";

type DatasetCategory =
  | "autovelox"
  | "ztl"
  | "sosta"
  | "assicurazione"
  | "revisione"
  | "telefono"
  | "corsia-bus"
  | "semaforo"
  | "misto";
type EvaluationField =
  | "noticeNumber"
  | "plate"
  | "violationDate"
  | "articleCode"
  | "paragraph"
  | "amountReduced"
  | "amountOrdinary"
  | "points"
  | "classification";

type ExpectedField =
  | string
  | {
      value: string;
      readable?: boolean;
      note?: string;
    };

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
  excludedFromReadableAccuracy: boolean;
  confusion: string | null;
};

type CaseResult = {
  id: string;
  category: DatasetCategory;
  files: string[];
  providerUsed: string;
  visionStatus: string;
  durationMs: number;
  totalAccuracy: number;
  readableAccuracy: number;
  expectedFields: number;
  readableFields: number;
  correctFields: number;
  correctReadableFields: number;
  fields: FieldResult[];
  failureReason: string;
  partialAnalysis: boolean;
  providerError: boolean;
  confidence: number;
  confidenceBreakdown: Record<string, number>;
  thresholdAction: "report_immediato" | "revision_pass_mirato" | "documento_incerto";
};

type FieldSummary = {
  expected: number;
  readable: number;
  correct: number;
  correctReadable: number;
  totalAccuracy: number;
  readableAccuracy: number;
};

const categories: DatasetCategory[] = [
  "autovelox",
  "ztl",
  "sosta",
  "assicurazione",
  "revisione",
  "telefono",
  "corsia-bus",
  "semaforo",
  "misto",
];
const fields: EvaluationField[] = [
  "noticeNumber",
  "plate",
  "violationDate",
  "articleCode",
  "paragraph",
  "amountReduced",
  "amountOrdinary",
  "points",
  "classification",
];
const confidenceWeights = {
  noticeNumber: 20,
  plate: 20,
  violationDate: 15,
  articleCode: 15,
  amounts: 15,
  classification: 15,
} as const;
const supportedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
const datasetRoot = path.join(process.cwd(), "evaluation-dataset");
const resultsRoot = path.join(process.cwd(), "evaluation-results");
const jsonReportPath = path.join(resultsRoot, "benchmark-report.json");
const markdownReportPath = path.join(resultsRoot, "benchmark-report.md");
const qualityDashboardPath = path.join(resultsRoot, "quality-dashboard.md");

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
  await writeFile(qualityDashboardPath, renderQualityDashboard(report), "utf8");
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

  if (filePaths.length === 0) {
    const fieldResults = compareFields(expected, null);
    return buildCaseResult(datasetCase, [], fieldResults, null, "NO_DOCUMENTS");
  }

  const files = await Promise.all(
    filePaths.map(async (filePath) => {
      const buffer = await readFile(filePath);
      return new File([buffer], path.basename(filePath), {
        type: mimeTypeFromPath(filePath),
      });
    }),
  );

  try {
    const analysis = await analyzeUploadedDocuments(
      files,
      {
        notificationDate: "",
        authority: "",
        amount: "",
        violationType: "",
      },
      {
        analysisId: `benchmark-${datasetCase.category}-${datasetCase.id}`,
        productionRuntime: true,
        debug: false,
      },
    );
    const fieldResults = compareFields(expected, analysis.report);
    return buildCaseResult(
      datasetCase,
      filePaths,
      fieldResults,
      analysis,
      inferFailureReason(analysis, fieldResults),
    );
  } catch (error) {
    const fieldResults = compareFields(expected, null);
    return buildCaseResult(
      datasetCase,
      filePaths,
      fieldResults,
      null,
      error instanceof Error ? error.message : "ANALYSIS_FAILED",
    );
  }
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
  report: ScreeningReport | null,
): FieldResult[] {
  return fields
    .map((field): FieldResult | null => {
      const expectation = normalizeExpected(expected.fields[field]);
      if (!expectation.value) return null;
      const actual = report ? actualValue(field, report) : NOT_DETECTED;
      const correct = valuesMatch(field, actual, expectation.value);
      return {
        field,
        expected: expectation.value,
        actual,
        readable: expectation.readable,
        correct,
        excludedFromReadableAccuracy: !expectation.readable,
        confusion: correct ? null : detectConfusion(expectation.value, actual),
      };
    })
    .filter((item): item is FieldResult => Boolean(item));
}

function normalizeExpected(value: ExpectedField | undefined) {
  if (typeof value === "string") {
    return { value: value.trim(), readable: true };
  }

  return {
    value: value?.value?.trim() ?? "",
    readable: value?.readable !== false,
  };
}

function actualValue(field: EvaluationField, report: ScreeningReport) {
  switch (field) {
    case "noticeNumber":
      return report.identifiedData.reportNumber;
    case "plate":
      return report.identifiedData.plate;
    case "violationDate":
      return (
        report.identifiedData.violationDate ||
        report.identifiedData.assessmentDate ||
        report.identifiedData.notificationDate
      );
    case "amountReduced":
      return report.identifiedData.reducedAmount || report.normalizedData.reducedAmount;
    case "amountOrdinary":
      return report.normalizedData.standardAmount || report.identifiedData.amount;
    case "articleCode":
      return report.normalizedData.articleCode || report.identifiedData.article;
    case "paragraph":
      return report.normalizedData.paragraph || report.identifiedData.paragraph;
    case "classification":
      return report.violationClassification.value;
    case "points":
      return report.normalizedData.points?.toString() || report.identifiedData.licensePoints;
  }
}

function valuesMatch(field: EvaluationField, actual: string, expected: string) {
  if (field === "amountReduced" || field === "amountOrdinary") {
    return normalizeAmount(actual) === normalizeAmount(expected);
  }

  if (field === "violationDate") {
    return normalizeDate(actual) === normalizeDate(expected);
  }

  if (field === "noticeNumber") {
    return normalizeNoticeNumber(actual) === normalizeNoticeNumber(expected);
  }

  if (field === "points") {
    return normalizeToken(actual) === normalizeToken(expected);
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

function hasPairConfusion(
  expected: string,
  actual: string,
  left: string,
  right: string,
) {
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

function buildCaseResult(
  datasetCase: { id: string; category: DatasetCategory },
  filePaths: string[],
  fieldResults: FieldResult[],
  analysis: AnalyzeUploadedDocumentsResult | null,
  failureReason: string,
): CaseResult {
  const readableFields = fieldResults.filter((field) => field.readable);
  const correctFields = fieldResults.filter((field) => field.correct);
  const correctReadableFields = readableFields.filter((field) => field.correct);
  const confidence = calculateConfidence(fieldResults);
  return {
    id: datasetCase.id,
    category: datasetCase.category,
    files: filePaths,
    providerUsed: analysis?.processing.providerLog.providerUsed ?? "none",
    visionStatus: analysis?.processing.providerLog.visionStatus ?? "Non eseguita",
    durationMs: analysis?.processing.durationMs ?? 0,
    totalAccuracy: percent(correctFields.length, fieldResults.length),
    readableAccuracy: percent(correctReadableFields.length, readableFields.length),
    expectedFields: fieldResults.length,
    readableFields: readableFields.length,
    correctFields: correctFields.length,
    correctReadableFields: correctReadableFields.length,
    fields: fieldResults,
    failureReason,
    partialAnalysis: hasPartialUsefulResult(fieldResults),
    providerError: isProviderError(analysis, failureReason),
    confidence,
    confidenceBreakdown: calculateConfidenceBreakdown(fieldResults),
    thresholdAction: thresholdAction(confidence),
  };
}

function hasPartialUsefulResult(fieldResults: FieldResult[]) {
  const correct = new Set(
    fieldResults.filter((field) => field.correct).map((field) => field.field),
  );
  return (
    correct.has("noticeNumber") &&
    correct.has("plate") &&
    correct.has("violationDate") &&
    (correct.has("amountReduced") || correct.has("amountOrdinary"))
  );
}

function inferFailureReason(
  analysis: AnalyzeUploadedDocumentsResult,
  fieldsResult: FieldResult[],
) {
  if (!analysis.processing.providerLog.visionAttempted) return "VISION_NOT_ATTEMPTED";
  if (analysis.processing.providerLog.providerUsed === "none") {
    return "VISION_PROVIDER_FAILED";
  }
  if (hasPartialUsefulResult(fieldsResult)) return "PARTIAL_ANALYSIS_COMPLETED";
  if (fieldsResult.some((field) => !field.correct)) return "FIELD_MISMATCH";
  return "NONE";
}

function buildReport(caseResults: CaseResult[]) {
  const categoryAccuracy = Object.fromEntries(
    categories.map((category) => [
      category,
      summarizeCases(caseResults.filter((result) => result.category === category)),
    ]),
  ) as Record<DatasetCategory, ReturnType<typeof summarizeCases>>;
  const fieldAccuracy = Object.fromEntries(
    fields.map((field) => [field, summarizeField(caseResults, field)]),
  ) as Record<EvaluationField, FieldSummary>;
  const confusions = summarizeConfusions(caseResults);
  const topErrors = summarizeTopErrors(caseResults);
  const providerErrors = caseResults.filter((result) => result.providerError).length;

  return {
    generatedAt: new Date().toISOString(),
    datasetRoot,
    cases: caseResults,
    totals: summarizeCases(caseResults),
    categoryAccuracy,
    fieldAccuracy,
    confusions,
    topErrors,
    providerErrors,
    providerErrorRate: percent(providerErrors, caseResults.length),
    confidence: summarizeConfidence(caseResults),
    targets: {
      launchDatasetSize: "50+ verbali reali",
      readableAccuracy: "> 90%",
      plate: "> 95%",
      amounts: "> 95%",
      noticeNumber: "> 95%",
      providerErrors: "< 1%",
      classification: "> 95%",
    },
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

function summarizeField(
  caseResults: CaseResult[],
  field: EvaluationField,
): FieldSummary {
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
  const examples: Array<{
    caseId: string;
    category: DatasetCategory;
    field: EvaluationField;
    expected: string;
    actual: string;
    confusion: string;
  }> = [];

  for (const result of caseResults) {
    for (const field of result.fields) {
      if (!field.confusion) continue;
      counts[field.confusion] = (counts[field.confusion] ?? 0) + 1;
      examples.push({
        caseId: result.id,
        category: result.category,
        field: field.field,
        expected: field.expected,
        actual: field.actual,
        confusion: field.confusion,
      });
    }
  }

  return { counts, examples };
}

function summarizeTopErrors(caseResults: CaseResult[]) {
  return caseResults
    .flatMap((result) =>
      result.fields
        .filter((field) => !field.correct)
        .map((field) => ({
          caseId: result.id,
          category: result.category,
          field: field.field,
          expected: field.expected,
          actual: field.actual,
          readable: field.readable,
          confusion: field.confusion,
        })),
    )
    .slice(0, 20);
}

function summarizeConfidence(caseResults: CaseResult[]) {
  if (caseResults.length === 0) {
    return {
      average: 0,
      reportImmediate: 0,
      revisionPass: 0,
      uncertain: 0,
    };
  }

  return {
    average: Number(
      (
        caseResults.reduce((total, result) => total + result.confidence, 0) /
        caseResults.length
      ).toFixed(2),
    ),
    reportImmediate: caseResults.filter(
      (result) => result.thresholdAction === "report_immediato",
    ).length,
    revisionPass: caseResults.filter(
      (result) => result.thresholdAction === "revision_pass_mirato",
    ).length,
    uncertain: caseResults.filter(
      (result) => result.thresholdAction === "documento_incerto",
    ).length,
  };
}

function calculateConfidence(fieldResults: FieldResult[]) {
  return Object.values(calculateConfidenceBreakdown(fieldResults)).reduce(
    (total, value) => total + value,
    0,
  );
}

function calculateConfidenceBreakdown(fieldResults: FieldResult[]) {
  const byField = new Map(fieldResults.map((field) => [field.field, field]));
  const amountReduced = byField.get("amountReduced");
  const amountOrdinary = byField.get("amountOrdinary");
  const amountCorrect = Boolean(amountReduced?.correct || amountOrdinary?.correct);
  return {
    noticeNumber: scoreField(byField.get("noticeNumber"), confidenceWeights.noticeNumber),
    plate: scoreField(byField.get("plate"), confidenceWeights.plate),
    violationDate: scoreField(byField.get("violationDate"), confidenceWeights.violationDate),
    articleCode: scoreField(byField.get("articleCode"), confidenceWeights.articleCode),
    amounts: amountCorrect ? confidenceWeights.amounts : 0,
    classification: scoreField(byField.get("classification"), confidenceWeights.classification),
  };
}

function scoreField(field: FieldResult | undefined, points: number) {
  if (!field) return 0;
  if (!field.readable) return 0;
  return field.correct ? points : 0;
}

function thresholdAction(confidence: number) {
  if (confidence >= 90) return "report_immediato";
  if (confidence >= 70) return "revision_pass_mirato";
  return "documento_incerto";
}

function isProviderError(
  analysis: AnalyzeUploadedDocumentsResult | null,
  failureReason: string,
) {
  if (!analysis) return true;
  return (
    analysis.processing.providerLog.providerUsed === "none" ||
    /PROVIDER|VISION_PROVIDER|FAILED|TIMEOUT/i.test(failureReason)
  );
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines = [
    "# Benchmark MulteOnline",
    "",
    `Generato: ${report.generatedAt}`,
    "",
    "## Accuracy Media",
    "",
    `- Casi analizzati: ${report.totals.cases}`,
    `- Accuracy totale: ${report.totals.totalAccuracy}%`,
    `- Accuracy campi leggibili: ${report.totals.readableAccuracy}%`,
    `- Confidence media: ${report.confidence.average}`,
    `- Errori provider: ${report.providerErrors} (${report.providerErrorRate}%)`,
    "",
    "## Accuracy Per Categoria",
    "",
    "| Categoria | Casi | Accuracy totale | Accuracy leggibili |",
    "|---|---:|---:|---:|",
    ...categories.map((category) => {
      const item = report.categoryAccuracy[category];
      return `| ${category} | ${item.cases} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Accuracy Per Campo",
    "",
    "| Campo | Attesi | Leggibili | Accuracy totale | Accuracy leggibili |",
    "|---|---:|---:|---:|---:|",
    ...fields.map((field) => {
      const item = report.fieldAccuracy[field];
      return `| ${field} | ${item.expected} | ${item.readable} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Confusioni Frequenti",
    "",
  ];

  if (Object.keys(report.confusions.counts).length === 0) {
    lines.push("Nessuna confusione frequente rilevata.");
  } else {
    lines.push("| Confusione | Conteggio |", "|---|---:|");
    for (const [confusion, count] of Object.entries(report.confusions.counts)) {
      lines.push(`| ${confusion} | ${count} |`);
    }
  }

  lines.push("", "## Casi", "");
  for (const item of report.cases) {
    lines.push(
      `- ${item.category}/${item.id}: totale ${item.totalAccuracy}%, leggibili ${item.readableAccuracy}%, ${item.failureReason}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function renderQualityDashboard(report: ReturnType<typeof buildReport>) {
  const lines = [
    "# MulteOnline Quality Dashboard",
    "",
    `Generato: ${report.generatedAt}`,
    "",
    "## Sintesi",
    "",
    `- Casi nel dataset: ${report.totals.cases}`,
    `- Accuracy totale: ${report.totals.totalAccuracy}%`,
    `- Accuracy campi leggibili: ${report.totals.readableAccuracy}%`,
    `- Confidence media: ${report.confidence.average}/100`,
    `- Errori provider: ${report.providerErrors} (${report.providerErrorRate}%)`,
    "",
    "## Confidence",
    "",
    `- Report immediato (>= 90): ${report.confidence.reportImmediate}`,
    `- Revision pass mirato (70-89): ${report.confidence.revisionPass}`,
    `- Documento incerto (< 70): ${report.confidence.uncertain}`,
    "",
    "## Accuracy Per Categoria",
    "",
    "| Categoria | Casi | Accuracy totale | Accuracy leggibili |",
    "|---|---:|---:|---:|",
    ...categories.map((category) => {
      const item = report.categoryAccuracy[category];
      return `| ${category} | ${item.cases} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Accuracy Per Campo",
    "",
    "| Campo | Attesi | Leggibili | Accuracy totale | Accuracy leggibili |",
    "|---|---:|---:|---:|---:|",
    ...fields.map((field) => {
      const item = report.fieldAccuracy[field];
      return `| ${field} | ${item.expected} | ${item.readable} | ${item.totalAccuracy}% | ${item.readableAccuracy}% |`;
    }),
    "",
    "## Top Errori",
    "",
  ];

  if (report.topErrors.length === 0) {
    lines.push("Nessun errore sui campi attesi del dataset corrente.");
  } else {
    lines.push("| Caso | Categoria | Campo | Atteso | Ottenuto | Confusione |");
    lines.push("|---|---|---|---|---|---|");
    for (const error of report.topErrors) {
      lines.push(
        `| ${error.caseId} | ${error.category} | ${error.field} | ${error.expected} | ${error.actual} | ${error.confusion ?? "-"} |`,
      );
    }
  }

  lines.push("", "## Confusioni", "");
  if (Object.keys(report.confusions.counts).length === 0) {
    lines.push("Nessuna confusione frequente rilevata.");
  } else {
    lines.push("| Confusione | Conteggio |", "|---|---:|");
    for (const [confusion, count] of Object.entries(report.confusions.counts)) {
      lines.push(`| ${confusion} | ${count} |`);
    }
  }

  lines.push(
    "",
    "## Soglie Go-Live",
    "",
    "- Dataset: 50+ verbali reali",
    "- Accuracy campi leggibili: > 90%",
    "- Targa: > 95%",
    "- Importi: > 95%",
    "- Numero verbale: > 95%",
    "- Errori provider: < 1%",
  );

  return `${lines.join("\n")}\n`;
}

function printReport(report: ReturnType<typeof buildReport>) {
  console.log("Benchmark dataset MulteOnline");
  console.log(`Casi analizzati: ${report.totals.cases}`);
  console.log(`Accuracy media totale: ${report.totals.totalAccuracy}%`);
  console.log(
    `Accuracy media campi leggibili: ${report.totals.readableAccuracy}%`,
  );
  console.log("");

  for (const category of categories) {
    const item = report.categoryAccuracy[category];
    console.log(
      `${category}: ${item.cases} casi, totale ${item.totalAccuracy}%, leggibili ${item.readableAccuracy}%`,
    );
  }

  console.log("");
  console.log(`Report JSON: ${jsonReportPath}`);
  console.log(`Report MD: ${markdownReportPath}`);
  console.log(`Quality dashboard: ${qualityDashboardPath}`);
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

function normalizeNoticeNumber(value: string) {
  const token = normalizeToken(value);
  return token.replace(/20\d{2}/g, "");
}

function normalizeDate(value: string) {
  const numericMatch = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numericMatch) {
    const year =
      numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3];
    return `${numericMatch[1].padStart(2, "0")}/${numericMatch[2].padStart(2, "0")}/${year}`;
  }

  const monthMap: Record<string, string> = {
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
  const textualMatch = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(
      /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/,
    );
  if (!textualMatch) return "";
  return `${textualMatch[1].padStart(2, "0")}/${monthMap[textualMatch[2]]}/${textualMatch[3]}`;
}

function percent(correct: number, total: number) {
  if (total === 0) return 0;
  return Number(((correct / total) * 100).toFixed(2));
}
