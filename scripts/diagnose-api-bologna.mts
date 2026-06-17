import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { POST } from "../src/app/api/analyze/route.ts";

const datasetDir = path.join(
  process.cwd(),
  "datasets",
  "sosta",
  "golden-bologna-sosta-rimozione",
);
const imagePath = path.join(datasetDir, "original.jpeg");
const outputPath = path.join(
  process.cwd(),
  "evaluation-results",
  "api-bologna-diagnostic.json",
);

async function main() {
  await loadLocalEnv();

  const imageBuffer = await readFile(imagePath);
  const formData = new FormData();
  formData.append(
    "files",
    new File([imageBuffer], "golden-bologna-sosta-rimozione.jpeg", {
      type: "image/jpeg",
    }),
  );

  const response = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: formData,
    }),
  );
  const payload = await response.json() as {
    report?: {
      identifiedData?: Record<string, string>;
      normalizedData?: Record<string, string>;
      violationClassification?: { value?: string };
      potentialIssues?: string[];
      consistencyChecks?: Array<{ title: string; detail: string }>;
      summary?: string;
    };
    processing?: unknown;
    error?: string;
  };
  const report = payload.report;
  const extracted = {
    authority: report?.identifiedData?.authority ?? "",
    municipality: report?.identifiedData?.municipality ?? "",
    noticeNumber: report?.identifiedData?.reportNumber ?? "",
    plate: report?.identifiedData?.plate ?? "",
    violationDate: report?.identifiedData?.violationDate ?? "",
    violationTime: report?.identifiedData?.violationTime ?? "",
    article: report?.normalizedData?.articleCode ?? "",
    amount: report?.identifiedData?.amount ?? "",
    classification: report?.violationClassification?.value ?? "",
  };
  const checks = {
    authority: includesToken(extracted.authority, "Comune di Bologna - Polizia Locale"),
    municipality: includesToken(extracted.municipality, "Bologna"),
    noticeNumber: includesToken(extracted.noticeNumber, "635227-71"),
    plate: includesToken(extracted.plate, "DZ923NZ"),
    violationDate: sameItalianDate(extracted.violationDate, "28/01/2026"),
    violationTime: includesToken(extracted.violationTime, "11:10"),
    article: includesToken(extracted.article, "7/158"),
    amount: includesToken(extracted.amount, "€93,60"),
    classification: includesToken(extracted.classification, "Sosta / Rimozione"),
    noSpeedArithmetic: !/differenza aritmetica|18\s*km\/h|13\s*km\/h/i.test(
      JSON.stringify(report),
    ),
  };
  const ok = response.status === 200 && Object.values(checks).every(Boolean);
  const result = {
    ok,
    status: response.status,
    extracted,
    checks,
    processing: payload.processing,
    report: payload.report,
    error: payload.error,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log("API Bologna diagnostic");
  console.log(`HTTP status: ${response.status}`);
  console.log("Dati estratti:");
  console.log(JSON.stringify(extracted, null, 2));
  console.log("Checks:");
  console.log(JSON.stringify(checks, null, 2));
  console.log(`Output salvato in: ${outputPath}`);

  if (!ok) {
    process.exit(1);
  }
  process.exit(0);
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
    // .env.local is optional.
  }
}

function includesToken(actual: string, expected: string) {
  return normalize(actual).includes(normalize(expected));
}

function sameItalianDate(actual: string, expected: string) {
  return normalizeDate(actual) === normalizeDate(expected);
}

function normalize(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeDate(value: string) {
  const numeric = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (numeric) {
    return [
      numeric[1].padStart(2, "0"),
      numeric[2].padStart(2, "0"),
      numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3],
    ].join("-");
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
  const textual = value.toLowerCase().match(
    /(\d{1,2})\s+([a-zà]+)\s+(\d{4})/,
  );
  if (!textual) return normalize(value);
  return [
    textual[1].padStart(2, "0"),
    months[textual[2]] ?? textual[2],
    textual[3],
  ].join("-");
}

await main();
