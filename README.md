# PoliticsAI <sup>bêta</sup>

**Le budget public français, enfin lisible.**

Un projet citoyen : rendre les 1 672 milliards d'euros de dépenses publiques (État,
Sécurité sociale, collectivités) compréhensibles, explorables et vérifiables par
n'importe qui — sans jugement, avec des données officielles.

> _PoliticsAI est un nom de code ; le produit trouvera son nom._
> La vision complète du projet est dans [VISION.md](VISION.md).

## La V2 — Le Simulateur : « Vous êtes ministre du Budget »

Un jeu sérieux, à règles publiques : choisissez une mission (« Sous les 3 % », « Cap sur
le plein emploi », « Financer la transition », ou le bac à sable), composez votre budget à
partir de **121 mesures chiffrées et sourcées** — ou **inventez les vôtres** (c'est vous
qui fixez le montant, le moteur n'invente aucun chiffre) — et regardez réagir déficit,
dette, croissance, chômage et « climat social » (jauge assumée ludique) sur 2025-2029.

Le catalogue couvre 21 domaines (santé, école, écologie, transports, logement, retraites,
défense, agriculture, numérique, territoires, fiscalité des ménages et des entreprises…)
et propose systématiquement les mesures **et leurs symétriques** — filtres par type et par
domaine, tri par montant, par ordre alphabétique ou par réception sociale.

Le moteur est **mécanique, au premier ordre et intégralement documenté dans l'app** :
multiplicateurs budgétaires par levier (fourchettes OFCE/FMI, trois scénarios de
prudence), loi d'Okun, bouclage fiscal à 45 % (un investissement de 20 Md€ ne creuse
pas le déficit de 20 Md€ — et une coupe de 20 Md€ ne le réduit pas d'autant), effet
dénominateur et charge d'intérêts sur la dette. Verdicts factuels (objectif atteint ou
non), étoiles, **carte « Mon budget 2029 » téléchargeable en PNG** et budget partageable
par URL.

### V2.3 — Proposer avec ses mots, sans IA

Un champ libre : écrivez « la retraite à 67 ans », « augmenter la TVA de 2 points »,
« recruter 50 000 profs » — le simulateur comprend et calcule. **Aucune intelligence
artificielle** : un [parseur déterministe](app/src/lib/parser.ts) tourne dans votre
navigateur (mots-clés, extraction des nombres, ancres publiques : l'âge légal est à
64 ans, la TVA à 20 %…). Rien n'est envoyé nulle part, rien n'est deviné.

**Le domaine de validité**, surtout : chaque mesure réglable porte la plage où son
chiffrage est défendable, et la raison de cette plage. Tapez « la retraite à 80 ans » et
le simulateur **refuse de calculer** — en expliquant que les chiffrages du COR portent
sur 1 à 3 ans, qu'à 80 ans la quasi-totalité des personnes seraient déjà hors de l'emploi
et que les économies de pensions seraient absorbées par l'invalidité, le chômage et les
minima. Puis il propose la version calculable. *Un modèle qui répond à tout est un modèle
qui ment quelque part.*

Hors catalogue ? La proposition part dans **la file citoyenne** : les idées y sont
regroupées et classées par nombre de demandes, **n'importe qui peut proposer un chiffrage
à condition de citer ses sources**, rien n'est publié avant relecture — et un chiffrage
validé devient une mesure utilisable dans le simulateur.

### Le bac à sable et l'atelier de mesures

La mission « bac à sable » n'impose aucun objectif et ouvre **l'atelier complet** : au-delà
du nom, du domaine et du montant, vous réglez vous-même le **levier économique** (donc le
multiplicateur), la **montée en charge**, la **réception sociale** et les **emplois publics
directs** créés ou supprimés — avec un aperçu de l'effet (solde, PIB, chômage) calculé en
direct pendant que vous réglez. Les mesures inventées voyagent dans l'URL : votre
laboratoire est partageable et rechargeable tel quel.

### V2.1 — Le Mur des budgets (collaboratif)

Publiez votre budget **anonymement** (pas de compte, pas de cookie, aucune donnée
personnelle) et découvrez ceux des autres : **les mesures les plus choisies** (avec
intensité moyenne), le taux de réussite par mission, la distribution des déficits, et
les budgets récents — chacun ré-ouvrable d'un clic dans votre simulateur. Les titres
des mesures inventées sont comptés mais pas republiés tant qu'il n'y a pas de
modération. Le serveur ([server/index.mjs](server/index.mjs)) est **zéro dépendance**
(node:http + JSONL append-only) : ~250 lignes auditables. L'app fonctionne
intégralement sans lui (hébergement statique → le mur se masque).

```bash
node server/index.mjs   # le mur + la file, sur :8787 (Vite proxifie /api)
```

Pour activer la modération des chiffrages citoyens, lancer avec un jeton :

```bash
PAI_ADMIN_TOKEN=votre-jeton node server/index.mjs
```

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
server/                Le Mur des budgets — API zéro dépendance (node:http + JSONL)
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
| **V2.1** | Le Mur des budgets (publication anonyme, stats collectives) | ✅ Livrée |
| **V2.2** | Catalogue de 121 mesures, bac à sable et atelier avancé | ✅ Livrée |
| **V2.3** | Champ libre déterministe, domaine de validité, file citoyenne | ✅ Livrée |
| V2.4 | Déploiement public, nom définitif, licence | À venir |
| V1.5 | Ticket de caisse fiscal + quiz quotidien | Hiver 2026-2027 |
| V3 | Chiffrage des programmes — présidentielle 2027 | Février-avril 2027 |

## Licence

À définir (voir VISION.md, décisions parquées). Dans l'attente : tous droits réservés
sur le code ; les données publiques restent publiques.
