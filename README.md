# PoliticsAI <sup>bêta</sup>

**Le budget public français, enfin lisible.**

Un projet citoyen : rendre les 1 672 milliards d'euros de dépenses publiques (État,
Sécurité sociale, collectivités) compréhensibles, explorables et vérifiables par
n'importe qui — sans jugement, avec des données officielles.

> _PoliticsAI est un nom de code ; le produit trouvera son nom._
> La vision complète du projet est dans [VISION.md](VISION.md).

## La V2 — Le Simulateur : « Vous êtes ministre du Budget »

Un jeu sérieux, à règles publiques : choisissez une mission (« Sous les 3 % », « Cap sur
le plein emploi », « Financer la transition », ou bac à sable), composez votre budget à
partir de **33 mesures chiffrées et sourcées** — ou **inventez les vôtres** (c'est vous
qui fixez le montant, le moteur n'invente aucun chiffre) — et regardez réagir déficit,
dette, croissance, chômage et « climat social » (jauge assumée ludique) sur 2025-2029.

Le moteur est **mécanique, au premier ordre et intégralement documenté dans l'app** :
multiplicateurs budgétaires par levier (fourchettes OFCE/FMI, trois scénarios de
prudence), loi d'Okun, bouclage fiscal à 45 % (un investissement de 20 Md€ ne creuse
pas le déficit de 20 Md€ — et une coupe de 20 Md€ ne le réduit pas d'autant), effet
dénominateur et charge d'intérêts sur la dette. Verdicts factuels (objectif atteint ou
non), étoiles, **carte « Mon budget 2029 » téléchargeable en PNG** et budget partageable
par URL.

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

| Étape | Contenu | Statut |
|---|---|---|
| **V1** | L'Explorateur (Sankey, Europe, tableau) | ✅ Livrée |
| **V2** | Simulateur « Vous êtes ministre du Budget » | ✅ Livrée |
| V2.1 | Simulateur collaboratif (mesures les plus proposées, budgets partagés) | À venir |
| V1.5 | Ticket de caisse fiscal + quiz quotidien | Hiver 2026-2027 |
| V3 | Chiffrage des programmes — présidentielle 2027 | Février-avril 2027 |

## Licence

À définir (voir VISION.md, décisions parquées). Dans l'attente : tous droits réservés
sur le code ; les données publiques restent publiques.
