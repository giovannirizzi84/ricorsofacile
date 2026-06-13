export type ServicePackage = {
  name: string;
  price: string;
  audience?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  badge?: string;
  primaryEntry?: boolean;
  featured?: boolean;
  exclusion?: string;
  idealFor?: string[];
};

export const packages: ServicePackage[] = [
  {
    name: "Screening AI",
    price: "€0,99",
    description:
      "Per capire rapidamente se la tua multa presenta elementi da approfondire.",
    features: [
      "Analisi preliminare automatizzata",
      "Sintesi del verbale",
      "Possibili criticità rilevate",
      "Termini per il ricorso",
      "Report sintetico PDF",
    ],
    cta: "Analizza la tua multa",
    href: "/analizza",
    badge: "Inizia da qui",
    primaryEntry: true,
  },
  {
    name: "Consulenza Legale",
    price: "€19,90",
    audience: "Per sanzioni fino a €250",
    description:
      "Per chi ha ricevuto una sanzione di importo contenuto e vuole una verifica professionale prima di decidere se procedere.",
    features: [
      "Revisione del verbale da parte del team legale",
      "Verifica dell’analisi AI",
      "Valutazione della convenienza economica",
      "Indicazione del percorso più opportuno",
      "Risposta sintetica professionale",
    ],
    exclusion: "Non include la redazione del ricorso.",
    cta: "Richiedi consulenza legale",
    href: "/consulenza",
  },
  {
    name: "Ricorso Smart",
    price: "€79",
    audience: "Per sanzioni da €250 a €500",
    description:
      "Per sanzioni di importo medio e casi standard in cui il team legale ritenga opportuno procedere con un ricorso.",
    features: [
      "Analisi professionale del verbale",
      "Valutazione della strategia più opportuna",
      "Scelta tra Prefetto e Giudice di Pace caso per caso",
      "Predisposizione del ricorso",
      "Modello pronto alla firma",
      "Istruzioni operative di deposito o invio",
      "Assistenza via email",
    ],
    cta: "Richiedi Ricorso Smart",
    href: "/consulenza",
    featured: true,
    badge: "Consigliato",
  },
  {
    name: "Ricorso Premium",
    price: "€149",
    audience: "Per sanzioni superiori a €500 o casi complessi",
    description:
      "Per pratiche più delicate, sanzioni elevate o casi con conseguenze ulteriori.",
    idealFor: [
      "Sanzioni superiori a €500",
      "Sospensione patente",
      "Decurtazione punti significativa",
      "Recidiva",
      "Documentazione articolata",
      "Contestazioni più complesse",
    ],
    features: [
      "Analisi professionale approfondita",
      "Valutazione strategica del caso",
      "Gestione documentale avanzata",
      "Predisposizione del ricorso",
      "Supporto procedurale dedicato",
      "Monitoraggio della pratica",
      "Aggiornamenti sullo stato della pratica",
    ],
    cta: "Richiedi Ricorso Premium",
    href: "/consulenza",
  },
];

export const faqs = [
  {
    q: "Lo Screening AI garantisce l’annullamento della multa?",
    a: "No. Lo Screening AI individua esclusivamente elementi che potrebbero meritare approfondimento. Non garantisce l’annullamento della sanzione.",
  },
  {
    q: "Lo Screening AI sostituisce il parere di un avvocato?",
    a: "No. Lo Screening AI è uno strumento informativo preliminare. Le richieste di consulenza o ricorso vengono valutate dal nostro team legale.",
  },
  {
    q: "Chi esamina la mia pratica se richiedo consulenza o ricorso?",
    a: "La pratica viene esaminata dal nostro team legale, che valuta la documentazione e individua il percorso più opportuno.",
  },
  {
    q: "Devo scegliere io tra ricorso al Prefetto e ricorso al Giudice di Pace?",
    a: "No. Se richiedi assistenza professionale, il team legale valuterà caso per caso quale percorso sia più appropriato tra Prefetto e Giudice di Pace.",
  },
  {
    q: "Qual è la differenza tra Prefetto e Giudice di Pace?",
    a: "Sono due diversi strumenti previsti dalla legge per contestare una sanzione. La scelta dipende da vari elementi, tra cui tipo di violazione, importo, documentazione disponibile, termini e obiettivi del caso concreto.",
  },
  {
    q: "Il prezzo include tutti i costi del ricorso?",
    a: "No. I prezzi indicati riguardano esclusivamente i servizi offerti da MulteOnline. Eventuali contributi, marche, diritti, spese di notifica, contributo unificato o altri costi esterni restano a carico del cliente.",
  },
  {
    q: "Quale pacchetto devo scegliere?",
    a: "In generale, per sanzioni fino a €250 può essere sufficiente una Consulenza Legale. Per sanzioni tra €250 e €500 può essere indicato il Ricorso Smart. Per sanzioni superiori a €500 o casi complessi può essere più adatto il Ricorso Premium. In ogni caso, puoi iniziare dallo Screening AI a €0,99.",
  },
];
