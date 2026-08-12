#!/usr/bin/env python3
"""
PoliticsAI — pipeline de données Eurostat.

Récupère les comptes des administrations publiques (France + comparaison UE)
et produit des JSON propres pour l'application, avec métadonnées de source.

Sources (API de diffusion Eurostat, format JSON-stat) :
  - gov_10a_exp  : dépenses par fonction (CFAP/COFOG), niveaux 1 et 2
  - gov_10a_main : principaux agrégats (recettes détaillées, B9, TE, TR)
  - nama_10_gdp  : PIB (B1GQ, prix courants)

Usage : python3 data/pipeline/fetch_data.py
Sorties : data/processed/france.json, data/processed/europe.json

Aucune dépendance externe (stdlib uniquement).
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
OUT_DIR = Path(__file__).resolve().parent.parent / "processed"

PREFERRED_YEAR = 2024   # millésime cible
FALLBACK_YEAR = 2023    # replis par pays/secteur si 2024 absent

SECTORS = {
    "S13": "Toutes administrations publiques",
    "S1311": "État et organismes centraux",
    "S1313": "Collectivités locales",
    "S1314": "Administrations de sécurité sociale",
}

# Pays de la comparaison européenne (code Eurostat -> nom français court)
GEOS_EU = {
    "EU27_2020": "Union européenne",
    "FR": "France",
    "DE": "Allemagne",
    "IT": "Italie",
    "ES": "Espagne",
    "NL": "Pays-Bas",
    "BE": "Belgique",
    "AT": "Autriche",
    "SE": "Suède",
    "DK": "Danemark",
    "FI": "Finlande",
    "PL": "Pologne",
    "PT": "Portugal",
    "IE": "Irlande",
    "EL": "Grèce",
}

COFOG_L1 = ["GF01", "GF02", "GF03", "GF04", "GF05",
            "GF06", "GF07", "GF08", "GF09", "GF10"]


def fetch(dataset: str, **params) -> dict:
    """Interroge l'API Eurostat, labels en français."""
    qs: list[tuple[str, str]] = [("format", "JSON"), ("lang", "FR")]
    for k, v in params.items():
        if isinstance(v, (list, tuple)):
            qs += [(k, str(item)) for item in v]
        else:
            qs.append((k, str(v)))
    url = BASE + dataset + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(url, headers={"User-Agent": "PoliticsAI-pipeline/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


class Cube:
    """Accès par coordonnées à une réponse JSON-stat."""

    def __init__(self, js: dict):
        self.js = js
        self.ids: list[str] = js["id"]
        self.sizes: list[int] = js["size"]
        self.index: dict[str, dict[str, int]] = {
            dim: js["dimension"][dim]["category"]["index"] for dim in self.ids
        }
        self.labels: dict[str, dict[str, str]] = {
            dim: js["dimension"][dim]["category"].get("label", {}) for dim in self.ids
        }
        self.values: dict[str, float] = js.get("value", {})

    def get(self, **coords) -> float | None:
        pos = 0
        for dim, size in zip(self.ids, self.sizes):
            cat = coords.get(dim)
            if cat is None:
                if size == 1:
                    ci = 0
                else:
                    raise KeyError(f"dimension {dim} non spécifiée (taille {size})")
            else:
                ci = self.index[dim].get(cat)
                if ci is None:
                    return None
            pos = pos * size + ci
        return self.values.get(str(pos))

    def label(self, dim: str, code: str) -> str:
        return self.labels.get(dim, {}).get(code, code)

    def categories(self, dim: str) -> list[str]:
        idx = self.index[dim]
        return [c for c, _ in sorted(idx.items(), key=lambda kv: kv[1])]


def pick_year(cube: Cube, probe: dict, years: list[int]) -> int | None:
    """Premier millésime (ordre donné) où la valeur sonde est non nulle."""
    for y in years:
        v = cube.get(time=str(y), **probe)
        if v is not None:
            return y
    return None


def build_france() -> dict:
    years = [str(PREFERRED_YEAR), str(FALLBACK_YEAR)]

    print("→ gov_10a_exp (dépenses COFOG, France, 4 secteurs, 2 unités)…")
    exp = Cube(fetch(
        "gov_10a_exp", freq="A", na_item="TE", geo="FR",
        unit=["MIO_EUR", "PC_GDP"], sector=list(SECTORS), time=years,
    ))

    print("→ gov_10a_main (recettes et agrégats, France, 4 secteurs)…")
    main = Cube(fetch(
        "gov_10a_main", freq="A", geo="FR", unit="MIO_EUR",
        sector=list(SECTORS), time=years,
    ))

    print("→ nama_10_gdp (PIB France)…")
    gdp_cube = Cube(fetch(
        "nama_10_gdp", freq="A", na_item="B1GQ", unit="CP_MEUR",
        geo="FR", time=years,
    ))

    perimeters = {}
    for sector, sector_label in SECTORS.items():
        year = pick_year(exp, {"sector": sector, "cofog99": "TOTAL", "unit": "MIO_EUR"},
                         [PREFERRED_YEAR, FALLBACK_YEAR])
        if year is None:
            print(f"  ⚠ aucune donnée pour {sector}, secteur ignoré")
            continue
        t = str(year)
        gdp = gdp_cube.get(time=t)

        def e(cofog: str, unit: str = "MIO_EUR") -> float | None:
            return exp.get(sector=sector, cofog99=cofog, unit=unit, time=t)

        def m(item: str) -> float | None:
            return main.get(sector=sector, na_item=item, time=t)

        total_exp = e("TOTAL")
        total_rev = m("TR")
        b9 = m("B9")

        # --- Dépenses par fonction (niveau 1 + enfants niveau 2) ---
        functions = []
        l1_sum = 0.0
        for gf in COFOG_L1:
            v = e(gf)
            if v is None:
                continue
            l1_sum += v
            children = []
            for code in exp.categories("cofog99"):
                if code.startswith(gf) and len(code) == 6:
                    cv = e(code)
                    if cv is not None and cv > 0:
                        children.append({
                            "code": code,
                            "label": exp.label("cofog99", code),
                            "value": round(cv, 1),
                        })
            children.sort(key=lambda c: -c["value"])
            functions.append({
                "code": gf,
                "label": exp.label("cofog99", gf),
                "value": round(v, 1),
                "pctGdp": round(e(gf, "PC_GDP"), 2) if e(gf, "PC_GDP") is not None else None,
                "children": children,
            })
        functions.sort(key=lambda f: -f["value"])

        if total_exp and abs(l1_sum - total_exp) / total_exp > 0.005:
            print(f"  ⚠ {sector}: somme niveau 1 ({l1_sum:,.0f}) ≠ TOTAL ({total_exp:,.0f})")

        # --- Recettes par grande catégorie ---
        # Décomposition additive de TR ; le résidu garantit l'exactitude du total.
        cats = []

        def add(code: str, value: float | None, label: str, detail: str | None = None):
            if value is not None and value > 0.5:
                cats.append({"code": code, "label": label, "value": round(value, 1),
                             **({"detail": detail} if detail else {})})

        d61 = m("D61REC")
        d211 = m("D211REC")
        d21 = m("D21REC")
        d29 = m("D29REC")
        d51a = m("D51A_C1REC")
        d51b = m("D51B_C2REC")
        d5 = m("D5REC")
        d91 = m("D91REC")
        sales = m("P11_P12_P131")
        d73 = m("D73REC")

        add("D61", d61, "Cotisations sociales")
        add("D211", d211, "TVA")
        if d21 is not None and d211 is not None:
            add("D21X", d21 - d211, "Accises et taxes sur les produits",
                "TICPE, tabac, alcool, assurances…")
        add("D29", d29, "Impôts sur la production",
            "Taxe foncière des entreprises, CFE, versement mobilité…")
        add("D51A", d51a, "Impôts sur le revenu des ménages", "IR, CSG, CRDS…")
        add("D51B", d51b, "Impôt sur les sociétés")
        other_d5 = (d5 - d51a - d51b) if None not in (d5, d51a, d51b) else None
        other_tax = (other_d5 or 0) + (d91 or 0)
        add("D5X_D91", other_tax if other_tax > 0 else None,
            "Autres impôts (patrimoine, successions…)",
            "Taxe foncière des ménages, IFI, droits de succession…")
        add("SALES", sales, "Ventes et redevances",
            "Cantines, musées, redevances, production pour compte propre…")
        if sector != "S13":
            add("D73", d73, "Transferts d'autres administrations",
                "Dotations et transferts reçus des autres administrations publiques")

        named = sum(c["value"] for c in cats)
        if total_rev is not None:
            residual = total_rev - named
            if residual > 0.5:
                cats.append({"code": "OTHER", "label": "Autres recettes",
                             "value": round(residual, 1),
                             "detail": "Revenus du patrimoine, transferts divers, aides à l'investissement…"})
        cats.sort(key=lambda c: -c["value"])

        deficit = None
        if total_exp is not None and total_rev is not None:
            deficit = round(total_exp - total_rev, 1)

        perimeters[sector] = {
            "label": sector_label,
            "year": year,
            "gdp": round(gdp, 1) if gdp else None,
            "expenditureTotal": round(total_exp, 1) if total_exp else None,
            "expenditurePctGdp": round(e("TOTAL", "PC_GDP"), 2) if e("TOTAL", "PC_GDP") else None,
            "revenueTotal": round(total_rev, 1) if total_rev else None,
            "netLending": round(b9, 1) if b9 is not None else None,
            "deficit": deficit,
            "functions": functions,
            "revenues": cats,
        }
        print(f"  ✓ {sector} ({year}) : dépenses {total_exp:,.0f} M€, "
              f"recettes {total_rev:,.0f} M€, {len(functions)} fonctions")

    return {
        "meta": {
            "source": "Eurostat — comptes nationaux des administrations publiques (SEC 2010)",
            "datasets": ["gov_10a_exp", "gov_10a_main", "nama_10_gdp"],
            "url": "https://ec.europa.eu/eurostat/fr/web/government-finance-statistics",
            "extracted": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "unit": "MIO_EUR",
            "note": ("Dépenses par fonction : nomenclature CFAP/COFOG. "
                     "Les sous-secteurs (État, collectivités, sécurité sociale) sont non consolidés "
                     "entre eux : les transferts entre administrations y figurent. "
                     "Le total toutes administrations (S13) est consolidé."),
        },
        "perimeters": perimeters,
    }


def build_europe() -> dict:
    print("→ gov_10a_exp (Europe, % du PIB, niveau 1)…")
    cube = Cube(fetch(
        "gov_10a_exp", freq="A", na_item="TE", unit="PC_GDP", sector="S13",
        cofog99=["TOTAL"] + COFOG_L1, geo=list(GEOS_EU),
        time=[str(PREFERRED_YEAR), str(FALLBACK_YEAR)],
    ))

    countries = []
    for geo, name in GEOS_EU.items():
        year = pick_year(cube, {"geo": geo, "cofog99": "TOTAL"},
                         [PREFERRED_YEAR, FALLBACK_YEAR])
        if year is None:
            print(f"  ⚠ pas de données pour {geo}")
            continue
        t = str(year)
        functions = {}
        for gf in COFOG_L1:
            v = cube.get(geo=geo, cofog99=gf, time=t)
            if v is not None:
                functions[gf] = round(v, 2)
        countries.append({
            "geo": geo,
            "label": name,
            "year": year,
            "totalPctGdp": round(cube.get(geo=geo, cofog99="TOTAL", time=t), 2),
            "functions": functions,
        })
        print(f"  ✓ {geo} ({year}) : total {countries[-1]['totalPctGdp']} % du PIB")

    countries.sort(key=lambda c: -c["totalPctGdp"])
    return {
        "meta": {
            "source": "Eurostat — dépenses des administrations publiques par fonction (gov_10a_exp)",
            "unit": "PC_GDP",
            "sector": "S13 (consolidé)",
            "extracted": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "note": "Millésime le plus récent disponible par pays (2024, sinon 2023).",
        },
        "countries": countries,
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    france = build_france()
    (OUT_DIR / "france.json").write_text(
        json.dumps(france, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ écrit {OUT_DIR / 'france.json'}")

    europe = build_europe()
    (OUT_DIR / "europe.json").write_text(
        json.dumps(europe, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ écrit {OUT_DIR / 'europe.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
