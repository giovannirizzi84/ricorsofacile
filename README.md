# MulteOnline

Web app Next.js per lo screening preliminare automatizzato di verbali stradali.
Il sistema funziona gratuitamente senza OpenAI e senza credito API.

## Pipeline di analisi

1. L’utente carica PDF, JPG o PNG.
2. I PDF vengono letti prima come testo nativo.
3. I PDF scannerizzati vengono convertiti in immagini e passati a Tesseract.js.
4. Le immagini vengono analizzate con OCR italiano locale.
5. Il motore TypeScript applica regole preliminari e calcola score/confidenza.
6. Se Ollama è disponibile, `qwen3:8b` migliora soltanto la sintesi narrativa.
7. Se Ollama non risponde, il report viene comunque generato dalle regole.

Il report include fatti estratti, motivi rilevati, criticità, dati mancanti,
termini indicativi, percorso da approfondire e costi vivi orientativi.

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Non sono necessarie chiavi API.

## Ollama opzionale

Ollama non è obbligatorio. Per abilitarlo su macOS:

```bash
brew install ollama
ollama pull qwen3:8b
ollama serve
```

Configurazione facoltativa in `.env.local`:

```env
OLLAMA_ENABLED=true
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=qwen3:8b
```

Per usare esclusivamente OCR e regole:

```env
OLLAMA_ENABLED=false
```

## Moduli principali

- `src/lib/documents/extractText.ts`: testo PDF e OCR Tesseract.
- `src/lib/rules/fineAnalysisRules.ts`: estrazione dati, regole e scoring.
- `src/lib/ai/ollamaClient.ts`: arricchimento narrativo locale opzionale.
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

Lo score è indicativo:

- `0-39`: ricorso debole;
- `40-69`: ricorso da approfondire;
- `70-100`: ricorso potenzialmente fondato.

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
