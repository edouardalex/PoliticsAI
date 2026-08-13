#!/usr/bin/env python3
"""
Palier 4 — budget de l'État, nomenclature LOLF.

Source : data.economie.gouv.fr, jeu `plf-2026-budget-vert`. Ce fichier est le
seul jeu ouvert qui donne l'**exécution 2024 en crédits de paiement** ligne à
ligne, jusqu'au niveau le plus fin publié (mission → programme → action →
ligne de dépense), pour l'ensemble du budget général.

Rattachement : la comptabilité nationale (COFOG) et la comptabilité budgétaire
(LOLF) sont deux référentiels distincts et il n'existe aucune table officielle
qui les relie au niveau du programme. Le rattachement vient donc de
data/crosswalk/programme_cofog.csv, construit et publié par le projet, et
chaque vue est marquée `mapping = éditorial`.
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from deep_model import make_view, node, ods_export

DOMAIN = "data.economie.gouv.fr"
CROSSWALK = Path(__file__).resolve().parent.parent / "crosswalk" / "programme_cofog.csv"

# Millésime du fichier budget vert → millésime d'exécution qu'il porte.
DATASETS = {2024: ("plf-2026-budget-vert", "execution_2024_cp")}

SOURCE = {
    "name": "Budget de l'État — exécution 2024 en crédits de paiement (annexe « budget vert » au PLF 2026)",
    "dataset": "data.economie.gouv.fr / plf-2026-budget-vert",
    "url": "https://data.economie.gouv.fr/explore/dataset/plf-2026-budget-vert/",
}

CAVEATS = [
    "Périmètre budgétaire : budget général de l'État. Il ne recouvre pas la "
    "fonction COFOG correspondante, qui inclut aussi les dépenses des opérateurs "
    "et organismes divers d'administration centrale.",
    "La charge de la dette et les remboursements et dégrèvements d'impôts ne "
    "figurent pas dans cette annexe : ils manquent donc à l'appel.",
    "Le rattachement d'un programme à une fonction est un choix éditorial de "
    "PoliticsAI, pas une classification officielle. La table est publiée dans "
    "le dépôt (data/crosswalk/programme_cofog.csv) avec un niveau de confiance "
    "par ligne.",
]

CONFIDENCE_LABEL = {
    "haute": "rattachement direct",
    "moyenne": "programme composite",
    "basse": "programme de soutien, rattachement conventionnel",
}


def load_crosswalk() -> dict[str, dict]:
    out: dict[str, dict] = {}
    with CROSSWALK.open(encoding="utf-8-sig") as fh:
        for row in csv.DictReader(r for r in fh if not r.lstrip().startswith("#")):
            if not row.get("programme"):
                continue
            out[row["programme"].strip()] = {
                "cofog": row["cofog"].strip(),
                "confiance": (row.get("confiance") or "").strip(),
                "note": (row.get("note") or "").strip(),
            }
    return out


def _key(row: dict) -> str:
    """Clé de rattachement : numéro de programme, ou code de la mission
    pour les prélèvements sur recettes qui n'ont pas de programme."""
    num = row.get("numero_programme")
    if num not in (None, ""):
        return str(int(num))
    return (row.get("mission") or "").strip()


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    year = next((y for y in years if y in DATASETS), None)
    if year is None:
        print("→ LOLF : aucun millésime d'exécution disponible, vue ignorée")
        return []
    dataset, field = DATASETS[year]
    print(f"→ Budget de l'État, nomenclature LOLF (exécution {year})…")

    trace: list[str] = []
    rows = ods_export(
        DOMAIN, dataset, trace=trace,
        where="type_depense='Crédits budgétaires'",
        select=("mission,numero_programme,programme,code_action_si_credit_budgetaire,"
                f"action_si_credit_budgetaire,code_depense,libelle,{field}"),
    )
    xw = load_crosswalk()

    # mission → programme → action → ligne
    tree: dict[str, dict] = {}
    unmapped: dict[str, float] = defaultdict(float)
    total_seen = 0.0
    for r in rows:
        amount = r.get(field)
        if not amount:
            continue
        amount /= 1e6  # € → M€
        total_seen += amount
        key = _key(r)
        m = xw.get(key)
        if not m:
            unmapped[f"{key} — {r.get('programme') or r.get('mission')}"] += amount
            continue
        prog_label = r.get("programme") or f"Programme {key}"
        action = r.get("action_si_credit_budgetaire") or "Non ventilé par action"
        line = r.get("libelle") or action

        cofog = m["cofog"]
        node_key = (cofog, r.get("mission") or "—", key, prog_label, action)
        tree.setdefault(node_key, []).append((r.get("code_depense") or line, line, amount))

    if unmapped:
        tot = sum(unmapped.values())
        print(f"  ⚠ {len(unmapped)} lignes budgétaires non rattachées "
              f"({tot/1000:,.1f} Md€) — elles n'apparaissent dans aucune vue :")
        for k, v in sorted(unmapped.items(), key=lambda kv: -kv[1])[:8]:
            print(f"      {v/1000:7.2f} Md€  {k[:70]}")

    # Regroupement par ancre COFOG (niveau 1 et niveau 2)
    anchors: dict[str, dict] = defaultdict(dict)
    for (cofog, mission, prog, prog_label, action), lines in tree.items():
        targets = {cofog[:4]}
        if len(cofog) > 4:
            targets.add(cofog)
        for anchor in targets:
            a = anchors[anchor]
            mnode = a.setdefault(mission, {})
            pnode = mnode.setdefault((prog, prog_label), {})
            pnode.setdefault(action, []).extend(lines)

    caveats = list(CAVEATS)
    if unmapped:
        caveats.append(
            f"{abs(sum(unmapped.values()))/1000:,.1f} Md€ de lignes budgétaires "
            f"n'ont pas pu être rattachées à une fonction : elles n'apparaissent "
            f"dans aucune vue.".replace(",", " "))

    views = []
    for cofog, missions in sorted(anchors.items()):
        anchor = f"S1311:{cofog}"
        parent = parent_amounts.get(anchor)
        if not parent:
            continue
        nodes = []
        for mission, progs in missions.items():
            pnodes = []
            for (prog, prog_label), actions in progs.items():
                anodes = []
                for action, lines in actions.items():
                    lnodes = [node(f"{prog}-{code}", label, amt)
                              for code, label, amt in lines if abs(amt) >= 0.005]
                    total = sum(a for _, _, a in lines)
                    anodes.append(node(f"{prog}-{action[:24]}", action, total,
                                       children=lnodes if len(lnodes) > 1 else []))
                meta = xw.get(prog, {})
                pnodes.append(node(
                    f"prog-{prog}", prog_label,
                    sum(a["amount"] for a in anodes), children=anodes,
                    detail=meta.get("note") or None,
                    confidence=meta.get("confiance") or None,
                    confidenceLabel=CONFIDENCE_LABEL.get(meta.get("confiance", "")),
                ))
            nodes.append(node(f"mission-{mission[:24]}", mission,
                              sum(p["amount"] for p in pnodes), children=pnodes))

        views.append(make_view(
            view_id=f"lolf-{cofog.lower()}", anchor=anchor,
            title="Dans le budget de l'État, ligne par ligne",
            subtitle="Missions, programmes et actions rattachés à cette fonction",
            basis="LOLF", basis_label=f"Budget général de l'État, exécution {year} (crédits de paiement)",
            year=year, nodes=nodes, parent_amount=parent,
            parent_label="Dépense de l'État pour cette fonction (COFOG, comptabilité nationale)",
            mapping="éditorial", source=SOURCE, caveats=caveats,
            queries=list(trace), source_rows=len(rows),
            perimeter_note=(
                "On quitte ici la comptabilité nationale pour la comptabilité "
                "budgétaire. Les deux ne couvrent pas le même périmètre et ne "
                "s'additionnent pas : la part expliquée est indiquée."),
        ))

    print(f"  ✓ {len(views)} vues LOLF, {total_seen/1000:,.1f} Md€ lus, "
          f"{(total_seen - sum(unmapped.values()))/1000:,.1f} Md€ rattachés")
    return views
