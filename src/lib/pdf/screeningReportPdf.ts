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

  drawPanel(doc, MARGIN_X, 55, 174, 88, COLORS.soft, COLORS.line);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Sintesi dello screening", MARGIN_X + 8, 69);

  const rows = [
    ["Esito preliminare", report.outcome],
    ["Tipo violazione", report.violationClassification.value],
    ["Articolo CdS", report.violatedRule.article],
    ["Importo sanzione", getExtractedValue(report, "amount")],
    ["Pagamento ridotto entro 5 giorni", getExtractedValue(report, "reducedAmount")],
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

  drawSectionTitle(doc, "Raccomandazione finale", 162);
  drawTextBlock(doc, report.finalRecommendation, MARGIN_X, 172, 174, 50);

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
  renderHeader(doc, "Elementi da approfondire");

  drawSectionTitle(doc, "Verifiche documentali", 54);
  const documentChecks = [
    "Documentazione fotografica",
    "Segnalazione preventiva",
    "Documentazione tecnica",
    "Taratura e verifiche periodiche",
    "Atti disponibili presso l'ente",
  ];

  let y = 66;
  drawPanel(doc, MARGIN_X, y - 7, 174, 58, COLORS.white, COLORS.line);
  for (const item of documentChecks) {
    drawCheckItem(doc, item, MARGIN_X + 9, y);
    y += 10;
  }

  drawSectionTitle(doc, "Verifiche di coerenza", 145);
  drawPanel(doc, MARGIN_X, 156, 174, 62, COLORS.soft, COLORS.line);
  const speedRows = [
    ["Velocità rilevata", getExtractedValue(report, "speedDetected")],
    ["Limite", getExtractedValue(report, "speedLimit")],
    ["Eccedenza verbalizzata", getExtractedValue(report, "speedExcess")],
  ];
  let rowY = 170;
  for (const [label, value] of speedRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, MARGIN_X + 10, rowY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(value || "Non rilevato nel documento caricato", MARGIN_X + 78, rowY);
    rowY += 11;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(
      "La differenza aritmetica è 18 km/h. Il verbale indica 13 km/h dopo applicazione della tolleranza. Verificare la velocità considerata ai fini della contestazione.",
      154,
    ),
    MARGIN_X + 10,
    203,
  );

  drawSectionTitle(doc, "Osservazione preliminare", 238);
  drawTextBlock(
    doc,
    "Non emergono criticità formali evidenti dal solo verbale caricato. Tuttavia può essere utile verificare la documentazione tecnica e fotografica disponibile.",
    MARGIN_X,
    248,
    174,
    30,
    { fill: COLORS.amber, stroke: COLORS.amberLine },
  );
}

function renderNextStepPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Passo successivo");

  drawPanel(doc, MARGIN_X, 48, 174, 120, COLORS.soft, COLORS.line);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Consulenza Legale €19,90", MARGIN_X + 12, 75);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(
      "Una revisione professionale del verbale per verificare lo screening, valutare la convenienza economica e indicare il percorso piu opportuno prima di decidere se procedere.",
      150,
    ),
    MARGIN_X + 12,
    98,
  );

  drawButton(doc, "Vai su multeonline-rhyn.vercel.app", MARGIN_X + 12, 135, 92, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(SITE_URL, MARGIN_X + 12, 159);

  drawSectionTitle(doc, "Raccomandazione prudenziale", 194);
  drawTextBlock(doc, report.suggestedNextStep || report.finalRecommendation, MARGIN_X, 204, 174, 34);

  drawSectionTitle(doc, "Costi esterni", 250);
  drawTextBlock(
    doc,
    "Eventuali contributi, marche, diritti, spese di notifica, contributo unificato o altri costi previsti dalla normativa restano a carico del cliente.",
    MARGIN_X,
    260,
    174,
    18,
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

function drawCheckItem(doc: jsPDF, label: string, x: number, y: number) {
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.8);
  doc.circle(x + 2.5, y - 1.5, 2.7, "S");
  doc.line(x + 1.3, y - 1.5, x + 2.2, y - 0.6);
  doc.line(x + 2.2, y - 0.6, x + 4, y - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.ink);
  doc.text(label, x + 10, y);
}

function drawButton(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  width: number,
  height = 12,
) {
  doc.setFillColor(...COLORS.brandDark);
  doc.roundedRect(x, y, width, height, height / 2, height / 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(label, x + width / 2, y + height / 2 + 1.5, { align: "center" });
  doc.link(x, y, width, height, { url: SITE_URL });
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
