# MulteOnline

Web app Next.js per lo screening preliminare automatizzato di verbali stradali.
Il sistema usa GPT-4o Vision come provider AI principale per i documenti
caricati e mantiene Gemini, parser, regole e fallback controllati.

## Pipeline di analisi

1. L’utente carica PDF, JPG, PNG o WEBP.
2. I documenti vengono preparati per GPT-4o Vision.
3. I PDF testuali possono fornire testo nativo come supporto al parser.
4. Le immagini e i PDF scannerizzati vengono analizzati con GPT-4o Vision.
5. Il JSON strutturato passa al motore TypeScript di regole.
6. Se OpenAI non risponde, Gemini può essere usato come fallback controllato.
7. Se anche il fallback non risponde in produzione, il sistema restituisce un
   report prudente senza avviare Tesseract server-side.
8. In locale/dev/test l’OCR può essere usato come fallback controllato.

Il report include fatti estratti, motivi rilevati, criticità, dati mancanti,
termini indicativi, percorso da approfondire e costi vivi orientativi.

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Senza chiave OpenAI il sito può usare Gemini come fallback se configurato; se
nessun provider risponde, restituisce una risposta controllata quando il
documento non può essere analizzato con sufficiente affidabilità.

## OpenAI GPT-4o

1. Apri [OpenAI Platform](https://platform.openai.com/api-keys).
2. Crea una API key e copiala in `.env.local`.
3. Configura:

```env
OPENAI_API_KEY=la_tua_chiave_openai
OPENAI_MODEL=gpt-4o
```

La chiave resta esclusivamente sul server e non viene inviata al browser.
GPT-4o Vision è il provider principale usato dalla route `/api/analyze`.

## Gemini Fallback

1. Apri [Google AI Studio](https://aistudio.google.com/apikey).
2. Accedi con un account Google e crea o seleziona un progetto.
3. Fai clic su **Create API key** e copia la chiave.
4. Aggiungi a `.env.local`:

```env
GEMINI_API_KEY=la_tua_chiave
GEMINI_MODEL=gemini-2.5-flash
```

`gemini-2.5-flash` è il modello stabile predefinito e disponibile nel free
tier. La disponibilità e i limiti dipendono dalle condizioni Google vigenti.

La chiave resta esclusivamente sul server e non viene inviata al browser.
Quando Gemini viene usato come fallback, i documenti vengono trasmessi alle API
Google. Prima dell’uso commerciale devono essere completate informativa,
accordi e valutazioni privacy applicabili per tutti i provider configurati.

## Configurazione Vercel

1. Apri il progetto MulteOnline nella dashboard Vercel.
2. Vai in **Settings → Environment Variables**.
3. Aggiungi `OPENAI_API_KEY` come variabile sensibile per Production, Preview e
   Development.
4. Aggiungi `OPENAI_MODEL` con valore `gpt-4o`.
5. Facoltativo: aggiungi `GEMINI_API_KEY` e `GEMINI_MODEL` per il fallback.
6. Esegui un nuovo deployment affinché le variabili siano disponibili.

Non configurare variabili `NEXT_PUBLIC_` per la chiave: la esporrebbero al
browser.

## Benchmark Provider

I benchmark restano disponibili per misurare l’accuratezza dei provider sul
dataset reale e confrontare GPT-4o con Gemini.

Comandi:

```bash
npm run benchmark:gpt4o
npm run benchmark:compare
```

Output:

- `evaluation-results/gpt4o-benchmark-report.json`
- `evaluation-results/gpt4o-benchmark-report.md`
- `evaluation-results/provider-comparison-report.json`
- `evaluation-results/provider-comparison-report.md`

Il benchmark GPT-4o usa uno schema JSON compatto con questi campi:
`authority`, `municipality`, `noticeNumber`, `plate`, `violationDate`,
`amountReduced`, `amountOrdinary`, `articleCode`, `classification`.
I campi non leggibili devono restare `null`.

## Moduli principali

- `src/lib/documents/extractText.ts`: testo PDF e OCR Tesseract.
- `src/lib/rules/fineAnalysisRules.ts`: estrazione dati, regole e scoring.
- `src/lib/ai/openaiClient.ts`: provider GPT-4o Vision principale.
- `src/lib/ai/geminiClient.ts`: fallback Gemini strutturato.
- `src/app/api/analyze/route.ts`: validazione upload e orchestrazione.

## Regole MVP

Il motore considera, tra gli altri:

- possibile notifica oltre 90 giorni;
- riferimenti ad autovelox, tutor e ZTL;
- omologazione o approvazione del dispositivo;
- luogo, targa, ente, articolo e importo;
- modalità e autorità per il ricorso;
- motivazione della mancata contestazione immediata;
- qualità e completezza della documentazione.

Il motore usa internamente un indicatore tecnico per ordinare le segnalazioni,
ma il report mostra esclusivamente esiti prudenti:

- `Nessuna criticità evidente`;
- `Verifica consigliata`;
- `Elementi da approfondire`;
- `Documentazione insufficiente`.

L’indicatore non rappresenta una probabilità di successo del ricorso.

Una confidenza documentale molto bassa forza l’esito
`Documentazione insufficiente`.

## Limiti

- massimo 5 documenti;
- massimo 10 MB per file e 30 MB complessivi;
- OCR dei PDF scannerizzati limitato alle prime 5 pagine;
- nessuna archiviazione persistente;
- nessuna banca dati giurisprudenziale aggiornata;
- le regole non sostituiscono la valutazione del caso concreto.

> Questa analisi è uno screening preliminare automatizzato e non costituisce
> parere legale, consulenza professionale o garanzia di accoglimento del
> ricorso.
