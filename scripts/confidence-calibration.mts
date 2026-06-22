import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvaluationField = {
  field: string;
  expected: string;
  actual: string;
  readable: boolean;
  correct: boolean;
};

type BenchmarkCase = {
  id: string;
  category: string;
  confidence: number;
  totalAccuracy: number;
  readableAccuracy: number;
  fields: EvaluationField[];
};

type BenchmarkReport = {
  generatedAt: string;
  cases: BenchmarkCase[];
};

type Bucket = {
  label: string;
  min: number;
  max: number;
};

const resultsRoot = path.join(process.cwd(), "evaluation-results");
const benchmarkReportPath = path.join(resultsRoot, "benchmark-report.json");
const calibrationReportPath = path.join(resultsRoot, "confidence-calibration.md");
const buckets: Bucket[] = [
  { label: "90-100", min: 90, max: 100 },
  { label: "80-89", min: 80, max: 89.999 },
  { label: "70-79", min: 70, max: 79.999 },
  { label: "60-69", min: 60, max: 69.999 },
  { label: "<60", min: Number.NEGATIVE_INFINITY, max: 59.999 },
];

await main();

async function main() {
  const report = JSON.parse(
    await readFile(benchmarkReportPath, "utf8"),
  ) as BenchmarkReport;
  await mkdir(resultsRoot, { recursive: true });
  await writeFile(calibrationReportPath, renderCalibration(report), "utf8");
  console.log(`Confidence calibration: ${calibrationReportPath}`);
}

function renderCalibration(report: BenchmarkReport) {
  const lines = [
    "# Confidence Calibration MulteOnline",
    "",
    `Generato da benchmark: ${report.generatedAt}`,
    `Generato report: ${new Date().toISOString()}`,
    "",
    "## Lettura",
    "",
    "La calibrazione confronta il confidence score con l'accuracy reale misurata sui campi attesi. L'accuracy principale usata per la calibrazione e' quella sui campi leggibili, per non penalizzare dati non presenti o non valutabili nel documento.",
    "",
    "## Casi Benchmark",
    "",
    "| Caso | Categoria | Confidence | Accuracy leggibili | Accuracy totale | Campi corretti | Campi errati |",
    "|---|---|---:|---:|---:|---|---|",
    ...report.cases.map((item) => renderCaseRow(item)),
    "",
    "## Fasce Confidence",
    "",
    "| Fascia | Casi | Accuracy media leggibili | Accuracy media totale | Errore medio |",
    "|---|---:|---:|---:|---:|",
    ...buckets.map((bucket) => renderBucketRow(bucket, report.cases)),
    "",
    "## Conclusione Operativa",
    "",
    renderConclusion(report.cases),
    "",
    "## Raccomandazione Soglia",
    "",
    renderThresholdRecommendation(report.cases),
  ];

  return `${lines.join("\n")}\n`;
}

function renderCaseRow(item: BenchmarkCase) {
  const correctFields = item.fields
    .filter((field) => field.correct)
    .map((field) => field.field)
    .join(", ");
  const wrongFields = item.fields
    .filter((field) => !field.correct)
    .map((field) =>
      field.readable
        ? `${field.field} (${field.actual})`
        : `${field.field} (non leggibile/non valutabile)`,
    )
    .join(", ");

  return `| ${item.id} | ${item.category} | ${item.confidence} | ${item.readableAccuracy}% | ${item.totalAccuracy}% | ${correctFields || "-"} | ${wrongFields || "-"} |`;
}

function renderBucketRow(bucket: Bucket, cases: BenchmarkCase[]) {
  const matching = cases.filter(
    (item) => item.confidence >= bucket.min && item.confidence <= bucket.max,
  );
  const readableAccuracy = average(matching.map((item) => item.readableAccuracy));
  const totalAccuracy = average(matching.map((item) => item.totalAccuracy));
  const averageError = matching.length === 0 ? 0 : Number((100 - readableAccuracy).toFixed(2));
  return `| ${bucket.label} | ${matching.length} | ${readableAccuracy}% | ${totalAccuracy}% | ${averageError}% |`;
}

function renderConclusion(cases: BenchmarkCase[]) {
  const highConfidenceCases = cases.filter((item) => item.confidence >= 90);
  const highConfidenceAccuracy = average(
    highConfidenceCases.map((item) => item.readableAccuracy),
  );
  const confidence90Text =
    highConfidenceCases.length === 0
      ? "Nel dataset attuale non ci sono casi con confidence >= 90, quindi la soglia non e' ancora calibrabile."
      : `Un confidence di 90 o superiore corrisponde a una precisione media del ${highConfidenceAccuracy}% sui campi leggibili nel dataset attuale.`;

  return `${confidence90Text}\n\nCampione attuale: ${cases.length} casi. La lettura e' utile come segnale iniziale, ma non ancora statisticamente robusta.`;
}

function renderThresholdRecommendation(cases: BenchmarkCase[]) {
  const highConfidence = cases.filter((item) => item.confidence >= 90);
  const lowerConfidence = cases.filter((item) => item.confidence < 90);
  const highAverage = average(highConfidence.map((item) => item.readableAccuracy));
  const lowerAverage = average(lowerConfidence.map((item) => item.readableAccuracy));

  if (highConfidence.length === 0) {
    return "Non confermare ancora la soglia 90: servono casi con confidence alta nel dataset.";
  }

  if (highAverage >= 90 && lowerAverage < highAverage) {
    return "La soglia confidence >= 90 puo' essere usata provvisoriamente per report diretto; i casi sotto 90 dovrebbero restare candidati a review pass. Confermare su almeno 50 verbali reali.";
  }

  return "La soglia confidence >= 90 non e' ancora sufficientemente predittiva: mantenere review pass prudenziale finche' il dataset non cresce.";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}
