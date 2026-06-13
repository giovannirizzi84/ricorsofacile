import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  SCREENING_DISCLAIMER,
  type IdentifiedFineData,
  type ScreeningReport,
  type ViolationClassification,
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
  violationTime?: string;
  notificationDate?: Date;
  authority?: string;
  municipality?: string;
  reportNumber?: string;
  amount?: string;
  reducedAmount?: string;
  plate?: string;
  article?: string;
  paragraph?: string;
  place?: string;
  eventDescription?: string;
  violationType: ViolationClassification;
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
  const rawScore = reasons.reduce((total, result) => total + result.points, 0);
  const textQuality = calculateTextQuality(text, facts);
  const confidence = calculateConfidence(textQuality, facts);
  const score = Math.min(100, Math.round(rawScore * (0.55 + confidence / 220)));
  const missingDocuments = buildMissingDocuments(facts, textQuality);
  const criticalities = unique([
    ...(options.warnings ?? []),
    ...reasons.map((result) => result.title),
  ]);
  const outcome = getOutcome(score, confidence);
  const identifiedData = buildIdentifiedData(facts);
  const eventSummary = facts.eventDescription || buildFallbackEventSummary(facts);

  return {
    outcome,
    score,
    confidence,
    summary: buildSummary(outcome, confidence, reasons),
    documentQuality: getDocumentQuality(textQuality),
    analysisMethod: options.method,
    ollamaEnhanced: false,
    identifiedData,
    violatedRule: {
      article: facts.article
        ? `Art. ${facts.article} Codice della Strada`
        : ARTICLE_NOT_IDENTIFIED,
      paragraph: facts.paragraph ? `Comma ${facts.paragraph}` : NOT_DETECTED,
      classification: facts.violationType,
      description: getRuleDescription(facts),
    },
    eventSummary,
    preliminaryAssessment: buildPreliminaryAssessment(
      outcome,
      confidence,
      reasons,
    ),
    extractedFacts: formatFacts(identifiedData),
    reasons,
    criticalities,
    deadlines: buildDeadlines(facts.notificationDate),
    suggestedPath: buildSuggestedPath(outcome),
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
        ? "Carica il verbale completo e gli eventuali documenti di notifica per ottenere uno screening più attendibile."
        : "Verifica i dati sul documento originale e valuta un approfondimento professionale prima di intraprendere iniziative.",
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
    findContextDate(text, /(infrazione|violazione|accertamento|commessa|avvenuta)/i) ??
    dates[0];
  const notificationDate =
    parseDate(caseData.notificationDate) ??
    findContextDate(text, /(notifica|notificato|spedizione|consegna)/i) ??
    dates[1];
  const plate = text
    .toUpperCase()
    .match(/\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/)?.[0]
    ?.replace(/\s/g, "");
  const amount =
    normalizeAmount(caseData.amount) ??
    matchAmount(text, /(?:sanzione|importo|somma\s+di|pagamento)[^\d€]{0,25}(?:€\s*)?(\d{1,5}(?:[.,]\d{2})?)/i) ??
    matchAmount(text, /€\s*(\d{1,5}(?:[.,]\d{2})?)/i);
  const reducedAmount =
    matchAmount(
      text,
      /(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%|misura\s+ridotta)[^\d€]{0,50}(?:€\s*)?(\d{1,5}(?:[.,]\d{2})?)/i,
    ) ??
    matchAmount(
      text,
      /(?:€\s*)?(\d{1,5}(?:[.,]\d{2})?)[^\n]{0,45}(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%)/i,
    );
  const articleMatch = text.match(
    /(?:art(?:icolo)?\.?\s*)(\d{1,3}(?:[-\s]?(?:bis|ter|quater))?)(?:\s*(?:,|-)?\s*(?:comma|co\.?)\s*([0-9]+(?:[-\s]?(?:bis|ter|quater))?))?/i,
  );
  const paragraph =
    articleMatch?.[2] ??
    text.match(
      /(?:comma|co\.?)\s*([0-9]+(?:[-\s]?(?:bis|ter|quater))?)/i,
    )?.[1];
  const place = cleanPlace(
    text.match(
      /(?:luogo(?:\s+della\s+violazione)?|in\s+localit[aà]|via|viale|piazza|corso|strada|localit[aà]|km|chilometro)\s*[:\-]?\s*[^\n,;]{3,100}/i,
    )?.[0],
  );
  const municipality =
    cleanExtractedValue(
      text.match(/(?:comune\s+di|citt[aà]\s+di)\s+([^\n,;]{2,60})/i)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/polizia\s+(?:locale|municipale)\s+di\s+([^\n,;]{2,60})/i)?.[1],
    );
  const authority =
    cleanExtractedValue(caseData.authority) ??
    cleanExtractedValue(
      text.match(
        /(?:corpo\s+di\s+)?(?:polizia\s+locale|polizia\s+municipale|polizia\s+stradale|carabinieri|guardia\s+di\s+finanza|comune\s+di)[^\n,;]{0,80}/i,
      )?.[0],
    );
  const reportNumber = cleanExtractedValue(
    text.match(
      /(?:verbale|accertamento)\s*(?:n(?:umero)?\.?|nr\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{2,30})/i,
    )?.[1],
  );
  const violationTime =
    findContextTime(text, /(infrazione|violazione|accertamento|commessa|ore)/i) ??
    text.match(/\b(?:ore\s*)?([01]?\d|2[0-3])[:.][0-5]\d\b/i)?.[0]?.replace(/^ore\s*/i, "");
  const violationType = classifyViolation(
    `${caseData.violationType}\n${text}`,
    articleMatch?.[1],
  );
  const deviceType = getDeviceType(normalized, violationType);
  const eventDescription = extractEventDescription(text);

  return {
    violationDate,
    violationTime,
    notificationDate,
    authority,
    municipality,
    reportNumber,
    amount,
    reducedAmount,
    plate,
    article: articleMatch?.[1],
    paragraph,
    place,
    eventDescription,
    violationType,
    deviceType,
  };
}

function classifyViolation(
  source: string,
  article?: string,
): ViolationClassification {
  const value = normalize(source);
  if (
    /\bztl\b|zona\s+a\s+traffico\s+limitato|accesso\s+(?:non\s+autorizzato|area\s+vietata)|varco\s+elettronico/.test(
      value,
    ) ||
    article === "7"
  ) {
    return "ZTL / accesso area vietata";
  }
  if (
    /autovelox|tutor|eccesso\s+di\s+velocit[aà]|limite\s+di\s+velocit[aà]|velocit[aà]\s+media/.test(
      value,
    ) ||
    article === "142"
  ) {
    return "Autovelox / eccesso velocità";
  }
  if (
    /divieto\s+di\s+sosta|sosta\s+(?:vietata|irregolare)|parcheggi|sostava[^\n]{0,50}(?:vietat|non\s+consentit)/.test(
      value,
    ) ||
    article === "158"
  ) {
    return "Divieto di sosta";
  }
  if (
    /semaforo\s+rosso|luce\s+rossa|segnalazione\s+semaforica/.test(value) ||
    article === "146"
  ) {
    return "Semaforo rosso";
  }
  if (/mancata\s+revisione|revisione\s+scaduta/.test(value) || article === "80") {
    return "Mancata revisione";
  }
  if (
    /senza\s+assicurazione|copertura\s+assicurativa|assicurazione\s+scaduta/.test(
      value,
    ) ||
    article === "193"
  ) {
    return "Assicurazione";
  }
  if (
    /uso\s+(?:del\s+)?telefono|telefono\s+alla\s+guida|cellulare/.test(value) ||
    article === "173"
  ) {
    return "Uso telefono";
  }
  return "Altro";
}

function getDeviceType(
  normalized: string,
  violationType: ViolationClassification,
): ExtractedFacts["deviceType"] {
  if (/\btutor\b|velocit[aà]\s+media/i.test(normalized)) return "Tutor";
  if (
    /\bautovelox\b|rilevator[ei]\s+di\s+velocit/i.test(normalized) ||
    violationType === "Autovelox / eccesso velocità"
  ) {
    return "Autovelox";
  }
  if (violationType === "ZTL / accesso area vietata") return "ZTL";
  return undefined;
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
    `${context.facts.deviceType}: riferimenti tecnici non individuati`,
    20,
    "Nel testo estratto non compare un riferimento riconoscibile a omologazione, approvazione o decreto del dispositivo.",
    "Disciplina degli strumenti di accertamento; documentazione tecnica e orientamenti applicabili da verificare.",
    "Media",
  );
}

function missingPrecisePlace(context: RuleContext): RuleResult | null {
  if (context.facts.place) return null;
  return reason(
    "Luogo preciso non individuato",
    15,
    "La lettura automatica non ha individuato via, piazza, strada, località o progressiva chilometrica.",
    "Completezza e determinatezza del verbale; verifica consigliata sul documento originale.",
    "Media",
  );
}

function missingPlate(context: RuleContext): RuleResult | null {
  if (context.facts.plate || /\btarga\b/i.test(context.normalized)) return null;
  return reason(
    "Targa non individuata",
    20,
    "Nel testo estratto non compare una targa nel formato ordinario né un riferimento leggibile alla targa.",
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
    "Informazioni sui rimedi esperibili; rilevanza da verificare sul verbale completo.",
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
    !context.facts.violationDate && "data della violazione",
    !context.facts.authority && "ente accertatore",
    !context.facts.amount && "importo",
    !context.facts.article && "articolo contestato",
  ].filter(Boolean);
  if (missing.length < 2) return null;
  return reason(
    "Più dati essenziali non individuati",
    20,
    `Non risultano leggibili: ${missing.join(", ")}.`,
    "Completezza formale del verbale; verifica consigliata sul documento originale.",
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

function buildIdentifiedData(facts: ExtractedFacts): IdentifiedFineData {
  return {
    authority: facts.authority || NOT_DETECTED,
    municipality: facts.municipality || NOT_DETECTED,
    reportNumber: facts.reportNumber || NOT_DETECTED,
    plate: facts.plate || NOT_DETECTED,
    violationDate: facts.violationDate ? formatDate(facts.violationDate) : NOT_DETECTED,
    violationTime: facts.violationTime || NOT_DETECTED,
    notificationDate: facts.notificationDate
      ? formatDate(facts.notificationDate)
      : NOT_DETECTED,
    amount: facts.amount ? `€${facts.amount}` : NOT_DETECTED,
    reducedAmount: facts.reducedAmount
      ? `€${facts.reducedAmount}`
      : NOT_DETECTED,
    article: facts.article
      ? `Art. ${facts.article} Codice della Strada`
      : ARTICLE_NOT_IDENTIFIED,
    paragraph: facts.paragraph ? `Comma ${facts.paragraph}` : NOT_DETECTED,
    violationType: facts.violationType,
    place: facts.place || NOT_DETECTED,
  };
}

function getRuleDescription(facts: ExtractedFacts) {
  const descriptions: Record<ViolationClassification, string> = {
    "ZTL / accesso area vietata":
      "Possibile accesso o transito in una zona soggetta a limitazioni.",
    "Autovelox / eccesso velocità":
      "Possibile superamento del limite di velocità rilevato direttamente o tramite dispositivo.",
    "Divieto di sosta": "Possibile violazione delle regole di fermata o sosta.",
    "Semaforo rosso":
      "Possibile inosservanza della segnalazione semaforica.",
    "Mancata revisione":
      "Possibile circolazione con revisione non regolare o scaduta.",
    Assicurazione:
      "Possibile assenza o irregolarità della copertura assicurativa.",
    "Uso telefono":
      "Possibile utilizzo di telefono o dispositivo durante la guida.",
    Altro:
      "La tipologia non è stata classificata con sufficiente specificità.",
  };
  return descriptions[facts.violationType];
}

function buildFallbackEventSummary(facts: ExtractedFacts) {
  const parts = [
    facts.violationType !== "Altro" && facts.violationType,
    facts.violationDate && `in data ${formatDate(facts.violationDate)}`,
    facts.violationTime && `alle ore ${facts.violationTime}`,
    facts.place && `presso ${facts.place}`,
    facts.plate && `per il veicolo targato ${facts.plate}`,
  ].filter(Boolean);
  if (parts.length < 2) return NOT_DETECTED;
  return `Il documento sembra riferirsi a: ${parts.join(", ")}. La descrizione deve essere verificata sul verbale originale.`;
}

function extractEventDescription(text: string) {
  const sentence = text
    .match(
      /(?:il\s+veicolo|il\s+conducente|il\s+trasgressore)[\s\S]{20,320}?[.!?](?=\s|$)/i,
    )?.[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (sentence) return sentence;

  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 25 && line.length <= 320);
  const candidate =
    lines.find((line) =>
      /(?:circolava|transitava|sostava|superava|accedeva|ometteva|faceva\s+uso|veniva\s+accertato)/i.test(
        line,
      ),
    ) ??
    lines.find(
      (line) =>
        /(?:violazione|trasgressore)/i.test(line) &&
        !/^(?:data|luogo)\s+(?:della\s+)?violazione/i.test(line),
    );
  return candidate ? candidate.slice(0, 320) : undefined;
}

function calculateTextQuality(text: string, facts: ExtractedFacts) {
  const factCount = Object.entries(facts).filter(
    ([key, value]) => key !== "violationType" && Boolean(value),
  ).length;
  if (text.length < 100) return 15;
  if (text.length < 350) return Math.min(65, 30 + factCount * 4);
  return Math.min(100, 55 + factCount * 4);
}

function calculateConfidence(textQuality: number, facts: ExtractedFacts) {
  const essential = [
    facts.violationDate,
    facts.notificationDate,
    facts.authority,
    facts.amount,
    facts.article,
  ].filter(Boolean).length;
  return Math.min(100, Math.round(textQuality * 0.6 + essential * 8));
}

function getOutcome(
  score: number,
  confidence: number,
): ScreeningReport["outcome"] {
  if (confidence < 35) return "Documentazione insufficiente";
  if (score >= 55) return "Elementi da approfondire";
  if (score >= 20) return "Verifica consigliata";
  return "Nessuna criticità evidente";
}

function buildSummary(
  outcome: ScreeningReport["outcome"],
  confidence: number,
  reasons: RuleResult[],
) {
  if (outcome === "Documentazione insufficiente") {
    return "Il documento non contiene abbastanza informazioni leggibili per uno screening attendibile. È consigliato caricare una copia completa e più nitida.";
  }
  if (reasons.length === 0) {
    return "I controlli automatici non hanno rilevato criticità evidenti nei dati disponibili. Questo non esclude aspetti non leggibili o non verificabili automaticamente.";
  }
  return `Lo screening ha individuato ${reasons.length} element${reasons.length === 1 ? "o" : "i"} che potrebbero meritare approfondimento. La valutazione dipende dalla qualità e completezza del documento caricato.`;
}

function buildPreliminaryAssessment(
  outcome: ScreeningReport["outcome"],
  confidence: number,
  reasons: RuleResult[],
) {
  if (outcome === "Documentazione insufficiente") {
    return "Valutazione non completabile con sufficiente attendibilità. Integrare il documento prima di assumere decisioni.";
  }
  if (reasons.length === 0) {
    return "Non sono emerse criticità automatiche evidenti. È comunque consigliata la verifica del verbale originale e degli allegati.";
  }
  const relevance = reasons.some((item) => item.relevance === "Alta")
    ? "almeno una segnalazione di rilevanza alta"
    : "segnalazioni di rilevanza media o bassa";
  return `Sono presenti ${relevance}. Si consiglia una verifica professionale prima di valutare un eventuale ricorso. La qualità tecnica dell’estrazione è ${confidence >= 75 ? "buona" : confidence >= 50 ? "parziale" : "limitata"}.`;
}

function buildSuggestedPath(
  outcome: ScreeningReport["outcome"],
): ScreeningReport["suggestedPath"] {
  if (outcome === "Documentazione insufficiente") {
    return {
      route: "Documentazione insufficiente",
      rationale: "Non è prudente indicare una procedura senza dati completi.",
      risks: "Termini e possibili criticità potrebbero essere valutati in modo errato.",
    };
  }
  return {
    route: "Valutazione professionale necessaria",
    rationale:
      "La scelta tra Prefetto e Giudice di Pace dipende dal caso concreto e non viene determinata automaticamente.",
    risks:
      "Termini, costi e conseguenze del rigetto devono essere verificati prima di procedere.",
  };
}

function buildDeadlines(notificationDate?: Date) {
  if (!notificationDate) {
    return [
      {
        label: "Termini di ricorso",
        date: "Data non calcolabile",
        basis: "La data ufficiale di notifica non è stata rilevata.",
        caution: "Verificare immediatamente verbale, busta, relata o PEC.",
      },
    ];
  }
  return [
    {
      label: "Prefetto, termine ordinario indicativo",
      date: formatDate(addDays(notificationDate, 60)),
      basis: "Calcolo automatico di 60 giorni dalla data considerata.",
      caution:
        "Modalità di notifica, festività e circostanze specifiche possono incidere.",
    },
    {
      label: "Giudice di Pace, termine ordinario indicativo",
      date: formatDate(addDays(notificationDate, 30)),
      basis: "Calcolo automatico di 30 giorni dalla data considerata.",
      caution:
        "Il termine effettivo deve essere verificato sul documento ufficiale.",
    },
  ];
}

function buildSources(facts: ExtractedFacts): ScreeningReport["sources"] {
  const sources: ScreeningReport["sources"] = [
    {
      title: "Codice della Strada",
      reference: facts.article
        ? `Art. ${facts.article}${facts.paragraph ? `, comma ${facts.paragraph}` : ""}`
        : "Articoli 201, 203 e 204-bis",
      whyRelevant:
        "Norma contestata, notifica e strumenti ordinari di opposizione.",
      verificationStatus: facts.article ? "Da verificare" : "Riferimento generale",
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
      reference: "Norme tecniche, decreti e documentazione applicabile",
      whyRelevant:
        "Approvazione, segnalazione e modalità di utilizzo richiedono verifica sul caso concreto.",
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

function formatFacts(data: IdentifiedFineData) {
  return [
    `Ente accertatore: ${data.authority}`,
    `Comune: ${data.municipality}`,
    `Numero verbale: ${data.reportNumber}`,
    `Targa: ${data.plate}`,
    `Data violazione: ${data.violationDate}`,
    `Ora violazione: ${data.violationTime}`,
    `Data notifica: ${data.notificationDate}`,
    `Importo sanzione: ${data.amount}`,
    `Importo ridotto entro 5 giorni: ${data.reducedAmount}`,
    `Norma: ${data.article}`,
    `Comma: ${data.paragraph}`,
    `Tipo violazione: ${data.violationType}`,
    `Luogo: ${data.place}`,
  ];
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

function findContextTime(text: string, contextPattern: RegExp) {
  for (const line of text.split(/\n/)) {
    if (!contextPattern.test(line)) continue;
    const time = line.match(/\b(?:ore\s*)?([01]?\d|2[0-3])[:.][0-5]\d\b/i)?.[0];
    if (time) return time.replace(/^ore\s*/i, "");
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

function matchAmount(text: string, pattern: RegExp) {
  return normalizeAmount(text.match(pattern)?.[1]);
}

function normalizeAmount(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\d{1,5}(?:[.,]\d{1,2})?/);
  if (!match) return undefined;
  const [integer, decimals = "00"] = match[0].replace(",", ".").split(".");
  return `${integer},${decimals.padEnd(2, "0").slice(0, 2)}`;
}

function cleanExtractedValue(value?: string) {
  const cleaned = value
    ?.replace(/\s+/g, " ")
    .replace(/\s+(?:data|verbale|targa|importo|articolo)\b.*$/i, "")
    .trim()
    .replace(/[.,;:]+$/, "");
  return cleaned || undefined;
}

function cleanPlace(value?: string) {
  return cleanExtractedValue(
    value?.replace(
      /^(?:luogo(?:\s+(?:della\s+)?violazione)?|in\s+localit[aà])\s*[:\-]?\s*/i,
      "",
    ),
  );
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
