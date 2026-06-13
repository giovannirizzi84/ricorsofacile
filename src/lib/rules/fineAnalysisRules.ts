import {
  SCREENING_DISCLAIMER,
  type ScreeningReport,
} from "@/lib/screening-report";

export type FineCaseData = {
  notificationDate: string;
  authority: string;
  amount: string;
  violationType: string;
};

type RuleContext = {
  text: string;
  normalized: string;
  caseData: FineCaseData;
  facts: ExtractedFacts;
};

type ExtractedFacts = {
  violationDate?: Date;
  notificationDate?: Date;
  authority?: string;
  amount?: string;
  plate?: string;
  article?: string;
  place?: string;
  deviceType?: "Autovelox" | "Tutor" | "ZTL";
};

type RuleResult = ScreeningReport["reasons"][number];

const rules: Array<(context: RuleContext) => RuleResult | null> = [
  notificationOverNinetyDays,
  speedDeviceWithoutApproval,
  missingPrecisePlace,
  missingPlate,
  missingAppealAuthority,
  missingImmediateContestReason,
  missingEssentialData,
];

export function analyzeFineText(
  text: string,
  caseData: FineCaseData,
  options: {
    method: ScreeningReport["analysisMethod"];
    warnings?: string[];
  },
): ScreeningReport {
  const normalized = normalize(text);
  const facts = extractFacts(text, normalized, caseData);
  const context = { text, normalized, caseData, facts };
  const reasons = rules
    .map((rule) => rule(context))
    .filter((result): result is RuleResult => Boolean(result));
  const rawScore = reasons.reduce((total, reason) => total + reason.points, 0);
  const textQuality = calculateTextQuality(text, facts);
  const confidence = calculateConfidence(textQuality, facts);
  const score = Math.min(100, Math.round(rawScore * (0.55 + confidence / 220)));
  const missingDocuments = buildMissingDocuments(facts, textQuality);
  const criticalities = [
    ...(options.warnings ?? []),
    ...reasons
      .filter((reason) => reason.needsVerification)
      .map((reason) => `${reason.title}: richiede verifica sul documento originale.`),
  ];
  const outcome = getOutcome(score, confidence);

  return {
    outcome,
    score,
    confidence,
    summary: buildSummary(outcome, score, confidence, reasons),
    documentQuality: getDocumentQuality(textQuality),
    analysisMethod: options.method,
    ollamaEnhanced: false,
    extractedFacts: formatFacts(facts),
    reasons,
    criticalities: unique(criticalities),
    deadlines: buildDeadlines(facts.notificationDate),
    suggestedPath: buildSuggestedPath(outcome, score),
    estimatedCosts: [
      {
        label: "Ricorso al Prefetto",
        amount: "Gratuito",
        note: "Salvo costi di invio. In caso di rigetto la sanzione può aumentare.",
      },
      {
        label: "Giudice di Pace fino a €1.033",
        amount: "€43",
        note: "Contributo unificato indicativo, separato dal compenso del servizio.",
      },
      {
        label: "Da €1.033,01 a €5.200",
        amount: "€98 + €27",
        note: "Contributo unificato e marca da bollo indicativi.",
      },
      {
        label: "Oltre €5.200",
        amount: "Secondo scaglioni",
        note: "Contributo superiore da verificare secondo la legge vigente.",
      },
    ],
    nextStep:
      outcome === "Documentazione insufficiente"
        ? "Carica il verbale completo e i documenti di notifica prima di valutare un ricorso."
        : "Fai verificare motivi, termini e documenti da un professionista prima di depositare il ricorso.",
    sources: buildSources(facts),
    missingDocuments,
    extractedTextPreview: text.slice(0, 2500),
    disclaimer: SCREENING_DISCLAIMER,
  };
}

function extractFacts(
  text: string,
  normalized: string,
  caseData: FineCaseData,
): ExtractedFacts {
  const dates = extractDates(text);
  const violationDate =
    findContextDate(text, /(infrazione|violazione|accertamento|commessa)/i) ??
    dates[0];
  const notificationDate =
    parseDate(caseData.notificationDate) ??
    findContextDate(text, /(notifica|notificato|spedizione|consegna)/i) ??
    dates[1];
  const plateMatch = text.toUpperCase().match(/\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/);
  const amountMatch = text.match(
    /(?:€|eur(?:o)?|importo|somma)[^\d]{0,15}(\d{1,5}(?:[.,]\d{2})?)/i,
  );
  const articleMatch = text.match(
    /(?:art(?:icolo)?\.?\s*)(\d{1,3}(?:[-\s]?[a-z]+)?)/i,
  );
  const placeMatch = text.match(
    /(?:via|viale|piazza|corso|strada|localit[aà]|km|chilometro)\s+[^\n,;]{3,80}/i,
  );
  const deviceType = /\bautovelox\b|rilevator[ei]\s+di\s+velocit/i.test(normalized)
    ? "Autovelox"
    : /\btutor\b|velocit[aà]\s+media/i.test(normalized)
      ? "Tutor"
      : /\bztl\b|zona\s+a\s+traffico\s+limitato/i.test(normalized)
        ? "ZTL"
        : undefined;

  return {
    violationDate,
    notificationDate,
    authority:
      caseData.authority ||
      text.match(
        /(?:polizia locale|polizia municipale|carabinieri|polizia stradale|comune di)\s+[^\n,;]{0,60}/i,
      )?.[0],
    amount: caseData.amount || amountMatch?.[1],
    plate: plateMatch?.[0]?.replace(/\s/g, ""),
    article: articleMatch?.[1],
    place: placeMatch?.[0],
    deviceType,
  };
}

function notificationOverNinetyDays(context: RuleContext): RuleResult | null {
  const { violationDate, notificationDate } = context.facts;
  if (!violationDate || !notificationDate) return null;
  const days = daysBetween(violationDate, notificationDate);
  if (days <= 90) return null;

  return reason(
    "Possibile notifica oltre 90 giorni",
    40,
    `Tra la data di violazione e quella di notifica risultano circa ${days} giorni.`,
    "Art. 201 Codice della Strada; decorrenza ed eccezioni da verificare.",
    "Alta",
  );
}

function speedDeviceWithoutApproval(context: RuleContext): RuleResult | null {
  if (!["Autovelox", "Tutor"].includes(context.facts.deviceType ?? "")) return null;
  if (/omologaz|approvaz|decreto\s+(?:ministeriale|dirigenziale)/i.test(context.normalized)) {
    return null;
  }

  return reason(
    `${context.facts.deviceType}: omologazione non individuata`,
    20,
    "Nel testo estratto non compare un riferimento riconoscibile a omologazione, approvazione o decreto del dispositivo.",
    "Disciplina degli strumenti di accertamento; documento e orientamenti applicabili da verificare.",
    "Media",
  );
}

function missingPrecisePlace(context: RuleContext): RuleResult | null {
  if (context.facts.place) return null;
  return reason(
    "Luogo preciso non individuato",
    15,
    "L’OCR non ha individuato via, piazza, strada, località o progressiva chilometrica.",
    "Requisiti di determinatezza e completezza del verbale.",
    "Media",
  );
}

function missingPlate(context: RuleContext): RuleResult | null {
  if (context.facts.plate || /\btarga\b/i.test(context.normalized)) return null;
  return reason(
    "Targa non individuata",
    20,
    "Nel testo estratto non compare una targa nel formato ordinario né la parola “targa”.",
    "Identificazione del veicolo nel verbale.",
    "Alta",
  );
}

function missingAppealAuthority(context: RuleContext): RuleResult | null {
  if (
    /prefetto|giudice\s+di\s+pace|autorit[aà]\s+(?:competente|a\s+cui)|modalit[aà]\s+di\s+ricorso/i.test(
      context.normalized,
    )
  ) {
    return null;
  }
  return reason(
    "Autorità e modalità di ricorso non individuate",
    15,
    "Il testo estratto non contiene riferimenti riconoscibili a Prefetto, Giudice di Pace o modalità di opposizione.",
    "Informazioni sui rimedi esperibili; rilevanza del vizio da verificare.",
    "Media",
  );
}

function missingImmediateContestReason(context: RuleContext): RuleResult | null {
  if (
    !/mancata\s+contestazione|non\s+(?:è\s+stato|e\s+stato)?\s*contestat[ao]\s+immediatamente|contestazione\s+differita/i.test(
      context.normalized,
    )
  ) {
    return null;
  }
  if (
    /impossibilit[aà]|inseguimento|assenza\s+del\s+trasgressore|art\.?\s*201|veicolo\s+in\s+movimento|sicurezza/i.test(
      context.normalized,
    )
  ) {
    return null;
  }
  return reason(
    "Motivazione della mancata contestazione non individuata",
    20,
    "Il verbale sembra richiamare una contestazione differita senza una motivazione leggibile nel testo estratto.",
    "Art. 201 Codice della Strada e casi di contestazione differita.",
    "Alta",
  );
}

function missingEssentialData(context: RuleContext): RuleResult | null {
  const missing = [
    !context.facts.violationDate && "data dell’infrazione",
    !context.facts.authority && "ente accertatore",
    !context.facts.amount && "importo",
    !context.facts.article && "articolo contestato",
  ].filter(Boolean);
  if (missing.length < 2) return null;
  return reason(
    "Più dati essenziali non individuati",
    20,
    `Non risultano leggibili: ${missing.join(", ")}.`,
    "Completezza formale del verbale; verificare il documento originale.",
    "Alta",
  );
}

function reason(
  title: string,
  points: number,
  evidence: string,
  legalBasis: string,
  relevance: RuleResult["relevance"],
): RuleResult {
  return {
    title,
    points,
    evidence,
    legalBasis,
    relevance,
    needsVerification: true,
  };
}

function calculateTextQuality(text: string, facts: ExtractedFacts) {
  const factCount = Object.values(facts).filter(Boolean).length;
  if (text.length < 100) return 15;
  if (text.length < 350) return 35 + factCount * 4;
  return Math.min(100, 60 + factCount * 5);
}

function calculateConfidence(textQuality: number, facts: ExtractedFacts) {
  const essential = [
    facts.violationDate,
    facts.notificationDate,
    facts.authority,
    facts.amount,
  ].filter(Boolean).length;
  return Math.min(100, Math.round(textQuality * 0.65 + essential * 8.75));
}

function getOutcome(
  score: number,
  confidence: number,
): ScreeningReport["outcome"] {
  if (confidence < 35) return "Documentazione insufficiente";
  if (score >= 70) return "Ricorso potenzialmente fondato";
  if (score >= 40) return "Ricorso da approfondire";
  return "Ricorso debole";
}

function buildSummary(
  outcome: ScreeningReport["outcome"],
  score: number,
  confidence: number,
  reasons: RuleResult[],
) {
  if (outcome === "Documentazione insufficiente") {
    return `Il testo disponibile non consente una valutazione attendibile (confidenza ${confidence}%). Occorre integrare o migliorare i documenti.`;
  }
  if (reasons.length === 0) {
    return `Le regole automatiche non hanno individuato anomalie evidenti. Il punteggio ${score}/100 non esclude motivi non rilevabili automaticamente.`;
  }
  return `Lo screening ha rilevato ${reasons.length} element${reasons.length === 1 ? "o" : "i"} da verificare. Il punteggio ${score}/100 indica ${outcome.toLowerCase()}, con confidenza documentale del ${confidence}%.`;
}

function buildSuggestedPath(
  outcome: ScreeningReport["outcome"],
  score: number,
): ScreeningReport["suggestedPath"] {
  if (outcome === "Documentazione insufficiente") {
    return {
      route: "Documentazione insufficiente",
      rationale: "Non è prudente scegliere una procedura senza il verbale completo.",
      risks: "Scadenze e motivi potrebbero essere valutati in modo errato.",
    };
  }
  if (score >= 70) {
    return {
      route: "Giudice di Pace",
      rationale:
        "Può consentire una valutazione più articolata dei vizi rilevati, ma la scelta va verificata sul caso concreto.",
      risks: "Sono previsti costi vivi e non esiste garanzia di accoglimento.",
    };
  }
  return {
    route: "Valutazione professionale necessaria",
    rationale:
      "Il punteggio non consente di preferire automaticamente Prefetto o Giudice di Pace.",
    risks:
      "Il rigetto del ricorso al Prefetto può comportare una sanzione aumentata.",
  };
}

function buildDeadlines(notificationDate?: Date) {
  if (!notificationDate) {
    return [
      {
        label: "Termini di ricorso",
        date: "Data non calcolabile",
        basis: "Servono data e modalità ufficiali della notifica.",
        caution: "Verificare immediatamente il verbale e la relata di notifica.",
      },
    ];
  }
  return [
    {
      label: "Prefetto, termine ordinario indicativo",
      date: formatDate(addDays(notificationDate, 60)),
      basis: "Calcolo automatico di 60 giorni dalla data dichiarata.",
      caution:
        "Festività, modalità di notifica e circostanze specifiche possono incidere.",
    },
    {
      label: "Giudice di Pace, termine ordinario indicativo",
      date: formatDate(addDays(notificationDate, 30)),
      basis: "Calcolo automatico di 30 giorni dalla data dichiarata.",
      caution:
        "Il termine effettivo deve essere verificato sul documento ufficiale.",
    },
  ];
}

function buildSources(facts: ExtractedFacts): ScreeningReport["sources"] {
  const sources: ScreeningReport["sources"] = [
    {
      title: "Codice della Strada",
      reference: "Articoli 201, 203 e 204-bis",
      whyRelevant:
        "Notifica, ricorso al Prefetto e opposizione al Giudice di Pace.",
      verificationStatus: "Riferimento generale",
    },
    {
      title: "Legge 689/1981",
      reference: "Disciplina generale delle sanzioni amministrative",
      whyRelevant: "Principi procedurali e opposizione alle sanzioni.",
      verificationStatus: "Riferimento generale",
    },
  ];
  if (facts.deviceType) {
    sources.push({
      title: `Accertamenti con ${facts.deviceType}`,
      reference: "Norme tecniche, decreti e giurisprudenza applicabile",
      whyRelevant:
        "Approvazione, omologazione, segnalazione e modalità di utilizzo devono essere verificate sul caso concreto.",
      verificationStatus: "Da verificare",
    });
  }
  return sources;
}

function buildMissingDocuments(facts: ExtractedFacts, textQuality: number) {
  const documents: string[] = [];
  if (!facts.notificationDate) documents.push("busta, relata o PEC di notifica");
  if (textQuality < 55) documents.push("scansione completa e più leggibile del verbale");
  if (facts.deviceType === "Autovelox" || facts.deviceType === "Tutor") {
    documents.push("fotogrammi e documentazione tecnica del dispositivo");
  }
  if (facts.deviceType === "ZTL") {
    documents.push("fotogrammi del transito e informazioni sulla segnaletica");
  }
  return unique(documents);
}

function formatFacts(facts: ExtractedFacts) {
  return [
    facts.violationDate &&
      `Data infrazione individuata: ${formatDate(facts.violationDate)}`,
    facts.notificationDate &&
      `Data notifica considerata: ${formatDate(facts.notificationDate)}`,
    facts.authority && `Ente accertatore: ${facts.authority}`,
    facts.amount && `Importo: €${facts.amount}`,
    facts.plate && `Targa: ${facts.plate}`,
    facts.article && `Articolo contestato: ${facts.article}`,
    facts.place && `Luogo individuato: ${facts.place}`,
    facts.deviceType && `Tipologia rilevata: ${facts.deviceType}`,
  ].filter((item): item is string => Boolean(item));
}

function extractDates(text: string) {
  const matches = text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g);
  return Array.from(matches)
    .map((match) => parseItalianDate(match[0]))
    .filter((date): date is Date => Boolean(date));
}

function findContextDate(text: string, contextPattern: RegExp) {
  for (const line of text.split(/\n/)) {
    if (!contextPattern.test(line)) continue;
    const date = line.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0];
    if (date) return parseItalianDate(date);
  }
  return undefined;
}

function parseDate(value: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return parseItalianDate(value);
}

function parseItalianDate(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return undefined;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), 12);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "long" }).format(date);
}

function getDocumentQuality(
  quality: number,
): ScreeningReport["documentQuality"] {
  if (quality >= 70) return "Buona";
  if (quality >= 35) return "Parziale";
  return "Insufficiente";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function unique(values: string[]) {
  return [...new Set(values)];
}
