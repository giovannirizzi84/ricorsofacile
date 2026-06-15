import type { ScreeningReport } from "@/lib/screening-report";

const defaultEndpoint = "http://localhost:11434/api/generate";
const defaultModel = "qwen3:8b";

export async function enhanceReportWithOllama(
  extractedText: string,
  report: ScreeningReport,
): Promise<ScreeningReport> {
  if (process.env.OLLAMA_ENABLED === "false") return report;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(
      process.env.OLLAMA_URL || defaultEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || defaultModel,
          stream: false,
          options: { temperature: 0.2 },
          prompt: buildPrompt(extractedText, report),
        }),
      },
    );

    if (!response.ok) return report;

    const payload = (await response.json()) as { response?: string };
    const narrative = parseNarrative(payload.response);
    if (!narrative) return report;

    return {
      ...report,
      summary: narrative.summary,
      finalRecommendation: narrative.finalRecommendation,
      nextStep: narrative.finalRecommendation,
      ollamaEnhanced: true,
    };
  } catch {
    return report;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(extractedText: string, report: ScreeningReport) {
  return `
Sei un assistente che migliora esclusivamente la forma narrativa di uno
screening preliminare di un verbale stradale. I dati strutturati forniti sono
l'unica fonte ammessa.

REGOLE OBBLIGATORIE:
- non inventare dati, norme, articoli, date, fatti o criticità;
- non dedurre articoli o commi;
- non modificare i valori strutturati;
- non usare "ricorso fondato", "multa annullabile", "probabilità di successo",
  "vittoria" o promesse di annullamento;
- distinguere sempre dato rilevato, incertezza e verifica consigliata;
- restituire soltanto JSON valido, senza markdown.

Formato richiesto:
{
  "summary": "massimo 120 parole, tono neutro e prudente",
  "finalRecommendation": "massimo 70 parole, conclusione prudente"
}

DATI STRUTTURATI:
${JSON.stringify(
  {
    preliminaryOutcome: report.outcome,
    extractedData: report.extractedData,
    violationClassification: report.violationClassification,
    legalRule: report.violatedRule,
    eventSummary: report.eventSummary,
    potentialIssues: report.reasons.map((reason) => ({
      title: reason.title,
      evidence: reason.evidence,
    })),
    economicConvenience: report.economicConvenience,
    missingDocuments: report.missingDocuments,
  },
  null,
  2,
)}

TESTO ORIGINALE, SOLO PER CONTROLLO DI COERENZA:
${extractedText.slice(0, 8_000)}
`.trim();
}

function parseNarrative(value?: string) {
  if (!value) return null;
  const json = value.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as {
      summary?: unknown;
      finalRecommendation?: unknown;
    };
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.finalRecommendation !== "string"
    ) {
      return null;
    }
    const summary = parsed.summary.trim().slice(0, 1200);
    const finalRecommendation = parsed.finalRecommendation.trim().slice(0, 700);
    const forbidden =
      /ricorso\s+fondato|multa\s+annullabile|probabilit[aà]\s+di\s+successo|vittoria|annullamento\s+garantito/i;
    if (
      !summary ||
      !finalRecommendation ||
      forbidden.test(summary) ||
      forbidden.test(finalRecommendation)
    ) {
      return null;
    }
    return { summary, finalRecommendation };
  } catch {
    return null;
  }
}
