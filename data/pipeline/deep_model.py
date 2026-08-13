#!/usr/bin/env python3
"""
PoliticsAI — modèle de nœud profond (« zoom ») et utilitaires de source.

Principe
--------
Sous le niveau 2 de la nomenclature COFOG, la comptabilité nationale s'arrête.
Toute descente supplémentaire suppose de changer de référentiel comptable
(LOLF pour l'État, M14/M57 pour les collectivités, remboursements pour
l'assurance maladie). Les totaux ne bouclent alors plus avec le parent.

Ce module pose la règle du projet : un changement de source est un objet de
première classe, explicite et mesuré. Chaque « vue » porte son référentiel, son
millésime, sa source, la part du parent qu'elle explique (`coverage`) et la
qualité de son rattachement (`mapping`). Rien n'est jamais mis à l'échelle pour
faire coïncider les totaux : ce qui n'est pas expliqué reste visible.

Aucune dépendance externe (stdlib uniquement).
"""

from __future__ import annotations

import hashlib
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "processed" / "deep"
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# Qualité du rattachement au nœud parent COFOG.
#   officiel  : la ventilation est publiée telle quelle par le producteur
#   dérivé    : recomposée mécaniquement depuis les codes de la source
#   éditorial : correspondance construite par nos soins (table versionnée)
MAPPINGS = ("officiel", "dérivé", "éditorial")


def ods_export(domain: str, dataset: str, *, where: str = "",
               select: str = "", order_by: str = "", limit: int = -1,
               trace: list[str] | None = None) -> list[dict]:
    """Export complet d'un jeu Opendatasoft (API Explore v2.1).

    `trace` collecte l'URL exacte interrogée : c'est elle qui est publiée avec
    la vue, pour que n'importe qui puisse refaire la requête et retomber sur
    les mêmes chiffres."""
    params = {"limit": str(limit)}
    if where:
        params["where"] = where
    if select:
        params["select"] = select
    if order_by:
        params["order_by"] = order_by
    url = (f"https://{domain}/api/explore/v2.1/catalog/datasets/"
           f"{dataset}/exports/json?" + urllib.parse.urlencode(params))
    if trace is not None:
        trace.append(url)
    req = urllib.request.Request(url, headers={"User-Agent": "PoliticsAI-pipeline/0.2"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


def ods_records(domain: str, dataset: str, *, trace: list[str] | None = None,
                **params) -> list[dict]:
    """Requête agrégée (group_by, select) sur l'API Explore v2.1."""
    qs = urllib.parse.urlencode({k: str(v) for k, v in params.items()})
    url = (f"https://{domain}/api/explore/v2.1/catalog/datasets/"
           f"{dataset}/records?" + qs)
    if trace is not None:
        trace.append(url)
    req = urllib.request.Request(url, headers={"User-Agent": "PoliticsAI-pipeline/0.2"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode("utf-8")).get("results", [])
    except urllib.error.HTTPError as exc:  # message d'erreur exploitable
        raise RuntimeError(f"{exc.code} sur {url}\n{exc.read().decode('utf-8')[:300]}") from None


def lit(value: str) -> str:
    """Littéral ODSQL. Les guillemets doubles évitent d'avoir à échapper les
    apostrophes, fréquentes dans les libellés français."""
    return '"' + str(value).replace('"', '\\"') + '"'


def node(nid: str, label: str, amount: float, **extra) -> dict:
    """Nœud générique. `amount` toujours en M€, comme le reste du projet."""
    n = {"id": nid, "label": label, "amount": round(amount, 2)}
    for k, v in extra.items():
        if v not in (None, [], {}, ""):
            n[k] = v
    return n


def sort_tree(nodes: list[dict]) -> list[dict]:
    """Tri décroissant récursif : la lecture suit toujours la taille."""
    nodes.sort(key=lambda n: -n["amount"])
    for n in nodes:
        if n.get("children"):
            sort_tree(n["children"])
    return nodes


def total_of(nodes: list[dict]) -> float:
    return sum(n["amount"] for n in nodes)


def check_tree(view_id: str, nodes: list[dict], tol: float = 0.01) -> None:
    """Vérifie que chaque parent égale la somme de ses enfants."""
    def walk(ns: list[dict], path: str) -> None:
        for n in ns:
            kids = n.get("children")
            if kids:
                s = total_of(kids)
                if n["amount"] and abs(s - n["amount"]) / abs(n["amount"]) > tol:
                    print(f"  ⚠ {view_id} {path}/{n['label'][:40]} : "
                          f"enfants {s:,.0f} ≠ parent {n['amount']:,.0f}")
                walk(kids, path + "/" + n["id"])
    walk(nodes, "")


def make_view(*, view_id: str, anchor: str, title: str, subtitle: str,
              basis: str, basis_label: str, year: int | str,
              nodes: list[dict], parent_amount: float | None,
              parent_label: str, mapping: str, source: dict,
              coverage: float | None = None, comparable: bool = True,
              perimeter_note: str = "",
              caveats: list[str] | None = None,
              unit_note: str = "",
              queries: list[str] | None = None,
              source_rows: int | None = None) -> dict:
    """Assemble une vue de zoom prête à être servie à l'application."""
    assert mapping in MAPPINGS, mapping
    sort_tree(nodes)
    amount = total_of(nodes)
    # `comparable=False` : la vue n'est pas un sous-ensemble du parent (dépenses
    # fiscales par exemple). On laisse alors `coverage` vide plutôt que de
    # laisser croire à une part.
    if comparable and coverage is None and parent_amount:
        coverage = round(amount / parent_amount, 4)
    if not comparable:
        coverage = None
    return {
        "id": view_id,
        "anchor": anchor,
        "title": title,
        "subtitle": subtitle,
        "basis": basis,
        "basisLabel": basis_label,
        "year": year,
        "amount": round(amount, 2),
        "parentAmount": round(parent_amount, 2) if parent_amount else None,
        "parentLabel": parent_label,
        "coverage": coverage,
        "mapping": mapping,
        "perimeterNote": perimeter_note,
        "caveats": caveats or [],
        "unitNote": unit_note,
        # Provenance : l'URL exacte interrogée et le volume lu. Toute personne
        # qui rejoue la requête doit retomber sur les mêmes montants.
        "source": {**source, "queries": queries or []},
        "sourceRows": source_rows,
        "extracted": TODAY,
        "nodes": nodes,
    }


def fingerprint(nodes: list[dict]) -> str:
    """Empreinte SHA-256 de l'arbre publié. Permet de vérifier qu'un fichier
    servi correspond bien à ce que le pipeline a produit."""
    payload = json.dumps(nodes, ensure_ascii=False, sort_keys=True,
                         separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def file_digest(path: Path) -> dict | None:
    """Empreinte d'un fichier d'entrée versionné (table de correspondance)."""
    if not path.exists():
        return None
    raw = path.read_bytes()
    return {
        "path": str(path.relative_to(Path(__file__).resolve().parent.parent.parent)),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "lines": len([ln for ln in raw.decode("utf-8-sig").splitlines()
                      if ln.strip() and not ln.lstrip().startswith("#")]),
    }


def write_views(views: list[dict]) -> None:
    """Écrit un fichier par vue, un index léger pour le chargement paresseux,
    et un manifeste d'audit qui récapitule toutes les provenances."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index: dict[str, list[dict]] = {}
    for v in views:
        check_tree(v["id"], v["nodes"])
        # Le fichier de vue porte les mêmes métadonnées que l'index : ainsi une
        # vue chargée seule se suffit à elle-même.
        v["nodeCount"] = count_nodes(v["nodes"])
        v["depth"] = tree_depth(v["nodes"])
        v["sourceName"] = v["source"]["name"]
        v["fingerprint"] = fingerprint(v["nodes"])
        (OUT_DIR / f"{v['id']}.json").write_text(
            json.dumps(v, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.setdefault(v["anchor"], []).append({
            "id": v["id"],
            "title": v["title"],
            "subtitle": v["subtitle"],
            "basis": v["basis"],
            "basisLabel": v["basisLabel"],
            "year": v["year"],
            "amount": v["amount"],
            "parentAmount": v["parentAmount"],
            "coverage": v["coverage"],
            "mapping": v["mapping"],
            "sourceName": v["source"]["name"],
            "nodeCount": v["nodeCount"],
            "depth": v["depth"],
        })
    for entries in index.values():
        entries.sort(key=lambda e: (e["coverage"] is None, -(e["coverage"] or 0)))
    (OUT_DIR / "index.json").write_text(
        json.dumps({"extracted": TODAY, "anchors": index},
                   ensure_ascii=False, indent=1), encoding="utf-8")

    crosswalk = OUT_DIR.parent.parent / "crosswalk" / "programme_cofog.csv"
    manifest = {
        "extracted": TODAY,
        "note": ("Manifeste d'audit. Chaque vue publie la ou les URL exactement "
                 "interrogées, le nombre de lignes lues à la source et "
                 "l'empreinte SHA-256 de l'arbre publié. Rejouer une requête "
                 "doit redonner les mêmes montants."),
        "inputs": [d for d in [file_digest(crosswalk)] if d],
        "views": sorted(({
            "id": v["id"],
            "anchor": v["anchor"],
            "basis": v["basis"],
            "year": v["year"],
            "mapping": v["mapping"],
            "coverage": v["coverage"],
            "amount": v["amount"],
            "nodeCount": v["nodeCount"],
            "sourceRows": v.get("sourceRows"),
            "source": v["source"]["dataset"],
            "queries": v["source"].get("queries", []),
            "fingerprint": v["fingerprint"],
        } for v in views), key=lambda e: e["id"]),
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(v["nodeCount"] for v in views)
    untraced = [v["id"] for v in views if not v["source"].get("queries")]
    print(f"✓ {len(views)} vues, {total:,} nœuds écrits dans {OUT_DIR}")
    if untraced:
        print(f"  ⚠ {len(untraced)} vues sans requête source tracée : "
              f"{', '.join(untraced[:5])}")


def count_nodes(nodes: list[dict]) -> int:
    return sum(1 + count_nodes(n.get("children", [])) for n in nodes)


def tree_depth(nodes: list[dict]) -> int:
    return 1 + max((tree_depth(n["children"]) for n in nodes if n.get("children")),
                   default=0) if nodes else 0
