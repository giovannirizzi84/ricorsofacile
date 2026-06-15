import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  SCREENING_DISCLAIMER,
  VIOLATION_NOT_CLASSIFIED,
  type ExtractedDataField,
  type FieldConfidence,
  type IdentifiedFineData,
  type ScreeningReport,
  type ViolationClassification,
} from "../screening-report.ts";

export type FineCaseData = {
  notificationDate: string;
  authority: string;
  amount: string;
  violationType: string;
};

type RuleContext = {
  text: string;
  normalized: string;
  facts: ExtractedFacts;
};

type ExtractedFacts = {
  violationDate?: Date;
  violationTime?: string;
  assessmentDate?: Date;
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
  eventDescriptionConfidence?: FieldConfidence;
  violationType: ViolationClassification;
  violationTypeConfidence: FieldConfidence;
  deviceType?: "Autovelox" | "Tutor" | "ZTL";
  pointsDetected: boolean;
  suspensionDetected: boolean;
  fieldConfidence: Partial<
    Record<Exclude<ExtractedDataField["key"], "eventSummary">, FieldConfidence>
  >;
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
  _caseData: FineCaseData,
  options: {
    method: ScreeningReport["analysisMethod"];
    warnings?: string[];
  },
): ScreeningReport {
  const normalized = normalize(text);
  const facts = extractFacts(text, normalized);
  const context = { text, normalized, facts };
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
  const extractedData = buildExtractedData(
    identifiedData,
    eventSummary,
    facts,
    options.method,
  );
  const legalRule: ScreeningReport["legalRule"] = {
    article: facts.article
      ? `Art. ${facts.article} Codice della Strada`
      : ARTICLE_NOT_IDENTIFIED,
    paragraph: facts.paragraph ? `Comma ${facts.paragraph}` : NOT_DETECTED,
    description: getRuleDescription(facts),
    confidence: facts.article
      ? facts.fieldConfidence.article ?? "Bassa"
      : "Non rilevato",
  };
  const finalRecommendation = buildFinalRecommendation(
    textQuality,
    outcome,
    facts,
  );

  return {
    outcome,
    score,
    confidence,
    summary: buildSummary(outcome, confidence, reasons),
    documentQuality: getDocumentQuality(textQuality),
    analysisMethod: options.method,
    aiEnhanced: false,
    rulesEngineUsed: true,
    aiExecution: {
      provider: "Google Gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      attempted: false,
      promptExecuted: false,
      fallbackUsed: true,
      status: "Non tentato",
    },
    identifiedData,
    extractedData,
    violatedRule: {
      ...legalRule,
      classification: facts.violationType,
    },
    legalRule,
    violationClassification: {
      value: facts.violationType,
      confidence: facts.violationTypeConfidence,
    },
    eventSummary,
    preliminaryAssessment: buildPreliminaryAssessment(
      outcome,
      confidence,
      reasons,
    ),
    extractedFacts: formatFacts(identifiedData),
    reasons,
    potentialIssues: reasons.map(
      (item) => `${item.title}: ${item.evidence}`,
    ),
    criticalities,
    deadlines: buildDeadlines(facts.notificationDate),
    appealDeadlines: {
      prefetto: "Generalmente 60 giorni dalla contestazione o notificazione",
      giudiceDiPace:
        "Generalmente 30 giorni dalla contestazione o notificazione",
      caution:
        "I termini effettivi devono essere verificati sulla base della data di notifica e delle circostanze concrete.",
    },
    suggestedPath: buildSuggestedPath(),
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
    economicConvenience: buildEconomicConvenience(facts, reasons),
    finalRecommendation,
    suggestedNextStep: finalRecommendation,
    nextStep: finalRecommendation,
    sources: buildSources(facts),
    missingDocuments,
    extractedTextPreview: text.slice(0, 2500),
    disclaimer: SCREENING_DISCLAIMER,
    finalDisclaimer: SCREENING_DISCLAIMER,
  };
}

function extractFacts(
  text: string,
  normalized: string,
): ExtractedFacts {
  const violationDate = findContextDate(
    text,
    /(data\s+(?:della\s+)?(?:infrazione|violazione|accertamento)|(?:infrazione|violazione|accertamento|commessa|avvenuta)\s+(?:il|in\s+data))/i,
  );
  const assessmentDate = findContextDate(
    text,
    /(data\s+(?:dell['’]\s*)?accertamento|accertat[oa]\s+(?:il|in\s+data))/i,
  );
  const notificationDate = findContextDate(
    text,
    /(data\s+(?:della\s+)?notifica|notificat[oa]\s+(?:il|in\s+data)|spedizione\s+(?:il|in\s+data)|consegnat[oa]\s+(?:il|in\s+data))/i,
  );
  const plate = text
    .toUpperCase()
    .match(/\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/)?.[0]
    ?.replace(/\s/g, "");
  const labelledAmount = matchAmount(
    text,
    /(?:sanzione|importo|somma\s+di|pagamento)[^\d€]{0,25}(?:€\s*)?(\d{1,5}(?:[.,]\d{2})?)/i,
  );
  const amount = labelledAmount ?? matchAmount(
    text,
    /€\s*(\d{1,5}(?:[.,]\d{2})?)/i,
  );
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
    /(?:art(?:icolo)?\.?\s*)(\d{1,3}(?:[-\s]?(?:bis|ter|quater))?)/i,
  );
  const articleLine = articleMatch?.[1]
    ? text.match(
        new RegExp(
          `art(?:icolo)?\\.?\\s*${escapeRegExp(articleMatch[1])}\\b[^\\n]{0,100}`,
          "i",
        ),
      )?.[0]
    : undefined;
  const paragraph = articleLine?.match(
    /(?:comma|co\.?)\s*([0-9]+(?:[-\s]?(?:bis|ter|quater))?)/i,
  )?.[1];
  const labelledPlace = text.match(
    /luogo(?:\s+della\s+violazione)?\s*[:\-]?\s*[^\n,;]{3,100}/i,
  )?.[0];
  const place = cleanPlace(
    labelledPlace ??
      text.match(
        /(?:in\s+localit[aà]|via|viale|piazza|corso|strada|localit[aà]|km|chilometro)\s*[:\-]?\s*[^\n,;]{3,100}/i,
      )?.[0],
  );
  const municipality =
    cleanExtractedValue(
      text.match(/(?:comune\s+di|citt[aà]\s+di)\s+([^\n,;]{2,60})/i)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/polizia\s+(?:locale|municipale)\s+di\s+([^\n,;]{2,60})/i)?.[1],
    );
  const authority = cleanExtractedValue(
    text.match(
      /(?:corpo\s+di\s+)?(?:polizia\s+locale|polizia\s+municipale|polizia\s+stradale|carabinieri|guardia\s+di\s+finanza|comune\s+di)[^\n,;]{0,80}/i,
    )?.[0],
  );
  const reportNumber = cleanExtractedValue(
    text.match(
      /(?:verbale|accertamento)\s*(?:n(?:umero)?\.?|nr\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{2,30})/i,
    )?.[1],
  );
  const violationTime = findContextTime(
    text,
    /(infrazione|violazione|accertamento|commessa|avvenuta|ore)/i,
  );
  const classification = classifyViolation(text, articleMatch?.[1]);
  const violationType = classification.value;
  const deviceType = getDeviceType(normalized, violationType);
  const eventDescription = extractEventDescription(text);
  const legalContext = /codice\s+della\s+strada|\bc\.?\s*d\.?\s*s\.?\b/i.test(
    text,
  );
  const pointsDetected =
    /decurtazione\s+(?:di\s+)?\d+\s+punti|perdita\s+(?:di\s+)?\d+\s+punti|punti\s+patente/i.test(
      text,
    );
  const suspensionDetected =
    /sospensione\s+(?:della\s+)?patente|patente\s+sospesa/i.test(text);
  const fieldConfidence: ExtractedFacts["fieldConfidence"] = {
    ...(violationDate && { violationDate: "Alta" }),
    ...(violationTime && { violationTime: "Alta" }),
    ...(assessmentDate && { assessmentDate: "Alta" }),
    ...(notificationDate && { notificationDate: "Alta" }),
    ...(authority && { authority: "Media" }),
    ...(municipality && { municipality: "Alta" }),
    ...(reportNumber && { reportNumber: "Alta" }),
    ...(plate && { plate: "Alta" }),
    ...(amount && { amount: labelledAmount ? "Alta" : "Media" }),
    ...(reducedAmount && { reducedAmount: "Media" }),
    ...(articleMatch?.[1] && { article: legalContext ? "Alta" : "Media" }),
    ...(paragraph && { paragraph: legalContext ? "Alta" : "Media" }),
    ...(place && { place: labelledPlace ? "Alta" : "Media" }),
    ...(violationType !== VIOLATION_NOT_CLASSIFIED && {
      violationType: classification.confidence,
    }),
  };

  return {
    violationDate,
    violationTime,
    assessmentDate,
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
    eventDescription: eventDescription?.value,
    eventDescriptionConfidence: eventDescription?.confidence,
    violationType,
    violationTypeConfidence: classification.confidence,
    deviceType,
    pointsDetected,
    suspensionDetected,
    fieldConfidence,
  };
}

function classifyViolation(
  source: string,
  article?: string,
): {
  value: ViolationClassification;
  confidence: FieldConfidence;
} {
  const value = normalize(source);
  if (
    /\bztl\b|zona\s+a\s+traffico\s+limitato|accesso\s+(?:non\s+autorizzato|area\s+vietata)|varco\s+elettronico/.test(
      value,
    )
  ) {
    return { value: "ZTL / accesso area vietata", confidence: "Alta" };
  }
  if (
    /autovelox|tutor|eccesso\s+di\s+velocit[aà]|limite\s+di\s+velocit[aà]|velocit[aà]\s+media/.test(
      value,
    )
  ) {
    return { value: "autovelox / eccesso di velocità", confidence: "Alta" };
  }
  if (
    /divieto\s+di\s+sosta|sosta\s+(?:vietata|irregolare)|parcheggi|sostava[^\n]{0,50}(?:vietat|non\s+consentit)/.test(
      value,
    )
  ) {
    return { value: "divieto di sosta", confidence: "Alta" };
  }
  if (
    /semaforo\s+rosso|luce\s+rossa|segnalazione\s+semaforica/.test(value)
  ) {
    return { value: "semaforo rosso", confidence: "Alta" };
  }
  if (/mancata\s+revisione|revisione\s+scaduta/.test(value)) {
    return { value: "mancata revisione", confidence: "Alta" };
  }
  if (
    /senza\s+assicurazione|copertura\s+assicurativa|assicurazione\s+scaduta/.test(
      value,
    )
  ) {
    return { value: "mancata assicurazione", confidence: "Alta" };
  }
  if (
    /uso\s+(?:del\s+)?telefono|telefono\s+alla\s+guida|cellulare/.test(value)
  ) {
    return { value: "uso del telefono alla guida", confidence: "Alta" };
  }
  if (/corsia\s+(?:riservata|preferenziale)|transito\s+riservato/.test(value)) {
    return {
      value: "circolazione in corsia riservata",
      confidence: "Alta",
    };
  }
  if (
    /mancata\s+comunicazione\s+(?:dei\s+)?dati\s+(?:del\s+)?conducente|omessa\s+comunicazione\s+(?:dei\s+)?dati/i.test(
      value,
    )
  ) {
    return {
      value: "mancata comunicazione dati conducente",
      confidence: "Alta",
    };
  }

  const articleClassifications: Record<
    string,
    Exclude<ViolationClassification, typeof VIOLATION_NOT_CLASSIFIED>
  > = {
    "7": "altra violazione",
    "80": "mancata revisione",
    "142": "autovelox / eccesso di velocità",
    "146": "semaforo rosso",
    "158": "divieto di sosta",
    "173": "uso del telefono alla guida",
    "193": "mancata assicurazione",
  };
  if (article && articleClassifications[article]) {
    return {
      value: articleClassifications[article],
      confidence: "Media",
    };
  }
  return {
    value: VIOLATION_NOT_CLASSIFIED,
    confidence: "Non rilevato",
  };
}

function getDeviceType(
  normalized: string,
  violationType: ViolationClassification,
): ExtractedFacts["deviceType"] {
  if (/\btutor\b|velocit[aà]\s+media/i.test(normalized)) return "Tutor";
  if (
    /\bautovelox\b|rilevator[ei]\s+di\s+velocit/i.test(normalized) ||
    violationType === "autovelox / eccesso di velocità"
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
    assessmentDate: facts.assessmentDate
      ? formatDate(facts.assessmentDate)
      : NOT_DETECTED,
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

function buildExtractedData(
  data: IdentifiedFineData,
  eventSummary: string,
  facts: ExtractedFacts,
  method: ScreeningReport["analysisMethod"],
): ExtractedDataField[] {
  const field = (
    key: ExtractedDataField["key"],
    label: string,
    value: string,
    confidence = facts.fieldConfidence[
      key as Exclude<ExtractedDataField["key"], "eventSummary">
    ],
  ): ExtractedDataField => ({
    key,
    label,
    value,
    confidence: adjustConfidence(
      value === NOT_DETECTED ||
      value === ARTICLE_NOT_IDENTIFIED ||
      value === VIOLATION_NOT_CLASSIFIED
        ? "Non rilevato"
        : confidence ?? "Bassa",
      method,
    ),
  });

  return [
    field("authority", "Ente accertatore", data.authority),
    field("municipality", "Comune", data.municipality),
    field("reportNumber", "Numero verbale", data.reportNumber),
    field("plate", "Targa", data.plate),
    field("violationDate", "Data violazione", data.violationDate),
    field("violationTime", "Ora violazione", data.violationTime),
    field("assessmentDate", "Data accertamento", data.assessmentDate),
    field("notificationDate", "Data notifica", data.notificationDate),
    field("place", "Luogo violazione", data.place),
    field("amount", "Importo", data.amount),
    field(
      "reducedAmount",
      "Importo ridotto entro 5 giorni",
      data.reducedAmount,
    ),
    field("article", "Articolo CdS", data.article),
    field("paragraph", "Comma", data.paragraph),
    field(
      "eventSummary",
      "Descrizione sintetica",
      eventSummary,
      facts.eventDescription
        ? facts.eventDescriptionConfidence
        : "Bassa",
    ),
    field(
      "violationType",
      "Tipo violazione",
      data.violationType,
      facts.violationTypeConfidence,
    ),
  ];
}

function adjustConfidence(
  confidence: FieldConfidence,
  method: ScreeningReport["analysisMethod"],
): FieldConfidence {
  if (confidence === "Non rilevato") return confidence;
  if (method !== "OCR + regole") return confidence;
  if (confidence === "Alta") return "Media";
  if (confidence === "Media") return "Bassa";
  return confidence;
}

function getRuleDescription(facts: ExtractedFacts) {
  const descriptions: Record<ViolationClassification, string> = {
    "ZTL / accesso area vietata":
      "Possibile accesso o transito in una zona soggetta a limitazioni.",
    "autovelox / eccesso di velocità":
      "Possibile superamento del limite di velocità rilevato direttamente o tramite dispositivo.",
    "divieto di sosta": "Possibile violazione delle regole di fermata o sosta.",
    "semaforo rosso":
      "Possibile inosservanza della segnalazione semaforica.",
    "mancata revisione":
      "Possibile circolazione con revisione non regolare o scaduta.",
    "mancata assicurazione":
      "Possibile assenza o irregolarità della copertura assicurativa.",
    "uso del telefono alla guida":
      "Possibile utilizzo di telefono o dispositivo durante la guida.",
    "circolazione in corsia riservata":
      "Possibile transito in una corsia riservata o preferenziale.",
    "mancata comunicazione dati conducente":
      "Possibile omissione della comunicazione dei dati del conducente.",
    "altra violazione":
      "La tipologia non è stata classificata con sufficiente specificità.",
    [VIOLATION_NOT_CLASSIFIED]:
      "La norma e la tipologia non sono state identificate con sufficiente certezza.",
  };
  if (!facts.article || facts.violationType === VIOLATION_NOT_CLASSIFIED) {
    return "Descrizione della norma non disponibile con sufficiente certezza.";
  }
  return descriptions[facts.violationType];
}

function buildFallbackEventSummary(facts: ExtractedFacts) {
  const parts = [
    facts.violationType !== VIOLATION_NOT_CLASSIFIED && facts.violationType,
    facts.violationDate && `in data ${formatDate(facts.violationDate)}`,
    facts.violationTime && `alle ore ${facts.violationTime}`,
    facts.place && `presso ${facts.place}`,
    facts.plate && `per il veicolo targato ${facts.plate}`,
  ].filter(Boolean);
  if (parts.length < 2) return NOT_DETECTED;
  return `Dalla documentazione caricata risulta una contestazione relativa a ${parts.join(", ")}. La descrizione è preliminare e deve essere verificata sul verbale originale.`;
}

function extractEventDescription(text: string) {
  const sentence = text
    .match(
      /(?:il\s+veicolo|il\s+conducente|il\s+trasgressore)[\s\S]{20,320}?[.!?](?=\s|$)/i,
    )?.[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (sentence) return { value: sentence, confidence: "Alta" as const };

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
  return candidate
    ? { value: candidate.slice(0, 320), confidence: "Media" as const }
    : undefined;
}

function calculateTextQuality(text: string, facts: ExtractedFacts) {
  const factCount = Object.entries(facts).filter(
    ([key, value]) =>
      ![
        "violationType",
        "violationTypeConfidence",
        "fieldConfidence",
        "eventDescriptionConfidence",
      ].includes(key) && Boolean(value),
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
  if (confidence < 35) return "Medio interesse all’approfondimento";
  if (score >= 55) return "Alto interesse all’approfondimento";
  if (score >= 20) return "Medio interesse all’approfondimento";
  return "Basso interesse all’approfondimento";
}

function buildSummary(
  outcome: ScreeningReport["outcome"],
  confidence: number,
  reasons: RuleResult[],
) {
  if (confidence < 35) {
    return "Il documento non contiene abbastanza informazioni leggibili per uno screening attendibile. È consigliato caricare una copia completa e più nitida.";
  }
  if (reasons.length === 0) {
    return "Dal solo documento caricato non emergono criticità evidenti. Potrebbe comunque essere utile una verifica professionale in presenza di ulteriori documenti o circostanze.";
  }
  return `Lo screening ha individuato ${reasons.length} element${reasons.length === 1 ? "o" : "i"} che potrebbero meritare verifica. L’esito "${outcome}" è preliminare e dipende dalla qualità e completezza del documento caricato.`;
}

function buildPreliminaryAssessment(
  outcome: ScreeningReport["outcome"],
  confidence: number,
  reasons: RuleResult[],
) {
  if (confidence < 35) {
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

function buildSuggestedPath(): ScreeningReport["suggestedPath"] {
  return {
    route: "Valutazione professionale necessaria",
    rationale:
      "La scelta tra Prefetto e Giudice di Pace dipende dal caso concreto e non viene determinata automaticamente.",
    risks:
      "Termini, costi e conseguenze del rigetto devono essere verificati prima di procedere.",
  };
}

function buildEconomicConvenience(
  facts: ExtractedFacts,
  reasons: RuleResult[],
): ScreeningReport["economicConvenience"] {
  const amount = facts.amount
    ? Number(facts.amount.replace(".", "").replace(",", "."))
    : undefined;
  const complexCase =
    facts.pointsDetected || facts.suspensionDetected || reasons.length >= 4;

  if (facts.suspensionDetected || (amount !== undefined && amount > 500)) {
    return {
      level: "Alta",
      reason:
        "L’importo elevato o la possibile presenza di conseguenze accessorie può rendere utile una valutazione professionale approfondita.",
      possiblePackage:
        "Pacchetto eventualmente coerente con il caso: Ricorso Premium €149.",
    };
  }
  if (
    facts.pointsDetected ||
    complexCase ||
    (amount !== undefined && amount > 250)
  ) {
    return {
      level: "Media",
      reason:
        "L’importo, la complessità apparente o le possibili conseguenze accessorie richiedono una verifica del rapporto tra costi e benefici.",
      possiblePackage:
        "Pacchetto eventualmente coerente con il caso: Ricorso Smart €79.",
    };
  }
  if (amount !== undefined) {
    return {
      level: "Bassa",
      reason:
        "L’importo appare contenuto e non sono state rilevate con certezza conseguenze accessorie; può essere prudente verificare il caso prima di predisporre un ricorso.",
      possiblePackage:
        "Pacchetto eventualmente coerente con il caso: Consulenza Legale €19,90.",
    };
  }
  return {
    level: "Non valutabile",
    reason:
      "L’importo della sanzione non è stato rilevato con sufficiente certezza.",
    possiblePackage:
      "Nessun pacchetto individuabile prima di integrare i dati mancanti.",
  };
}

function buildFinalRecommendation(
  textQuality: number,
  outcome: ScreeningReport["outcome"],
  facts: ExtractedFacts,
) {
  if (textQuality < 35) {
    return "La documentazione caricata non consente di formulare una valutazione completa. È opportuno caricare una copia più leggibile e completa.";
  }
  if (facts.amount && Number(facts.amount.replace(",", ".")) <= 250) {
    return "Per sanzioni di importo contenuto, può essere opportuno partire da una consulenza legale prima di valutare un ricorso.";
  }
  if (outcome === "Basso interesse all’approfondimento") {
    return "Dal solo documento caricato non emergono criticità evidenti. Una verifica professionale può comunque essere utile in presenza di ulteriori documenti o circostanze.";
  }
  return "L’analisi preliminare ha individuato alcuni elementi che potrebbero meritare verifica professionale.";
}

function buildDeadlines(notificationDate?: Date) {
  const commonCaution =
    "I termini effettivi devono essere verificati sulla base della data di notifica e delle circostanze concrete.";
  return [
    {
      label: "Prefetto",
      date: "Generalmente 60 giorni",
      basis: notificationDate
        ? `Dalla contestazione o notificazione. Data di notifica rilevata: ${formatDate(notificationDate)}.`
        : "Dalla contestazione o notificazione. La data di notifica non è stata rilevata.",
      caution: commonCaution,
    },
    {
      label: "Giudice di Pace",
      date: "Generalmente 30 giorni",
      basis: notificationDate
        ? `Dalla contestazione o notificazione. Data di notifica rilevata: ${formatDate(notificationDate)}.`
        : "Dalla contestazione o notificazione. La data di notifica non è stata rilevata.",
      caution: commonCaution,
    },
  ];
}

function buildSources(facts: ExtractedFacts): ScreeningReport["sources"] {
  const sources: ScreeningReport["sources"] = [
    {
      title: "Codice della Strada",
      reference: facts.article
        ? `Art. ${facts.article}${facts.paragraph ? `, comma ${facts.paragraph}` : ""}`
        : ARTICLE_NOT_IDENTIFIED,
      whyRelevant:
        "Norma contestata da verificare direttamente sul verbale originale.",
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
    `Data accertamento: ${data.assessmentDate}`,
    `Data notifica: ${data.notificationDate}`,
    `Importo sanzione: ${data.amount}`,
    `Importo ridotto entro 5 giorni: ${data.reducedAmount}`,
    `Norma: ${data.article}`,
    `Comma: ${data.paragraph}`,
    `Tipo violazione: ${data.violationType}`,
    `Luogo: ${data.place}`,
  ];
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

function parseItalianDate(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return undefined;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(year, month - 1, day, 12);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values: string[]) {
  return [...new Set(values)];
}
