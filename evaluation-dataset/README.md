# MulteOnline Real Evaluation Dataset

Questa cartella contiene casi reali o semi-reali usati per misurare l'accuratezza
della pipeline di analisi.

Struttura:

```text
evaluation-dataset/
  autovelox/
    nome-caso/
      document.pdf
      expected.json
  ztl/
  sosta/
  misto/
```

In alternativa, per evitare di committare documenti personali, `expected.json`
puo indicare file locali tramite `sourceFiles`.

Esempio:

```json
{
  "sourceFiles": ["/percorso/locale/image-1.jpg"],
  "fields": {
    "noticeNumber": "862906/T",
    "plate": "X6SCPX",
    "violationDate": "18/10/2023",
    "amountReduced": "42,40",
    "amountOrdinary": "55,00",
    "articleCode": { "value": "7", "readable": false },
    "classification": { "value": "Sosta / divieto di sosta", "readable": false }
  }
}
```

Se un campo non e leggibile nelle immagini disponibili, impostare
`"readable": false`: il benchmark lo conteggia nella copertura totale, ma non
penalizza l'accuracy dei campi leggibili.

Comando:

```bash
npm run benchmark:dataset
```

Output:

- `evaluation-results/benchmark-report.json`
- `evaluation-results/benchmark-report.md`
