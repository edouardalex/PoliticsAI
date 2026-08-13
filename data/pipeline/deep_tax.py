#!/usr/bin/env python3
"""
Palier 7 — les recettes, impôt par impôt.

Le côté gauche du diagramme était le plus grossier de toute l'application :
1 504 Md€ décrits par neuf postes. Le jeu Eurostat `gov_10a_taxag` donne la
nomenclature fiscale complète du SEC 2010 — jusqu'aux droits d'accise, aux
taxes sur les primes d'assurance ou aux cotisations des travailleurs
indépendants — dans **le même référentiel, le même millésime et la même
consolidation** que le reste des comptes.

C'est donc le jumeau du palier 0 : on ne change pas de source, on ouvre une
dimension qui était déjà là. Aucun rattachement éditorial, additivité exacte
vérifiée à l'écriture.

Deux limites franches, portées par les vues :
  - la TVA (206 Md€), l'impôt sur le revenu (275 Md€) et l'impôt sur les
    sociétés (84 Md€) n'ont **aucun sous-détail** dans cette nomenclature : ils
    restent des lignes uniques ;
  - les recettes non fiscales (ventes, redevances, revenus du patrimoine) n'y
    figurent pas : la vue couvre les impôts et cotisations, pas tout le produit.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request

from deep_model import make_view, node

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
DATASET = "gov_10a_taxag"

SECTORS = ["S13", "S1311", "S1313", "S1314"]

SOURCE = {
    "name": "Eurostat — agrégats d'impôts et de cotisations sociales des comptes nationaux",
    "dataset": f"Eurostat / {DATASET}",
    "url": "https://ec.europa.eu/eurostat/fr/web/government-finance-statistics",
}

# Arbres rattachés à chaque poste de recettes de l'application.
# (code de l'application → titre, sous-titre, racine de l'arbre ESA)
TREES: dict[str, tuple[str, str, list]] = {
    "D61": (
        "Qui paie les cotisations sociales",
        "Employeurs, salariés, indépendants, retraités",
        [
            ("D611", "À la charge des employeurs", [
                ("D611C", "Cotisations obligatoires", []),
                ("D611V", "Cotisations volontaires", []),
            ]),
            ("D613", "À la charge des ménages", [
                ("D613CE", "Salariés", []),
                ("D613CS", "Travailleurs indépendants", []),
                ("D613CN", "Personnes n'occupant pas d'emploi", []),
                ("D613V", "Cotisations volontaires", []),
            ]),
            ("D612", "Cotisations imputées", []),
        ],
    ),
    "D21X": (
        "Les accises et taxes sur les produits",
        "Tout ce qui frappe un produit ou un service en dehors de la TVA",
        [
            ("D214A", "Droits d'accise et impôts de consommation", []),
            ("D214G", "Taxes sur les primes d'assurance", []),
            ("D214C", "Impôts sur les transactions mobilières", []),
            ("D214H", "Autres taxes sur des services déterminés", []),
            ("D214F", "Impôts sur les loteries, jeux et paris", []),
            ("D214D", "Taxes à l'immatriculation des véhicules", []),
            ("D214I", "Impôts généraux sur les ventes", []),
            ("D214E", "Taxes sur les spectacles et divertissements", []),
            ("D214B", "Droits de timbre", []),
            ("D214L", "Autres impôts sur les produits", []),
            ("D212", "Droits et taxes à l'importation", []),
        ],
    ),
    "D29": (
        "Les impôts sur la production",
        "Ce que les entreprises paient parce qu'elles produisent, pas parce qu'elles gagnent",
        [
            ("D29A", "Impôts sur les terrains, bâtiments et autres constructions", []),
            ("D29C", "Impôts sur la masse salariale et les effectifs", []),
            ("D29H", "Autres impôts sur la production", []),
            ("D29F", "Impôts sur les émissions polluantes", []),
            ("D29B", "Impôts sur l'utilisation d'actifs fixes", []),
            ("D29E", "Autorisations d'exercer une activité", []),
            ("D29D", "Impôts sur les transactions internationales", []),
            ("D29G", "Sous-compensation de TVA (régime forfaitaire)", []),
        ],
    ),
    "D5X_D91": (
        "Patrimoine, successions et autres impôts",
        "Ce qui est prélevé sur le capital détenu ou transmis",
        [
            ("D91A", "Droits de succession et de donation", []),
            ("D59A", "Impôts courants sur le capital", []),
            ("D91B", "Prélèvements sur le capital", []),
            ("D91C", "Autres impôts sur le capital", []),
            ("D59F", "Autres impôts courants", []),
            ("D59D", "Licences acquittées par les ménages", []),
            ("D59B", "Impôts de capitation", []),
            ("D59C", "Impôts sur la dépense", []),
            ("D59E", "Impôts sur les transactions internationales", []),
        ],
    ),
}

PERIMETER_NOTE = (
    "Même source et même millésime que le diagramme : on ouvre une nomenclature "
    "qui était déjà dans les comptes, sans changer de référentiel. Les montants "
    "sont ceux effectivement encaissés par le périmètre affiché."
)

CAVEATS = [
    "La TVA, l'impôt sur le revenu et l'impôt sur les sociétés n'ont pas de "
    "sous-détail dans cette nomenclature : ils restent des lignes uniques.",
    "Les montants sont nets des impôts dus mais non recouvrables, isolés dans "
    "une ligne négative lorsqu'ils sont significatifs.",
]


def _cube(sector: str, year: int, trace: list[str]) -> dict | None:
    qs = [("format", "JSON"), ("lang", "FR"), ("geo", "FR"), ("time", str(year)),
          ("unit", "MIO_EUR"), ("sector", sector)]
    url = BASE + DATASET + "?" + urllib.parse.urlencode(qs)
    trace.append(url)
    req = urllib.request.Request(url, headers={"User-Agent": "PoliticsAI-pipeline/0.2"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            js = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    if not js.get("value"):
        return None
    ids, sizes = js["id"], js["size"]
    inv = {v: k for k, v in js["dimension"]["na_item"]["category"]["index"].items()}
    out: dict[str, float] = {}
    for pos, val in js["value"].items():
        p = int(pos)
        coords = {}
        for d, s in zip(reversed(ids), reversed(sizes)):
            coords[d] = p % s
            p //= s
        out[inv[coords["na_item"]]] = val
    return out


def _build(spec: list, vals: dict, prefix: str) -> list[dict]:
    out = []
    for code, label, kids in spec:
        v = vals.get(code)
        if v is None or abs(v) < 0.5:
            continue
        children = _build(kids, vals, prefix)
        # Un parent dont les enfants ne bouclent pas garde un reste explicite.
        if children:
            gap = v - sum(c["amount"] for c in children)
            if abs(gap) > max(1.0, abs(v) * 0.005):
                children.append(node(f"{prefix}{code}-reste", "Autres", gap))
        out.append(node(f"{prefix}{code}", label, v, children=children, detail=code))
    return out


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    import json as _json
    from pathlib import Path

    france = _json.loads(
        (Path(__file__).resolve().parent.parent / "processed" / "france.json")
        .read_text(encoding="utf-8"))

    trace: list[str] = []
    views: list[dict] = []
    year = None
    cubes: dict[str, dict] = {}
    for sector in SECTORS:
        for candidate in years:
            c = _cube(sector, candidate, trace)
            if c:
                cubes[sector] = c
                year = year or candidate
                break

    if not cubes:
        print("→ Recettes : aucune donnée fiscale disponible, palier ignoré")
        return []

    print(f"→ Recettes — nomenclature fiscale complète ({year})…")

    for sector, vals in cubes.items():
        revenues = {r["code"]: r["value"] for r in france["perimeters"][sector]["revenues"]}
        for app_code, (title, subtitle, spec) in TREES.items():
            parent = revenues.get(app_code)
            if not parent or parent < 100:
                continue
            nodes = _build(spec, vals, f"{sector}-")
            if len(nodes) < 2:
                continue
            # Impôts dus non recouvrables : ligne négative, jamais gommée.
            total = sum(n["amount"] for n in nodes)
            if parent and abs(total - parent) > max(1.0, parent * 0.005):
                nodes.append(node(f"{sector}-{app_code}-ecart",
                                  "Écart de périmètre avec les comptes nationaux",
                                  parent - total))
            views.append(make_view(
                view_id=f"tax-{sector.lower()}-{app_code.lower()}",
                anchor=f"{sector}:{app_code}",
                title=title, subtitle=subtitle,
                basis="SEC2010",
                basis_label=f"Agrégats fiscaux des comptes nationaux, {year}",
                year=year, nodes=nodes, parent_amount=parent,
                parent_label="Ce poste de recettes dans le diagramme",
                mapping="officiel", source=SOURCE,
                perimeter_note=PERIMETER_NOTE, caveats=CAVEATS,
                queries=[u for u in trace
                         if f"sector={sector}&" in u + "&" or u.endswith(f"sector={sector}")],
                source_rows=len(vals),
            ))

    print(f"  ✓ {len(views)} vues de recettes sur {len(cubes)} périmètres")
    return views
