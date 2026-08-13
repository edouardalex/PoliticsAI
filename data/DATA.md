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

### Deux dimensions dans la même source

`gov_10a_exp` croise la fonction (COFOG) et la **nature de l'opération** (SEC
2010). Le pipeline récupère les deux : chaque fonction et chaque sous-fonction
porte sa décomposition en dix postes additifs (salaires D1, prestations en
argent D62, soins remboursés D632, achats P2, investissement OP5ANP, transferts
D7 et D9, intérêts D4, subventions D3, impôts payés D29_D5_D8). La somme des dix
reconstitue exactement le total — le pipeline le vérifie à chaque exécution et
échoue bruyamment sinon.

Les valeurs **négatives sont conservées** : l'ajustement SIFIM sur la gestion de
la dette vaut −1,3 Md€ en consommation intermédiaire. Les écarter casserait
l'additivité.

## Aller plus bas : les sources de zoom

La comptabilité nationale s'arrête au niveau 2 du COFOG. Toute descente
supplémentaire change de référentiel comptable, donc de périmètre. Le projet
traite ce changement comme un objet explicite plutôt que de le masquer : chaque
« vue » (`data/processed/deep/<vue>.json`) porte son référentiel, son millésime,
sa source, la **part du parent qu'elle explique** et la **qualité de son
rattachement**. Rien n'est jamais mis à l'échelle pour faire coïncider les
totaux ; ce qui n'est pas expliqué reste affiché comme tel.

| Source | Ce qu'elle apporte | Rattachement |
|---|---|---|
| **CNAM** — `data.ameli.fr/depenses` | Cartographie des pathologies : maladie → sous-groupe → stade → poste de soin (27 postes), avec effectifs et coût moyen par patient | `officiel` (ventilation publiée par la CNAM) |
| **Budget de l'État** — `plf-2026-budget-vert` | Exécution 2024 en crédits de paiement : mission → programme → action → ligne | `éditorial` (table de correspondance, voir ci-dessous) |
| **Dépenses fiscales** — même jeu | 350 dispositifs chiffrés (89,4 Md€) et 62 taxes affectées (20,8 Md€) | `officiel` au national, `éditorial` par fonction |
| **OFGL** — `data.ofgl.fr` | Dépense locale par niveau de collectivité et par nature, puis annuaire de 34 869 communes en €/habitant | `dérivé` |
| **ESSPROS** — Eurostat `spr_exp_f*` | 8 fonctions de protection sociale décomposées en prestations nommées, avec l'axe « sous / sans conditions de ressources » | `dérivé` |
| **Agrégats fiscaux** — Eurostat `gov_10a_taxag` | Nomenclature fiscale complète du SEC 2010 : accises, taxes sur les assurances, cotisations par type de payeur, droits de succession | `officiel` |

`mapping` vaut `officiel` (ventilation publiée telle quelle), `dérivé`
(recomposée mécaniquement depuis les codes de la source) ou `éditorial`
(correspondance construite par le projet).

### La table de correspondance programme → COFOG

Il n'existe **aucune table officielle publiée** reliant les programmes du budget
de l'État aux fonctions de la comptabilité nationale : l'Insee opère ce
rattachement en interne sans le diffuser. `data/crosswalk/programme_cofog.csv`
est donc une construction du projet, publiée pour être contestable ligne à
ligne. Elle couvre les 173 lignes budgétaires du fichier source ; une seule
(l'ajustement technique `T3_CAS`, −6,0 Md€) reste non rattachée et l'application
le signale.

Règle suivie : on ne descend au niveau 2 que lorsque le rattachement est
univoque ; dans le doute on reste au niveau 1. Chaque ligne porte un niveau de
confiance (`haute` / `moyenne` / `basse`) affiché dans l'application.

### Les prestations sociales (ESSPROS)

Le plus gros bloc du budget — 693 Md€ de protection sociale — s'arrêtait à huit
sous-fonctions dont un « Vieillesse : 392 Md€ » que rien ne détaillait. Les bases
ESSPROS d'Eurostat donnent la ventilation officielle par prestation, sur trois
axes emboîtés (espèces/nature → périodique/unique → prestation), plus la
distinction **sous / sans conditions de ressources** qui n'a aucun équivalent
COFOG. Additivité exacte vérifiée sur les trois axes.

Deux réserves portées par les vues elles-mêmes : ESSPROS couvre **tous les
régimes** (y compris complémentaires et d'employeur) — le périmètre est plus
large que les administrations publiques, donc aucune part expliquée n'est
revendiquée ; et le dernier millésime français est **2023**, un an derrière le
reste de l'application.

### Ce qu'ESSPROS ne divise pas

Une ligne domine tout : **« pension de vieillesse », 341,1 Md€**, que ces bases
nomment mais ne décomposent pas. C'est aujourd'hui la plus grosse ligne
terminale de toute l'application, et aucune source ouverte et machine-lisible ne
la divise par régime. Le CAS Pensions (53,2 Md€, pensions civiles et militaires
de l'État) en est le seul morceau détaillé, par la voie budgétaire.

### Les recettes (palier 7)

Le côté gauche du diagramme restait le plus grossier : 1 504 Md€ décrits par
neuf postes. `gov_10a_taxag` ouvre la nomenclature fiscale complète — **même
source, même millésime, même consolidation** que le reste des comptes, donc
aucun changement de référentiel et aucun rattachement éditorial. Quatre postes
sur neuf se décomposent, chacun bouclant à 100 % de son parent :

- **cotisations sociales** (483,6 Md€) par type de payeur : employeurs,
  salariés, indépendants, personnes sans emploi, cotisations imputées ;
- **accises et taxes sur les produits** (118,4 Md€) en onze lignes ;
- **impôts sur la production** (129,9 Md€) en sept lignes ;
- **patrimoine et successions** (28,5 Md€) en six lignes.

Le gain est réel mais borné, et il faut le dire : on passe de 9 à 35 postes,
mais l'euro médian ne descend que de 275 à 208 Md€. **La TVA (207,8 Md€),
l'impôt sur le revenu (275,0 Md€) et l'impôt sur les sociétés (83,7 Md€) — 38 %
des recettes — n'ont aucune ventilation de leur produit en donnée ouverte.**
Le fichier des déclarations 2042 (`ir-declarations-2042-nat`) détaille l'assiette
et les réductions d'impôt, pas le produit ; il ne comble donc pas ce trou.

### Chorus

Le système financier de l'État n'est **pas publié en donnée ouverte** : aucun
jeu « Chorus » sur data.gouv.fr ni sur data.economie.gouv.fr, et il n'existe pas
de balance comptable de l'État équivalente à celles des collectivités (7,0 M de
lignes par an). Ce que Chorus produit et que l'administration diffuse, c'est
l'exécution budgétaire agrégée — précisément ce que l'application consomme déjà
via l'annexe « budget vert » (exécution 2024 en crédits de paiement) et les
rapports annuels de performance. La situation mensuelle de l'État n'est qu'un
catalogue de PDF.

En dessous — factures, engagements, fournisseurs — la seule source ouverte est
la commande publique (DECP, 702 901 marchés dans la version 3). Elle mesure un
autre objet (montants notifiés, non des paiements), sa couverture est partielle,
elle mélange tous les acheteurs publics et ne se rattache à aucune fonction
COFOG. Elle nomme aussi des entreprises : son usage relève d'une décision
éditoriale, pas technique.

## Traçabilité

Chaque vue publie de quoi refaire le chemin sans nous croire :

- **la ou les URL exactement interrogées** — rejouer la requête doit redonner
  les mêmes montants ;
- **le nombre de lignes lues à la source**, en regard du nombre publié ;
- **une empreinte SHA-256 de l'arbre publié**, recalculable depuis le fichier
  servi ;
- **un export CSV** de l'arbre complet, chemin compris, dont l'en-tête reporte
  source, requête et empreinte : le fichier se vérifie hors de l'application.

`data/processed/deep/manifest.json` récapitule tout cela pour les 106 vues, et
porte en plus l'empreinte SHA-256 de la table de correspondance
`programme_cofog.csv`. Le pipeline échoue bruyamment si une vue est écrite sans
requête source tracée.

Ordres de grandeur atteints : **4 392 lignes terminales publiées**, ligne
terminale médiane à **53 M€**, premier quartile à 9,7 M€.

### Quand la vue dépasse son parent

Deux rattachements donnent une couverture supérieure à 100 % : les crédits
d'enseignement supérieur (le programme 150 finance aussi de la recherche, que la
comptabilité nationale classe en recherche fondamentale) et les transferts aux
collectivités (une partie du prélèvement sur recettes est classée ailleurs).
Ce n'est pas un bug à corriger mais l'information elle-même : les deux
comptabilités ne découpent pas le monde de la même façon. L'application l'affiche
explicitement.

### Ce que la profondeur ne recouvre pas

- L'annexe « budget vert » **n'inclut ni la charge de la dette ni les
  remboursements et dégrèvements d'impôts** : ils manquent aux vues LOLF.
- Les bases OFGL additionnent les niveaux de collectivités **sans les consolider
  entre eux** (un euro versé par une commune à son intercommunalité est compté
  deux fois), contrairement au sous-secteur S1313 de la comptabilité nationale.
- Le périmètre CNAM couvre les montants **remboursés** : ni le reste à charge,
  ni les dépenses de santé non remboursées.
- Une dépense fiscale n'est pas une dépense mais une recette en moins : ses
  montants ne s'additionnent à rien. Sa couverture est donc laissée vide plutôt
  que calculée.

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
# vérifie les sommes niveau 1 vs TOTAL (tolérance 0,5 %),
# l'additivité fonction × nature, et l'exactitude des recettes (résidu explicite)
```

```bash
python3 data/pipeline/fetch_deep.py
# vues de zoom : CNAM, budget de l'État, dépenses fiscales, collectivités
# vérifie que chaque parent égale la somme de ses enfants dans tous les arbres
# et signale les lignes budgétaires non rattachées
```

`fetch_deep.py` accepte une liste de sources (`cnam`, `lolf`, `taxexp`, `ofgl`)
pour ne reconstruire qu'une partie ; les vues déjà produites sont conservées.
