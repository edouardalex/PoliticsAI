#!/usr/bin/env python3
"""
Palier 5 — dépenses fiscales et taxes affectées.

Une dépense fiscale n'est pas une dépense : c'est un impôt qu'on renonce à
percevoir (crédit d'impôt, exonération, taux réduit). Elle ne figure donc dans
aucune ligne de dépense de la comptabilité nationale — elle diminue les
recettes. C'est pour cette raison qu'on l'appelle le budget invisible, et
c'est pour la même raison que sa `coverage` est laissée vide : ce n'est pas une
part du parent, c'est un ordre de grandeur à mettre en regard.

Source : annexe « budget vert » au PLF 2026, qui chiffre chaque dispositif au
titre de 2024 et le rattache à un programme du budget de l'État — ce qui permet
de le ranger sous la même fonction que les crédits correspondants.
"""

from __future__ import annotations

from collections import defaultdict

from deep_lolf import CROSSWALK, load_crosswalk  # noqa: F401  (table partagée)
from deep_model import make_view, node, ods_export

DOMAIN = "data.economie.gouv.fr"
DATASETS = {2024: ("plf-2026-budget-vert", "execution_2024_cp")}

SOURCE = {
    "name": "Dépenses fiscales et taxes affectées, chiffrage 2024 (annexe « budget vert » au PLF 2026)",
    "dataset": "data.economie.gouv.fr / plf-2026-budget-vert",
    "url": "https://data.economie.gouv.fr/explore/dataset/plf-2026-budget-vert/",
}

KINDS = {
    "Dépenses fiscales": {
        "slug": "depenses-fiscales",
        "title": "Les impôts auxquels l'État renonce",
        "subtitle": "Crédits d'impôt, exonérations et taux réduits, dispositif par dispositif",
        "group": "impot_si_depense_fiscale",
        "group_label": "impôt concerné",
        "note": (
            "Une dépense fiscale réduit une recette : elle n'apparaît dans "
            "aucune ligne de dépense publique. Le montant indique ce que le "
            "dispositif a coûté au budget de l'État en 2024, pas une somme "
            "versée."),
    },
    "Taxes affectées plafonnées": {
        "slug": "taxes-affectees",
        "title": "Les taxes qui ne passent pas par le budget",
        "subtitle": "Impôts affectés directement à un organisme, sous plafond",
        "group": "affectataire_si_taxe_affectee",
        "group_label": "organisme affectataire",
        "note": (
            "Ces taxes sont perçues au profit direct d'un organisme, sans "
            "transiter par le budget général. Elles financent des dépenses qui, "
            "elles, figurent bien dans la comptabilité nationale."),
    },
}


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    year = next((y for y in years if y in DATASETS), None)
    if year is None:
        print("→ Dépenses fiscales : aucun millésime disponible, vue ignorée")
        return []
    dataset, field = DATASETS[year]
    print(f"→ Dépenses fiscales et taxes affectées ({year})…")

    xw = load_crosswalk()
    views: list[dict] = []

    for kind, cfg in KINDS.items():
        trace: list[str] = []
        rows = ods_export(
            DOMAIN, dataset, where=f"type_depense='{kind}'", trace=trace,
            select=(f"mission,numero_programme,programme,code_depense,libelle,"
                    f"{cfg['group']},{field}"),
        )
        items = [(r, (r.get(field) or 0) / 1e6) for r in rows]
        items = [(r, a) for r, a in items if abs(a) >= 0.5]
        if not items:
            continue

        # Vue nationale : regroupée par impôt (ou par organisme affectataire)
        groups: dict[str, list[dict]] = defaultdict(list)
        for r, amount in items:
            g = r.get(cfg["group"]) or "Non précisé"
            groups[g].append(node(str(r.get("code_depense") or r["libelle"][:40]),
                                  r.get("libelle") or "Sans libellé", amount,
                                  detail=r.get("programme") or None))
        nodes = [node(f"g-{g[:30]}", g, sum(c["amount"] for c in kids), children=kids)
                 for g, kids in groups.items()]

        views.append(make_view(
            view_id=cfg["slug"], anchor="S1311",
            title=cfg["title"], subtitle=cfg["subtitle"],
            basis="FISC", basis_label=f"Chiffrage {year} au titre de l'exercice",
            year=year, nodes=nodes, parent_amount=parent_amounts.get("S1311"),
            parent_label="Dépenses de l'État (comptabilité nationale)",
            mapping="officiel", source=SOURCE, comparable=False,
            queries=list(trace), source_rows=len(rows),
            perimeter_note=cfg["note"],
            caveats=[
                "Les chiffrages de dépenses fiscales sont des estimations de "
                "l'administration, révisées d'une année sur l'autre.",
                "Les montants ne s'additionnent pas aux dépenses : ce sont des "
                "recettes en moins, pas des euros dépensés.",
            ],
        ))

        # Déclinaison par fonction : chaque dispositif suit le programme auquel
        # l'annexe le rattache, donc la fonction COFOG de ce programme.
        by_anchor: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
        for r, amount in items:
            num = r.get("numero_programme")
            m = xw.get(str(int(num))) if num not in (None, "") else None
            if not m:
                continue
            g = r.get(cfg["group"]) or "Non précisé"
            leaf = node(str(r.get("code_depense") or r["libelle"][:40]),
                        r.get("libelle") or "Sans libellé", amount,
                        detail=r.get("programme") or None)
            targets = {m["cofog"][:4]}
            if len(m["cofog"]) > 4:
                targets.add(m["cofog"])
            for t in targets:
                by_anchor[t][g].append(leaf)

        for cofog, groups in by_anchor.items():
            anchor = f"S1311:{cofog}"
            if anchor not in parent_amounts:
                continue
            nodes = [node(f"g-{g[:30]}", g, sum(c["amount"] for c in kids), children=kids)
                     for g, kids in groups.items()]
            views.append(make_view(
                view_id=f"{cfg['slug']}-{cofog.lower()}", anchor=anchor,
                title=cfg["title"], subtitle=cfg["subtitle"],
                basis="FISC", basis_label=f"Chiffrage {year} au titre de l'exercice",
                year=year, nodes=nodes, parent_amount=parent_amounts[anchor],
                parent_label="Dépense de l'État pour cette fonction (comptabilité nationale)",
                mapping="éditorial", source=SOURCE, comparable=False,
                queries=list(trace), source_rows=len(rows),
                perimeter_note=(
                    cfg["note"] + " Le rattachement à cette fonction suit le "
                    "programme budgétaire auquel l'annexe associe le dispositif."),
                caveats=[
                    "Les chiffrages de dépenses fiscales sont des estimations de "
                    "l'administration, révisées d'une année sur l'autre.",
                    "Les montants ne s'additionnent pas aux dépenses de la fonction.",
                ],
            ))

        total = sum(a for _, a in items)
        print(f"  ✓ {kind.lower()} : {total/1000:,.1f} Md€, {len(items)} dispositifs")

    return views
