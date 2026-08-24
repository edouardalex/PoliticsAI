#!/usr/bin/env python3
"""
Palier 8 — la commande publique, entreprise par entreprise.

C'est le plancher absolu de la donnée publique française : qui a signé quel
marché, avec quel acheteur, pour quel montant. Et c'est aussi la source la plus
sale du projet — il faut le dire avant de s'en servir.

Ce que la source contient réellement (millésime 2023, mesuré) :
  - 87 340 lignes pour 72 339 identifiants de marché distincts ;
  - 98 % portent une raison sociale, contre 11 % dans la version non enrichie ;
  - **27 lignes totalisent 69 818 Md€**, soit 24 fois le PIB français. Une
    tonte d'espaces verts y figure à 100 000 milliards d'euros.

Règle de filtrage, publiée avec la vue et jamais silencieuse :
  on ne retient que les marchés dont le montant est strictement positif et
  inférieur ou égal à 1 Md€. Le nombre et le total des lignes écartées sont
  affichés dans la vue.

Ce que ces montants ne sont pas : des paiements. Un marché notifié est un
engagement, parfois pluriannuel, parfois jamais consommé jusqu'à son plafond.
Rien ici ne se rapproche d'une ligne de dépense exécutée, et rien ne se
rattache à une fonction COFOG.
"""

from __future__ import annotations

from collections import defaultdict

from deep_model import lit, make_view, node, ods_export

DOMAIN = "data.economie.gouv.fr"
DATASET = "decp_augmente"

YEAR = "2023"          # dernier millésime complet
MAX_MONTANT = 1e9      # au-delà, la saisie est presque toujours erronée
TOP_MARCHES = 500      # taille annoncée dans le titre de la vue dédiée

SOURCE = {
    "name": "Données essentielles de la commande publique, version enrichie des raisons sociales",
    "dataset": f"data.economie.gouv.fr / {DATASET}",
    "url": "https://data.economie.gouv.fr/explore/dataset/decp_augmente/",
    "producer": "Ministères économiques et financiers, à partir des déclarations des acheteurs",
    "licence": "Licence Ouverte v2.0 (Etalab)",
    "cadence": "Irrégulière ; jeu marqué « déprécié » par son producteur",
    "brings": "Le plancher : qui a signé quel marché, avec quel acheteur, pour quel montant.",
}

# Divisions de la nomenclature européenne CPV (deux premiers chiffres du code).
CPV_DIVISIONS = {
    "03": "Produits agricoles, de l'élevage, de la pêche et de la sylviculture",
    "09": "Produits pétroliers, combustibles et électricité",
    "14": "Produits des industries extractives",
    "15": "Produits alimentaires, boissons et tabac",
    "16": "Machines agricoles",
    "18": "Vêtements, chaussures et articles de voyage",
    "19": "Cuir, textiles, plastique et caoutchouc",
    "22": "Imprimés et produits connexes",
    "24": "Produits chimiques",
    "30": "Machines de bureau et matériel informatique",
    "31": "Machines, appareils et équipements électriques",
    "32": "Équipements de radio, télévision et communication",
    "33": "Matériels médicaux et produits pharmaceutiques",
    "34": "Équipements de transport",
    "35": "Équipements de sécurité, de secours, de police et de défense",
    "37": "Instruments de musique, articles de sport et jeux",
    "38": "Équipements de laboratoire, d'optique et de précision",
    "39": "Meubles, aménagements et appareils électroménagers",
    "41": "Eau captée et épurée",
    "42": "Machines industrielles",
    "43": "Machines pour l'exploitation minière et la construction",
    "44": "Structures et matériaux de construction",
    "45": "Travaux de construction",
    "48": "Logiciels et systèmes d'information",
    "50": "Services de réparation et d'entretien",
    "51": "Services d'installation",
    "55": "Services d'hôtellerie et de restauration",
    "60": "Services de transport",
    "63": "Services d'appui et auxiliaires des transports",
    "64": "Services des postes et télécommunications",
    "65": "Services publics d'eau, d'électricité et de gaz",
    "66": "Services financiers et d'assurance",
    "70": "Services immobiliers",
    "71": "Architecture, ingénierie et contrôle technique",
    "72": "Services informatiques",
    "73": "Recherche et développement",
    "75": "Services de l'administration publique et de la sécurité sociale",
    "76": "Services liés à l'industrie du pétrole et du gaz",
    "77": "Services agricoles, sylvicoles et horticoles",
    "79": "Services aux entreprises : droit, marketing, conseil, recrutement",
    "80": "Services d'enseignement et de formation",
    "85": "Services de santé et d'action sociale",
    "90": "Assainissement, déchets et environnement",
    "92": "Services récréatifs, culturels et sportifs",
    "98": "Autres services collectifs, sociaux et personnels",
}

PERIMETER_NOTE = (
    "On quitte complètement la comptabilité publique. Un marché notifié est un "
    "engagement, pas un paiement : il peut courir sur plusieurs années et n'être "
    "jamais consommé jusqu'à son plafond. Ces montants ne s'additionnent à aucune "
    "dépense du diagramme et ne se rattachent à aucune fonction. Tous les "
    "acheteurs publics sont mêlés : État, collectivités, hôpitaux, bailleurs."
)


def _caveats(dropped: int, dropped_amount: float, dupes: int) -> list[str]:
    return [
        "Déclaration obligatoire au-dessus de 40 000 € seulement, et lacunaire : "
        "la commande publique réelle est plus large que ce fichier.",
        f"Qualité de la source : {dropped} marchés de plus de 1 Md€ ont été "
        f"écartés, ils totalisaient {dropped_amount/1000:,.0f} Md€ à eux seuls "
        f"— l'équivalent de {dropped_amount/2935236:,.0f} fois le PIB français. "
        f"La règle de filtrage est publiée dans le pipeline.".replace(",", " "),
        f"{dupes} lignes portaient un identifiant de marché déjà vu (lots ou "
        f"cotitulaires) et n'ont été comptées qu'une fois.",
        "Les raisons sociales viennent d'un rapprochement avec le répertoire "
        "SIRENE réalisé par le producteur du fichier, pas par nous. Une erreur "
        "de SIRET dans la déclaration se traduit par une entreprise mal nommée.",
        "Ce jeu de données est marqué « déprécié » par son producteur : c'est "
        "néanmoins le seul qui porte les raisons sociales.",
    ]


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    print(f"→ Commande publique — marchés notifiés en {YEAR}…")
    trace: list[str] = []
    rows = ods_export(
        DOMAIN, DATASET, trace=trace,
        where=f"anneenotification={lit(YEAR)} and montant>0 and montant<={MAX_MONTANT:.0f}",
        select=("id,objetmarche,montant,codecpv_division,referencecpv,"
                "denominationunitelegale,siretetablissement,nomacheteur,"
                "communeetablissement,nature,datenotification"),
    )
    print(f"  {len(rows):,} lignes retenues")

    # Écartés : mesurés séparément pour pouvoir les annoncer.
    dropped = ods_export(
        DOMAIN, DATASET, trace=trace,
        where=f"anneenotification={lit(YEAR)} and montant>{MAX_MONTANT:.0f}",
        select="id,montant",
    )
    dropped_amount = sum((r.get("montant") or 0) / 1e6 for r in dropped)

    # L'ordre d'export n'est pas garanti par la source : sans tri, la ligne
    # retenue pour un identifiant donné change d'une exécution à l'autre et
    # l'empreinte de la vue devient instable. On trie donc sur une clé stable
    # avant de dédupliquer.
    rows.sort(key=lambda r: (str(r.get("id") or ""),
                             str(r.get("siretetablissement") or ""),
                             -(r.get("montant") or 0),
                             str(r.get("objetmarche") or "")))

    # Un identifiant de marché peut revenir (lots, cotitulaires) : on ne compte
    # son montant qu'une fois.
    seen: set[str] = set()
    kept: list[dict] = []
    dupes = 0
    for r in rows:
        mid = str(r.get("id") or "")
        if mid and mid in seen:
            dupes += 1
            continue
        if mid:
            seen.add(mid)
        kept.append(r)
    print(f"  {dupes:,} doublons d'identifiant écartés · {len(kept):,} marchés uniques")

    def siret_of(r: dict) -> str | None:
        v = str(r.get("siretetablissement") or "").strip()
        return v if v.isdigit() and len(v) >= 9 else None

    def firm(r: dict) -> str:
        return (r.get("denominationunitelegale")
                or r.get("nomacheteur") and "Titulaire non identifié"
                or "Titulaire non identifié")

    # — Vue 1 : catégorie d'achat → entreprise titulaire —
    by_div: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for r in kept:
        div = str(r.get("codecpv_division") or "").zfill(2)
        by_div[div][firm(r)].append(r)

    divisions: list[dict] = []
    obsolete: list[dict] = []
    for div, firms in by_div.items():
        fnodes = []
        for name, ms in firms.items():
            total = sum((m.get("montant") or 0) / 1e6 for m in ms)
            if total < 0.01:
                continue
            sirets = sorted({s for s in (siret_of(m) for m in ms) if s})
            fnodes.append(node(
                f"{div}-{sirets[0] if sirets else name[:20]}", name, total,
                detail=(f"{len(ms)} marché{'s' if len(ms) > 1 else ''}"
                        + (f" · SIREN {sirets[0][:9]}" if sirets else "")),
            ))
        if not fnodes:
            continue
        known = div in CPV_DIVISIONS
        n = node(
            f"cpv-{div}",
            CPV_DIVISIONS.get(div, f"Code CPV {div}"),
            sum(f["amount"] for f in fnodes), children=fnodes,
            detail=f"{sum(len(v) for v in firms.values())} marchés",
        )
        (divisions if known else obsolete).append(n)

    if obsolete:
        divisions.append(node(
            "cpv-obsoletes", "Codes de nomenclature retirés ou non reconnus",
            sum(o["amount"] for o in obsolete), children=obsolete,
            detail="Codes de la nomenclature CPV antérieure à 2008, encore "
                   "utilisés dans certaines déclarations",
        ))

    views = [make_view(
        view_id="decp-entreprises", anchor="S13",
        title="La commande publique, entreprise par entreprise",
        subtitle=f"Marchés notifiés en {YEAR}, par catégorie d'achat puis par titulaire",
        basis="DECP", basis_label=f"Marchés publics notifiés en {YEAR} (montants engagés)",
        year=int(YEAR), nodes=divisions,
        parent_amount=parent_amounts.get("S13"),
        parent_label="Dépenses de toutes les administrations publiques (comptabilité nationale)",
        mapping="dérivé", source=SOURCE, comparable=False,
        perimeter_note=PERIMETER_NOTE,
        caveats=_caveats(len(dropped), dropped_amount, dupes),
        queries=list(trace), source_rows=len(rows) + len(dropped),
    )]

    # — Vue 2 : les plus gros marchés, un par un —
    top = sorted(kept, key=lambda r: -(r.get("montant") or 0))[:TOP_MARCHES]
    tnodes = [node(
        str(r.get("id") or i), (r.get("objetmarche") or "Objet non renseigné")[:180],
        (r.get("montant") or 0) / 1e6,
        detail=" · ".join(x for x in [
            r.get("denominationunitelegale"),
            r.get("nomacheteur") and f"pour {r['nomacheteur']}",
            r.get("referencecpv"),
        ] if x),
    ) for i, r in enumerate(top)]

    views.append(make_view(
        view_id="decp-plus-gros", anchor="S13",
        title=f"Les {TOP_MARCHES} plus gros marchés publics de {YEAR}",
        subtitle="Objet, titulaire et acheteur, marché par marché",
        basis="DECP", basis_label=f"Marchés publics notifiés en {YEAR} (montants engagés)",
        year=int(YEAR), nodes=tnodes,
        parent_amount=parent_amounts.get("S13"),
        parent_label="Dépenses de toutes les administrations publiques (comptabilité nationale)",
        mapping="dérivé", source=SOURCE, comparable=False,
        perimeter_note=PERIMETER_NOTE,
        caveats=_caveats(len(dropped), dropped_amount, dupes),
        queries=list(trace), source_rows=len(rows) + len(dropped),
    ))

    total = sum(d["amount"] for d in divisions)
    print(f"  ✓ {total/1000:,.1f} Md€ · {len(divisions)} catégories d'achat · "
          f"{sum(len(d['children']) for d in divisions):,} entreprises titulaires")
    return views
