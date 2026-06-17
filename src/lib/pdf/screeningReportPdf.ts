import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type {
  ExtractedDataField,
  FieldConfidence,
  ScreeningReport,
} from "../screening-report";

const CONSULTATION_URL =
  "https://multeonline-rhyn.vercel.app/prezzi?pacchetto=consulenza";
const DISPLAY_URL = "www.multeonline.it";
const FONT_FAMILY = "MulteOnlineSans";
const FONT_FILES = {
  normal: "/fonts/MulteOnlineSans-Regular.ttf",
  bold: "/fonts/MulteOnlineSans-Bold.ttf",
} as const;
const PAGE_WIDTH = 210;
const MARGIN_X = 18;
const BOTTOM_Y = 276;
type RgbColor = readonly [number, number, number];
const COLORS = {
  ink: [21, 43, 48],
  muted: [91, 108, 119],
  line: [218, 226, 230],
  brand: [15, 87, 82],
  brandDark: [16, 61, 58],
  soft: [239, 246, 244],
  greenSoft: [240, 248, 245],
  blueSoft: [241, 247, 253],
  amber: [255, 247, 230],
  amberLine: [244, 190, 95],
  white: [255, 255, 255],
} as const satisfies Record<string, RgbColor>;

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

export async function generateScreeningReportPdf(report: ScreeningReport) {
  const doc = await buildScreeningReportPdf(report);
  doc.save("MulteOnline-relazione-preliminare.pdf");
}

export async function buildScreeningReportPdf(report: ScreeningReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await loadPdfFonts(doc);
  const qrCode = await QRCode.toDataURL(CONSULTATION_URL, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
  });

  renderSummaryPage(doc, report);
  doc.addPage();
  renderDataPage(doc, report);
  doc.addPage();
  renderIssuesPage(doc, report);
  doc.addPage();
  renderNextStepPage(doc, report, qrCode);

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    renderFooter(doc, page, doc.getNumberOfPages());
  }

  return doc;
}

function renderSummaryPage(doc: jsPDF, report: ScreeningReport) {
  renderCoverHeader(doc);

  setPdfFont(doc, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Data generazione: ${formatDateTime(new Date())}`, MARGIN_X, 58);

  drawPanel(doc, MARGIN_X, 72, 174, 88, COLORS.soft, COLORS.line);
  setPdfFont(doc, "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Sintesi dello screening", MARGIN_X + 8, 86);

  const rows = [
    ["Esito preliminare", report.outcome],
    ["Tipo violazione", report.violationClassification.value],
    ["Articolo CdS", report.violatedRule.article],
    ["Importo sanzione", formatPdfValue(getExtractedValue(report, "amount"))],
    [
      "Pagamento ridotto entro 5 giorni",
      formatPdfValue(getExtractedValue(report, "reducedAmount")),
    ],
    ["Punti patente", getExtractedValue(report, "licensePoints")],
  ];

  let y = 99;
  for (const [label, value] of rows) {
    setPdfFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, MARGIN_X + 8, y);
    setPdfFont(doc, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.ink);
    doc.text(trimToWidth(doc, value, 90), MARGIN_X + 65, y);
    y += 10;
  }

  drawSectionTitle(doc, "Raccomandazione finale", 178);
  drawTextBlock(doc, report.finalRecommendation, MARGIN_X, 188, 174, 38);

  drawSectionTitle(doc, "Nota importante", 238);
  drawTextBlock(doc, report.disclaimer, MARGIN_X, 248, 174, 24, {
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
  setPdfFont(doc, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.white);
  doc.text("Campo", tableX + 4, y + 6);
  doc.text("Valore", tableX + col1 + 4, y + 6);
  y += 9;

  for (const field of fields) {
    if (y > 264) break;
    const confidenceSuffix = formatConfidenceSuffix(field.confidence);
    const formattedFieldValue = formatPdfValue(field.value);
    const value = confidenceSuffix
      ? `${formattedFieldValue} (${confidenceSuffix})`
      : formattedFieldValue;
    const lines = doc.splitTextToSize(value, col2 - 8).slice(0, 2);
    const rowHeight = Math.max(7, 4 * lines.length + 3);

    doc.setDrawColor(...COLORS.line);
    doc.setFillColor(248, 250, 250);
    doc.rect(tableX, y, col1, rowHeight, "FD");
    doc.setFillColor(...COLORS.white);
    doc.rect(tableX + col1, y, col2, rowHeight, "FD");

    setPdfFont(doc, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.ink);
    doc.text(field.label, tableX + 4, y + 5);

    setPdfFont(doc, "normal");
    doc.setTextColor(...COLORS.ink);
    doc.text(lines, tableX + col1 + 4, y + 5);
    y += rowHeight;
  }

  setPdfFont(doc, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "L'affidabilita viene indicata solo per dati con confidenza media, bassa o non rilevati.",
    MARGIN_X,
    272,
  );
}

function renderIssuesPage(doc: jsPDF, report: ScreeningReport) {
  renderHeader(doc, "Elementi da approfondire");

  const boxX = MARGIN_X;
  const boxW = 174;
  const innerX = boxX + 14;
  const valueX = boxX + 86;

  drawPanel(doc, boxX, 52, boxW, 70, COLORS.greenSoft, COLORS.line);
  drawSectionTitleAt(doc, "Verifiche documentali", innerX, 66);
  const documentChecks = [
    "documentazione fotografica",
    "segnalazione preventiva",
    "documentazione tecnica",
    "taratura",
    "atti disponibili",
  ];

  let y = 81;
  for (const item of documentChecks) {
    drawCheckItem(doc, item, innerX + 2, y, 8.8);
    y += 8;
  }

  drawPanel(doc, boxX, 132, boxW, 66, COLORS.amber, COLORS.amberLine);
  drawSectionTitleAt(doc, "Verifiche di coerenza", innerX, 148);
  const speedRows = [
    ["Velocità rilevata", getExtractedValue(report, "speedDetected")],
    ["Limite", getExtractedValue(report, "speedLimit")],
    ["Eccedenza verbalizzata", getExtractedValue(report, "speedExcess")],
  ];
  let rowY = 162;
  for (const [label, value] of speedRows) {
    setPdfFont(doc, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, innerX, rowY);
    setPdfFont(doc, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(value || "Non rilevato nel documento caricato", valueX, rowY);
    rowY += 8.2;
  }

  setPdfFont(doc, "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(
      "La differenza aritmetica è 18 km/h. Il verbale indica 13 km/h dopo applicazione della tolleranza. Verificare la velocità considerata ai fini della contestazione.",
      154,
    ),
    innerX,
    187,
  );

  drawPanel(doc, boxX, 214, boxW, 42, COLORS.blueSoft, COLORS.line);
  drawSectionTitleAt(doc, "Osservazione preliminare", innerX, 230);
  drawTextBlock(
    doc,
    "Non emergono criticità formali evidenti dal solo verbale caricato. Tuttavia può essere utile verificare la documentazione tecnica e fotografica disponibile.",
    innerX,
    240,
    146,
    16,
  );
}

function renderNextStepPage(
  doc: jsPDF,
  report: ScreeningReport,
  qrCode: string,
) {
  renderHeader(doc, "Passo successivo");

  const leftX = MARGIN_X;
  const rightX = 128;
  const leftW = 96;
  const rightW = 64;

  drawPanel(doc, leftX, 52, leftW, 176, COLORS.soft, COLORS.line);
  setPdfFont(doc, "bold");
  doc.setFontSize(15.5);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Consulenza Legale 19,90 €", leftX + 9, 74);

  setPdfFont(doc, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(
      "Una revisione professionale del verbale per verificare lo screening, valutare la convenienza economica e indicare il percorso piu opportuno prima di decidere se procedere.",
      74,
    ),
    leftX + 9,
    93,
  );

  drawSectionTitleAt(doc, "Perche richiedere la consulenza", leftX + 9, 136);
  const consultationBenefits = [
    "Verifica documentazione fotografica",
    "Verifica taratura e verifiche periodiche",
    "Verifica segnalazione preventiva",
    "Verifica termini e notifiche",
    "Valutazione della convenienza del ricorso",
    "Confronto con orientamenti giurisprudenziali rilevanti",
  ];

  let y = 149;
  for (const benefit of consultationBenefits) {
    drawCheckItem(doc, benefit, leftX + 9, y, 8.4);
    y += 10;
  }

  drawButton(doc, "Prenota consulenza 19,90 €", leftX + 9, 207, 72, 13);

  drawPanel(doc, rightX, 52, rightW, 128, COLORS.white, COLORS.line);
  setPdfFont(doc, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Prenota la", rightX + 10, 74);
  doc.text("consulenza", rightX + 10, 84);
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text("Scansiona il QR code", rightX + 10, 98);
  doc.addImage(qrCode, "PNG", rightX + 12, 108, 40, 40);
  doc.setFontSize(8);
  doc.text(DISPLAY_URL, rightX + 10, 163);

  drawSectionTitle(doc, "Costi esterni", 244);
  drawTextBlock(
    doc,
    "Eventuali contributi, marche, diritti, spese di notifica, contributo unificato o altri costi previsti dalla normativa restano a carico del cliente.",
    MARGIN_X,
    254,
    174,
    18,
  );
}

function renderCoverHeader(doc: jsPDF) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");
  setPdfFont(doc, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.white);
  doc.text("MulteOnline", MARGIN_X, 15);

  setPdfFont(doc, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    "Screening preliminare verbali e sanzioni amministrative",
    MARGIN_X,
    38,
  );
  setPdfFont(doc, "bold");
  doc.setFontSize(21);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("Relazione preliminare sul verbale", MARGIN_X, 50);
}

function renderHeader(doc: jsPDF, title: string) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, 24, "F");
  setPdfFont(doc, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.white);
  doc.text("MulteOnline", MARGIN_X, 15);

  setPdfFont(doc, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, MARGIN_X, 36);
}

function renderFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(...COLORS.line);
  doc.line(MARGIN_X, BOTTOM_Y, PAGE_WIDTH - MARGIN_X, BOTTOM_Y);
  setPdfFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  if (page === total) {
    doc.text(
      "Lo screening ha finalita esclusivamente informative e preliminari e non costituisce parere legale.",
      MARGIN_X,
      284,
    );
  } else {
    doc.text(`MulteOnline | Pagina ${page} di ${total}`, MARGIN_X, 284);
  }
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  drawSectionTitleAt(doc, title, MARGIN_X, y);
}

function drawSectionTitleAt(doc: jsPDF, title: string, x: number, y: number) {
  setPdfFont(doc, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(title, x, y);
}

function drawTextBlock(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: { fill: RgbColor; stroke: RgbColor },
) {
  if (options) {
    drawPanel(doc, x, y - 8, width, height, options.fill, options.stroke);
  }
  setPdfFont(doc, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    doc.splitTextToSize(text, width - (options ? 14 : 0)),
    x + (options ? 7 : 0),
    y + 2,
  );
}

function drawPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: RgbColor,
  stroke: RgbColor,
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");
}

function drawCheckItem(
  doc: jsPDF,
  label: string,
  x: number,
  y: number,
  fontSize = 10.5,
) {
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.8);
  doc.circle(x + 2.5, y - 1.5, 2.7, "S");
  doc.line(x + 1.3, y - 1.5, x + 2.2, y - 0.6);
  doc.line(x + 2.2, y - 0.6, x + 4, y - 3);
  setPdfFont(doc, "normal");
  doc.setFontSize(fontSize);
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
  setPdfFont(doc, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text(label, x + width / 2, y + height / 2 + 1.5, {
    align: "center",
  });
  doc.link(x, y, width, height, { url: CONSULTATION_URL });
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

async function loadPdfFonts(doc: jsPDF) {
  const [regular, bold] = await Promise.all([
    loadFontAsBase64(FONT_FILES.normal),
    loadFontAsBase64(FONT_FILES.bold),
  ]);

  doc.addFileToVFS("MulteOnlineSans-Regular.ttf", regular);
  doc.addFileToVFS("MulteOnlineSans-Bold.ttf", bold);
  doc.addFont("MulteOnlineSans-Regular.ttf", FONT_FAMILY, "normal");
  doc.addFont("MulteOnlineSans-Bold.ttf", FONT_FAMILY, "bold");
  setPdfFont(doc, "normal");
}

async function loadFontAsBase64(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Font PDF non caricato: ${path}`);
  }

  return arrayBufferToBase64(await response.arrayBuffer());
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function setPdfFont(doc: jsPDF, style: "normal" | "bold") {
  doc.setFont(FONT_FAMILY, style);
}

function formatPdfValue(value: string) {
  return value
    .replace(/\bEUR\s*([0-9]+(?:[.,][0-9]{2})?)\b/gi, "$1 €")
    .replace(/€\s*([0-9]+(?:[.,][0-9]{2})?)/g, "$1 €")
    .replace(/\s+/g, " ")
    .trim();
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
