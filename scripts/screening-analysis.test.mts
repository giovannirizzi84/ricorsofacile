import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { extractDocuments } from "../src/lib/documents/extractText.ts";
import { analyzeFineText } from "../src/lib/rules/fineAnalysisRules.ts";
import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  VIOLATION_NOT_CLASSIFIED,
} from "../src/lib/screening-report.ts";

const emptyCaseData = {
  notificationDate: "",
  authority: "",
  amount: "",
  violationType: "",
};

function analyze(text: string) {
  return analyzeFineText(text, emptyCaseData, {
    method: "Testo PDF + regole",
  });
}

function field(
  report: ReturnType<typeof analyze>,
  key: ReturnType<typeof analyze>["extractedData"][number]["key"],
) {
  const result = report.extractedData.find((item) => item.key === key);
  assert.ok(result, `Campo ${key} non presente nel report`);
  return result;
}

function assertPrudentLanguage(report: ReturnType<typeof analyze>) {
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(
    serialized,
    /ricorso fondato|multa annullabile|probabilit[aà] di (?:successo|vittoria)|successo garantito|vincerai/i,
  );
}

function visibleReportText(report: ReturnType<typeof analyze>) {
  return [
    report.outcome,
    report.summary,
    ...report.extractedData.map((item) => `${item.label}: ${item.value}`),
    report.violatedRule.article,
    report.violatedRule.paragraph,
    report.violationClassification.value,
    report.eventSummary,
    ...report.potentialIssues,
    ...report.deadlines.flatMap((deadline) => [
      deadline.label,
      deadline.date,
      deadline.basis,
      deadline.caution,
    ]),
    report.economicConvenience.level,
    report.economicConvenience.reason,
    report.economicConvenience.possiblePackage,
    report.economicConvenience.ctaLabel,
    report.finalRecommendation,
    report.disclaimer,
  ].join("\n");
}

test("classifica un verbale ZTL senza inventare dati mancanti", () => {
  const report = analyze(`
    COMUNE DI BOLOGNA
    Verbale n. ZTL-12345
    Data della violazione: 12/05/2026 ore 10:15
    Luogo della violazione: Via Rizzoli 1
    Art. 7 del Codice della Strada, comma 9
    Importo sanzione: €88,00
    Il veicolo accedeva in zona a traffico limitato.
  `);

  assert.equal(
    report.violationClassification.value,
    "ZTL / accesso area vietata",
  );
  assert.equal(report.extractedData.length, 26);
  assert.equal(report.aiExecution.provider, "Google Gemini");
  assert.equal(report.aiExecution.promptExecuted, false);
  assert.equal(report.aiExecution.fallbackUsed, true);
  assert.equal(report.rulesEngineUsed, true);
  assert.equal(
    report.appealDeadlines.prefetto,
    "Generalmente 60 giorni dalla contestazione o notificazione",
  );
  assert.equal(field(report, "notificationDate").value, NOT_DETECTED);
  assert.equal(
    field(report, "notificationDate").confidence,
    "Non rilevato",
  );
  assertPrudentLanguage(report);
});

test("classifica un verbale autovelox e mantiene articolo e comma espliciti", () => {
  const report = analyze(`
    POLIZIA LOCALE DI BOLOGNA
    Verbale n. AV-99127
    Data della violazione: 03/02/2026 ore 14:22
    Strada Statale 9 km 121
    Art. 142 del Codice della Strada, comma 8
    Importo: €173,00
    Il veicolo superava il limite di velocità mediante rilevazione autovelox.
  `);

  assert.equal(
    report.violationClassification.value,
    "Autovelox / Eccesso di velocità",
  );
  assert.equal(field(report, "article").confidence, "Alta");
  assert.equal(field(report, "paragraph").value, "Comma 8");
  assertPrudentLanguage(report);
});

test("golden-rovigo-speeding", async () => {
  const pdfPath =
    "/Users/giovannirizzi/Downloads/COPIA CONFORME - SEND (firmato).pdf";
  await access(pdfPath);

  const pdfBuffer = await readFile(pdfPath);
  const [document] = await extractDocuments([
    new File([pdfBuffer], "COPIA CONFORME - SEND (firmato).pdf", {
      type: "application/pdf",
    }),
  ]);
  const report = analyze(document.text);
  const byKey = Object.fromEntries(
    report.extractedData.map((item) => [item.key, item]),
  );

  assert.equal(document.method, "Testo PDF");
  assert.equal(report.identifiedData.authority, "Comune di Rovigo - Polizia Locale");
  assert.equal(report.identifiedData.municipality, "Rovigo");
  assert.equal(report.identifiedData.reportNumber, "X-4677");
  assert.equal(report.identifiedData.registryNumber, "25017145/2025");
  assert.equal(report.identifiedData.plate, "GW766EL");
  assert.equal(report.identifiedData.violationDate, "26 agosto 2025");
  assert.equal(report.identifiedData.violationTime, "05:13");
  assert.equal(report.identifiedData.assessmentDate, "30 agosto 2025");
  assert.equal(report.identifiedData.assessmentTime, "08:43");
  assert.equal(
    report.identifiedData.place,
    "Viale Amendola G. SR88 km 5+200, Rovigo",
  );
  assert.equal(report.identifiedData.article, "Art. 142 Codice della Strada");
  assert.equal(report.identifiedData.paragraph, "Comma 8");
  assert.equal(report.identifiedData.violationType, "Autovelox / Eccesso di velocità");
  assert.equal(report.identifiedData.speedDetected, "88 km/h");
  assert.equal(report.identifiedData.speedLimit, "70 km/h");
  assert.equal(report.identifiedData.speedExcess, "13 km/h");
  assert.equal(report.identifiedData.licensePoints, "3");
  assert.equal(report.identifiedData.reducedAmount, "€170,57");
  assert.equal(report.identifiedData.amount, "€239,77");
  assert.equal(report.identifiedData.minimumAmount, "€230,67");
  assert.equal(report.identifiedData.administrativeFees, "€9,10");
  assert.equal(report.identifiedData.deviceName, "PROJECT K53800_SPEED");
  assert.equal(
    report.identifiedData.approvalDecree,
    "Ministero Infrastrutture e Trasporti prot. n. 549 del 21/12/2021",
  );
  assert.equal(
    report.identifiedData.calibrationCheck,
    "Presente riferimento a controllo metrologico e verifica annuale",
  );
  assert.equal(report.normalizedData.articleCode, "142");
  assert.equal(report.normalizedData.paragraph, "8");
  assert.equal(report.normalizedData.violationTime, "05:13");
  assert.equal(report.normalizedData.detectionTime, "08:43");
  assert.equal(report.normalizedData.reducedAmount, "€170,57");
  assert.equal(report.normalizedData.standardAmount, "€239,77");
  assert.equal(report.normalizedData.speedDetected, 88);
  assert.equal(report.normalizedData.speedLimit, 70);
  assert.equal(report.normalizedData.speedExcess, 13);
  assert.equal(report.normalizedData.points, 3);
  assert.equal(
    report.normalizedData.classification,
    "Autovelox / Eccesso di velocità",
  );
  assert.ok(report.identifiedData.place.includes("Viale Amendola G. SR88"));
  assert.equal(report.extractionDebug.selectedMainVerbalePage, 4);
  assert.equal(
    report.extractionDebug.pages.find((page) => page.pageNumber === 4)
      ?.classification,
    "MAIN_VERBALE",
  );
  assert.equal(byKey.article.confidence, "Alta");
  assert.equal(byKey.assessmentTime.confidence, "Alta");
  assert.equal(byKey.speedDetected.confidence, "Alta");
  assert.equal(byKey.speedLimit.confidence, "Alta");
  assert.equal(byKey.speedExcess.confidence, "Alta");
  assert.equal(byKey.licensePoints.confidence, "Alta");
  assert.ok(
    report.consistencyChecks.some(
      (check) =>
        check.title === "Coerenza velocità e superamento" &&
        check.status === "Da verificare" &&
      check.detail.includes("tolleranza"),
    ),
  );
  assert.match(
    report.eventSummary,
    /Contestazione per eccesso di velocità: veicolo targa GW766EL circolava a 88 km\/h su limite 70 km\/h; eccedenza verbalizzata 13 km\/h dopo tolleranza\./,
  );
  assert.ok(
    report.potentialIssues.some((issue) =>
      issue.includes("PROJECT K53800_SPEED") &&
      issue.includes("decreto di approvazione") &&
      issue.includes("controlli periodici"),
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(report.potentialIssues),
    /riferimenti tecnici non individuati/i,
  );
  assert.equal(report.outcome, "Medio interesse all’approfondimento");
  assert.equal(report.economicConvenience.level, "Media-bassa");
  assert.equal(report.economicConvenience.possiblePackage, "Consulenza Legale €19,90");
  assert.equal(report.economicConvenience.ctaLabel, "Richiedi consulenza legale €19,90");
  assert.equal(report.economicConvenience.ctaHref, "/prezzi?pacchetto=consulenza");
  assert.match(report.economicConvenience.reason, /3 punti patente/);
  assert.match(
    report.finalRecommendation,
    /presenza di 3 punti patente e la natura tecnica dell’accertamento tramite autovelox/,
  );
  assert.ok(
    report.potentialIssues.some((issue) =>
      issue.includes("Non emergono criticità formali evidenti") &&
      issue.includes("documentazione fotografica") &&
      issue.includes("taratura/verifica periodica"),
    ),
  );
  assert.match(
    report.deadlines[0].basis,
    /Data di notifica non rilevata nel documento caricato/,
  );
  assert.match(report.deadlines[1].basis, /Allega ricevuta, relata o avviso SEND/);
  assert.deepEqual(report.deadlines.map((deadline) => deadline.date), [
    "Generalmente 60 giorni",
    "Generalmente 30 giorni",
  ]);
  const visibleText = visibleReportText(report);
  assert.doesNotMatch(visibleText, /METODO|QUALITÀ ESTRAZIONE|ANALISI AI|MOTORE REGOLE|Testo estratto dal verbale/i);
  assert.doesNotMatch(visibleText, /Testo PDF \+ regole|OCR e regole|Qualità estrazione|Analisi AI non disponibile|Motore regole usato/i);
  assertPrudentLanguage(report);
});

test("il flusso utente non mostra termini tecnici nel consenso e nel riepilogo", async () => {
  const component = await readFile(
    new URL("../src/components/screening-flow.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    component,
    /OCR|Gemini|Google Gemini|fallback|motore di regole|regole deterministiche|testo estratto|Modalità: OCR \+ regole \+ AI/i,
  );
  assert.match(component, /Avvia l’analisi preliminare/);
  assert.match(component, /Maggiori informazioni sul trattamento dei dati/);
  assert.match(component, /Avanzamento analisi/);
});

test("classifica un divieto di sosta", () => {
  const report = analyze(`
    POLIZIA MUNICIPALE DI FIRENZE
    Verbale n. DS-4455
    Data della violazione: 10/04/2026 ore 09:10
    Luogo della violazione: Via Roma 20
    Articolo 158 Codice della Strada
    Importo sanzione: €42,00
    Il veicolo sostava in area con divieto di sosta.
  `);

  assert.equal(report.violationClassification.value, "divieto di sosta");
  assert.equal(field(report, "amount").value, "€42,00");
  assertPrudentLanguage(report);
});

test("gestisce un documento poco leggibile senza completare i dati", () => {
  const report = analyze("testo parziale illeggibile 12 xx verb");

  assert.equal(report.documentQuality, "Insufficiente");
  assert.equal(field(report, "reportNumber").value, NOT_DETECTED);
  assert.equal(field(report, "article").value, ARTICLE_NOT_IDENTIFIED);
  assert.equal(
    report.violationClassification.value,
    VIOLATION_NOT_CLASSIFIED,
  );
  assertPrudentLanguage(report);
});

test("non deduce l'articolo dalla sola descrizione della violazione", () => {
  const report = analyze(`
    COMUNE DI ROMA
    Verbale n. X-7788
    Data della violazione: 11/03/2026
    Il veicolo accedeva in zona a traffico limitato.
    Importo sanzione: €83,00
  `);

  assert.equal(report.violationClassification.value, "ZTL / accesso area vietata");
  assert.equal(field(report, "article").value, ARTICLE_NOT_IDENTIFIED);
  assert.equal(field(report, "article").confidence, "Non rilevato");
  assertPrudentLanguage(report);
});

test("se l'importo non è presente la convenienza non è valutabile", () => {
  const report = analyze(`
    POLIZIA LOCALE DI TORINO
    Verbale n. M-8899
    Data della violazione: 08/05/2026
    Art. 80 del Codice della Strada
    Il veicolo circolava con revisione scaduta.
  `);

  assert.equal(field(report, "amount").value, NOT_DETECTED);
  assert.equal(field(report, "amount").confidence, "Non rilevato");
  assert.equal(report.economicConvenience.level, "Non valutabile");
  assertPrudentLanguage(report);
});
