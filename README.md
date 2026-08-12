# PoliticsAI <sup>bêta</sup>

**Le budget public français, enfin lisible.**

Un projet citoyen : rendre les 1 672 milliards d'euros de dépenses publiques (État,
Sécurité sociale, collectivités) compréhensibles, explorables et vérifiables par
n'importe qui — sans jugement, avec des données officielles.

> _PoliticsAI est un nom de code ; le produit trouvera son nom._
> La vision complète du projet est dans [VISION.md](VISION.md).

## La V1 — L'Explorateur

Un **diagramme de flux animé** (Sankey) qui montre d'où vient l'argent public et où
il va, sur les données Eurostat/Insee les plus récentes (millésime 2024) :

- **Le flux** : recettes → administrations → dépenses par fonction (COFOG), avec le
  déficit visible comme flux d'emprunt distinct. Drill-down au niveau 2 (double-clic ou
  fiche) : la santé se décompose en hôpitaux / soins de ville / médicaments, etc.
- **Quatre périmètres** : toutes administrations (consolidé), État, Sécurité sociale,
  collectivités locales.
- **Trois unités** : milliards d'euros, « pour 1 000 € dépensés », % du PIB.
- **Fiches par poste** : montant, part, comparaison européenne, description neutre,
  équivalences concrètes (« ≈ 580 avions Rafale »), lien partageable.
- **L'Europe** : chaque fonction comparée à 14 pays (dot plot, % du PIB).
- **Le tableau** : toutes les valeurs accessibles et exportables (CSV) — le jumeau
  WCAG du diagramme.
- **Recherche** (⌘K), état de l'app encodé dans l'URL (chaque vue est partageable),
  responsive (layout mobile dédié), `prefers-reduced-motion` respecté.

## Lancer le projet

```bash
cd app
npm install
npm run dev          # → http://localhost:5173
```

Rafraîchir les données (aucune dépendance, Python ≥ 3.9) :

```bash
python3 data/pipeline/fetch_data.py
```

## Structure

```
VISION.md              Le document fondateur (vision, roadmap 2027, ligne éditoriale)
data/
  pipeline/            Script d'extraction Eurostat (stdlib uniquement)
  processed/           JSON versionnés consommés par l'app (source de vérité)
  DATA.md              Sources, millésimes, choix méthodologiques, limites
app/                   Application web (Vite + React + TypeScript + d3-sankey)
```

## Les règles du projet (constitution de neutralité)

1. **Décrire, jamais qualifier.** Les chiffres et les comparaisons ; le jugement
   appartient au lecteur.
2. **Tout chiffre est sourcé** et traçable jusqu'à la statistique publique.
3. **Méthodologie ouverte** — ce dépôt.
4. **Mêmes règles pour tous**, quel que soit le bord politique.
5. **Les chiffres viennent des données, jamais d'un modèle d'IA.**

## Roadmap

| Étape | Contenu | Échéance visée |
|---|---|---|
| **V1** | L'Explorateur (ce dépôt) | Automne 2026, calé sur le PLF 2027 |
| V1.5 | Ticket de caisse fiscal + quiz quotidien | Hiver 2026-2027 |
| V2 | Simulateur « à vous de faire le budget » | Hiver 2026-2027 |
| V3 | Chiffrage des programmes — présidentielle 2027 | Février-avril 2027 |

## Licence

À définir (voir VISION.md, décisions parquées). Dans l'attente : tous droits réservés
sur le code ; les données publiques restent publiques.
