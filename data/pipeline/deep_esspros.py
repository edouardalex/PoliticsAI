#!/usr/bin/env python3
"""
Palier 6 — prestations de protection sociale, prestation par prestation.

Le plus gros bloc du budget public — 693 Md€ de protection sociale — s'arrêtait
à huit sous-fonctions COFOG, dont un « Vieillesse : 392 Md€ » que rien ne
détaillait. Les bases **ESSPROS** d'Eurostat (`spr_exp_f*`) donnent la
ventilation officielle par prestation nommée, sur trois axes emboîtés :

    espèces / nature
      → périodiques / uniques
        → prestation détaillée (pension de vieillesse, allocation de soins…)

avec, en plus, la distinction **sous / sans conditions de ressources**, qui n'a
aucun équivalent dans le COFOG et répond à une question que personne ne peut
trancher aujourd'hui : quelle part de la protection sociale est conditionnée
aux revenus ?

Deux avertissements portés par les vues elles-mêmes :
  - ESSPROS couvre **tous les régimes**, y compris complémentaires et
    d'employeur : le périmètre est plus large que les administrations publiques,
    et l'on ne prétend donc à aucune part expliquée ;
  - le dernier millésime français est **2023**, un an derrière le reste de
    l'application.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request

from deep_model import make_view, node

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"

# Jeu ESSPROS → (fonction COFOG d'accueil, libellé, sous-titre)
FUNCTIONS = {
    "spr_exp_fol": ("GF1002", "Vieillesse",
                    "Pensions, minimum vieillesse, aide à l'autonomie des âgés"),
    "spr_exp_fsu": ("GF1003", "Survie",
                    "Pensions de réversion et prestations aux survivants"),
    "spr_exp_fdi": ("GF1001", "Invalidité",
                    "Pensions d'invalidité, allocations et aides aux personnes handicapées"),
    "spr_exp_ffa": ("GF1004", "Famille et enfants",
                    "Allocations familiales, congés, accueil du jeune enfant"),
    "spr_exp_fun": ("GF1005", "Chômage",
                    "Indemnisation, formation et aides au retour à l'emploi"),
    "spr_exp_fho": ("GF1006", "Logement",
                    "Aides personnelles au logement"),
    "spr_exp_fex": ("GF1007", "Exclusion sociale",
                    "Revenus minimaux et aides aux personnes en difficulté"),
    "spr_exp_fsi": ("GF07", "Maladie et soins de santé",
                    "Soins remboursés et indemnités journalières"),
}

# Vue d'ensemble : tout sauf la santé, sous la fonction Protection sociale.
OVERVIEW_EXCLUDE = {"spr_exp_fsi"}

SOURCE = {
    "name": "Eurostat — système européen de statistiques intégrées de la protection sociale (ESSPROS)",
    "dataset": "Eurostat / spr_exp_f*",
    "url": "https://ec.europa.eu/eurostat/fr/web/social-protection/database",
    "producer": "Eurostat (Commission européenne), alimenté pour la France par l'Insee",
    "licence": "Réutilisation autorisée avec mention de la source (politique Eurostat)",
    "cadence": "Annuelle",
    "brings": "Les huit fonctions de protection sociale décomposées en prestations nommées, et la part versée sous conditions de ressources — que le COFOG ne dit pas.",
}

PERIMETER_NOTE = (
    "ESSPROS recense les prestations de protection sociale versées par "
    "tous les régimes — sécurité sociale, État et collectivités, mais aussi "
    "régimes complémentaires et d'employeur. Le périmètre est donc plus large "
    "que celui des administrations publiques : ces montants ne sont pas une "
    "part de la ligne parente. Ils excluent en revanche les frais de gestion, "
    "que le COFOG inclut."
)

CAVEATS = [
    "Millésime 2023 : ces bases ont un an de retard sur les comptes par "
    "fonction utilisés ailleurs dans l'application. Les deux ne se comparent "
    "pas terme à terme.",
    "Une prestation « sans conditions de ressources » peut rester soumise à "
    "d'autres conditions (âge, cotisations, situation familiale).",
    "Les frais de gestion des régimes ne sont pas comptés ici : ESSPROS mesure "
    "ce qui arrive aux bénéficiaires, pas le coût de l'administration.",
]

TOTAL_CODE = "SPR"


def _fetch(dataset: str, year: int, trace: list[str]) -> dict | None:
    qs = [("format", "JSON"), ("lang", "FR"), ("geo", "FR"),
          ("time", str(year)), ("unit", "MIO_EUR")]
    url = BASE + dataset + "?" + urllib.parse.urlencode(qs)
    trace.append(url)
    req = urllib.request.Request(url, headers={"User-Agent": "PoliticsAI-pipeline/0.2"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            js = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    return js if js.get("value") else None


def _decode(js: dict) -> tuple[dict[tuple[str, str], float], dict[str, str]]:
    """(spdep, spdepm) → montant, et libellés des prestations."""
    ids, sizes = js["id"], js["size"]
    idx = {d: js["dimension"][d]["category"]["index"] for d in ids}
    inv = {d: {v: k for k, v in idx[d].items()} for d in ids}
    out: dict[tuple[str, str], float] = {}
    for pos, val in js["value"].items():
        p = int(pos)
        coords = {}
        for d, s in zip(reversed(ids), reversed(sizes)):
            coords[d] = inv[d][p % s]
            p //= s
        out[(coords["spdep"], coords["spdepm"])] = val
    labels = js["dimension"]["spdep"]["category"].get("label", {})
    return out, labels


def _clean(label: str, parent_label: str | None) -> str:
    """Les libellés Eurostat répètent la branche : « Prestations périodiques en
    espèces - pension de vieillesse ». On ne garde que ce qui est nouveau."""
    if " - " in label:
        head, tail = label.rsplit(" - ", 1)
        if parent_label and head.strip().lower() in parent_label.strip().lower():
            return tail[:1].upper() + tail[1:]
        return tail[:1].upper() + tail[1:]
    return label


def _parents(codes: set[str]) -> dict[str, str]:
    """Le parent d'un code est le code le plus long qui le préfixe
    (CASH_P_OLD_PEN → CASH_P → CASH), la racine SPR à défaut. Les codes ESSPROS
    de premier niveau (CASH, KND) ne portent pas le préfixe de la racine, d'où
    ce calcul plutôt qu'un simple `startswith`."""
    out: dict[str, str] = {}
    for c in codes:
        if c == TOTAL_CODE:
            continue
        ancestors = [o for o in codes
                     if o not in (c, TOTAL_CODE) and c.startswith(o + "_")]
        out[c] = max(ancestors, key=len) if ancestors else TOTAL_CODE
    return out


def _tree(vals: dict, labels: dict, id_prefix: str = "") -> list[dict]:
    """Reconstruit la hiérarchie à partir de l'emboîtement des codes ESSPROS.
    L'additivité est vérifiée par check_tree au moment de l'écriture."""
    codes = {c for (c, m) in vals if m == "TOTAL"}
    parent = _parents(codes)

    def build_level(node_code: str) -> list[dict]:
        out = []
        for code in sorted(c for c, p in parent.items() if p == node_code):
            amount = vals.get((code, "TOTAL"))
            if amount is None or abs(amount) < 0.5:
                continue
            kids = build_level(code)
            mt = vals.get((code, "MT"))
            out.append(node(
                f"{id_prefix}{code}",
                _clean(labels.get(code, code), labels.get(node_code)),
                amount, children=kids,
                meansTested=({"amount": round(mt, 1), "share": round(mt / amount, 4)}
                             if mt is not None and amount else None),
            ))
        return out

    return build_level(TOTAL_CODE)


def build(parent_amounts: dict[str, float], years: list[int]) -> list[dict]:
    trace: list[str] = []
    year = None
    cubes: dict[str, tuple[dict, dict]] = {}
    for candidate in [*years, 2023, 2022]:
        probe = _fetch("spr_exp_fol", candidate, trace)
        if probe:
            year = candidate
            cubes["spr_exp_fol"] = _decode(probe)
            break
    if year is None:
        print("→ ESSPROS : aucun millésime disponible, palier ignoré")
        return []

    print(f"→ ESSPROS — prestations de protection sociale ({year})…")
    for dataset in FUNCTIONS:
        if dataset in cubes:
            continue
        js = _fetch(dataset, year, trace)
        if js:
            cubes[dataset] = _decode(js)
        else:
            print(f"  ⚠ {dataset} indisponible pour {year}, fonction absente des vues")

    views: list[dict] = []
    grand_total = 0.0

    # — Une vue par fonction, sous la sous-fonction COFOG correspondante —
    for dataset, (cofog, label, subtitle) in FUNCTIONS.items():
        if dataset not in cubes:
            continue
        vals, labels = cubes[dataset]
        nodes = _tree(vals, labels)
        if not nodes:
            continue
        total = vals.get((TOTAL_CODE, "TOTAL"), 0.0)
        grand_total += total
        anchor = f"S13:{cofog}"
        views.append(make_view(
            view_id=f"esspros-{cofog.lower()}", anchor=anchor,
            title=f"{label} : par prestation",
            subtitle=subtitle,
            basis="ESSPROS",
            basis_label=f"Prestations de protection sociale, tous régimes, {year}",
            year=year, nodes=nodes,
            parent_amount=parent_amounts.get(anchor),
            parent_label="Dépense publique pour cette fonction (COFOG, comptabilité nationale)",
            mapping="dérivé", source=SOURCE, comparable=False,
            perimeter_note=PERIMETER_NOTE, caveats=CAVEATS,
            unit_note="Part de la prestation versée sous conditions de ressources.",
            queries=[u for u in trace if dataset in u and f"time={year}" in u],
            source_rows=len([1 for (_, m) in vals if m == "TOTAL"]),
        ))

    # — Vue d'ensemble sous Protection sociale (hors santé) —
    overview: list[dict] = []
    over_rows = 0
    for dataset, (cofog, label, subtitle) in FUNCTIONS.items():
        if dataset in OVERVIEW_EXCLUDE or dataset not in cubes:
            continue
        vals, labels = cubes[dataset]
        kids = _tree(vals, labels, id_prefix=f"{cofog}-")
        total = vals.get((TOTAL_CODE, "TOTAL"))
        if not kids or total is None:
            continue
        over_rows += len([1 for (_, m) in vals if m == "TOTAL"])
        mt = vals.get((TOTAL_CODE, "MT"))
        overview.append(node(
            f"fn-{cofog}", label, total, children=kids, detail=subtitle,
            meansTested=({"amount": round(mt, 1), "share": round(mt / total, 4)}
                         if mt is not None and total else None),
        ))

    if overview:
        views.append(make_view(
            view_id="esspros-gf10", anchor="S13:GF10",
            title="Toute la protection sociale, prestation par prestation",
            subtitle="Retraites, famille, chômage, invalidité, logement, minima sociaux",
            basis="ESSPROS",
            basis_label=f"Prestations de protection sociale, tous régimes, {year}",
            year=year, nodes=overview,
            parent_amount=parent_amounts.get("S13:GF10"),
            parent_label="Protection sociale, toutes administrations (COFOG, comptabilité nationale)",
            mapping="dérivé", source=SOURCE, comparable=False,
            perimeter_note=PERIMETER_NOTE, caveats=CAVEATS,
            unit_note="Part de la prestation versée sous conditions de ressources.",
            queries=[u for u in trace if f"time={year}" in u
                     and any(d in u for d in FUNCTIONS if d not in OVERVIEW_EXCLUDE)],
            source_rows=over_rows,
        ))

    leaves = sum(v["nodeCount"] for v in views if v["id"] != "esspros-gf10") \
        if all("nodeCount" in v for v in views) else 0
    print(f"  ✓ {len(views)} vues, {grand_total/1000:,.1f} Md€ de prestations"
          + (f", {leaves} nœuds" if leaves else ""))
    return views
