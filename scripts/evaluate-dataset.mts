import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractDocuments } from "../src/lib/documents/extractText.ts";
import { analyzeFineText } from "../src/lib/rules/fineAnalysisRules.ts";
import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  VIOLATION_NOT_CLASSIFIED,
  type ScreeningReport,
} from "../src/lib/screening-report.ts";

type DatasetCategory =
  | "autovelox"
  | "ztl"
  | "sosta"
  | "semaforo"
  | "revisione"
  | "assicurazione";

type ExpectedFields = {
  authority?: string;
  plate?: string;
  article?: string;
  paragraph?: string;
  amount?: string;
  points?: string;
  classification?: string;
};

type EvaluationField =
  | "authority"
  | "plate"
  | "article"
  | "paragraph"
  | "amount"
  | "points"
  | "classification";

type FieldResult = {
  field: EvaluationField;
  expected: string;
  actual: string;
  passed: boolean;
  errorType: EvaluationErrorType | null;
};

type EvaluationErrorType =
  | "OCR_ERROR"
  | "PARSER_ERROR"
  | "RULE_ENGINE_ERROR"
  | "CLASSIFICATION_ERROR";

type DatasetCase = {
  id: string;
  category: DatasetCategory;
  directory: string;
  expectedPath: string;
  documentPaths: string[];
};

type CaseEvaluation = {
  id: string;
  category: DatasetCategory;
  documents: string[];
  method: ScreeningReport["analysisMethod"];
  documentQuality: ScreeningReport["documentQuality"];
  accuracy: number;
  evaluatedFields: number;
  correctFields: number;
  fields: FieldResult[];
  extractionDebug: ScreeningReport["extractionDebug"];
};

type CategorySummary = {
  category: DatasetCategory;
  documents: number;
  accuracy: number;
  fields: Record<EvaluationField, FieldAccuracy>;
};

type FieldAccuracy = {
  evaluated: number;
  correct: number;
  accuracy: number;
};

const categories: DatasetCategory[] = [
  "autovelox",
  "ztl",
  "sosta",
  "semaforo",
  "revisione",
  "assicurazione",
];
const fields: EvaluationField[] = [
  "authority",
  "plate",
  "article",
  "paragraph",
  "amount",
  "points",
  "classification",
];
const supportedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);
const datasetRoot = path.join(process.cwd(), "datasets");
const resultsRoot = path.join(process.cwd(), "evaluation-results");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

const cases = await discoverDatasetCases();
const evaluations: CaseEvaluation[] = [];

await mkdir(path.join(resultsRoot, "errors"), { recursive: true });

for (const datasetCase of cases) {
  const evaluation = await evaluateCase(datasetCase);
  evaluations.push(evaluation);
  await saveCaseErrors(evaluation);
}

const summary = buildSummary(evaluations);
await mkdir(resultsRoot, { recursive: true });
await writeJson(path.join(resultsRoot, `summary-${timestamp}.json`), summary);
await writeJson(path.join(resultsRoot, "latest-summary.json"), summary);

printSummary(summary);

async function discoverDatasetCases() {
  const discovered: DatasetCase[] = [];

  for (const category of categories) {
    const categoryDir = path.join(datasetRoot, category);
    const entries = await safeReaddir(categoryDir);

    for (const entry of entries) {
      const candidate = path.join(categoryDir, entry);
      if (!(await isDirectory(candidate))) continue;

      const expectedPath = path.join(candidate, "expected.json");
      if (!(await exists(expectedPath))) continue;

      const documentPaths = (await safeReaddir(candidate))
        .map((name) => path.join(candidate, name))
        .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
        .sort((left, right) => left.localeCompare(right));

      discovered.push({
        id: entry,
        category,
        directory: candidate,
        expectedPath,
        documentPaths,
      });
    }
  }

  return discovered;
}

async function evaluateCase(datasetCase: DatasetCase): Promise<CaseEvaluation> {
  const expected = JSON.parse(
    await readFile(datasetCase.expectedPath, "utf8"),
  ) as ExpectedFields;

  if (datasetCase.documentPaths.length === 0) {
    const fieldResults = compareExpectedToActual(
      expected,
      null,
      "",
      "OCR + regole",
    );
    return {
      id: datasetCase.id,
      category: datasetCase.category,
      documents: [],
      method: "OCR + regole",
      documentQuality: "Insufficiente",
      accuracy: calculateAccuracy(fieldResults),
      evaluatedFields: fieldResults.length,
      correctFields: fieldResults.filter((field) => field.passed).length,
      fields: fieldResults,
      extractionDebug: {
        pages: [],
        selectedMainVerbalePage: null,
        validationWarnings: ["Nessun documento originale trovato nel caso."],
      },
    };
  }

  const files = await Promise.all(
    datasetCase.documentPaths.map(async (documentPath) => {
      const buffer = await readFile(documentPath);
      return new File([buffer], path.basename(documentPath), {
        type: mimeTypeFromPath(documentPath),
      });
    }),
  );
  const documents = await extractDocuments(files);
  const extractedText = documents
    .map(
      (document, index) =>
        `-- ${index + 1} of ${documents.length} --\nDOCUMENTO: ${document.filename}\nMETODO: ${document.method}\n${document.text}`,
    )
    .join("\n\n---\n\n");
  const usedOcr = documents.some((document) => document.method === "OCR");
  const report = analyzeFineText(
    extractedText,
    {
      notificationDate: "",
      authority: "",
      amount: "",
      violationType: "",
    },
    {
      method: usedOcr ? "OCR + regole" : "Testo PDF + regole",
      warnings: documents.flatMap((document) => document.warnings),
    },
  );
  const fieldResults = compareExpectedToActual(
    expected,
    report,
    extractedText,
    usedOcr ? "OCR + regole" : "Testo PDF + regole",
  );

  return {
    id: datasetCase.id,
    category: datasetCase.category,
    documents: datasetCase.documentPaths.map((documentPath) =>
      path.relative(datasetRoot, documentPath),
    ),
    method: report.analysisMethod,
    documentQuality: report.documentQuality,
    accuracy: calculateAccuracy(fieldResults),
    evaluatedFields: fieldResults.length,
    correctFields: fieldResults.filter((field) => field.passed).length,
    fields: fieldResults,
    extractionDebug: report.extractionDebug,
  };
}

function compareExpectedToActual(
  expected: ExpectedFields,
  report: ScreeningReport | null,
  extractedText: string,
  method: ScreeningReport["analysisMethod"],
) {
  return fields
    .map((field): FieldResult | null => {
      const expectedValue = expected[field]?.trim();
      if (!expectedValue) return null;

      const actualValue = report ? getActualValue(field, report) : NOT_DETECTED;
      const passed = valuesMatch(field, actualValue, expectedValue);

      return {
        field,
        expected: expectedValue,
        actual: actualValue,
        passed,
        errorType: passed
          ? null
          : classifyError(field, expectedValue, actualValue, extractedText, method),
      };
    })
    .filter((result): result is FieldResult => Boolean(result));
}

function getActualValue(field: EvaluationField, report: ScreeningReport) {
  switch (field) {
    case "authority":
      return report.identifiedData.authority;
    case "plate":
      return report.identifiedData.plate;
    case "article":
      return report.normalizedData.articleCode || report.identifiedData.article;
    case "paragraph":
      return report.normalizedData.paragraph || report.identifiedData.paragraph;
    case "amount":
      return (
        report.normalizedData.standardAmount ||
        report.identifiedData.amount ||
        report.identifiedData.reducedAmount
      );
    case "points":
      return String(report.normalizedData.points ?? report.identifiedData.licensePoints);
    case "classification":
      return report.normalizedData.classification || report.violationClassification.value;
  }
}

function valuesMatch(
  field: EvaluationField,
  actualValue: string,
  expectedValue: string,
) {
  if (field === "amount") {
    const actualAmount = parseAmount(actualValue);
    const expectedAmount = parseAmount(expectedValue);
    return (
      actualAmount !== null &&
      expectedAmount !== null &&
      Math.abs(actualAmount - expectedAmount) < 0.01
    );
  }

  if (field === "points") {
    return parseInteger(actualValue) === parseInteger(expectedValue);
  }

  return normalizeComparable(actualValue).includes(
    normalizeComparable(expectedValue),
  );
}

function classifyError(
  field: EvaluationField,
  expectedValue: string,
  actualValue: string,
  extractedText: string,
  method: ScreeningReport["analysisMethod"],
): EvaluationErrorType {
  if (field === "classification") {
    return "CLASSIFICATION_ERROR";
  }

  const actualMissing =
    !actualValue ||
    [NOT_DETECTED, ARTICLE_NOT_IDENTIFIED, VIOLATION_NOT_CLASSIFIED].some(
      (missingValue) => actualValue.includes(missingValue),
    );
  const textContainsExpected = normalizeComparable(extractedText).includes(
    normalizeComparable(expectedValue),
  );

  if (actualMissing && method === "OCR + regole" && !textContainsExpected) {
    return "OCR_ERROR";
  }
  if (textContainsExpected) {
    return "PARSER_ERROR";
  }
  return "RULE_ENGINE_ERROR";
}

async function saveCaseErrors(evaluation: CaseEvaluation) {
  const failedFields = evaluation.fields.filter((field) => !field.passed);
  if (failedFields.length === 0) return;

  for (const field of failedFields) {
    await writeJson(
      path.join(
        resultsRoot,
        "errors",
        `${evaluation.category}-${safeFilename(evaluation.id)}-${field.field}.json`,
      ),
      {
        document: {
          id: evaluation.id,
          category: evaluation.category,
          files: evaluation.documents,
        },
        expected: field.expected,
        actual: field.actual,
        field: field.field,
        errorType: field.errorType,
        method: evaluation.method,
        documentQuality: evaluation.documentQuality,
        extractionDebug: evaluation.extractionDebug,
      },
    );
  }
}

function buildSummary(evaluations: CaseEvaluation[]) {
  const categorySummaries = categories.map((category) =>
    summarizeCategory(
      category,
      evaluations.filter((evaluation) => evaluation.category === category),
    ),
  );
  const allFieldSummary = summarizeFields(evaluations);
  const errorCounts = countErrors(evaluations);
  const problematicFields = fields
    .map((field) => ({
      field,
      errors: evaluations.flatMap((evaluation) =>
        evaluation.fields.filter((result) => result.field === field && !result.passed),
      ).length,
    }))
    .sort((left, right) => right.errors - left.errors);
  const evaluatedFields = evaluations.reduce(
    (total, evaluation) => total + evaluation.evaluatedFields,
    0,
  );
  const correctFields = evaluations.reduce(
    (total, evaluation) => total + evaluation.correctFields,
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    datasetRoot,
    totalCases: evaluations.length,
    evaluatedFields,
    correctFields,
    overallAccuracy: percent(correctFields, evaluatedFields),
    categorySummaries,
    fieldAccuracy: allFieldSummary,
    errorCounts,
    problematicFields,
    cases: evaluations,
    targets: {
      article: "> 95%",
      amount: "> 95%",
      classification: "> 95%",
      overall: "> 90%",
      launchDatasetSize: "30 verbali reali",
    },
  };
}

function summarizeCategory(
  category: DatasetCategory,
  evaluations: CaseEvaluation[],
): CategorySummary {
  return {
    category,
    documents: evaluations.length,
    accuracy: percent(
      evaluations.reduce((total, evaluation) => total + evaluation.correctFields, 0),
      evaluations.reduce((total, evaluation) => total + evaluation.evaluatedFields, 0),
    ),
    fields: summarizeFields(evaluations),
  };
}

function summarizeFields(evaluations: CaseEvaluation[]) {
  return Object.fromEntries(
    fields.map((field) => {
      const matching = evaluations.flatMap((evaluation) =>
        evaluation.fields.filter((result) => result.field === field),
      );
      const correct = matching.filter((result) => result.passed).length;

      return [
        field,
        {
          evaluated: matching.length,
          correct,
          accuracy: percent(correct, matching.length),
        } satisfies FieldAccuracy,
      ];
    }),
  ) as Record<EvaluationField, FieldAccuracy>;
}

function countErrors(evaluations: CaseEvaluation[]) {
  const counts: Record<EvaluationErrorType, number> = {
    OCR_ERROR: 0,
    PARSER_ERROR: 0,
    RULE_ENGINE_ERROR: 0,
    CLASSIFICATION_ERROR: 0,
  };

  for (const evaluation of evaluations) {
    for (const field of evaluation.fields) {
      if (field.errorType) counts[field.errorType] += 1;
    }
  }

  return counts;
}

function calculateAccuracy(fieldResults: FieldResult[]) {
  return percent(
    fieldResults.filter((field) => field.passed).length,
    fieldResults.length,
  );
}

function printSummary(summary: ReturnType<typeof buildSummary>) {
  console.log("Valutazione dataset MulteOnline");
  console.log(`Casi analizzati: ${summary.totalCases}`);
  console.log(`Accuracy complessiva: ${summary.overallAccuracy}%`);
  console.log("");

  for (const category of summary.categorySummaries) {
    console.log(`Categoria: ${category.category}`);
    console.log(`Verbali: ${category.documents}`);
    console.log(`Accuracy articolo: ${category.fields.article.accuracy}%`);
    console.log(`Accuracy importo: ${category.fields.amount.accuracy}%`);
    console.log(`Accuracy targa: ${category.fields.plate.accuracy}%`);
    console.log(
      `Accuracy classificazione: ${category.fields.classification.accuracy}%`,
    );
    console.log(`Accuracy totale: ${category.accuracy}%`);
    console.log("");
  }

  console.log(
    `Report salvato in ${path.join("evaluation-results", "latest-summary.json")}`,
  );
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

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function mimeTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

function parseAmount(value: string) {
  const match = value.match(/\d{1,4}(?:[.,]\d{2})?/);
  if (!match) return null;
  return Number(match[0].replace(",", "."));
}

function parseInteger(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function percent(correct: number, total: number) {
  if (total === 0) return 0;
  return Number(((correct / total) * 100).toFixed(2));
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "");
}
