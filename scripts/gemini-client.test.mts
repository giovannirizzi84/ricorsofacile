import assert from "node:assert/strict";
import test from "node:test";
import { enhanceReportWithGemini } from "../src/lib/ai/geminiClient.ts";
import { analyzeFineText } from "../src/lib/rules/fineAnalysisRules.ts";
import { SCREENING_DISCLAIMER } from "../src/lib/screening-report.ts";

const sourceText = `
  COMUNE DI BOLOGNA
  Verbale n. ZTL-12345
  Data della violazione: 12/05/2026 ore 10:15
  Luogo della violazione: Via Rizzoli 1
  Art. 7 del Codice della Strada, comma 9
  Importo sanzione: €88,00
  Il veicolo accedeva in zona a traffico limitato.
`;

function ruleReport() {
  return analyzeFineText(
    sourceText,
    {
      notificationDate: "",
      authority: "",
      amount: "",
      violationType: "",
    },
    { method: "Testo PDF + regole" },
  );
}

test("usa il motore di regole quando la chiave Gemini manca", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const report = await enhanceReportWithGemini(sourceText, ruleReport());
    assert.equal(report.aiExecution.status, "Chiave non configurata");
    assert.equal(report.aiExecution.promptExecuted, false);
    assert.equal(report.rulesEngineUsed, true);
    assert.equal(report.aiEnhanced, false);
  } finally {
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
  }
});

test("accetta una risposta Gemini strutturata senza sostituire dati certi", async (context) => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  const baseReport = ruleReport();
  const geminiOutput = {
    preliminaryOutcome: baseReport.outcome,
    extractedData: [
      {
        key: "plate",
        value: "AB123CD",
        confidence: "Alta",
        evidence: "targa AB123CD",
      },
    ],
    articleCds: {
      article: baseReport.violatedRule.article,
      paragraph: baseReport.violatedRule.paragraph,
      confidence: "Alta",
      evidence: "Art. 7 del Codice della Strada, comma 9",
    },
    violationType: {
      value: baseReport.violationClassification.value,
      confidence: "Alta",
      evidence: "zona a traffico limitato",
    },
    eventDescription:
      "Il veicolo accedeva in zona a traffico limitato in Via Rizzoli.",
    potentialIssues: baseReport.potentialIssues,
    appealDeadlines: baseReport.appealDeadlines,
    economicConvenience: baseReport.economicConvenience,
    suggestedPath: baseReport.suggestedPath,
    summary:
      "Il verbale contiene dati utili allo screening; gli elementi rilevati richiedono una verifica prudenziale.",
    finalRecommendation:
      "Verificare il verbale completo e la documentazione disponibile prima di scegliere un eventuale percorso.",
    disclaimer: SCREENING_DISCLAIMER,
  };

  context.mock.method(globalThis, "fetch", async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(geminiOutput) }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  try {
    const report = await enhanceReportWithGemini(sourceText, baseReport);
    const plate = report.extractedData.find((field) => field.key === "plate");

    assert.equal(report.aiExecution.status, "Completata");
    assert.equal(report.aiExecution.promptExecuted, true);
    assert.equal(report.rulesEngineUsed, true);
    assert.equal(report.aiEnhanced, true);
    assert.equal(
      plate?.value,
      "Non rilevato nel documento caricato",
      "Gemini non deve introdurre una targa assente dal testo",
    );
  } finally {
    if (previousKey) {
      process.env.GEMINI_API_KEY = previousKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});
