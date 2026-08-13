#!/usr/bin/env python3
"""
Palier 2 — cartographie médicalisée des dépenses de l'Assurance maladie.

Source : data.ameli.fr, jeu `depenses` (« Pathologies : dépenses remboursées
affectées à chaque pathologie »). La CNAM affecte chaque euro remboursé à un
groupe de pathologie, à un traitement chronique ou à un épisode de soins : la
ventilation est donc **officielle**, pas reconstruite par nos soins.

Deux vues en sortent, parce que la comptabilité nationale classe les deux blocs
à des endroits différents :
  - soins en nature (hôpital + ville) → fonction Santé (GF07)
  - prestations en espèces (indemnités journalières, invalidité, rentes AT/MP)
    → fonction Protection sociale (GF10)

Profondeur : pathologie N1 → N2 → N3 → poste de soin (27 postes).
Le nombre de patients (`ntop`) et le coût moyen annuel sont conservés : c'est
le niveau que le lecteur peut réellement se représenter.
"""

from __future__ import annotations

from deep_model import make_view, node, ods_export, ods_records

DOMAIN = "data.ameli.fr"
DATASET = "depenses"

TOTAL_LABEL = "Total consommants tous régimes"

# dep_niv_1 → (rattachement COFOG, libellé court)
IN_KIND = {"Hospitalisations (tous secteurs)": "Hôpital",
           "Soins de ville": "Soins de ville"}
CASH = "Prestations en espèces"

SOURCE = {
    "name": "Assurance maladie (CNAM) — cartographie des pathologies et des dépenses",
    "dataset": "data.ameli.fr / depenses",
    "url": "https://data.ameli.fr/explore/dataset/depenses/",
}


def _levels(row: dict) -> set[str]:
    v = row.get("niveau_prioritaire") or []
    return set(v if isinstance(v, list) else [v])


def _pick_year(years: list[int]) -> int:
    got = ods_records(DOMAIN, DATASET, limit=50, group_by="annee", select="annee")
    have = {int(str(r["annee"])[:4]) for r in got if r.get("annee")}
    for y in years:
        if y in have:
            return y
    raise SystemExit("aucun millésime CNAM disponible")


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    trace: list[str] = []
    year = _pick_year(years)
    print(f"→ CNAM cartographie des pathologies ({year})…")

    rows = ods_export(
        DOMAIN, DATASET,
        where=f"year(annee)={year} and type_somme='Partiel'",
        select="patho_niv1,patho_niv2,patho_niv3,top,dep_niv_1,dep_niv_2,"
               "montant,ntop,n_recourant_au_poste,niveau_prioritaire",
        trace=trace,
    )
    print(f"  {len(rows):,} lignes pathologie × poste de soin")

    # Effectifs de patients par groupe (non additifs : une personne peut relever
    # de plusieurs pathologies — on ne les cumule jamais dans l'arbre).
    counts: dict[str, int] = {}
    meta: dict[str, dict] = {}
    for r in rows:
        top = r["top"]
        if top not in meta:
            meta[top] = {"n1": r["patho_niv1"], "n2": r["patho_niv2"],
                         "n3": r["patho_niv3"], "levels": _levels(r)}
        if r.get("ntop"):
            counts[top] = max(counts.get(top, 0), int(r["ntop"]))

    def build_view(keep: set[str] | None, drop: str | None,
                   anchor: str, view_id: str, title: str, subtitle: str,
                   parent_label: str, perimeter_note: str,
                   caveats: list[str]) -> dict | None:
        # Montant par (top, poste) sur le périmètre retenu
        by_top: dict[str, dict[str, float]] = {}
        recourants: dict[tuple[str, str], int] = {}
        for r in rows:
            d1 = r["dep_niv_1"]
            if keep is not None and d1 not in keep:
                continue
            if drop is not None and d1 == drop:
                continue
            m = r.get("montant")
            if not m:
                continue
            key = f"{IN_KIND.get(d1, d1)} — {r['dep_niv_2']}"
            by_top.setdefault(r["top"], {})
            by_top[r["top"]][key] = by_top[r["top"]].get(key, 0.0) + m / 1e6
            if r.get("n_recourant_au_poste"):
                recourants[(r["top"], key)] = int(r["n_recourant_au_poste"])

        if not by_top:
            return None

        def postes(top: str) -> list[dict]:
            out = []
            for label, amount in by_top.get(top, {}).items():
                if amount < 0.05:
                    continue
                n = recourants.get((top, label))
                out.append(node(
                    f"{top}|{label}", label, amount,
                    unitCost=({"amount": round(amount * 1e6 / n),
                               "per": "personne", "count": n}
                              if n and n > 1000 else None),
                ))
            return out

        def amount_of(top: str) -> float:
            return sum(by_top.get(top, {}).values())

        tops = [t for t in meta if t in by_top and meta[t]["n1"] != TOTAL_LABEL]

        def make_node(top: str, level: int) -> dict:
            m = meta[top]
            label = m[f"n{level}"] or m["n1"]
            kids: list[dict] = []
            if level < 3:
                nxt = level + 1
                for t2 in tops:
                    if t2 == top:
                        continue
                    m2 = meta[t2]
                    same = all(m2[f"n{i}"] == m[f"n{i}"] for i in range(1, level + 1))
                    if same and str(nxt) in m2["levels"] and m2[f"n{nxt}"]:
                        kids.append(make_node(t2, nxt))
            if not kids:
                kids = postes(top)
            n = counts.get(top)
            amt = amount_of(top)
            return node(
                top, label, amt, children=kids,
                unitCost=({"amount": round(amt * 1e6 / n), "per": "patient", "count": n}
                          if n and n > 1000 else None),
            )

        roots = [make_node(t, 1) for t in tops if "1" in meta[t]["levels"]]
        parent = parent_amounts.get(anchor)
        return make_view(
            view_id=view_id, anchor=anchor, title=title, subtitle=subtitle,
            basis="CNAM", basis_label="Dépenses remboursées, tous régimes d'assurance maladie",
            year=year, nodes=roots, parent_amount=parent,
            parent_label=parent_label, mapping="officiel", source=SOURCE,
            perimeter_note=perimeter_note, caveats=caveats,
            unit_note="Coût moyen annuel par patient du groupe.",
            queries=list(trace), source_rows=len(rows),
        )

    views = []
    v1 = build_view(
        keep=set(IN_KIND), drop=None, anchor="S1314:GF07",
        view_id="cnam-pathologies",
        title="Par maladie et par type de soin",
        subtitle="Ce que l'Assurance maladie rembourse, affecté pathologie par pathologie",
        parent_label="Santé — administrations de sécurité sociale (COFOG GF07)",
        perimeter_note=(
            "Périmètre : montants remboursés par l'assurance maladie obligatoire "
            "(hôpital et soins de ville). La fonction Santé de la comptabilité "
            "nationale est plus large : elle inclut notamment des dépenses non "
            "remboursées et des dotations à des établissements."),
        caveats=[
            "Une même personne peut relever de plusieurs groupes de pathologies : "
            "les effectifs de patients ne s'additionnent pas d'un groupe à l'autre.",
            "Les euros, eux, sont affectés une seule fois : les montants s'additionnent.",
        ])
    if v1:
        views.append(v1)

    v2 = build_view(
        keep={CASH}, drop=None, anchor="S1314:GF10",
        view_id="cnam-especes",
        title="Arrêts de travail, invalidité et rentes, par maladie",
        subtitle="Les prestations versées en argent par l'assurance maladie",
        parent_label="Protection sociale — administrations de sécurité sociale (COFOG GF10)",
        perimeter_note=(
            "Ces prestations sont versées en argent : la comptabilité nationale "
            "les classe en protection sociale, pas en santé. Le parent (GF10) "
            "couvre aussi les retraites, le chômage et les prestations familiales."),
        caveats=[
            "Périmètre : indemnités journalières, pensions d'invalidité et rentes "
            "AT/MP servies par l'assurance maladie uniquement.",
        ])
    if v2:
        views.append(v2)

    for v in views:
        print(f"  ✓ {v['id']} : {v['amount']/1000:,.1f} Md€, "
              f"{len(v['nodes'])} groupes de pathologies")
    return views
