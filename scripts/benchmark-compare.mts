import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ProviderReport = {
  generatedAt?: string;
  provider?: string;
  model?: string;
  totals?: {
    cases: number;
    totalAccuracy: number;
    readableAccuracy: number;
  };
  categoryAccuracy?: Record<
    string,
    { cases: number; totalAccuracy: number; readableAccuracy: number }
  >;
  fieldAccuracy?: Record<
    string,
    { expected: number; readable: number; totalAccuracy: number; readableAccuracy: number }
  >;
  providerErrors?: number;
  averageDurationMs?: number;
  averageCostEur?: number;
  cases?: Array<{
    durationMs?: number;
    estimatedCostEur?: number;
    failureReason?: string;
  }>;
};

const resultsRoot = path.join(process.cwd(), "evaluation-results");
const geminiPath = path.join(resultsRoot, "benchmark-report.json");
const openAIPath = path.join(resultsRoot, "gpt4o-benchmark-report.json");
const jsonReportPath = path.join(resultsRoot, "provider-comparison-report.json");
const markdownReportPath = path.join(resultsRoot, "provider-comparison-report.md");

const fields = [
  "noticeNumber",
  "plate",
  "violationDate",
  "amountReduced",
  "amountOrdinary",
  "articleCode",
  "classification",
];
const categories = ["autovelox", "ztl", "sosta", "misto"];

await main();

async function main() {
  const gemini = await readReport(geminiPath, "gemini");
  const openai = await readReport(openAIPath, "openai");
  const report = buildComparison(gemini, openai);

  await mkdir(resultsRoot, { recursive: true });
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownReportPath, renderMarkdown(report), "utf8");

  console.log("Provider comparison benchmark");
  console.log(`Gemini: ${report.providers.gemini.status}`);
  console.log(`GPT-4o: ${report.providers.openai.status}`);
  console.log(`Report JSON: ${jsonReportPath}`);
  console.log(`Report MD: ${markdownReportPath}`);
}

async function readReport(filePath: string, provider: string) {
  try {
    const report = JSON.parse(await readFile(filePath, "utf8")) as ProviderReport;
    return {
      provider,
      status: "available",
      path: filePath,
      report,
    };
  } catch {
    return {
      provider,
      status: "missing",
      path: filePath,
      report: null,
    };
  }
}

function buildComparison(
  gemini: Awaited<ReturnType<typeof readReport>>,
  openai: Awaited<ReturnType<typeof readReport>>,
) {
  return {
    generatedAt: new Date().toISOString(),
    providers: {
      gemini: providerSummary(gemini, "Google Gemini Vision"),
      openai: providerSummary(openai, "GPT-4o Vision"),
    },
    categories: Object.fromEntries(
      categories.map((category) => [
        category,
        {
          gemini: categorySummary(gemini.report, category),
          openai: categorySummary(openai.report, category),
        },
      ]),
    ),
    fields: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          gemini: fieldSummary(gemini.report, field),
          openai: fieldSummary(openai.report, field),
        },
      ]),
    ),
    note:
      "GPT-4o e usato solo per benchmark comparativo. Il flusso pubblico del sito resta invariato.",
  };
}

function providerSummary(
  input: Awaited<ReturnType<typeof readReport>>,
  label: string,
) {
  const report = input.report;
  const cases = report?.cases ?? [];
  const averageDurationMs =
    report?.averageDurationMs ??
    average(cases.map((item) => item.durationMs ?? 0));
  const averageCostEur =
    report?.averageCostEur ??
    average(cases.map((item) => item.estimatedCostEur ?? 0));

  return {
    label,
    status: input.status,
    source: input.path,
    cases: report?.totals?.cases ?? 0,
    totalAccuracy: report?.totals?.totalAccuracy ?? 0,
    readableAccuracy: report?.totals?.readableAccuracy ?? 0,
    providerErrors:
      report?.providerErrors ??
      cases.filter((item) => item.failureReason && item.failureReason !== "NONE")
        .length,
    averageDurationMs,
    averageCostEur,
  };
}

function categorySummary(report: ProviderReport | null, category: string) {
  const item = report?.categoryAccuracy?.[category];
  return {
    cases: item?.cases ?? 0,
    totalAccuracy: item?.totalAccuracy ?? 0,
    readableAccuracy: item?.readableAccuracy ?? 0,
  };
}

function fieldSummary(report: ProviderReport | null, field: string) {
  const item = report?.fieldAccuracy?.[field];
  return {
    expected: item?.expected ?? 0,
    readable: item?.readable ?? 0,
    totalAccuracy: item?.totalAccuracy ?? 0,
    readableAccuracy: item?.readableAccuracy ?? 0,
  };
}

function renderMarkdown(report: ReturnType<typeof buildComparison>) {
  const lines = [
    "# Confronto Provider Vision",
    "",
    `Generato: ${report.generatedAt}`,
    "",
    "## Sintesi",
    "",
    "| Provider | Stato | Casi | Accuracy totale | Accuracy leggibili | Errori provider | Tempo medio | Costo medio |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    providerRow(report.providers.gemini),
    providerRow(report.providers.openai),
    "",
    "## Per Categoria",
    "",
    "| Categoria | Gemini leggibili | GPT-4o leggibili |",
    "|---|---:|---:|",
    ...categories.map((category) => {
      const item = report.categories[category];
      return `| ${category} | ${item.gemini.readableAccuracy}% | ${item.openai.readableAccuracy}% |`;
    }),
    "",
    "## Per Campo",
    "",
    "| Campo | Gemini leggibili | GPT-4o leggibili |",
    "|---|---:|---:|",
    ...fields.map((field) => {
      const item = report.fields[field];
      return `| ${field} | ${item.gemini.readableAccuracy}% | ${item.openai.readableAccuracy}% |`;
    }),
    "",
    report.note,
  ];

  return `${lines.join("\n")}\n`;
}

function providerRow(provider: ReturnType<typeof providerSummary>) {
  return `| ${provider.label} | ${provider.status} | ${provider.cases} | ${provider.totalAccuracy}% | ${provider.readableAccuracy}% | ${provider.providerErrors} | ${provider.averageDurationMs} ms | ${provider.averageCostEur} EUR |`;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(5),
  );
}
