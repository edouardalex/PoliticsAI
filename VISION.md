# PoliticsAI — Document fondateur

> Établi le 12 août 2026. Document vivant : il fixe le cap, pas les détails.
> Le nom « PoliticsAI » est provisoire (voir [Décisions parquées](#décisions-parquées)).

## Le projet en une phrase

Rendre le budget public français — État, Sécurité sociale, collectivités — **compréhensible, explorable et jouable** par n'importe quel citoyen.

## Le problème

L'argent public français représente de l'ordre de 1 600 milliards d'euros par an, autour de 57 % du PIB. Chacun le finance, personne ne le voit. Les données sont publiques (PLF, PLFSS, comptes des collectivités, Eurostat), mais dispersées, arides et illisibles pour un non-spécialiste. Résultat : le débat budgétaire repose sur des intuitions fausses, des ordres de grandeur erronés et des slogans.

Les outils existants ne comblent pas ce vide :
- **budget.gouv.fr** : officiel mais soporifique, aucune dimension ludique ni personnelle ;
- **Institut Montaigne, Fipeco, iFRAP** : expertise réelle, mais format think tank, et pour certains une ligne éditoriale marquée ;
- **LexImpact / OpenFisca** : moteur de simulation sérieux, mais outil de spécialistes ;
- **Civic tech historiques** (Regards Citoyens…) : centrées sur le Parlement, pas sur l'argent, et sans les outils d'IA d'aujourd'hui.

Le trou dans la raquette : **l'expérience grand public, sensible, jouable et partageable**. Personne n'a fait le « SimCity du budget de l'État ».

## Audience prioritaire (V1)

**Le grand public curieux** : le citoyen qui débat au dîner sans maîtriser les chiffres. Tout découle de ce choix — simplicité radicale, design animé, zéro jargon, partage en un clic.

Les autres audiences (journalistes, enseignants, collectivités) viendront ensuite, portées par le même socle de données.

## Ligne éditoriale : la constitution de neutralité

La confiance est l'actif n° 1 du projet. Le premier procès en biais arrivera vite ; ces règles sont nos garde-fous, elles priment sur tout le reste :

1. **Décrire, jamais qualifier.** On montre les chiffres, les comparaisons, les ordres de grandeur. On n'écrit jamais « gaspillage », « dérive » ou « surcoût ». L'utilisateur juge.
2. **Tout chiffre est sourcé.** Chaque nombre affiché est traçable jusqu'à sa source officielle, en un clic.
3. **Méthodologie open source.** Les traitements de données et hypothèses de calcul sont publics et auditables.
4. **Mêmes règles pour tous.** Le jour où l'on chiffre les programmes politiques (V3), tous les partis passent dans le même moteur, avec les mêmes hypothèses, affichées.
5. **Les chiffres viennent de la base, jamais du modèle.** L'IA formule, explique, guide — elle n'invente jamais un nombre. Toute réponse chiffrée est une requête sur les données, pas une génération.

Conséquence assumée : **pas de « name and shame »**. La détection publique d'anomalies (marchés publics, dépenses locales) est exclue du produit — risque juridique (diffamation), données DECP trop sales (faux positifs), et incompatibilité avec le modèle économique visé. Au mieux, une future collaboration privée avec des journalistes d'investigation qui vérifient. Décision à réévaluer, mais pas avant 2028.

## L'expérience produit

### V1 — L'Explorateur (expérience héroïque : le Sankey)

**L'image fondatrice du projet : tout l'argent public de France sur un seul écran.**

- Un **diagramme de Sankey animé** : les recettes (TVA, impôt sur le revenu, cotisations, CSG…) qui s'écoulent vers les dépenses (retraites, santé, éducation, défense…).
- **Zoomable** : du macro (les grandes masses) au concret (le coût d'un lycée, d'un lit d'hôpital, d'un kilomètre d'autoroute).
- **Trois périmètres navigables** : État, Sécurité sociale, collectivités — et leur consolidation.
- **Comparaison européenne** dès la V1 (données Eurostat/COFOG) : « la France vs ses voisins » poste par poste.
- **Équivalences concrètes** au survol : « ce flux = X collèges = Y années du budget d'une ville de 10 000 habitants ».
- **Chaque état de l'exploration a son URL partageable** : le Sankey n'est pas une visite, c'est un générateur de captures et de liens. C'est la condition pour qu'il soit viral et pas seulement beau.
- **« Pose une question au budget »** : interface en langage naturel (voir Rôle de l'IA).

### V1.5 — La couche rétention & viralité

- **Le ticket de caisse fiscal** : j'indique grossièrement ce que je paie (TVA estimée, IR, CSG) et je reçois *mon* ticket : « tes impôts de l'année ont financé 2,3 jours de lit d'hôpital, 11 heures de professeur… ». Calcul 100 % côté client, aucune donnée stockée.
- **Le quiz quotidien** (mécanique Wordle) : une question d'ordre de grandeur par jour, score partageable. La surprise (« je pensais que c'était 10× plus ! ») est le carburant du partage — et la seule mécanique de *retour* du produit.

### V2 — Le Simulateur : « Tu es ministre du Budget »

Trouve 30 milliards. Chaque choix (supprimer, augmenter, réformer un poste) affiche ses conséquences visibles au premier ordre. À la fin : ta carte « Mon budget », partageable. Le moteur du simulateur est le même que celui qui servira au chiffrage des programmes — c'est ce qui rend les scores défendables.

### V3 — Les programmes politiques (présidentielle 2027)

Les programmes économiques des candidats, parsés en mesures structurées, mappés sur les lignes budgétaires, passés dans le simulateur de la V2. Chaque citoyen peut comparer les programmes entre eux, avec le sien, et avec le budget réel. Mêmes règles, mêmes hypothèses, tout affiché.

## Le rôle de l'IA

1. **Interface en langage naturel** sur le budget — le LLM comprend la question et la traduit en requête ; la base répond ; le LLM met en mots. Jamais l'inverse.
2. **Normalisation des données** : les sources publiques sont hétérogènes et sales ; les LLM servent au nettoyage, au mapping entre nomenclatures (LOLF ↔ COFOG), au contrôle qualité.
3. **Parsing des programmes politiques** (V3) : transformer un PDF de programme en liste de mesures chiffrables.

## Les données (périmètre V1 volontairement réduit)

| Source | Usage | Statut V1 |
|---|---|---|
| Eurostat — COFOG | Comparaison européenne, agrégats propres | ✅ Socle V1 |
| PLF — missions/programmes (data.economie.gouv.fr) | Détail budget de l'État | ✅ Socle V1 |
| PLFSS | Sécurité sociale | ✅ Socle V1 |
| OFGL / DGFiP | Comptes des collectivités | 🔜 V1.5+ |
| OpenFisca | Moteur de simulation socio-fiscale | 🔜 V2 (brique à réutiliser, pas à réécrire) |
| DECP (marchés publics) | — | ❌ Hors scope (marécage) |

Le pipeline de données représente ~70 % de l'effort réel du projet. Le front spectaculaire est la partie facile.

## Roadmap — calée sur la présidentielle d'avril 2027

| Échéance | Jalon |
|---|---|
| **Automne 2026** | Lancement V1 (Explorateur/Sankey), calé sur la présentation du PLF 2027 (~octobre) — le point d'actualité idéal |
| **Hiver 2026-2027** | V1.5 (ticket de caisse, quiz) puis V2 (Simulateur) |
| **Février–avril 2027** | V3 : chiffrage des programmes, en continu pendant la campagne |
| **Post-élection** | Offres médias & collectivités, comparateur communal |

## Modèle économique (pistes, non figées)

- **Grand public : gratuit, sans publicité, sans vente de données** — non négociable, c'est la condition de la neutralité.
- **Médias** : infographies interactives embarquables et maintenues à jour (fort appétit pendant la campagne 2027).
- **Collectivités** : « votre budget communal en version citoyenne », marque blanche — obligations de transparence, zéro outil séduisant sur le marché. Marché durable, cohérent avec la neutralité (et incompatible avec le name-and-shame, assumé plus haut).
- **Éducation** : packs pédagogiques (EMC, SES).

## Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| **Éparpillement** — la vision contient 5 produits | Séquencement strict V1 → V3 ; on ne commence pas une brique avant que la précédente soit sortie |
| **Procès en biais** — inévitable dès la V3 | Constitution de neutralité, méthodo open source, données brutes téléchargeables |
| **Rétention** — les civic tech font des pics puis meurent | Quiz quotidien, ancrage sur l'actualité budgétaire, partage systématique |
| **Marécage des données** | Périmètre V1 réduit (COFOG + PLF + PLFSS), DECP exclu |
| **Diffamation** | Aucune désignation publique d'entités ; pas d'anomalies dans le produit |

## L'hypothèse la plus risquée

> **« Le grand public a envie de jouer avec le budget plus de quatre minutes. »**

Toutes les civic tech ont buté dessus. Elle se teste à moindre coût : la V1 elle-même est le test — si le Sankey partagé ne génère pas de reprises spontanées (réseaux, médias), on pivote vers l'audience prescriptrice (journalistes, profs) avant d'investir dans V2.

## Décisions parquées

- **Le nom.** « PoliticsAI » dit l'inverse du produit : *Politics* évoque le partisan (le sujet est l'argent public), *AI* déclenche la méfiance sur des chiffres. Pistes : *OùVaLArgent*, *Balance Publique*, *MilleEuros*. À trancher avant le lancement public.
- **La stack technique.** Non décidée. Critères : web, animations riches (le Sankey est l'expérience cœur), pipeline de données robuste, coût d'hébergement minimal.
- **La structure juridique.** Produit avec potentiel économique — le choix de licence (cœur open source, expérience propriétaire ?) doit être tranché avant les premières contributions externes.
