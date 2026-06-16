import { jsPDF } from "jspdf";
import type {
  ExtractedDataField,
  FieldConfidence,
  ScreeningReport,
} from "../screening-report";

const SITE_URL = "https://multeonline-rhyn.vercel.app";
const PAGE_WIDTH = 210;
const MARGIN_X = 18;
const BOTTOM_Y = 276;
const COLORS = {
  ink: [21, 43, 48],
  muted: [91, 108, 119],
  line: [218, 226, 230],
  brand: [15, 87, 82],
  brandDark: [16, 61, 58],
  soft: [239, 246, 244],
  amber: [255, 247, 230],
  amberLine: [244, 190, 95],
  white: [255, 255, 255],
} as const;

const fieldOrder: ExtractedDataField["key"][] = [
  "authority",
  "municipality",
  "reportNumber",
  "registryNumber",
  "plate",
  "violationDate",
  "violationTime",
  "assessmentDate",
  "assessmentTime",
  "notificationDate",
  "place",
  "article",
  "paragraph",
  "violationType",
  "speedDetected",
  "speedLimit",
  "speedExcess",
  "licensePoints",
  "amount",
  "reducedAmount",
  "minimumAmount",
  "administrativeFees",
  "deviceName",
  "approvalDecree",
  "calibrationCheck",
  "eventSummary",
];

export function generateScreeningReportPdf(report: ScreeningReport) {
  const doc = buildScreeningReportPdf(report);
  doc.save("MulteOnline-relazione-preliminare.pdf");
}

export function buildScreeningReportPdf(report: ScreeningReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  renderSummaryPage(doc, report);
  doc.addPage();
  renderDataPage(doc, report);
  doc.addPage();
  renderIssuesPage(doc, report);
  doc.addPage();
  renderNextStepPage(doc, report);

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    renderFooter(doc, page, doc.getNumberOfPages());
  }

  return doc;
}

function renderSummaryPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Relazione preliminare sul verbale");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Data generazione: ${formatDateTime(new Date())}`, MARGIN_X, 43);

  drawPanel(doc, MARGIN_X, 55, 174, 76, COLORS.soft, COLORS.line);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Sintesi dello screening", MARGIN_X + 8, 69);

  const rows = [
    ["Esito preliminare", report.outcome],
    ["Tipo violazione", report.violationClassification.value],
    ["Articolo CdS", report.violatedRule.article],
    ["Importo", getExtractedValue(report, "reducedAmount") || getExtractedValue(report, "amount")],
    ["Punti patente", getExtractedValue(report, "licensePoints")],
  ];

  let y = 82;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, MARGIN_X + 8, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    doc.text(trimToWidth(doc, value, 90), MARGIN_X + 65, y);
    y += 10;
  }

  drawSectionTitle(doc, "Raccomandazione finale", 154);
  drawTextBlock(doc, report.finalRecommendation, MARGIN_X, 164, 174, 50);

  drawSectionTitle(doc, "Nota importante", 230);
  drawTextBlock(doc, report.disclaimer, MARGIN_X, 240, 174, 24, {
    fill: COLORS.amber,
    stroke: COLORS.amberLine,
  });
}

function renderDataPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Dati estratti dal verbale");

  const fields = orderedFields(report.extractedData);
  const tableX = MARGIN_X;
  const tableY = 47;
  const col1 = 56;
  const col2 = 118;
  let y = tableY;

  doc.setFillColor(...COLORS.brandDark);
  doc.rect(tableX, y, col1 + col2, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("Campo", tableX + 4, y + 6);
  doc.text("Valore", tableX + col1 + 4, y + 6);
  y += 9;

  for (const field of fields) {
    if (y > 264) break;
    const confidenceSuffix = formatConfidenceSuffix(field.confidence);
    const value = confidenceSuffix
      ? `${field.value} (${confidenceSuffix})`
      : field.value;
    const lines = doc.splitTextToSize(value, col2 - 8).slice(0, 2);
    const rowHeight = Math.max(7, 4 * lines.length + 3);

    doc.setDrawColor(...COLORS.line);
    doc.setFillColor(248, 250, 250);
    doc.rect(tableX, y, col1, rowHeight, "FD");
    doc.setFillColor(...COLORS.white);
    doc.rect(tableX + col1, y, col2, rowHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.ink);
    doc.text(field.label, tableX + 4, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.ink);
    doc.text(lines, tableX + col1 + 4, y + 5);
    y += rowHeight;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "L'affidabilita viene indicata solo per dati con confidenza media, bassa o non rilevati.",
    MARGIN_X,
    270,
  );
}

function renderIssuesPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Possibili elementi da approfondire");

  const items =
    report.potentialIssues.length > 0
      ? report.potentialIssues
      : [
          "Dal solo documento caricato non emergono elementi specifici; resta consigliata una verifica della documentazione completa.",
        ];

  let y = 48;
  for (const item of items.slice(0, 9)) {
    y = drawListItem(doc, item, MARGIN_X, y, 174);
    y += 3;
  }

  if (report.consistencyChecks.length > 0) {
    drawSectionTitle(doc, "Verifiche di coerenza", Math.max(y + 8, 158));
    y = Math.max(y + 20, 170);
    for (const check of report.consistencyChecks.slice(0, 4)) {
      y = drawListItem(
        doc,
        `${check.title}: ${check.detail}`,
        MARGIN_X,
        y,
        174,
        check.status,
      );
      y += 3;
    }
  }
}

function renderNextStepPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Passo successivo");

  drawPanel(doc, MARGIN_X, 54, 174, 92, COLORS.soft, COLORS.line);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Consulenza Legale €19,90", MARGIN_X + 10, 73);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(
      "Una revisione professionale del verbale per verificare lo screening, valutare la convenienza economica e indicare il percorso piu opportuno prima di decidere se procedere.",
      150,
    ),
    MARGIN_X + 10,
    90,
  );

  drawButton(doc, "Vai su multeonline-rhyn.vercel.app", MARGIN_X + 10, 119, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(SITE_URL, MARGIN_X + 10, 139);

  drawSectionTitle(doc, "Raccomandazione prudenziale", 172);
  drawTextBlock(doc, report.suggestedNextStep || report.finalRecommendation, MARGIN_X, 182, 174, 45);

  drawSectionTitle(doc, "Costi esterni", 242);
  drawTextBlock(
    doc,
    "Eventuali contributi, marche, diritti, spese di notifica, contributo unificato o altri costi previsti dalla normativa restano a carico del cliente.",
    MARGIN_X,
    252,
    174,
    24,
  );
}

function renderHeader(doc: jsPDF, title: string) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.white);
  doc.text("MulteOnline", MARGIN_X, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, MARGIN_X, 36);
}

function renderFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(...COLORS.line);
  doc.line(MARGIN_X, BOTTOM_Y, PAGE_WIDTH - MARGIN_X, BOTTOM_Y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("Screening preliminare automatizzato - non costituisce parere legale", MARGIN_X, 284);
  doc.text(`${page}/${total}`, PAGE_WIDTH - MARGIN_X, 284, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(title, MARGIN_X, y);
}

function drawTextBlock(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { fill: readonly [number, number, number]; stroke: readonly [number, number, number] },
) {
  if (options) {
    drawPanel(doc, x, y - 8, width, height, options.fill, options.stroke);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(doc.splitTextToSize(text, width - (options ? 14 : 0)), x + (options ? 7 : 0), y + 2);
}

function drawPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: readonly [number, number, number],
  stroke: readonly [number, number, number],
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");
}

function drawListItem(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  prefix = "Verifica consigliata",
) {
  const lines = doc.splitTextToSize(text, width - 12);
  const height = Math.max(16, lines.length * 5 + 10);
  drawPanel(doc, x, y, width, height, COLORS.white, COLORS.line);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.brand);
  doc.text(prefix, x + 7, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(lines, x + 7, y + 14);
  return y + height;
}

function drawButton(doc: jsPDF, label: string, x: number, y: number, width: number) {
  doc.setFillColor(...COLORS.brandDark);
  doc.roundedRect(x, y, width, 12, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text(label, x + width / 2, y + 7.8, { align: "center" });
  doc.link(x, y, width, 12, { url: SITE_URL });
}

function orderedFields(fields: ExtractedDataField[]) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return fieldOrder.flatMap((key) => {
    const field = byKey.get(key);
    return field ? [field] : [];
  });
}

function getExtractedValue(report: ScreeningReport, key: ExtractedDataField["key"]) {
  return report.extractedData.find((field) => field.key === key)?.value ?? "";
}

function formatConfidenceSuffix(confidence: FieldConfidence) {
  if (confidence === "Alta") return "";
  if (confidence === "Non rilevato") return "non rilevato";
  return `affidabilita ${confidence.toLowerCase()}`;
}

function trimToWidth(doc: jsPDF, value: string, width: number) {
  if (doc.getTextWidth(value) <= width) return value;
  let output = value;
  while (output.length > 8 && doc.getTextWidth(`${output}...`) > width) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}
