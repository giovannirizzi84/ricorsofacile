import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFineText } from "../src/lib/rules/fineAnalysisRules.ts";
import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
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

type Report = ReturnType<typeof analyze>;
type FieldKey = Report["extractedData"][number]["key"];

function field(report: Report, key: FieldKey) {
  const result = report.extractedData.find((item) => item.key === key);
  assert.ok(result, `Campo ${key} non presente nel report`);
  return result;
}

function assertField(report: Report, key: FieldKey, expected: string) {
  assert.equal(field(report, key).value, expected, `Campo ${key}`);
}

function assertCommon(
  report: Report,
  expected: {
    municipality: string;
    authority: string;
    reportNumber: string;
    plate: string;
    violationDate: string;
    violationTime: string;
    place: string;
    article: string;
    paragraph: string;
    amount: string;
    reducedAmount?: string;
    points?: string;
    classification: string;
    packagePattern: RegExp;
  },
) {
  assertField(report, "municipality", expected.municipality);
  assertField(report, "authority", expected.authority);
  assertField(report, "reportNumber", expected.reportNumber);
  assertField(report, "plate", expected.plate);
  assertField(report, "violationDate", expected.violationDate);
  assertField(report, "violationTime", expected.violationTime);
  assertField(report, "place", expected.place);
  assertField(report, "article", expected.article);
  assertField(report, "paragraph", expected.paragraph);
  assertField(report, "amount", expected.amount);
  if (expected.reducedAmount) {
    assertField(report, "reducedAmount", expected.reducedAmount);
  }
  if (expected.points) {
    assertField(report, "licensePoints", expected.points);
  }
  assert.equal(report.violationClassification.value, expected.classification);
  assert.equal(report.normalizedData.classification, expected.classification);
  assert.ok(
    report.potentialIssues.length > 0,
    "Il report deve indicare almeno un elemento da approfondire o verificare",
  );
  assert.match(
    report.economicConvenience.possiblePackage,
    expected.packagePattern,
  );
}

test("autovelox-speeding.test", () => {
  const report = analyze(`
    COMUNE DI RIMINI
    Corpo di Polizia Locale
    Verbale n. AV-2026-001
    Targa AA123BB
    Data della violazione: 14/01/2026 ore 16:42
    Luogo della violazione: SS16 Adriatica km 204
    Art. 142 comma 8 Codice della Strada
    Importo totale di Euro 176,80
    Pagamento entro 5 giorni: totale di Euro 123,76
    Decurtazione di n. 3 punti
    Il veicolo circolava alla velocità di 91 km/h con limite di velocità era di 70 km/h; eccedeva precisamente di km/h 16 dopo tolleranza. Accertamento con autovelox VELOMATIC 512.
  `);

  assertCommon(report, {
    municipality: "Rimini",
    authority: "Comune Di Rimini - Polizia Locale",
    reportNumber: "AV-2026-001",
    plate: "AA123BB",
    violationDate: "14 gennaio 2026",
    violationTime: "16:42",
    place: "SS16 Adriatica km 204",
    article: "Art. 142 Codice della Strada",
    paragraph: "Comma 8",
    amount: "€176,80",
    reducedAmount: "€123,76",
    points: "3",
    classification: "Autovelox / Eccesso di velocità",
    packagePattern: /Consulenza Legale|Ricorso Smart/,
  });
  assertField(report, "speedDetected", "91 km/h");
  assertField(report, "speedLimit", "70 km/h");
  assertField(report, "speedExcess", "16 km/h");
});

test("ztl-access.test", () => {
  const report = analyze(`
    COMUNE DI BOLOGNA
    Polizia Locale
    Verbale n. ZTL-7788
    Targa BB234CC
    Data della violazione: 08/02/2026 ore 10:15
    Luogo della violazione: Via Rizzoli 1
    Ai sensi dell'art. 7 C.d.S., comma 9
    Euro 87,00
    Il veicolo accedeva in zona a traffico limitato attraverso varco elettronico senza autorizzazione.
  `);

  assertCommon(report, {
    municipality: "Bologna",
    authority: "Comune Di Bologna - Polizia Locale",
    reportNumber: "ZTL-7788",
    plate: "BB234CC",
    violationDate: "8 febbraio 2026",
    violationTime: "10:15",
    place: "Via Rizzoli 1",
    article: "Art. 7 Codice della Strada",
    paragraph: "Comma 9",
    amount: "€87,00",
    classification: "ZTL / accesso area vietata",
    packagePattern: /Consulenza Legale/,
  });
});

test("parking-violation.test", () => {
  const report = analyze(`
    COMUNE DI FIRENZE
    Polizia Municipale
    Verbale n. DS-4455
    Targa CC345DD
    Data della violazione: 10/04/2026 ore 09:10
    Luogo della violazione: Via Roma 20
    articolo 158/1 Codice della Strada
    Importo sanzione: €42,00
    Il veicolo sostava in area con divieto di sosta.
  `);

  assertCommon(report, {
    municipality: "Firenze",
    authority: "Firenze - Polizia Municipale",
    reportNumber: "DS-4455",
    plate: "CC345DD",
    violationDate: "10 aprile 2026",
    violationTime: "09:10",
    place: "Via Roma 20",
    article: "Art. 158 Codice della Strada",
    paragraph: "Comma 1",
    amount: "€42,00",
    classification: "divieto di sosta",
    packagePattern: /Consulenza Legale/,
  });
});

test("red-light.test", () => {
  const report = analyze(`
    COMUNE DI PADOVA
    Polizia Locale
    Verbale n. SR-6102
    Targa DD456EE
    Data della violazione: 18/03/2026 ore 22:04
    Luogo della violazione: Incrocio Corso Milano / Via Vicenza
    Art. 146 comma 3 Codice della Strada
    Importo totale di Euro 167,00
    Decurtazione punti patente: 6
    Il conducente proseguiva la marcia nonostante la luce rossa della segnalazione semaforica.
  `);

  assertCommon(report, {
    municipality: "Padova",
    authority: "Comune Di Padova - Polizia Locale",
    reportNumber: "SR-6102",
    plate: "DD456EE",
    violationDate: "18 marzo 2026",
    violationTime: "22:04",
    place: "Incrocio Corso Milano / Via Vicenza",
    article: "Art. 146 Codice della Strada",
    paragraph: "Comma 3",
    amount: "€167,00",
    points: "6",
    classification: "semaforo rosso",
    packagePattern: /Consulenza Legale/,
  });
});

test("revision.test", () => {
  const report = analyze(`
    COMUNE DI TORINO
    Polizia Locale
    Verbale n. REV-3001
    Targa EE567FF
    Data della violazione: 12/05/2026 ore 08:25
    Luogo della violazione: Corso Francia 120
    Art. 80 comma 14 Codice della Strada
    Importo sanzione Euro 173,00
    Il veicolo circolava con revisione scaduta.
  `);

  assertCommon(report, {
    municipality: "Torino",
    authority: "Comune Di Torino - Polizia Locale",
    reportNumber: "REV-3001",
    plate: "EE567FF",
    violationDate: "12 maggio 2026",
    violationTime: "08:25",
    place: "Corso Francia 120",
    article: "Art. 80 Codice della Strada",
    paragraph: "Comma 14",
    amount: "€173,00",
    classification: "mancata revisione",
    packagePattern: /Consulenza Legale/,
  });
});

test("insurance.test", () => {
  const report = analyze(`
    COMUNE DI BARI
    Polizia Locale
    Verbale n. RCA-9004
    Targa FF678GG
    Data della violazione: 22/06/2026 ore 11:36
    Luogo della violazione: Via Amendola 45
    Art. 193 comma 2 Codice della Strada
    Importo totale di Euro 866,00
    Il veicolo circolava senza assicurazione obbligatoria RCA.
  `);

  assertCommon(report, {
    municipality: "Bari",
    authority: "Comune Di Bari - Polizia Locale",
    reportNumber: "RCA-9004",
    plate: "FF678GG",
    violationDate: "22 giugno 2026",
    violationTime: "11:36",
    place: "Via Amendola 45",
    article: "Art. 193 Codice della Strada",
    paragraph: "Comma 2",
    amount: "€866,00",
    classification: "mancata assicurazione",
    packagePattern: /Ricorso Premium/,
  });
});

test("phone-driving.test", () => {
  const report = analyze(`
    COMUNE DI VERONA
    Polizia Locale
    Verbale n. TEL-1207
    Targa GG789HH
    Data della violazione: 05/07/2026 ore 17:55
    Luogo della violazione: Viale del Lavoro 8
    Art. 173 comma 2 Codice della Strada
    Importo totale di Euro 250,00
    Decurtazione di 5 punti
    Il conducente faceva uso del telefono cellulare durante la guida senza dispositivo viva voce.
  `);

  assertCommon(report, {
    municipality: "Verona",
    authority: "Comune Di Verona - Polizia Locale",
    reportNumber: "TEL-1207",
    plate: "GG789HH",
    violationDate: "5 luglio 2026",
    violationTime: "17:55",
    place: "Viale del Lavoro 8",
    article: "Art. 173 Codice della Strada",
    paragraph: "Comma 2",
    amount: "€250,00",
    points: "5",
    classification: "uso del telefono alla guida",
    packagePattern: /Ricorso Smart/,
  });
});

test("bus-lane.test", () => {
  const report = analyze(`
    COMUNE DI MILANO
    Polizia Locale
    Verbale n. BUS-7761
    Targa HH890II
    Data della violazione: 29/08/2026 ore 07:48
    Luogo della violazione: Via Larga corsia preferenziale
    Art. 7 comma 14 Codice della Strada
    Importo totale di Euro 95,00
    Il veicolo transitava nella corsia preferenziale riservata ai mezzi pubblici.
  `);

  assertCommon(report, {
    municipality: "Milano",
    authority: "Comune Di Milano - Polizia Locale",
    reportNumber: "BUS-7761",
    plate: "HH890II",
    violationDate: "29 agosto 2026",
    violationTime: "07:48",
    place: "Via Larga corsia preferenziale",
    article: "Art. 7 Codice della Strada",
    paragraph: "Comma 14",
    amount: "€95,00",
    classification: "circolazione in corsia riservata",
    packagePattern: /Consulenza Legale/,
  });
});

test("driver-data.test", () => {
  const report = analyze(`
    COMUNE DI GENOVA
    Polizia Locale
    Verbale n. DC-2210
    Targa II901LL
    Data della violazione: 16/09/2026 ore 12:00
    Luogo della violazione: Ufficio Verbali - Via Garibaldi 9
    Art. 126-bis comma 2 Codice della Strada
    Importo totale di Euro 291,00
    Il proprietario ometteva la comunicazione dei dati del conducente nei termini richiesti.
  `);

  assertCommon(report, {
    municipality: "Genova",
    authority: "Comune Di Genova - Polizia Locale",
    reportNumber: "DC-2210",
    plate: "II901LL",
    violationDate: "16 settembre 2026",
    violationTime: "12:00",
    place: "Ufficio Verbali - Via Garibaldi 9",
    article: "Art. 126-bis Codice della Strada",
    paragraph: "Comma 2",
    amount: "€291,00",
    classification: "mancata comunicazione dati conducente",
    packagePattern: /Ricorso Smart/,
  });
});

test("incomplete-document.test", () => {
  const report = analyze(`
    COMUNE DI TESTVILLE
    Verbale n. INC-0001
    Data della violazione: 03/10/2026 ore 18:20
    Testo parziale poco leggibile. Targa non leggibile. Importo non leggibile.
    La descrizione della condotta risulta incompleta e non consente di individuare con certezza la norma violata.
  `);

  assertField(report, "municipality", "Testville");
  assertField(report, "reportNumber", "INC-0001");
  assertField(report, "violationDate", "3 ottobre 2026");
  assertField(report, "violationTime", "18:20");
  assertField(report, "authority", "Comune Di Testville");
  assertField(report, "plate", NOT_DETECTED);
  assertField(report, "place", NOT_DETECTED);
  assertField(report, "amount", NOT_DETECTED);
  assertField(report, "reducedAmount", NOT_DETECTED);
  assertField(report, "licensePoints", NOT_DETECTED);
  assertField(report, "article", ARTICLE_NOT_IDENTIFIED);
  assertField(report, "paragraph", NOT_DETECTED);
  assert.equal(
    report.economicConvenience.possiblePackage,
    "Nessun pacchetto individuabile prima di integrare i dati mancanti.",
  );
});
