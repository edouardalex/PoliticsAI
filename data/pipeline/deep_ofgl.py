#!/usr/bin/env python3
"""
Palier 3 — finances des collectivités locales.

Source : data.ofgl.fr (Observatoire des finances et de la gestion publique
locales). Deux sorties de nature différente :

1. une vue nationale rattachée au périmètre S1313, qui décompose la dépense
   locale par niveau de collectivité puis par nature (personnel, achats,
   interventions, équipement…) ;
2. un annuaire par commune — le seul niveau de granularité qu'un lecteur peut
   vraiment se réapproprier. 34 000 communes, en euros par habitant, avec la
   médiane de la strate de population comme point de comparaison.

L'annuaire est découpé par département : l'application ne charge que ce dont
elle a besoin.
"""

from __future__ import annotations

import json
import statistics
from collections import defaultdict

from deep_model import OUT_DIR, TODAY, lit, make_view, node, ods_export, ods_records

DOMAIN = "data.ofgl.fr"

BASES = [
    ("ofgl-base-communes", "Communes"),
    ("ofgl-base-gfp", "Intercommunalités à fiscalité propre"),
    ("ofgl-base-departements", "Départements"),
    ("ofgl-base-regions", "Régions"),
    ("ofgl-base-syndicats", "Syndicats intercommunaux"),
]

# Décomposition additive de la dépense locale (vérifiée à l'exécution).
SECTIONS = {
    "Fonctionnement": ("Dépenses de fonctionnement", [
        "Frais de personnel",
        "Achats et charges externes",
        "Dépenses d'intervention",
        "Charges financières",
        "Autres dépenses de fonctionnement",
    ]),
    "Investissement": ("Dépenses d'investissement", [
        "Dépenses d'équipement",
        "Subventions d'équipement versées",
        "Remboursements d'emprunts hors GAD",
        "Autres dépenses d'investissement",
    ]),
}

DETAIL = {
    "Frais de personnel": "Traitements et charges des agents territoriaux",
    "Achats et charges externes": "Énergie, fournitures, entretien, prestations",
    "Dépenses d'intervention": "Subventions et aides versées",
    "Dépenses d'équipement": "Travaux et acquisitions : écoles, voirie, bâtiments",
    "Remboursements d'emprunts hors GAD": "Remboursement du capital de la dette",
}

# Indicateurs conservés commune par commune (libellé OFGL → clé courte).
COMMUNE_FIELDS = {
    "Dépenses totales": "dt",
    "Dépenses de fonctionnement": "df",
    "Frais de personnel": "fp",
    "Achats et charges externes": "ac",
    "Dépenses d'intervention": "di",
    "Dépenses d'investissement": "dinv",
    "Dépenses d'équipement": "eq",
    "Recettes totales": "rt",
    "Impôts locaux": "il",
    "Dotation globale de fonctionnement": "dgf",
    "Encours de dette": "dette",
    "Epargne brute": "eb",
}

SOURCE = {
    "name": "Observatoire des finances et de la gestion publique locales (OFGL)",
    "dataset": "data.ofgl.fr / comptes des collectivités",
    "url": "https://data.ofgl.fr/explore/",
}

CAVEATS = [
    "Les niveaux de collectivités sont additionnés sans être consolidés entre "
    "eux : un euro qu'une commune verse à son intercommunalité est compté deux "
    "fois. La comptabilité nationale, elle, le neutralise.",
    "Budgets principaux uniquement : les budgets annexes (eau, assainissement, "
    "transports) ne sont pas comptés.",
]


def _sum(dataset: str, year: int, agregat: str,
         trace: list[str] | None = None) -> float:
    where = (f"year(exer)={year} and type_de_budget={lit('Budget principal')} "
             f"and agregat={lit(agregat)}")
    res = ods_records(DOMAIN, dataset, limit=1, select="sum(montant) as m",
                      where=where, trace=trace)
    return (res[0]["m"] or 0) / 1e6 if res else 0.0


def _pick_year(dataset: str, years: list[int]) -> int | None:
    res = ods_records(DOMAIN, dataset, limit=20, group_by="exer", select="exer")
    have = {int(str(r["exer"])[:4]) for r in res if r.get("exer")}
    return next((y for y in years if y in have), None)


def build_national(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    year = _pick_year("ofgl-base-communes", years)
    if year is None:
        return []
    print(f"→ OFGL — structure de la dépense locale ({year})…")

    trace: list[str] = []
    nodes = []
    for dataset, label in BASES:
        section_nodes = []
        for section, (total_label, parts) in SECTIONS.items():
            kids = []
            for agregat in parts:
                v = _sum(dataset, year, agregat, trace)
                if abs(v) < 1:
                    continue
                kids.append(node(f"{dataset}-{agregat[:20]}", agregat, v,
                                 detail=DETAIL.get(agregat)))
            if not kids:
                continue
            declared = _sum(dataset, year, total_label, trace)
            got = sum(k["amount"] for k in kids)
            if declared and abs(got - declared) / declared > 0.01:
                # Rien n'est mis à l'échelle : l'écart devient un poste visible.
                kids.append(node(f"{dataset}-{section}-reste", "Autres dépenses",
                                 declared - got))
            section_nodes.append(node(f"{dataset}-{section}", section,
                                      declared or got, children=kids))
        if section_nodes:
            nodes.append(node(dataset, label,
                              sum(s["amount"] for s in section_nodes),
                              children=section_nodes))

    view = make_view(
        view_id="ofgl-collectivites", anchor="S1313",
        title="Par niveau de collectivité et par nature",
        subtitle="Communes, intercommunalités, départements, régions et syndicats",
        basis="M57", basis_label=f"Comptes de gestion des collectivités, exercice {year}",
        year=year, nodes=nodes, parent_amount=parent_amounts.get("S1313"),
        parent_label="Dépenses des collectivités locales (comptabilité nationale)",
        mapping="dérivé", source=SOURCE, caveats=CAVEATS,
        queries=list(trace), source_rows=len(trace),
        perimeter_note=(
            "On passe de la comptabilité nationale aux comptes de gestion des "
            "collectivités. Les périmètres diffèrent, et les niveaux ne sont pas "
            "consolidés entre eux."),
    )
    print(f"  ✓ {view['amount']/1000:,.1f} Md€ sur {len(nodes)} niveaux de collectivités")
    return [view]


def build_communes(years: list[int]) -> None:
    year = _pick_year("ofgl-base-communes", years)
    if year is None:
        return
    print(f"→ OFGL — annuaire des communes ({year})…")

    deps = sorted({r["dep_code"] for r in ods_records(
        DOMAIN, "ofgl-base-communes", limit=110, group_by="dep_code",
        select="dep_code") if r.get("dep_code")})

    agregats = ",".join(lit(a) for a in COMMUNE_FIELDS)
    out_dir = OUT_DIR / "communes"
    out_dir.mkdir(parents=True, exist_ok=True)

    index: list[list] = []
    by_tranche: dict[str, list[float]] = defaultdict(list)
    dep_names: dict[str, str] = {}
    total = 0

    for dep in deps:
        rows = ods_export(
            DOMAIN, "ofgl-base-communes",
            where=(f"year(exer)={year} and type_de_budget={lit('Budget principal')} "
                   f"and dep_code={lit(dep)} and agregat in ({agregats})"),
            select="com_code,com_name,dep_code,dep_name,ptot,tranche_population,"
                   "agregat,montant",
        )
        communes: dict[str, dict] = {}
        for r in rows:
            code = r.get("com_code")
            if not code:
                continue
            c = communes.setdefault(code, {
                "c": code, "n": r.get("com_name") or code,
                "p": int(r.get("ptot") or 0),
                "t": r.get("tranche_population") or "",
                "v": {},
            })
            key = COMMUNE_FIELDS.get(r.get("agregat"))
            if key and r.get("montant") is not None:
                c["v"][key] = round(r["montant"])
            if r.get("dep_name"):
                dep_names[dep] = r["dep_name"]

        rows_out = sorted(communes.values(), key=lambda c: c["n"])
        (out_dir / f"{dep}.json").write_text(
            json.dumps({"dep": dep, "name": dep_names.get(dep, dep), "year": year,
                        "communes": rows_out}, ensure_ascii=False,
                       separators=(",", ":")), encoding="utf-8")
        for c in rows_out:
            index.append([c["c"], c["n"], dep])
            if c["p"] > 0 and c["v"].get("dt"):
                by_tranche[c["t"]].append(c["v"]["dt"] / c["p"])
        total += len(rows_out)
        print(f"    {dep} {dep_names.get(dep, ''):28} {len(rows_out):5} communes", end="\r")

    medians = {t: round(statistics.median(v)) for t, v in by_tranche.items() if v}
    (OUT_DIR / "communes-index.json").write_text(
        json.dumps({"year": year, "extracted": TODAY, "fields": COMMUNE_FIELDS,
                    "medianeStrate": medians,
                    "departements": dep_names, "communes": index},
                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  ✓ {total:,} communes réparties en {len(deps)} départements" + " " * 30)


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    views = build_national(parent_amounts, years)
    build_communes(years)
    return views
