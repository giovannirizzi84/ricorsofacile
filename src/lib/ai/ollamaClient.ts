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
    const narrative = payload.response?.trim();
    if (!narrative) return report;

    return {
      ...report,
      summary: narrative.slice(0, 1800),
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
Analizza il seguente testo estratto da un verbale di multa. Fornisci una
valutazione preliminare, non un parere legale, indicando possibili vizi formali,
termini da verificare, rischi del ricorso e documenti mancanti.

Non cambiare il punteggio deterministico (${report.score}/100), non inventare
norme o fatti e non promettere l'accoglimento. Scrivi un solo paragrafo chiaro
in italiano, massimo 180 parole.

Motivi rilevati dalle regole:
${report.reasons.map((reason) => `- ${reason.title}: ${reason.evidence}`).join("\n")}

Documenti mancanti:
${report.missingDocuments.join(", ") || "nessuno rilevato"}

Testo estratto:
${extractedText.slice(0, 12_000)}
`.trim();
}
