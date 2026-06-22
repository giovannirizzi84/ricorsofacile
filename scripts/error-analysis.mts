import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
  category: string;
  fields: FieldResult[];
};

type BenchmarkReport = {
  generatedAt: string;
  cases: CaseResult[];
};

type ErrorItem = {
  caseId: string;
  caseCategory: string;
  errorCategory: string;
  field: EvaluationField;
  expected: string;
  actual: string;
  readable: boolean;
  confusion: string | null;
};

const resultsRoot = path.join(process.cwd(), "evaluation-results");
const benchmarkReportPath = path.join(resultsRoot, "benchmark-report.json");
const errorAnalysisPath = path.join(resultsRoot, "error-analysis.md");
const confusionPairs = [
  ["5", "6"],
  ["0", "O"],
  ["8", "B"],
  ["I", "1"],
] as const;

await main();

async function main() {
  const report = JSON.parse(
    await readFile(benchmarkReportPath, "utf8"),
  ) as BenchmarkReport;
  const errors = collectErrors(report.cases);
  await mkdir(resultsRoot, { recursive: true });
  await writeFile(errorAnalysisPath, renderErrorAnalysis(report, errors), "utf8");
  console.log(`Error analysis: ${errorAnalysisPath}`);
}

function collectErrors(cases: CaseResult[]): ErrorItem[] {
  return cases.flatMap((item) =>
    item.fields
      .filter((field) => !field.correct)
      .map((field) => ({
        caseId: item.id,
        caseCategory: item.category,
        errorCategory: errorCategoryForField(field.field),
        field: field.field,
        expected: field.expected,
        actual: field.actual,
        readable: field.readable,
        confusion: field.confusion ?? detectConfusion(field.expected, field.actual),
      })),
  );
}

function errorCategoryForField(field: EvaluationField) {
  if (field === "plate") return "targhe";
  if (field === "noticeNumber") return "verbali";
  if (field === "violationDate") return "date";
  if (field === "amountReduced" || field === "amountOrdinary") return "importi";
  if (field === "articleCode" || field === "paragraph") return "articolo";
  if (field === "classification") return "classificazione";
  return "altro";
}

function renderErrorAnalysis(report: BenchmarkReport, errors: ErrorItem[]) {
  const grouped = groupBy(errors, (error) => error.errorCategory);
  const confusionCounts = countBy(
    errors.filter((error) => error.confusion),
    (error) => error.confusion ?? "",
  );
  const topErrors = topFrequentErrors(errors, 10);
  const categories = ["targhe", "verbali", "date", "importi", "articolo", "classificazione"];

  const lines = [
    "# Error Analysis MulteOnline",
    "",
    `Generato da benchmark: ${report.generatedAt}`,
    `Generato report: ${new Date().toISOString()}`,
    "",
    "## Sintesi",
    "",
    `- Casi analizzati: ${report.cases.length}`,
    `- Errori totali: ${errors.length}`,
    "",
    "## Errori Per Categoria",
    "",
    "| Categoria | Errori |",
    "|---|---:|",
    ...categories.map((category) => `| ${category} | ${grouped[category]?.length ?? 0} |`),
    "",
    "## Dettaglio Errori",
    "",
  ];

  if (errors.length === 0) {
    lines.push("Nessun errore rilevato nel benchmark corrente.");
  } else {
    lines.push("| Caso | Categoria caso | Gruppo | Campo | Atteso | Ottenuto | Leggibile | Confusione |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const error of errors) {
      lines.push(
        `| ${error.caseId} | ${error.caseCategory} | ${error.errorCategory} | ${error.field} | ${error.expected} | ${error.actual} | ${error.readable ? "si" : "no"} | ${error.confusion ?? "-"} |`,
      );
    }
  }

  lines.push("", "## Confusioni Rilevate", "");
  if (Object.keys(confusionCounts).length === 0) {
    lines.push("Nessuna confusione 5 ↔ 6, 0 ↔ O, 8 ↔ B, I ↔ 1 rilevata.");
  } else {
    lines.push("| Confusione | Conteggio |", "|---|---:|");
    for (const [confusion, count] of Object.entries(confusionCounts)) {
      lines.push(`| ${confusion} | ${count} |`);
    }
  }

  lines.push("", "## Top 10 Errori Piu Frequenti", "");
  if (topErrors.length === 0) {
    lines.push("Nessun errore frequente rilevato.");
  } else {
    lines.push("| Errore | Frequenza | Esempio |");
    lines.push("|---|---:|---|");
    for (const error of topErrors) {
      lines.push(`| ${error.key} | ${error.count} | ${error.example} |`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function topFrequentErrors(errors: ErrorItem[], limit: number) {
  const counts = new Map<
    string,
    { key: string; count: number; example: string }
  >();

  for (const error of errors) {
    const key = `${error.errorCategory}/${error.field}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(key, {
      key,
      count: 1,
      example: `${error.caseId}: atteso "${error.expected}", ottenuto "${error.actual}"`,
    });
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, limit);
}

function detectConfusion(expected: string, actual: string) {
  const expectedToken = normalizeToken(expected).toUpperCase();
  const actualToken = normalizeToken(actual).toUpperCase();
  for (const [left, right] of confusionPairs) {
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

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
    return groups;
  }, {});
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}
