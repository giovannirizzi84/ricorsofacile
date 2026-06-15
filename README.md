# MulteOnline

Web app Next.js per lo screening preliminare automatizzato di verbali stradali.
Il sistema usa Gemini come provider AI principale e continua a funzionare con
OCR e regole anche senza una chiave API.

## Pipeline di analisi

1. L’utente carica PDF, JPG o PNG.
2. I PDF vengono letti prima come testo nativo.
3. I PDF scannerizzati vengono convertiti in immagini e passati a Tesseract.js.
4. Le immagini vengono analizzate con OCR italiano locale.
5. Il motore TypeScript applica regole preliminari e calcola score/confidenza.
6. Gemini riceve testo estratto, dati delle regole e uno schema JSON vincolante.
7. Se Gemini non risponde, il report viene comunque generato dalle regole.

Il report include fatti estratti, motivi rilevati, criticità, dati mancanti,
termini indicativi, percorso da approfondire e costi vivi orientativi.

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Senza chiave Gemini il sito usa automaticamente OCR e motore di regole.

## Gemini

1. Apri [Google AI Studio](https://aistudio.google.com/apikey).
2. Accedi con un account Google e crea o seleziona un progetto.
3. Fai clic su **Create API key** e copia la chiave.
4. Crea `.env.local` nella root del progetto:

```env
GEMINI_API_KEY=la_tua_chiave
GEMINI_MODEL=gemini-2.5-flash-lite
```

`gemini-2.5-flash-lite` è il modello stabile predefinito per contenere costi e
latenza. La disponibilità e i limiti del free tier dipendono dalle condizioni
Google vigenti.

La chiave resta esclusivamente sul server e non viene inviata al browser.
Quando Gemini è attivo, il testo estratto dal verbale viene trasmesso alle API
Google. Prima dell’uso commerciale devono essere completate informativa,
accordi e valutazioni privacy applicabili.

## Configurazione Vercel

1. Apri il progetto MulteOnline nella dashboard Vercel.
2. Vai in **Settings → Environment Variables**.
3. Aggiungi `GEMINI_API_KEY` come variabile sensibile per Production, Preview e
   Development.
4. Aggiungi `GEMINI_MODEL` con valore `gemini-2.5-flash-lite`.
5. Esegui un nuovo deployment affinché le variabili siano disponibili.

Non configurare variabili `NEXT_PUBLIC_` per la chiave: la esporrebbero al
browser.

## Moduli principali

- `src/lib/documents/extractText.ts`: testo PDF e OCR Tesseract.
- `src/lib/rules/fineAnalysisRules.ts`: estrazione dati, regole e scoring.
- `src/lib/ai/geminiClient.ts`: analisi Gemini strutturata e fallback.
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
