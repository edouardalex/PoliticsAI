#!/usr/bin/env python3
"""
PoliticsAI — pipeline « profondeur ».

Construit les vues de zoom qui descendent sous le niveau 2 de la nomenclature
COFOG, en changeant de source. Chaque vue est autonome : son référentiel, son
millésime, sa source et la part du parent qu'elle explique sont portés par la
vue elle-même (voir deep_model.py).

Usage : python3 data/pipeline/fetch_deep.py [cnam|lolf|taxexp|ofgl …]
Sortie : data/processed/deep/<vue>.json + index.json

Prérequis : data/processed/france.json (fetch_data.py) pour les montants parents.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import deep_cnam
import deep_decp
import deep_esspros
import deep_lolf
import deep_ofgl
import deep_tax
import deep_taxexp
import build_databank
from deep_model import write_views

PROCESSED = Path(__file__).resolve().parent.parent / "processed"
YEARS = [2024, 2023]

BUILDERS = {
    "cnam": deep_cnam.build,
    "esspros": deep_esspros.build,
    "lolf": deep_lolf.build,
    "taxexp": deep_taxexp.build,
    "ofgl": deep_ofgl.build,
    "tax": deep_tax.build,
    "decp": deep_decp.build,
}


def parent_amounts() -> dict[str, float]:
    """Montants COFOG par ancre `<périmètre>:<fonction>` (M€)."""
    france = json.loads((PROCESSED / "france.json").read_text(encoding="utf-8"))
    out: dict[str, float] = {}
    for pid, p in france["perimeters"].items():
        out[pid] = p["expenditureTotal"]
        for f in p["functions"]:
            out[f"{pid}:{f['code']}"] = f["value"]
            for c in f.get("children", []):
                out[f"{pid}:{c['code']}"] = c["value"]
    return out


def main(argv: list[str]) -> int:
    wanted = [a for a in argv[1:] if not a.startswith("-")] or list(BUILDERS)
    unknown = [w for w in wanted if w not in BUILDERS]
    if unknown:
        print(f"source inconnue : {', '.join(unknown)} "
              f"(disponibles : {', '.join(BUILDERS)})")
        return 2

    parents = parent_amounts()
    views: list[dict] = []
    for name in wanted:
        views += BUILDERS[name](parents, YEARS)

    if len(wanted) < len(BUILDERS):
        # Construction partielle : on conserve les vues déjà produites.
        existing = PROCESSED / "deep"
        built = {v["id"] for v in views}
        for f in sorted(existing.glob("*.json")) if existing.exists() else []:
            if f.stem in built:
                continue
            payload = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and "anchor" in payload:  # ni index, ni annuaire
                views.append(payload)

    write_views(views)

    # La banque de données est un produit dérivé du pipeline : elle se
    # régénère à chaque passage, pour qu'aucun inventaire ne soit tenu à la main.
    build_databank.main()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
