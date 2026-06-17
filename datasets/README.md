# Dataset di validazione MulteOnline

Questa cartella contiene i verbali reali usati per misurare l'accuratezza del motore di analisi.

## Struttura

Usa una sottocartella per ogni caso:

```txt
datasets/
  autovelox/
    caso-001/
      verbale.pdf
      expected.json
  ztl/
    caso-001/
      pagina-1.jpg
      pagina-2.jpg
      expected.json
```

Sono supportati PDF, JPG, PNG e WEBP. Per un verbale multipagina fotografato, inserisci tutte le immagini nella stessa cartella del caso.

## expected.json

```json
{
  "authority": "",
  "plate": "",
  "article": "",
  "paragraph": "",
  "amount": "",
  "points": "",
  "classification": ""
}
```

Lascia vuoti solo i campi che non vuoi valutare per quel caso. I documenti reali non vanno anonimizzati nel risultato di produzione, ma prima di committarli verifica sempre privacy e consenso.
