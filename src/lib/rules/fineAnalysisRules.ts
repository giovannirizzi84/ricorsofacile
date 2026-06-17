import {
  ARTICLE_NOT_IDENTIFIED,
  NOT_DETECTED,
  SCREENING_DISCLAIMER,
  VIOLATION_NOT_CLASSIFIED,
  type ClassifiedDocumentPage,
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

type DocumentPagePipeline = {
  pages: ClassifiedDocumentPage[];
  mainVerbaleText: string;
  paymentText: string;
  warningsText: string;
  selectedMainVerbalePage: number | null;
  validationWarnings: string[];
};

type ExtractedFacts = {
  violationDate?: Date;
  violationTime?: string;
  assessmentDate?: Date;
  assessmentTime?: string;
  notificationDate?: Date;
  authority?: string;
  municipality?: string;
  reportNumber?: string;
  registryNumber?: string;
  amount?: string;
  reducedAmount?: string;
  plate?: string;
  article?: string;
  paragraph?: string;
  place?: string;
  speedDetected?: number;
  speedLimit?: number;
  speedExcess?: number;
  licensePoints?: number;
  minimumAmount?: string;
  administrativeFees?: string;
  deviceName?: string;
  approvalDecree?: string;
  calibrationCheck?: string;
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
  const pipeline = buildDocumentPagePipeline(text);
  const analysisText = [
    pipeline.mainVerbaleText,
    pipeline.paymentText,
    pipeline.warningsText,
  ]
    .filter(Boolean)
    .join("\n\n");
  const normalized = normalize(analysisText);
  const facts = extractFacts(
    pipeline.mainVerbaleText || analysisText,
    normalized,
    {
      paymentText: pipeline.paymentText,
      warningsText: pipeline.warningsText,
    },
  );
  const validationWarnings = [
    ...pipeline.validationWarnings,
    ...validateExtractedFacts(facts),
  ];
  const context = { text: analysisText, normalized, facts };
  const reasons = rules
    .map((rule) => rule(context))
    .filter((result): result is RuleResult => Boolean(result));
  const rawScore =
    reasons.reduce((total, result) => total + result.points, 0) +
    calculateInterestSignals(facts);
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
  const eventSummary = buildEventSummary(facts);
  const extractedData = buildExtractedData(
    identifiedData,
    eventSummary,
    facts,
    options.method,
  );
  const extractionLog = buildExtractionLog(extractedData);
  const consistencyChecks = buildConsistencyChecks(facts);
  const normalizedData = buildNormalizedData(facts);
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
    normalizedData,
    extractionDebug: buildExtractionDebug(pipeline, validationWarnings),
    extractionLog,
    consistencyChecks,
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
    potentialIssues: buildPotentialIssues(facts, reasons),
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
  context: {
    paymentText?: string;
    warningsText?: string;
  } = {},
): ExtractedFacts {
  const paymentText = context.paymentText ?? "";
  const assessmentMoment = findAssessmentMoment(text);
  const violationMoment = findViolationMoment(text);
  const violationDate =
    violationMoment.date ??
    findContextDate(
      text,
      /(data\s+(?:della\s+)?(?:infrazione|violazione)|(?:infrazione|violazione|commessa|avvenuta)\s+(?:il|in\s+data))/i,
    ) ??
    findLongReceiptDate(text);
  const assessmentDate =
    assessmentMoment.date ??
    findAssessmentDate(text) ??
    findContextDate(
      text,
      /(data\s+(?:dell['’]\s*)?accertamento|accertat[oa]\s+(?:il|in\s+data))/i,
    );
  const notificationDate = findContextDate(
    text,
    /(data\s+(?:della\s+)?notifica|notificat[oa]\s+(?:il|in\s+data)|spedizione\s+(?:il|in\s+data)|consegnat[oa]\s+(?:il|in\s+data))/i,
  );
  const plate = extractPlate(text);
  const totalAmount = matchAmount(
    text,
    /totale\s*[:\-]?\s*(?:(?:€|Euro)\s*)?(\d{1,5}(?:\s*[.,]\s*\d{2})?)/i,
  );
  const ordinaryAmount =
    matchAmount(
      text,
      /dal\s+6[°º]?\s+al\s+60[°º]?\s+giorno[\s\S]{0,260}?totale\s+di\s+Euro\s+(\d{1,5}(?:[.,]\d{2})?)/i,
    ) ??
    findContextualMoneyAmount(
      text,
      /(?:(?:oltre|[il]tre)\s+(?:cinque|5)\s+giorni|dal\s+6[°º]?\s+al\s+60[°º]?\s+giorno)/i,
    ) ??
    findPaymentAmount(paymentText, "standard");
  const labelledAmount = matchAmount(
    text,
    /(?:sanzione|importo|somma\s+di|pagamento|totale)[^\n€]{0,80}(?:(?:€|Euro)\s*)(\d{1,5}(?:\s*[.,]\s*\d{2})?)/i,
  );
  const amount = rejectInvalidAmount(
    totalAmount ?? ordinaryAmount ?? labelledAmount ?? matchAmount(
    text,
    /(?:€|Euro)\s*(\d{1,5}(?:\s*[.,]\s*\d{2})?)/i,
    ),
  );
  const reducedAmount =
    rejectInvalidAmount(matchAmount(
      text,
      /(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%|misura\s+ridotta)[\s\S]{0,220}?totale\s+di\s+Euro\s+(\d{1,5}(?:[.,]\d{2})?)/i,
    )) ??
    findContextualMoneyAmount(
      text,
      /(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%)/i,
    ) ??
    findPaymentAmount(paymentText, "reduced") ??
    rejectInvalidAmount(matchAmount(
      text,
      /(?:€\s*)?(\d{1,5}(?:[.,]\d{2})?)[^\n]{0,45}(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%)/i,
    ));
  const articleDetails = extractContestedArticle(text);
  const labelledPlace = text.match(
    /luogo(?:\s+della\s+violazione)?\s*[:\-]?\s*[^\n,;]{3,100}/i,
  )?.[0];
  const narrativePlace = extractNarrativePlace(text) ?? extractLongReceiptPlace(text);
  const place = narrativePlace ?? cleanPlace(
    labelledPlace ??
      text.match(
        /(?:in\s+localit[aà]|via|viale|piazza|corso|strada|localit[aà]|km|chilometro)\s*[:\-]?\s*[^\n,;]{3,100}/i,
      )?.[0],
  );
  const rawMunicipality =
    extractMunicipality(text);
  const municipality = rawMunicipality ? toTitleCase(rawMunicipality) : undefined;
  const authority = extractAuthority(text, municipality);
  const reportNumber = extractReportNumber(text);
  const registryNumber = cleanExtractedValue(
    text.match(/N\.?\s*Registro\s+([A-Z0-9./-]{3,40})/i)?.[1],
  );
  const violationTime =
    violationMoment.time ??
    findTimeNearDate(text, violationDate) ??
    findLongReceiptTime(text) ??
    findContextTime(text, /(infrazione|violazione|commessa|avvenuta)/i);
  const assessmentTime = assessmentMoment.time;
  const speedDetected = matchNumber(
    text,
    /(?:circolava\s+alla\s+velocit[aà]\s+di|velocit[aà][\s']*rilevata\s*[:\-]?)\s*(?:Km\/h\s*)?(\d{1,3})(?:\s*km\/h)?/i,
  );
  const speedLimit = matchNumber(
    text,
    /(?:limite\s+di\s+velocit[aà]\s+(?:era\s+)?di|consentita|limite\s*[:\-]?)\s*(?:Km\/h\s*)?(\d{1,3})(?:\s*km\/h)?/i,
  );
  const speedExcess = matchNumber(
    text,
    /(?:eccedeva\s+precisamente\s+di|eccedenza(?:\s+dopo\s+tolleranza)?\s*[:\-]?)\s*(?:Km\/h\s*)?(\d{1,3})(?:\s*km\/h)?/i,
  );
  const licensePoints = matchNumber(
    text,
    /(?:decurtazione\s+(?:di\s+)?(?:n\.?\s*)?|punti\s+patente\s*[:\-]?)\s*(\d{1,2})\s*(?:punti)?/i,
  );
  const minimumAmount = matchAmount(
    text,
    /sanzione\s+in\s+misura\s+ridotta\s+Euro\s+(\d{1,5}(?:[.,]\d{2})?)/i,
  );
  const administrativeFees = matchAmount(
    text,
    /pi[uù]\s+Euro\s+(\d{1,5}(?:[.,]\d{2})?)\s+per\s+le\s+spese\s+amministrative/i,
  );
  const deviceName = cleanExtractedValue(
    text.match(/denominato\s+([A-Z0-9_/-]+(?:\s+[A-Z0-9_/-]+)*)(?:,|\s+matr\.|\s+approvato)/i)?.[1],
  );
  const approvalDecree = extractApprovalDecree(text);
  const calibrationCheck = extractCalibrationCheck(text);
  const classification = classifyViolation(text, articleDetails.article);
  const violationType = classification.value;
  const deviceType = getDeviceType(normalized, violationType);
  const eventDescription = extractEventDescription(text);
  const legalContext = /codice\s+della\s+strada|\bc\.?\s*d\.?\s*s\.?\b/i.test(
    text,
  );
  const pointsDetected =
    /decurtazione\s+(?:di\s+)?(?:n\.?\s*)?\d+\s*(?:punti)?|perdita\s+(?:di\s+)?\d+\s+punti|punti\s+patente\s*[:\-]?\s*\d*/i.test(
      text,
    );
  const suspensionDetected =
    /sospensione\s+(?:della\s+)?patente|patente\s+sospesa/i.test(text);
  const fieldConfidence: ExtractedFacts["fieldConfidence"] = {
    ...(violationDate && { violationDate: "Alta" }),
    ...(violationTime && { violationTime: "Alta" }),
    ...(assessmentDate && { assessmentDate: "Alta" }),
    ...(assessmentTime && { assessmentTime: "Alta" }),
    ...(notificationDate && { notificationDate: "Alta" }),
    ...(authority && { authority: "Media" }),
    ...(municipality && { municipality: "Alta" }),
    ...(reportNumber && { reportNumber: "Alta" }),
    ...(registryNumber && { registryNumber: "Alta" }),
    ...(plate && { plate: "Alta" }),
    ...(amount && { amount: ordinaryAmount || labelledAmount ? "Alta" : "Media" }),
    ...(reducedAmount && { reducedAmount: "Alta" }),
    ...(articleDetails.article && { article: legalContext ? "Alta" : "Media" }),
    ...(articleDetails.paragraph && { paragraph: legalContext ? "Alta" : "Media" }),
    ...(place && { place: narrativePlace || labelledPlace ? "Alta" : "Media" }),
    ...(speedDetected !== undefined && { speedDetected: "Alta" }),
    ...(speedLimit !== undefined && { speedLimit: "Alta" }),
    ...(speedExcess !== undefined && { speedExcess: "Alta" }),
    ...(licensePoints !== undefined && { licensePoints: "Alta" }),
    ...(minimumAmount && { minimumAmount: "Alta" }),
    ...(administrativeFees && { administrativeFees: "Alta" }),
    ...(deviceName && { deviceName: "Alta" }),
    ...(approvalDecree && { approvalDecree: "Alta" }),
    ...(calibrationCheck && { calibrationCheck: "Alta" }),
    ...(violationType !== VIOLATION_NOT_CLASSIFIED && {
      violationType: classification.confidence,
    }),
  };

  return {
    violationDate,
    violationTime,
    assessmentDate,
    assessmentTime,
    notificationDate,
    authority,
    municipality,
    reportNumber,
    registryNumber,
    amount,
    reducedAmount,
    plate,
    article: articleDetails.article,
    paragraph: articleDetails.paragraph,
    place,
    speedDetected,
    speedLimit,
    speedExcess,
    licensePoints,
    minimumAmount,
    administrativeFees,
    deviceName,
    approvalDecree,
    calibrationCheck,
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
    /rimozione\s+del\s+veicolo|sanzione\s+accessoria\s+della\s+rimozione|spese\s+di\s+rimozione|custodia/.test(
      value,
    ) &&
    /sostava|sosta|tariffe\s+orarie|no\s+pagamento|zona\s+a\s+traffico\s+limitato/.test(
      value,
    )
  ) {
    return { value: "Sosta / Rimozione", confidence: "Alta" };
  }
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
    return { value: "Autovelox / Eccesso di velocità", confidence: "Alta" };
  }
  if (
    /divieto\s+di\s+sosta|sosta\s+(?:vietata|irregolare)|vietata\s+la\s+sosta|parcheggi|sostava[^\n]{0,50}(?:vietat|non\s+consentit)/.test(
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
    "7": "ZTL / accesso area vietata",
    "80": "mancata revisione",
    "126-bis": "mancata comunicazione dati conducente",
    "126bis": "mancata comunicazione dati conducente",
    "142": "Autovelox / Eccesso di velocità",
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
    violationType === "Autovelox / Eccesso di velocità"
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
  if (
    /omologaz|approvaz|approvat|decreto\s+(?:ministeriale|ministero|dirigenziale)|taratura/i.test(
      context.normalized,
    )
  ) {
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
    registryNumber: facts.registryNumber || NOT_DETECTED,
    plate: facts.plate || NOT_DETECTED,
    violationDate: facts.violationDate ? formatDate(facts.violationDate) : NOT_DETECTED,
    violationTime: facts.violationTime || NOT_DETECTED,
    assessmentDate: facts.assessmentDate
      ? formatDate(facts.assessmentDate)
      : NOT_DETECTED,
    assessmentTime: facts.assessmentTime || NOT_DETECTED,
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
    speedDetected:
      facts.speedDetected !== undefined ? `${facts.speedDetected} km/h` : NOT_DETECTED,
    speedLimit:
      facts.speedLimit !== undefined ? `${facts.speedLimit} km/h` : NOT_DETECTED,
    speedExcess:
      facts.speedExcess !== undefined ? `${facts.speedExcess} km/h` : NOT_DETECTED,
    licensePoints:
      facts.licensePoints !== undefined ? `${facts.licensePoints}` : NOT_DETECTED,
    minimumAmount: facts.minimumAmount ? `€${facts.minimumAmount}` : NOT_DETECTED,
    administrativeFees: facts.administrativeFees
      ? `€${facts.administrativeFees}`
      : NOT_DETECTED,
    deviceName: facts.deviceName || NOT_DETECTED,
    approvalDecree: facts.approvalDecree || NOT_DETECTED,
    calibrationCheck: facts.calibrationCheck || NOT_DETECTED,
    violationType: facts.violationType,
    place: facts.place || NOT_DETECTED,
  };
}

function buildNormalizedData(facts: ExtractedFacts): ScreeningReport["normalizedData"] {
  return {
    articleCode: facts.article || ARTICLE_NOT_IDENTIFIED,
    paragraph: facts.paragraph || NOT_DETECTED,
    violationTime: facts.violationTime || NOT_DETECTED,
    detectionTime: facts.assessmentTime || NOT_DETECTED,
    reducedAmount: facts.reducedAmount ? `€${facts.reducedAmount}` : NOT_DETECTED,
    standardAmount: facts.amount ? `€${facts.amount}` : NOT_DETECTED,
    speedDetected: facts.speedDetected ?? null,
    speedLimit: facts.speedLimit ?? null,
    speedExcess: facts.speedExcess ?? null,
    points: facts.licensePoints ?? null,
    classification: facts.violationType,
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
    field("registryNumber", "Numero registro", data.registryNumber),
    field("plate", "Targa", data.plate),
    field("violationDate", "Data violazione", data.violationDate),
    field("violationTime", "Ora violazione", data.violationTime),
    field("assessmentDate", "Data accertamento", data.assessmentDate),
    field("assessmentTime", "Ora accertamento", data.assessmentTime),
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
    field("speedDetected", "Velocità rilevata", data.speedDetected),
    field("speedLimit", "Limite", data.speedLimit),
    field("speedExcess", "Superamento", data.speedExcess),
    field("licensePoints", "Punti patente", data.licensePoints),
    field("minimumAmount", "Importo minimo edittale", data.minimumAmount),
    field("administrativeFees", "Spese amministrative", data.administrativeFees),
    field("deviceName", "Apparecchiatura", data.deviceName),
    field("approvalDecree", "Decreto approvazione", data.approvalDecree),
    field("calibrationCheck", "Taratura/verifica", data.calibrationCheck),
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
    "Autovelox / Eccesso di velocità":
      "Possibile superamento del limite di velocità rilevato direttamente o tramite dispositivo.",
    "Sosta / Rimozione":
      "Possibile violazione relativa alla sosta con richiamo alla rimozione del veicolo.",
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

function buildEventSummary(facts: ExtractedFacts) {
  if (
    facts.violationType === "Autovelox / Eccesso di velocità" &&
    facts.plate &&
    facts.speedDetected !== undefined &&
    facts.speedLimit !== undefined &&
    facts.speedExcess !== undefined
  ) {
    return `Contestazione per eccesso di velocità: veicolo targa ${facts.plate} circolava a ${facts.speedDetected} km/h su limite ${facts.speedLimit} km/h; eccedenza verbalizzata ${facts.speedExcess} km/h dopo tolleranza.`;
  }
  return facts.eventDescription || buildFallbackEventSummary(facts);
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
  const labelledDescription = text
    .match(/descrizione\s*[:\-]\s*([^\n]{20,320})/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  if (labelledDescription) {
    return { value: labelledDescription, confidence: "Alta" as const };
  }

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

function getOutcome(score: number, confidence: number): ScreeningReport["outcome"] {
  if (confidence < 35) return "Medio interesse all’approfondimento";
  if (score >= 70) return "Alto interesse all’approfondimento";
  if (score >= 25) return "Medio interesse all’approfondimento";
  return "Basso interesse all’approfondimento";
}

function calculateInterestSignals(facts: ExtractedFacts) {
  const amount = parseAmountNumber(facts.amount);
  let score = 0;
  if (amount !== undefined && amount > 500) score += 45;
  else if (amount !== undefined && amount >= 150) score += 18;
  else if (amount !== undefined && amount < 100) score -= 8;

  if (facts.suspensionDetected) score += 45;
  if ((facts.licensePoints ?? 0) >= 6) score += 30;
  else if ((facts.licensePoints ?? 0) > 0) score += 18;
  if (
    facts.violationType === "Autovelox / Eccesso di velocità" ||
    facts.violationType === "ZTL / accesso area vietata" ||
    facts.violationType === "semaforo rosso"
  ) {
    score += 15;
  }
  if (facts.deviceName || facts.approvalDecree || facts.calibrationCheck) score += 8;
  if (!facts.notificationDate) score += 8;
  if (facts.violationType === "mancata assicurazione") score += 45;
  return Math.max(0, score);
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
    return "Non emergono criticità formali evidenti dal solo verbale caricato. La valutazione resta preliminare e può dipendere da documentazione non inclusa nel file.";
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
    return "Non emergono criticità formali evidenti dal solo verbale caricato. Tuttavia può essere utile verificare allegati, termini e documentazione disponibile presso l’ente.";
  }
  const relevance = reasons.some((item) => item.relevance === "Alta")
    ? "almeno una segnalazione di rilevanza alta"
    : "segnalazioni di rilevanza media o bassa";
  return `Sono presenti ${relevance}. Si consiglia una verifica professionale prima di valutare un eventuale ricorso. La qualità tecnica dell’estrazione è ${confidence >= 75 ? "buona" : confidence >= 50 ? "parziale" : "limitata"}.`;
}

function buildExtractionLog(
  extractedData: ExtractedDataField[],
): ScreeningReport["extractionLog"] {
  const identified = extractedData
    .filter((field) => field.confidence !== "Non rilevato")
    .map((field) => ({
      field: field.key,
      confidence: field.confidence,
    }));
  const missing = extractedData
    .filter((field) => field.confidence === "Non rilevato")
    .map((field) => ({
      field: field.key,
      confidence: field.confidence,
    }));
  const confidenceByField = Object.fromEntries(
    extractedData.map((field) => [field.key, field.confidence]),
  );

  return { identified, missing, confidenceByField };
}

function buildConsistencyChecks(
  facts: ExtractedFacts,
): ScreeningReport["consistencyChecks"] {
  const checks: ScreeningReport["consistencyChecks"] = [];
  if (
    facts.speedDetected !== undefined &&
    facts.speedLimit !== undefined &&
    facts.speedExcess !== undefined
  ) {
    const arithmeticExcess = facts.speedDetected - facts.speedLimit;
    const status =
      arithmeticExcess === facts.speedExcess ? "Coerente" : "Da verificare";
    checks.push({
      title: "Coerenza velocità e superamento",
      status,
      detail:
        status === "Coerente"
          ? `La velocità rilevata (${facts.speedDetected} km/h) meno il limite (${facts.speedLimit} km/h) coincide con il superamento indicato (${facts.speedExcess} km/h).`
          : `La differenza aritmetica tra velocità rilevata (${facts.speedDetected} km/h) e limite (${facts.speedLimit} km/h) è ${arithmeticExcess} km/h, mentre il verbale indica ${facts.speedExcess} km/h. Verificare la tolleranza applicata e la velocità calcolata in verbalizzazione.`,
    });
  } else {
    checks.push({
      title: "Coerenza velocità e superamento",
      status: "Non verificabile",
      detail:
        "Velocità rilevata, limite o superamento non sono stati individuati con sufficiente certezza.",
    });
  }

  if (facts.article === "142" && facts.violationType === "Autovelox / Eccesso di velocità") {
    checks.push({
      title: "Coerenza norma e classificazione",
      status: "Coerente",
      detail:
        "L'articolo 142 CdS è coerente con una classificazione relativa a velocità/autovelox.",
    });
  } else if (facts.article && facts.violationType !== VIOLATION_NOT_CLASSIFIED) {
    checks.push({
      title: "Coerenza norma e classificazione",
      status: "Da verificare",
      detail:
        "La norma e la classificazione sono state individuate, ma richiedono verifica sul testo integrale del verbale.",
    });
  }

  return checks;
}

function buildPotentialIssues(facts: ExtractedFacts, reasons: RuleResult[]) {
  const issues = reasons.map((item) => `${item.title}: ${item.evidence}`);
  if (facts.deviceType === "Autovelox" || facts.article === "142") {
    issues.push(
      "Non emergono criticità formali evidenti dal solo verbale caricato. Tuttavia, trattandosi di accertamento tramite autovelox, può essere utile verificare la documentazione fotografica, la segnalazione preventiva, la taratura/verifica periodica e gli atti tecnici disponibili presso l’ente.",
    );
    if (facts.deviceName || facts.approvalDecree || facts.calibrationCheck) {
      issues.push(
        `Il verbale indica apparecchiatura ${facts.deviceName ?? "non rilevata"}, richiama decreto di approvazione e controlli periodici. Può essere utile verificare la documentazione tecnica agli atti, la segnalazione preventiva e i fotogrammi.`,
      );
    }
    issues.push(
      "Verifica segnalazione preventiva del dispositivo",
      "Verifica documentazione fotografica",
      "Verifica taratura e verifiche periodiche",
      "Verifica corretta notifica",
      "Verifica documentazione disponibile agli atti",
    );
  }
  if (facts.deviceType === "ZTL") {
    issues.push(
      "Verifica autorizzazione al transito e orari della ZTL",
      "Verifica documentazione fotografica del varco",
      "Verifica segnaletica e informazioni disponibili sul percorso",
    );
  }
  return unique(issues);
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
  const amount = parseAmountNumber(facts.amount);
  const complexCase =
    facts.pointsDetected || facts.suspensionDetected || reasons.length >= 4;

  if (facts.suspensionDetected || (amount !== undefined && amount > 500)) {
    return {
      level: "Alta",
      reason:
        "L’importo elevato o la possibile presenza di conseguenze accessorie può rendere utile una valutazione professionale approfondita.",
      possiblePackage:
        "Pacchetto eventualmente coerente con il caso: Ricorso Premium €149.",
      ctaLabel: "Richiedi Ricorso Premium €149",
      ctaHref: "/prezzi?pacchetto=premium",
    };
  }
  if (
    amount !== undefined &&
    amount < 250 &&
    (facts.pointsDetected ||
      facts.violationType === "Autovelox / Eccesso di velocità" ||
      facts.deviceName)
  ) {
    return {
      level: "Media-bassa",
      reason:
        `L’importo non è elevato, ma la presenza di ${facts.licensePoints ?? ""} punti patente e la natura tecnica dell’accertamento tramite autovelox rendono ragionevole una verifica professionale prima di decidere se procedere con ricorso.`.replace(
          "di  punti",
          "di punti",
        ),
      possiblePackage: "Consulenza Legale €19,90",
      ctaLabel: "Richiedi consulenza legale €19,90",
      ctaHref: "/prezzi?pacchetto=consulenza",
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
      ctaLabel: "Richiedi Ricorso Smart €79",
      ctaHref: "/prezzi?pacchetto=smart",
    };
  }
  if (amount !== undefined) {
    return {
      level: "Bassa",
      reason:
        "L’importo appare contenuto e non sono state rilevate con certezza conseguenze accessorie; può essere prudente verificare il caso prima di predisporre un ricorso.",
      possiblePackage:
        "Pacchetto eventualmente coerente con il caso: Consulenza Legale €19,90.",
      ctaLabel: "Richiedi consulenza legale €19,90",
      ctaHref: "/prezzi?pacchetto=consulenza",
    };
  }
  return {
    level: "Non valutabile",
    reason:
      "L’importo della sanzione non è stato rilevato con sufficiente certezza.",
    possiblePackage:
      "Nessun pacchetto individuabile prima di integrare i dati mancanti.",
    ctaLabel: "Vedi i pacchetti disponibili",
    ctaHref: "/prezzi",
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
  if (
    facts.amount &&
    parseAmountNumber(facts.amount)! <= 250 &&
    (facts.licensePoints || facts.violationType === "Autovelox / Eccesso di velocità")
  ) {
    return `Considerato l’importo non elevato, ma la presenza di ${facts.licensePoints ?? ""} punti patente e la natura tecnica dell’accertamento tramite autovelox, può essere opportuno partire da una consulenza legale prima di valutare un eventuale ricorso.`.replace(
      "di  punti",
      "di punti",
    );
  }
  if (facts.amount && parseAmountNumber(facts.amount)! <= 250) {
    return "Per sanzioni di importo contenuto, può essere opportuno partire da una consulenza legale prima di valutare un ricorso.";
  }
  if (outcome === "Basso interesse all’approfondimento") {
    return "Dal solo documento caricato non emergono criticità evidenti. Una verifica professionale può comunque essere utile in presenza di ulteriori documenti o circostanze.";
  }
  return "L’analisi preliminare ha individuato alcuni elementi che potrebbero meritare verifica professionale.";
}

function buildDeadlines(notificationDate?: Date) {
  const commonCaution =
    "Il calcolo è indicativo e deve essere verificato in base alle modalità di notifica e al caso concreto.";
  if (notificationDate) {
    return [
      {
        label: "Prefetto",
        date: formatDate(addDays(notificationDate, 60)),
        basis: "Scadenza indicativa Prefetto: 60 giorni dalla data di notifica rilevata.",
        caution: commonCaution,
      },
      {
        label: "Giudice di Pace",
        date: formatDate(addDays(notificationDate, 30)),
        basis: "Scadenza indicativa Giudice di Pace: 30 giorni dalla data di notifica rilevata.",
        caution: commonCaution,
      },
    ];
  }

  return [
    {
      label: "Prefetto",
      date: "Generalmente 60 giorni",
      basis:
        "Data di notifica non rilevata nel documento caricato. Per calcolare la scadenza precisa è necessario conoscere la data di notifica o allegare ricevuta, relata o avviso SEND.",
      caution:
        "Prefetto: generalmente 60 giorni dalla contestazione o notificazione.",
    },
    {
      label: "Giudice di Pace",
      date: "Generalmente 30 giorni",
      basis:
        "Allega ricevuta, relata o avviso SEND per consentire il calcolo preciso dei termini.",
      caution:
        "Giudice di Pace: generalmente 30 giorni dalla contestazione o notificazione.",
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
    `Numero registro: ${data.registryNumber}`,
    `Targa: ${data.plate}`,
    `Data violazione: ${data.violationDate}`,
    `Ora violazione: ${data.violationTime}`,
    `Data accertamento: ${data.assessmentDate}`,
    `Ora accertamento: ${data.assessmentTime}`,
    `Data notifica: ${data.notificationDate}`,
    `Importo sanzione: ${data.amount}`,
    `Importo ridotto entro 5 giorni: ${data.reducedAmount}`,
    `Importo minimo edittale: ${data.minimumAmount}`,
    `Spese amministrative: ${data.administrativeFees}`,
    `Norma: ${data.article}`,
    `Comma: ${data.paragraph}`,
    `Velocità rilevata: ${data.speedDetected}`,
    `Limite: ${data.speedLimit}`,
    `Superamento: ${data.speedExcess}`,
    `Punti patente: ${data.licensePoints}`,
    `Apparecchiatura: ${data.deviceName}`,
    `Decreto approvazione: ${data.approvalDecree}`,
    `Taratura/verifica: ${data.calibrationCheck}`,
    `Tipo violazione: ${data.violationType}`,
    `Luogo: ${data.place}`,
  ];
}

function buildDocumentPagePipeline(text: string): DocumentPagePipeline {
  const pages = segmentDocumentPages(text).map((page) => {
    const cleanedText = removeNoiseLines(page.text);
    const classification = classifyPage(cleanedText);
    return {
      pageNumber: page.pageNumber,
      text: cleanedText,
      classification: classification.classification,
      score: classification.score,
      textPreview: cleanedText.slice(0, 500),
    };
  });
  const mainPage =
    pages
      .filter((page) => page.classification === "MAIN_VERBALE")
      .sort((a, b) => b.score - a.score)[0] ??
    pages
      .filter((page) => /VERBALE DI CONTESTAZIONE DI VIOLAZIONE DEL CODICE DELLA STRADA/i.test(page.text))
      .sort((a, b) => b.score - a.score)[0] ??
    null;
  const paymentText = pages
    .filter((page) => page.classification === "PAYMENT_NOTICE")
    .map((page) => page.text)
    .join("\n\n");
  const warningsText = pages
    .filter((page) =>
      ["WARNINGS", "RECOURSE_INFORMATION"].includes(page.classification),
    )
    .map((page) => page.text)
    .join("\n\n");
  const validationWarnings: string[] = [];
  if (!mainPage) {
    validationWarnings.push("MAIN_VERBALE non individuata: estrazione eseguita sul testo completo pulito.");
  }

  return {
    pages: pages.map(({ pageNumber, classification, score, textPreview }) => ({
      pageNumber,
      classification,
      score,
      textPreview,
    })),
    mainVerbaleText: mainPage?.text ?? removeNoiseLines(text),
    paymentText,
    warningsText,
    selectedMainVerbalePage: mainPage?.pageNumber ?? null,
    validationWarnings,
  };
}

function segmentDocumentPages(text: string) {
  const markerPattern = /^--\s*(\d+)\s+of\s+\d+\s*--$/gim;
  const markers = [...text.matchAll(markerPattern)];
  if (markers.length === 0) {
    return [{ pageNumber: 1, text }];
  }

  return markers.map((marker, index) => {
    const start = marker.index ?? 0;
    const end = markers[index + 1]?.index ?? text.length;
    return {
      pageNumber: Number(marker[1]),
      text: text.slice(start, end),
    };
  });
}

function classifyPage(text: string): Pick<
  ClassifiedDocumentPage,
  "classification" | "score"
> {
  const normalizedPage = normalize(text);
  const scores = {
    MAIN_VERBALE: scoreMatches(normalizedPage, [
      /verbale di contestazione di violazione del codice della strada/,
      /verbale d['’]?accertamento d['’]?infrazione/,
      /al codice della strada/,
      /n registro/,
      /n verbale|numero verbale/,
      /ha violato il seguente articolo/,
      /\bart\b/,
      /velocita rilevata|targa|riferimento accertamento/,
    ]),
    PAYMENT_NOTICE: scoreMatches(normalizedPage, [
      /avviso di pagamento/,
      /pagopa/,
      /codice avviso/,
      /cbill/,
      /\beuro\b/,
      /entro 5 giorni/,
      /dal 6 al 60 giorno/,
    ]),
    DRIVER_DATA_FORM: scoreMatches(normalizedPage, [
      /modulo di comunicazione dati del conducente/,
      /comunicazione dati del conducente/,
      /ipotesi a/,
      /ipotesi b/,
      /patente di guida/,
      /firma del conducente/,
    ]),
    RECOURSE_INFORMATION: scoreMatches(normalizedPage, [
      /\bavvertenze\b/,
      /\bricorso\b/,
      /giudice di pace/,
      /prefetto/,
      /modalita di estinzione/,
    ]),
    DRIVER_COMMUNICATION_FORM: 0,
    WARNINGS: 0,
    NOISE_OR_COVER: scoreMatches(normalizedPage, [
      /1234567890qwerty/,
      /qwertyuiopasdfghjklzxcv/,
    ]),
  };
  if (scores.MAIN_VERBALE >= 3) {
    return { classification: "MAIN_VERBALE", score: scores.MAIN_VERBALE };
  }
  if (scores.DRIVER_DATA_FORM >= 3) {
    return {
      classification: "DRIVER_DATA_FORM",
      score: scores.DRIVER_DATA_FORM,
    };
  }
  if (scores.RECOURSE_INFORMATION >= 3) {
    return {
      classification: "RECOURSE_INFORMATION",
      score: scores.RECOURSE_INFORMATION,
    };
  }
  if (scores.PAYMENT_NOTICE >= 2) {
    return { classification: "PAYMENT_NOTICE", score: scores.PAYMENT_NOTICE };
  }
  if (scores.NOISE_OR_COVER > 0) {
    return {
      classification: "NOISE_OR_COVER",
      score: scores.NOISE_OR_COVER,
    };
  }
  const [classification, score] = Object.entries(scores).sort(
    ([, firstScore], [, secondScore]) => secondScore - firstScore,
  )[0] as [ClassifiedDocumentPage["classification"], number];

  return {
    classification: score > 0 ? classification : "NOISE_OR_COVER",
    score,
  };
}

function scoreMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function buildExtractionDebug(
  pipeline: DocumentPagePipeline,
  validationWarnings: string[],
): ScreeningReport["extractionDebug"] {
  if (process.env.NODE_ENV === "production") {
    return {
      pages: [],
      selectedMainVerbalePage: null,
      validationWarnings: [],
    };
  }

  return {
    pages: pipeline.pages,
    selectedMainVerbalePage: pipeline.selectedMainVerbalePage,
    validationWarnings,
  };
}

function removeNoiseLines(text: string) {
  return text
    .split(/\n/)
    .filter((line) => {
      const compact = line.replace(/\s+/g, "");
      if (!compact) return true;
      return !/qwertyuiopasdfghjklzxcv/i.test(line);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractContestedArticle(text: string) {
  const longReceiptArticles = extractLongReceiptArticles(text);
  if (longReceiptArticles.article) {
    return longReceiptArticles;
  }

  const targetedLine =
    text.match(
      /ha\s+violato\s+il\s+seguente\s+articolo:\s*(Art\.?\s*\d{1,3}(?:[-\s]?(?:bis|ter|quater))?[\s\S]{0,180})/i,
    )?.[1] ??
    text.match(
      /\bArt\.?\s*\d{1,3}(?:[-\s]?(?:bis|ter|quater))?\s*comma\s+[0-9]+(?:[-\s]?(?:bis|ter|quater))?[^\n]{0,160}/i,
    )?.[0] ??
    text
      .split(/\n/)
      .find((line) => /\bArt(?:icolo)?\.?\s*\d{1,3}/i.test(line) && /comma|Codice\s+della\s+Strada|C\.?d\.?S\.?/i.test(line));
  const fallbackLine = text.match(
    /\bArt(?:icolo)?\.?\s*\d{1,3}(?:[-\s]?(?:bis|ter|quater))?(?:\s*\/\s*[0-9]+(?:[-\s]?(?:bis|ter|quater))?)?[^\n]{0,120}(?:Codice\s+della\s+Strada|C\.?d\.?S\.?)/i,
  )?.[0];
  const line = targetedLine ?? fallbackLine;
  const article = line
    ?.match(/Art(?:icolo)?\.?\s*(\d{1,3}(?:[-\s]?(?:bis|ter|quater))?)/i)?.[1]
    ?.replace(/\s+/g, "-");
  const paragraph = line
    ?.match(/(?:comma|co\.?|\d{1,3}(?:[-\s]?(?:bis|ter|quater))?\s*\/)\s*([0-9]+(?:[-\s]?(?:bis|ter|quater))?)/i)?.[1]
    ?.replace(/\s+/g, "-");

  return { article, paragraph };
}

function extractLongReceiptArticles(text: string) {
  const articles = new Set<string>();
  if (/tariffe\s+orarie|no\s+pagamento|codice\s+di\s+infrazione:\s*0{0,2}791/i.test(text)) {
    articles.add("7");
  }
  if (/\bART[,.]?\s*158\b|codice\s+di\s+infrazione:\s*15833|rimozione\s+de[il]\s+veicolo/i.test(text)) {
    articles.add("158");
  }

  if (articles.size === 0) {
    return {};
  }

  return {
    article: [...articles].sort((left, right) => Number(left) - Number(right)).join("/"),
    paragraph: undefined,
  };
}

function findLongReceiptDate(text: string) {
  const date = text.match(/\bData\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)?.[1];
  return date ? parseItalianDate(date) : undefined;
}

function findLongReceiptTime(text: string) {
  const explicit = text.match(/\bOra\s*[:\-]?\s*([0-2]?\d[:.][0-5]\d)/i)?.[1];
  if (explicit) return explicit.replace(".", ":").padStart(5, "0");

  const nearDate = text.match(/\bData\s*[:\-]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}[\s\S]{0,80}?([0-2]?\d[:.][0-5]\d)/i)?.[1];
  if (!nearDate) return undefined;
  const normalized = nearDate.replace(".", ":");
  return normalized.length === 4 ? `1${normalized}` : normalized;
}

function findContextDate(text: string, contextPattern: RegExp) {
  for (const line of text.split(/\n/)) {
    if (!contextPattern.test(line)) continue;
    const date = line.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0];
    if (date) return parseItalianDate(date);
  }
  return undefined;
}

function findAssessmentMoment(text: string) {
  const match = text.match(
    /\bIn\s+data\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+alle\s+ore\s+([0-2]?\d[:.][0-5]\d)[\s\S]{0,220}?\bha\s+accertato\b/i,
  );
  return {
    date: match?.[1] ? parseItalianDate(match[1]) : undefined,
    time: match?.[2]?.replace(".", ":"),
  };
}

function findViolationMoment(text: string) {
  const match =
    text.match(
      /che\s+in\s+data\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+alle\s+ore\s+([0-2]?\d[:.][0-5]\d)/i,
    ) ??
    [...text.matchAll(/in\s+data\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+alle\s+ore\s+([0-2]?\d[:.][0-5]\d)/gi)][1];
  return {
    date: match?.[1] ? parseItalianDate(match[1]) : undefined,
    time: match?.[2]?.replace(".", ":"),
  };
}

function findAssessmentDate(text: string) {
  const date = text.match(
    /\bIn\s+data\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})[\s\S]{0,180}?\bha\s+accertato\b/i,
  )?.[1];
  return date ? parseItalianDate(date) : undefined;
}

function findContextTime(text: string, contextPattern: RegExp) {
  for (const line of text.split(/\n/)) {
    if (!contextPattern.test(line)) continue;
    const time = line.match(/\b(?:ore\s*)?([01]?\d|2[0-3])[:.][0-5]\d\b/i)?.[0];
    if (time) return time.replace(/^ore\s*/i, "");
  }
  return undefined;
}

function extractPlate(text: string) {
  const contextual =
    text.match(/targa\s*[:\-]?\s*([A-Z0-9)\]\s]{6,10})/i)?.[1] ??
    text.match(/veicolo\s+targato\s+([A-Z0-9)\]\s]{6,10})/i)?.[1];
  const normalizedContextual = normalizePlate(contextual);
  if (normalizedContextual) return normalizedContextual;

  return normalizePlate(
    text
      .toUpperCase()
      .match(/\b[A-Z]{2}\s?\d{3}\s?[A-Z0-9)\]]{2,3}\b/)?.[0],
  );
}

function normalizePlate(value?: string) {
  if (!value) return undefined;
  const compact = value
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[)\]]/g, "J")
    .replace(/[^A-Z0-9]/g, "");

  const standard = compact.match(/[A-Z]{2}\d{3}[A-Z]{2}/)?.[0];
  if (standard) return standard;

  const finalSeven = compact.match(/([A-Z]{2}\d{3}[A-Z])7\b/)?.slice(1);
  if (finalSeven) return `${finalSeven[0]}Z`;

  const extraDigit = compact.match(/([A-Z]{2}\d{3})\d([A-Z]{2})/)?.slice(1);
  if (extraDigit) return `${extraDigit[0]}${extraDigit[1]}`;

  return undefined;
}

function normalizeReportNumber(value?: string) {
  const cleaned = value
    ?.replace(/\s*-\s*Pag\.?\s*\d+\s*\/\s*\d+.*$/i, "")
    .replace(/^o(?=\d)/i, "0")
    .trim();
  return cleaned || undefined;
}

function extractReportNumber(text: string) {
  const candidates = [
    ...[...text.matchAll(/\bNum\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 ./\t-]{2,40})/gi)].map(
      (match) => match[1],
    ),
    text.match(/N\.?\s*verbale\s+([A-Z0-9][A-Z0-9 ./\t-]{2,40})/i)?.[1],
    text.match(
      /(?:verbale|accertamento)\s*(?:n(?:umero)?\.?|nr\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9 ./\t-]{2,40})/i,
    )?.[1],
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeReportNumber(cleanExtractedValue(value)?.replace(/\s*\/\s*/g, "/")))
    .filter((value): value is string => Boolean(value));

  return (
    candidates.find((candidate) => /\d{4,}\s*-\s*\d{1,4}/.test(candidate)) ??
    candidates.find((candidate) => /\d/.test(candidate))
  );
}

function findTimeNearDate(text: string, date?: Date) {
  if (!date) return undefined;
  const dateText = [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
  const compactDateText = dateText.replace(/^0(\d)\//, "$1/").replace(/\/0(\d)\//, "/$1/");
  const escapedDates = [dateText, compactDateText]
    .map(escapeRegExp)
    .join("|");
  return text
    .match(new RegExp(`(?:${escapedDates})[^\\n]{0,80}?(?:alle\\s+ore|ore)\\s*([0-2]?\\d[:.][0-5]\\d)`, "i"))?.[1]
    ?.replace(".", ":");
}

function matchNumber(text: string, pattern: RegExp) {
  const value = text.match(pattern)?.[1];
  return value ? Number(value) : undefined;
}

function findPaymentAmount(text: string, type: "reduced" | "standard") {
  if (!text) return undefined;
  const pattern =
    type === "reduced"
      ? /(?:entro\s+(?:cinque|5)\s+giorni|ridott[oa]\s+del\s+30%)[\s\S]{0,260}?(?:totale\s+di\s+Euro|Euro)\s+(\d{1,5}(?:[.,]\d{2})?)/i
      : /(?:(?:entro|in)\s+60\s+giorni|dal\s+6[°º]?\s+al\s+60[°º]?\s+giorno|misura\s+ridotta)[\s\S]{0,260}?(?:totale\s+di\s+Euro|Euro)\s+(\d{1,5}(?:[.,]\d{2})?)/i;
  return rejectInvalidAmount(matchAmount(text, pattern));
}

function rejectInvalidAmount(amount?: string) {
  if (!amount) return undefined;
  const numeric = Number(amount.replace(".", "").replace(",", "."));
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric <= 0 || numeric > 10_000) return undefined;
  if (/^(?:00192|3019|9250|0008)/.test(amount.replace(/[,.]/g, ""))) {
    return undefined;
  }
  return amount;
}

function extractMunicipality(text: string) {
  return (
    cleanExtractedValue(
      text.match(/^COMUNE\s+DI\s+([A-ZÀ-Ýa-zà-ÿ' -]{2,60})$/im)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/nel\s+Comune\s+di\s+([A-ZÀ-Ýa-zà-ÿ' -]{2,60}),/i)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/del\s+comune\s+di\s+([A-ZÀ-Ýa-zà-ÿ' -]{2,60})[,.\n]/i)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/polizia\s+(?:locale|municipale)\s+di\s+([^\n,;–-]{2,60})/i)?.[1],
    ) ??
    cleanExtractedValue(
      text.match(/(?:(?:comune|conune)\s+di|citt[aà]\s+di)\s+([^\n,;–-]{2,60})/i)?.[1],
    )
  );
}

function validateExtractedFacts(facts: ExtractedFacts) {
  const warnings: string[] = [];
  if (
    facts.violationType === "Autovelox / Eccesso di velocità" &&
    facts.article &&
    facts.article !== "142"
  ) {
    warnings.push("Classificazione autovelox incoerente con articolo diverso da 142.");
  }
  if (facts.place && /riportate nel|il conducente|ha violato/i.test(facts.place)) {
    warnings.push("Luogo estratto contiene parole generiche: verificare riestrazione.");
  }
  if (facts.amount && !rejectInvalidAmount(facts.amount)) {
    warnings.push("Importo sospetto: possibile codice pagoPA o codice fiscale.");
  }
  return warnings;
}

function extractApprovalDecree(text: string) {
  const match = text.match(
    /approvato\s+con\s+Decreto\s+Ministero\s+delle\s+Infrastrutture\s+e\s+dei\s+Trasporti\s+con\s+prot\.\s+n\.?\s*(\d+)\s+del\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  );
  if (!match) return undefined;
  return `Ministero Infrastrutture e Trasporti prot. n. ${match[1]} del ${match[2]}`;
}

function extractCalibrationCheck(text: string) {
  if (
    /controllo\s+di\s+taratura\s+metrologica[\s\S]{0,180}verifica\s+di\s+funzionalit[aà][\s\S]{0,80}cadenza\s+annuale/i.test(
      text,
    )
  ) {
    return "Presente riferimento a controllo metrologico e verifica annuale";
  }
  if (/taratura|verifica\s+di\s+funzionalit[aà]/i.test(text)) {
    return "Presente riferimento a taratura o verifica tecnica";
  }
  return undefined;
}

function extractAuthority(text: string, municipality?: string) {
  if (/comune\s+di\s+rovigo[\s\S]{0,80}polizia\s+locale/i.test(text)) {
    return "Comune di Rovigo - Polizia Locale";
  }
  if (
    /(?:comune|conune)\s+di\s+bologna/i.test(text) &&
    /verbale|accertatore|codice\s+della\s+strada|violazioni?\s+del\s+c\.?d\.?s/i.test(
      text,
    )
  ) {
    return "Comune di Bologna - Polizia Locale";
  }
  const police = cleanExtractedValue(
    text.match(
      /(?:corpo\s+di\s+)?(?:polizia\s+locale|polizia\s+municipale|polizia\s+stradale|carabinieri|guardia\s+di\s+finanza)[^\n,;]{0,80}/i,
    )?.[0],
  );
  const municipalityAuthority = cleanExtractedValue(
    text.match(/(?:comune|conune)\s+di\s+([^\n,;]{2,60})/i)?.[0],
  )?.replace(/^conune/i, "Comune");
  if (municipalityAuthority && /polizia\s+locale/i.test(text)) {
    return normalizeAuthority(`${municipalityAuthority} - Polizia Locale`);
  }
  if (municipality && /polizia\s+locale/i.test(text)) {
    return normalizeAuthority(`Comune di ${municipality} - Polizia Locale`);
  }
  if (police && municipality && !new RegExp(municipality, "i").test(police)) {
    return normalizeAuthority(`${municipality} - ${police}`);
  }
  return police
    ? normalizeAuthority(police)
    : municipalityAuthority
      ? normalizeAuthority(municipalityAuthority)
      : undefined;
}

function normalizeAuthority(value: string) {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\bComune\s+Di\b/gi, "Comune di")
    .replace(/\bConune\s+di\b/gi, "Comune di")
    .replace(/\s*-\s*/g, " - ")
    .trim();
  const parts = normalized
    .split(/\s+-\s+/)
    .map((part) => toTitleCase(part).replace(/\bDi\b/g, "di"))
    .filter(Boolean);
  const uniqueParts = parts.filter(
    (part, index) =>
      parts.findIndex(
        (candidate) => normalize(candidate) === normalize(part),
      ) === index,
  );

  if (
    uniqueParts.some((part) => /polizia locale/i.test(part)) &&
    uniqueParts.length > 1
  ) {
    return [
      uniqueParts.find((part) => /comune di/i.test(part)) ?? uniqueParts[0],
      "Polizia Locale",
    ].join(" - ");
  }

  return uniqueParts.join(" - ");
}

function extractNarrativePlace(text: string) {
  const match = text.match(
    /alle\s+ore\s+[0-2]?\d[:.][0-5]\d\s+in\s+(.{8,180}?)\s+del\s+comune\s+di\s+([A-ZÀ-Ýa-zà-ÿ' -]{2,60})[,.\n]/i,
  );
  if (!match) return undefined;
  const street = match[1]
    .replace(/\s+/g, " ")
    .replace(/\bcivico\/km\.\s*/i, "")
    .replace(/\bkm\.\s*/i, "km ")
    .trim();
  return `${toTitleCase(street)}, ${toTitleCase(match[2].trim())}`;
}

function extractLongReceiptPlace(text: string) {
  if (
    /via\s+p?[de][il]|via\s+del/i.test(text) &&
    /(?:borgo|0rgo|orogo|borqo|rg0|\bgo\s+di\b)/i.test(text) &&
    /(?:pietro|pregno|p1etro|pietr0|pietao|pletao)/i.test(text)
  ) {
    return "Via del Borgo di S. Pietro";
  }

  const direct = text.match(
    /\bIn\s*[:\-]\s*(.{8,120}?)\s+Civico\b/i,
  )?.[1];
  if (direct) return cleanPlace(direct);

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

function findContextualMoneyAmount(text: string, contextPattern: RegExp) {
  const match = contextPattern.exec(text);
  if (!match || match.index === undefined) return undefined;

  const context = text.slice(match.index, match.index + 420);
  const moneyMatch =
    context.match(/(?:€|Euro)\s*(\d{1,5}(?:\s*[.,]\s*\d{2})?)/i) ??
    context.match(/(\d{1,5}(?:\s*[.,]\s*\d{2})?)\s*(?:€|Euro)/i);

  return rejectInvalidAmount(normalizeAmount(moneyMatch?.[1]));
}

function normalizeAmount(value?: string) {
  if (!value) return undefined;
  const compactValue = value.replace(/\s*([.,])\s*/g, "$1");
  const match = compactValue.match(/\d{1,5}(?:[.,]\d{1,2})?/);
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

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (letter) => letter.toUpperCase())
    .replace(/\b(?:CdS|Cds)\b/g, "CdS")
    .replace(/\bSr(\d+)/g, "SR$1")
    .replace(/\bKm\b/g, "km")
    .replace(/\bG\.\b/g, "G.");
}

function cleanPlace(value?: string) {
  return cleanExtractedValue(
    value?.replace(
      /^(?:luogo(?:\s+(?:della\s+)?violazione)?|in\s+localit[aà])\s*[:\-]?\s*/i,
      "",
    )?.replace(
      /^dell['’]infrazione\s*[:\-]?\s*/i,
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

function parseAmountNumber(amount?: string) {
  if (!amount) return undefined;
  const value = Number(amount.replace(".", "").replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
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
