#!/usr/bin/env python3
"""
Génère la « Banque de données » : l'inventaire de tout ce que l'application
consomme, calculé depuis les fichiers produits par le pipeline.

Rien n'est saisi à la main ici. Ajouter une source au pipeline la fait
apparaître dans l'application au prochain passage, avec son producteur, sa
licence, sa cadence, ses millésimes et ce qu'elle apporte réellement.

Deux sorties :
  - databank.json          l'état courant, consommé par l'écran ;
  - databank-history.json  un journal append-only, une entrée par exécution,
                           pour voir la profondeur du projet s'étendre au fil
                           des années.

Usage : python3 data/pipeline/build_databank.py
"""

from __future__ import annotations

import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

PROCESSED = Path(__file__).resolve().parent.parent / "processed"
DEEP = PROCESSED / "deep"
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# La source « colonne vertébrale » ne produit pas de vue : c'est le diagramme
# lui-même. Elle est décrite ici pour figurer dans l'inventaire au même titre.
SPINE_SOURCE = {
    "name": "Eurostat — comptes des administrations publiques (SEC 2010)",
    "dataset": "Eurostat / gov_10a_exp · gov_10a_main · nama_10_gdp",
    "url": "https://ec.europa.eu/eurostat/fr/web/government-finance-statistics",
    "producer": "Eurostat (Commission européenne), alimenté pour la France par l'Insee",
    "licence": "Réutilisation autorisée avec mention de la source (politique Eurostat)",
    "cadence": "Annuelle",
    "brings": "L'ossature : toute la dépense et toute la recette publiques, "
              "consolidées, par fonction et par nature d'opération.",
    "basis": "SEC2010",
    "role": "spine",
}

PERIMETER_LABEL = {
    "S13": "Toutes administrations publiques",
    "S1311": "État et organismes centraux",
    "S1313": "Collectivités locales",
    "S1314": "Administrations de sécurité sociale",
}


def leaves(nodes, path=()):
    for n in nodes:
        if n.get("children"):
            yield from leaves(n["children"], path + (n["label"],))
        else:
            yield n["amount"], " › ".join(path + (n["label"],))


def load_views() -> list[dict]:
    out = []
    for f in sorted(DEEP.glob("*.json")):
        if f.stem in ("index", "manifest", "communes-index", "databank"):
            continue
        payload = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and "anchor" in payload:
            out.append(payload)
    return out


def main() -> int:
    france = json.loads((PROCESSED / "france.json").read_text(encoding="utf-8"))
    index = json.loads((DEEP / "index.json").read_text(encoding="utf-8"))["anchors"]
    views = load_views()

    # — Regroupement par source —
    by_source: dict[str, dict] = {}
    for v in views:
        src = v["source"]
        key = src["dataset"]
        s = by_source.setdefault(key, {
            "key": key,
            "name": src["name"],
            "dataset": src["dataset"],
            "url": src.get("url", ""),
            "producer": src.get("producer", "Non précisé"),
            "licence": src.get("licence", "Non précisée"),
            "cadence": src.get("cadence", "Non précisée"),
            "brings": src.get("brings", ""),
            "basis": v["basis"],
            "basisLabel": v["basisLabel"],
            "role": "zoom",
            "views": 0, "nodes": 0, "terminal": 0,
            "years": set(), "mappings": set(), "anchors": set(),
            "sourceRows": 0, "queries": set(),
        })
        s["views"] += 1
        s["nodes"] += v["nodeCount"]
        s["terminal"] += sum(1 for _ in leaves(v["nodes"]))
        s["years"].add(v["year"])
        s["mappings"].add(v["mapping"])
        s["anchors"].add(v["anchor"])
        s["sourceRows"] = max(s["sourceRows"], v.get("sourceRows") or 0)
        for q in v["source"].get("queries", []):
            s["queries"].add(q.split("?")[0])

    spine = dict(SPINE_SOURCE)
    p13 = france["perimeters"]["S13"]
    nature_cells = sum(
        len(f.get("natures", [])) + sum(len(c.get("natures", [])) for c in f.get("children", []))
        for p in france["perimeters"].values() for f in p["functions"])
    spine.update({
        "views": 0,
        "nodes": sum(1 + len(f.get("children", []))
                     for p in france["perimeters"].values() for f in p["functions"]),
        "terminal": nature_cells,
        "years": [p13["year"]],
        "mappings": ["officiel"],
        "anchors": [],
        "sourceRows": None,
        "queries": ["https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"],
        "basisLabel": f"Comptabilité nationale, millésime {p13['year']}",
    })

    sources = [spine] + sorted(
        ({**s,
          "years": sorted(s["years"]),
          "mappings": sorted(s["mappings"]),
          "anchors": sorted(s["anchors"]),
          "queries": sorted(s["queries"])}
         for s in by_source.values()),
        key=lambda s: -s["nodes"])

    # — Ce que chaque périmètre laisse encore à la maille COFOG —
    coverage = []
    for pid, p in france["perimeters"].items():
        covered = 0.0
        for f in p["functions"]:
            vs = [v for v in index.get(f"{pid}:{f['code']}", []) if v["coverage"]]
            if vs:
                covered += min(max(v["amount"] for v in vs), f["value"])
        own = [v for v in index.get(pid, []) if v["coverage"]]
        if own and covered == 0:
            covered = min(max(v["amount"] for v in own), p["expenditureTotal"])
        coverage.append({
            "perimeter": pid,
            "label": PERIMETER_LABEL.get(pid, pid),
            "total": round(p["expenditureTotal"], 1),
            "covered": round(covered, 1),
            "share": round(covered / p["expenditureTotal"], 4) if p["expenditureTotal"] else 0,
        })

    # — L'orchestration : quelles vues s'accrochent où —
    label_of: dict[str, str] = {}
    amount_of: dict[str, float] = {}
    for pid, p in france["perimeters"].items():
        label_of[pid] = PERIMETER_LABEL.get(pid, pid)
        amount_of[pid] = p["expenditureTotal"]
        for f in p["functions"]:
            label_of[f"{pid}:{f['code']}"] = f["label"]
            amount_of[f"{pid}:{f['code']}"] = f["value"]
            for c in f.get("children", []):
                label_of[f"{pid}:{c['code']}"] = c["label"]
                amount_of[f"{pid}:{c['code']}"] = c["value"]
        for r in p["revenues"]:
            label_of[f"{pid}:{r['code']}"] = r["label"]
            amount_of[f"{pid}:{r['code']}"] = r["value"]

    orchestration = []
    for anchor, vs in sorted(index.items(), key=lambda kv: -max(v["amount"] for v in kv[1])):
        pid = anchor.split(":")[0]
        orchestration.append({
            "anchor": anchor,
            "perimeter": pid,
            "perimeterLabel": PERIMETER_LABEL.get(pid, pid),
            "label": label_of.get(anchor, anchor),
            "parentAmount": round(amount_of.get(anchor, 0), 1) or None,
            "views": [{
                "id": v["id"], "title": v["title"], "basis": v["basis"],
                "year": v["year"], "amount": v["amount"],
                "coverage": v["coverage"], "mapping": v["mapping"],
                "nodes": v["nodeCount"], "depth": v["depth"],
            } for v in sorted(vs, key=lambda v: -v["nodeCount"])],
        })

    # — Le mur : les plus grosses lignes que rien ne divise —
    terminal: list[tuple[float, str, dict]] = []
    for v in views:
        for amount, path in leaves(v["nodes"]):
            if amount > 0:
                terminal.append((amount, path, v))
    terminal.sort(key=lambda t: -t[0])
    seen_wall: set[tuple[str, int]] = set()
    unique_wall = []
    for a, path, v in terminal:
        key = path.split(" › ")[-1]
        if key in seen_wall:
            continue
        seen_wall.add(key)
        unique_wall.append((a, path, v))
    wall = [{
        "amount": round(a, 1), "path": path,
        "label": path.split(" › ")[-1],
        "context": " › ".join(path.split(" › ")[:-1][-2:]),
        "basis": v["basis"], "viewId": v["id"], "viewTitle": v["title"],
        "source": v["source"]["name"], "year": v["year"],
    } for a, path, v in unique_wall[:12]]

    sizes = sorted(a for a, _, _ in terminal)

    # — Ce qui n'a encore aucune vue, du plus gros au plus petit —
    unreached = []
    for f in p13["functions"]:
        for c in f.get("children", []):
            has = any(index.get(f"{s}:{c['code']}")
                      for s in ("S13", "S1311", "S1314", "S1313"))
            if not has:
                inherited = next((v["title"] for s in ("S13", "S1311", "S1314", "S1313")
                                  for v in index.get(f"{s}:{f['code']}", [])), None)
                unreached.append({"code": c["code"],
                                  "label": f"{f['label']} › {c['label']}",
                                  "amount": round(c["value"], 1),
                                  "inherited": inherited})
    unreached.sort(key=lambda u: -u["amount"])

    databank = {
        "extracted": TODAY,
        "spineYear": p13["year"],
        "stats": {
            "sources": len(sources),
            "views": len(views),
            "nodes": sum(v["nodeCount"] for v in views),
            "terminal": len(terminal),
            "medianTerminal": round(statistics.median(sizes), 2) if sizes else 0,
            "smallestTerminal": round(sizes[0], 2) if sizes else 0,
            "maxDepth": max((v["depth"] for v in views), default=0),
            "queries": sum(len(v["source"].get("queries", [])) for v in views),
            "expenditure": round(p13["expenditureTotal"], 1),
            "revenue": round(p13["revenueTotal"], 1),
        },
        "sources": sources,
        "coverage": coverage,
        "orchestration": orchestration,
        "wall": wall,
        "unreached": unreached[:10],
    }
    (PROCESSED / "databank.json").write_text(
        json.dumps(databank, ensure_ascii=False, indent=1), encoding="utf-8")

    # — Journal : une entrée par exécution, remplacée si le jour se répète —
    hist_path = PROCESSED / "databank-history.json"
    hist = json.loads(hist_path.read_text(encoding="utf-8")) if hist_path.exists() \
        else {"note": "Une entrée par exécution du pipeline. Sert à voir la "
                      "profondeur du projet s'étendre au fil des millésimes.",
              "snapshots": []}
    snap = {
        "date": TODAY,
        "sources": len(sources),
        "views": len(views),
        "nodes": databank["stats"]["nodes"],
        "terminal": len(terminal),
        "spineYear": p13["year"],
        "sourceKeys": sorted({s["dataset"] for s in sources}),
    }
    hist["snapshots"] = [s for s in hist["snapshots"] if s["date"] != TODAY] + [snap]
    hist["snapshots"].sort(key=lambda s: s["date"])
    hist_path.write_text(json.dumps(hist, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"✓ banque de données : {len(sources)} sources, {len(views)} vues, "
          f"{databank['stats']['nodes']:,} nœuds, {len(terminal):,} lignes terminales")
    print(f"  journal : {len(hist['snapshots'])} instantané(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
