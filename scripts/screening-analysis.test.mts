import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(report.extractedData.length, 15);
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
    "autovelox / eccesso di velocità",
  );
  assert.equal(field(report, "article").confidence, "Alta");
  assert.equal(field(report, "paragraph").value, "Comma 8");
  assertPrudentLanguage(report);
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
