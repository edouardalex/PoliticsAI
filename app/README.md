# PoliticsAI — application web

Vite + React + TypeScript. Voir le [README du projet](../README.md) et
[VISION.md](../VISION.md).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production (dist/)
```

- Les données viennent de `../data/processed/*.json` (générées par
  `data/pipeline/fetch_data.py`).
- `?nomotion` dans l'URL désactive les animations d'entrée (accessibilité, tests,
  captures) ; `prefers-reduced-motion` est respecté nativement.
- L'état de l'app (périmètre, unité, vue, sélection, zoom) est encodé dans le hash
  de l'URL — chaque vue est partageable telle quelle.
