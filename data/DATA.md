# Les données

## Sources

Toutes les données proviennent de l'API de diffusion **Eurostat** (statistiques de
finances publiques, SEC 2010), alimentée pour la France par l'**Insee** :

| Jeu de données | Contenu | Usage |
|---|---|---|
| `gov_10a_exp` | Dépenses des administrations publiques par fonction (CFAP/COFOG), niveaux 1 et 2 | Côté « où va l'argent », drill-down, comparaison Europe |
| `gov_10a_main` | Principaux agrégats (recettes détaillées, TE, TR, B9) | Côté « d'où vient l'argent », déficit |
| `nama_10_gdp` | PIB aux prix courants (B1GQ) | Mode « % du PIB » |

Extraction : `python3 data/pipeline/fetch_data.py` (stdlib uniquement, labels
français demandés à l'API). Le script écrit `data/processed/france.json` et
`data/processed/europe.json`, seuls fichiers consommés par l'application.

## Millésime

**2024** pour la France (les 4 secteurs) et pour les 15 pays de la comparaison.
Le script préfère 2024 et se replie sur 2023 par pays/secteur si nécessaire (champ
`year` par périmètre et par pays).

## Choix méthodologiques

- **Périmètres.** `S13` (toutes administrations) est **consolidé** : les transferts
  internes sont neutralisés, chaque euro n'est compté qu'une fois. Les sous-secteurs
  (`S1311` État, `S1313` collectivités, `S1314` sécurité sociale) sont publiés **non
  consolidés entre eux** : les dotations de l'État aux collectivités apparaissent en
  dépense de l'État (fonction `GF0108`) et en recette des collectivités (`D73`).
  Leurs totaux ne s'additionnent donc pas — l'app l'affiche explicitement.
- **Recettes.** Décomposition additive de TR : cotisations sociales (D61), TVA
  (D211), accises et autres impôts sur les produits (D21−D211), impôts sur la
  production (D29), impôts sur le revenu des ménages (D51A, qui inclut la CSG),
  impôt sur les sociétés (D51B), autres impôts dont patrimoine (résidu D5 + D91),
  ventes et redevances (P11+P12+P131), transferts entre administrations (D73, hors
  S13), et un résidu « autres recettes » qui garantit l'exactitude du total.
- **Déficit.** L'app affiche l'écart **dépenses − recettes** du périmètre (les flux
  bouclent exactement). Il diffère légèrement du besoin de financement officiel
  **B9** (−169,1 Md€ vs 168,2 Md€ en 2024 pour S13) : traitement comptable des
  crédits d'impôts. Le B9 est conservé dans le JSON (`netLending`).
- **Sankey à nœud central.** Il n'existe **aucune affectation** d'une recette à une
  dépense (non-affectation budgétaire) : le diagramme fait transiter tous les flux
  par un nœud central « administrations publiques » plutôt que d'inventer des liens
  recette→dépense.
- **Fusion des petits postes.** Pour la lisibilité, les recettes < 0,8 % du total et
  les sous-fonctions < 1,4 % de leur fonction sont regroupées dans « Autres » (détail
  conservé dans les fiches).

## Limites connues

- Les comparaisons européennes reflètent aussi des différences d'**organisation**
  (santé par assurance privée obligatoire aux Pays-Bas, par exemple) — pas seulement
  des différences d'effort public.
- Le niveau 2 COFOG français comporte quelques postes non ventilés ou à zéro (R&D
  notamment) ; les écarts éventuels apparaissent en « non ventilé ».
- Les **équivalences** (« ≈ X collèges ») sont des ordres de grandeur indicatifs,
  sourcés dans l'app (Méthode & sources), pas des chiffrages.

## Reproduire

```bash
python3 data/pipeline/fetch_data.py
# vérifie les sommes niveau 1 vs TOTAL (tolérance 0,5 %)
# et l'exactitude de la décomposition des recettes (résidu explicite)
```
