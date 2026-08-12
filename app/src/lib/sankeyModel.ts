import type { Perimeter, CofogFunction } from './data';
import { functionColor, REVENUE_COLOR, SPINE_COLOR, DEFICIT_COLOR, SURPLUS_COLOR, childShade } from './palette';
import { FUNCTION_INFO, REVENUE_INFO } from '../content/text';

export type NodeKind = 'revenue' | 'spine' | 'function' | 'child' | 'deficit' | 'surplus' | 'source';

export interface MergedItem {
  label: string;
  value: number;
}

export interface SkNodeDatum {
  id: string;
  kind: NodeKind;
  code: string;
  label: string;
  value: number; // M€
  color: string;
  detail?: string;
  merged?: MergedItem[];
  /** côté du label : -1 gauche, +1 droite, 0 aucun */
  labelSide: -1 | 0 | 1;
}

export interface SkLinkDatum {
  source: string;
  target: string;
  value: number;
  color: string;
  /** identifiant du nœud « identité » du lien (pour le hover) */
  ownerId: string;
  isDeficit?: boolean;
}

export interface SkGraph {
  key: string;
  nodes: SkNodeDatum[];
  links: SkLinkDatum[];
  /** total de référence (dépenses du périmètre), M€ */
  refTotal: number;
}

/** Fusionne les éléments < threshold (part du total) dans un nœud « Autres ». */
function compact<T extends { label: string; value: number }>(
  items: T[],
  total: number,
  threshold: number,
): { kept: T[]; merged: MergedItem[] } {
  const kept: T[] = [];
  const merged: MergedItem[] = [];
  for (const it of items) {
    if (it.value / total < threshold && it.value > 0) {
      merged.push({ label: it.label, value: it.value });
    } else if (it.value > 0) {
      kept.push(it);
    }
  }
  return { kept, merged };
}

/** Vue d'ensemble : recettes (+ déficit) → administrations → fonctions. */
export function buildOverview(perimeter: Perimeter, perimeterId: string): SkGraph {
  const nodes: SkNodeDatum[] = [];
  const links: SkLinkDatum[] = [];
  const refTotal = perimeter.expenditureTotal;

  // — Recettes (fusion des catégories trop fines pour être lisibles)
  const { kept: revKept, merged: revMerged } = compact(perimeter.revenues, refTotal, 0.008);
  const revs = [...revKept];
  const otherIdx = revs.findIndex((r) => r.code === 'OTHER');
  let otherExtra: MergedItem[] = [];
  if (revMerged.length > 0) {
    const sum = revMerged.reduce((s, m) => s + m.value, 0);
    if (otherIdx >= 0) {
      revs[otherIdx] = { ...revs[otherIdx], value: revs[otherIdx].value + sum };
      otherExtra = revMerged;
    } else {
      revs.push({ code: 'OTHER', label: 'Autres recettes', value: sum });
      otherExtra = revMerged;
    }
  }
  revs.sort((a, b) => b.value - a.value);

  for (const r of revs) {
    nodes.push({
      id: r.code,
      kind: 'revenue',
      code: r.code,
      label: REVENUE_INFO[r.code]?.short ?? r.label,
      value: r.value,
      color: REVENUE_COLOR,
      detail: 'detail' in r ? (r as { detail?: string }).detail : undefined,
      merged: r.code === 'OTHER' && otherExtra.length ? otherExtra : undefined,
      labelSide: -1,
    });
    links.push({ source: r.code, target: 'SPINE', value: r.value, color: REVENUE_COLOR, ownerId: r.code });
  }

  // — Déficit (emprunt) : flux entrant distinct
  const deficit = perimeter.deficit;
  const significant = Math.abs(deficit) / refTotal > 0.002;
  if (significant && deficit > 0) {
    nodes.push({
      id: 'DEFICIT',
      kind: 'deficit',
      code: 'DEFICIT',
      label: 'Déficit (emprunt)',
      value: deficit,
      color: DEFICIT_COLOR,
      labelSide: -1,
    });
    links.push({ source: 'DEFICIT', target: 'SPINE', value: deficit, color: DEFICIT_COLOR, ownerId: 'DEFICIT', isDeficit: true });
  }

  // — Colonne centrale
  nodes.push({
    id: 'SPINE',
    kind: 'spine',
    code: 'SPINE',
    label: perimeter.label,
    value: refTotal,
    color: SPINE_COLOR,
    labelSide: 0,
  });

  // — Fonctions de dépense
  for (const f of perimeter.functions) {
    const info = FUNCTION_INFO[f.code];
    nodes.push({
      id: f.code,
      kind: 'function',
      code: f.code,
      label: info?.short ?? f.label,
      value: f.value,
      color: functionColor(f.code),
      labelSide: 1,
    });
    links.push({ source: 'SPINE', target: f.code, value: f.value, color: functionColor(f.code), ownerId: f.code });
  }

  // — Excédent éventuel (flux sortant)
  if (significant && deficit < 0) {
    nodes.push({
      id: 'SURPLUS',
      kind: 'surplus',
      code: 'SURPLUS',
      label: 'Excédent',
      value: -deficit,
      color: SURPLUS_COLOR,
      labelSide: 1,
    });
    links.push({ source: 'SPINE', target: 'SURPLUS', value: -deficit, color: SURPLUS_COLOR, ownerId: 'SURPLUS' });
  }

  return { key: `ov-${perimeterId}`, nodes, links, refTotal };
}

/** Vue zoomée : une fonction → ses sous-postes COFOG niveau 2. */
export function buildZoom(perimeter: Perimeter, fn: CofogFunction, perimeterId: string): SkGraph {
  const nodes: SkNodeDatum[] = [];
  const links: SkLinkDatum[] = [];
  const color = functionColor(fn.code);
  const info = FUNCTION_INFO[fn.code];

  nodes.push({
    id: fn.code,
    kind: 'source',
    code: fn.code,
    label: info?.short ?? fn.label,
    value: fn.value,
    color,
    labelSide: -1,
  });

  const { kept, merged } = compact(fn.children, fn.value, 0.014);
  const items: { code: string; label: string; value: number; merged?: MergedItem[] }[] = kept.map((c) => ({
    code: c.code,
    label: cleanChildLabel(c.label),
    value: c.value,
  }));
  if (merged.length > 0) {
    items.push({
      code: `${fn.code}_OTHER`,
      label: 'Autres sous-postes',
      value: merged.reduce((s, m) => s + m.value, 0),
      merged,
    });
  }
  // écart éventuel entre somme des enfants et total de la fonction
  const childSum = items.reduce((s, c) => s + c.value, 0);
  if (fn.value - childSum > fn.value * 0.01) {
    items.push({ code: `${fn.code}_NC`, label: 'Non ventilé', value: fn.value - childSum });
  }
  items.sort((a, b) => b.value - a.value);

  items.forEach((c, i) => {
    const shade = childShade(color, i, items.length);
    nodes.push({
      id: c.code,
      kind: 'child',
      code: c.code,
      label: c.label,
      value: c.value,
      color: shade,
      merged: c.merged,
      labelSide: 1,
    });
    links.push({ source: fn.code, target: c.code, value: c.value, color: shade, ownerId: c.code });
  });

  return { key: `zm-${perimeterId}-${fn.code}`, nodes, links, refTotal: perimeter.expenditureTotal };
}

/** Les libellés Eurostat N2 sont parfois longs — raccourcis d'affichage. */
function cleanChildLabel(label: string): string {
  return label
    .replace(/^R & D dans le domaine de (la |l'|l’)?/, 'R&D — ')
    .replace(/^R & D concernant (des |la |le |l'|l’)?/, 'R&D — ')
    .replace(/ n\.c\.a\.?$/, ' (divers)')
    .replace(/administrations publiques/, 'administrations');
}
