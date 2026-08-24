import deepIndexRaw from '../../../data/processed/deep/index.json';

/* ————————————————————————————————————————————————
   Descendre sous le niveau 2 de la nomenclature COFOG suppose de changer de
   source, donc de référentiel comptable. Une « vue » est exactement ça : un
   arbre venu d'ailleurs, accroché à un nœud, qui porte sa propre comptabilité
   et dit franchement quelle part du parent il explique.

   Les vues sont chargées à la demande (un fichier par vue) : le bundle initial
   ne porte que l'index.
   ———————————————————————————————————————————————— */

export type Basis = 'SEC2010' | 'LOLF' | 'M57' | 'CNAM' | 'FISC' | 'ESSPROS' | 'DECP';
export type Mapping = 'officiel' | 'dérivé' | 'éditorial';

export interface UnitCost {
  amount: number;
  per: string;
  count: number;
}

/** Part d'une prestation versée sous conditions de ressources (ESSPROS). */
export interface MeansTested {
  amount: number; // M€
  share: number; // 0–1
}

export interface DeepNode {
  id: string;
  label: string;
  amount: number; // M€
  detail?: string;
  unitCost?: UnitCost;
  meansTested?: MeansTested;
  confidence?: 'haute' | 'moyenne' | 'basse';
  confidenceLabel?: string;
  children?: DeepNode[];
}

export interface DeepViewSummary {
  id: string;
  title: string;
  subtitle: string;
  basis: Basis;
  basisLabel: string;
  year: number;
  amount: number;
  parentAmount: number | null;
  coverage: number | null;
  mapping: Mapping;
  sourceName: string;
  nodeCount: number;
  depth: number;
}

export interface DeepView extends DeepViewSummary {
  anchor: string;
  parentLabel: string;
  perimeterNote: string;
  caveats: string[];
  unitNote: string;
  /** `queries` : les URL exactement interrogées pour produire cet arbre. */
  source: { name: string; dataset: string; url: string; queries: string[] };
  /** Nombre de lignes lues à la source. */
  sourceRows: number | null;
  /** SHA-256 de l'arbre publié, recalculable depuis le fichier servi. */
  fingerprint: string;
  extracted: string;
  nodes: DeepNode[];
}

interface DeepIndex {
  extracted: string;
  anchors: Record<string, DeepViewSummary[]>;
}

export const DEEP_INDEX = deepIndexRaw as unknown as DeepIndex;

/* Chargement paresseux : Vite émet un chunk par fichier. */
const viewFiles = import.meta.glob<{ default: DeepView }>(
  '../../../data/processed/deep/*.json',
);
const departementFiles = import.meta.glob<{ default: DepartementFile }>(
  '../../../data/processed/deep/communes/*.json',
);

const viewCache = new Map<string, Promise<DeepView>>();

/** Vues disponibles sous un nœud. `anchor` vaut `S13` ou `S1311:GF09`. */
export function deepViewsFor(anchor: string): DeepViewSummary[] {
  return DEEP_INDEX.anchors[anchor] ?? [];
}

export function hasDeepViews(anchor: string): boolean {
  return deepViewsFor(anchor).length > 0;
}

/** Sous-secteurs, dans l'ordre de lecture du projet. */
const SUB_PERIMETERS = ['S1311', 'S1314', 'S1313'] as const;

export interface AnchoredView {
  view: DeepViewSummary;
  /** Renseigné quand la vue vient d'un sous-secteur alors qu'on regarde le
   *  périmètre consolidé : le lecteur doit savoir à quoi elle se rapporte. */
  fromPerimeter: string | null;
}

/**
 * Vues sous un nœud. Depuis « toutes administrations », on ne perd pas la
 * profondeur : à défaut de vue consolidée, on propose celles des sous-secteurs,
 * en disant lequel. Leur couverture reste rapportée à leur propre parent.
 */
export function deepViewsForNode(perimeterId: string, code: string | null): AnchoredView[] {
  const anchor = code ? `${perimeterId}:${code}` : perimeterId;
  const own = deepViewsFor(anchor).map((view) => ({ view, fromPerimeter: null }));
  if (perimeterId !== 'S13') return own;

  // Depuis le périmètre consolidé, on ajoute TOUJOURS les vues des sous-secteurs
  // aux vues propres. S'arrêter aux premières masquerait la plus fine : la
  // cartographie des pathologies (ancrée sur la sécurité sociale) disparaissait
  // derrière la vue européenne des prestations, ancrée au même endroit.
  const merged: AnchoredView[] = [...own];
  const seen = new Set(own.map((o) => o.view.id));
  for (const p of SUB_PERIMETERS) {
    const a = code ? `${p}:${code}` : p;
    for (const view of deepViewsFor(a)) {
      if (seen.has(view.id)) continue;
      seen.add(view.id);
      merged.push({ view, fromPerimeter: p });
    }
  }
  // La vue proposée en premier est celle qui explique vraiment une part de la
  // ligne, et à défaut la plus fine. Sans cela, la cartographie des pathologies
  // — de loin la plus parlante sous « Santé » — arrivait en dernier.
  merged.sort((a, b) => {
    const ca = a.view.coverage == null ? 1 : 0;
    const cb = b.view.coverage == null ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return b.view.nodeCount - a.view.nodeCount;
  });
  return merged;
}

export function loadDeepView(id: string): Promise<DeepView> {
  const cached = viewCache.get(id);
  if (cached) return cached;
  const loader = viewFiles[`../../../data/processed/deep/${id}.json`];
  if (!loader) return Promise.reject(new Error(`vue inconnue : ${id}`));
  const p = loader().then((m) => m.default);
  viewCache.set(id, p);
  return p;
}

/* ————— Annuaire des communes ————— */

export interface CommuneRow {
  c: string; // code Insee
  n: string; // nom
  p: number; // population totale
  t: string; // tranche de population
  v: Record<string, number>; // agrégats, en euros
}

interface DepartementFile {
  dep: string;
  name: string;
  year: number;
  communes: CommuneRow[];
}

export interface CommuneIndex {
  year: number;
  extracted: string;
  fields: Record<string, string>; // libellé OFGL → clé courte
  medianeStrate: Record<string, number>; // tranche → dépenses/hab médianes
  departements: Record<string, string>;
  communes: [string, string, string][]; // [insee, nom, département]
}

let communeIndex: Promise<CommuneIndex> | null = null;
const departementCache = new Map<string, Promise<DepartementFile>>();

export function loadCommuneIndex(): Promise<CommuneIndex> {
  if (!communeIndex) {
    const loader = viewFiles['../../../data/processed/deep/communes-index.json'];
    communeIndex = loader
      ? loader().then((m) => m.default as unknown as CommuneIndex)
      : Promise.reject(new Error('annuaire des communes absent'));
  }
  return communeIndex;
}

export function loadDepartement(dep: string): Promise<DepartementFile> {
  const cached = departementCache.get(dep);
  if (cached) return cached;
  const loader = departementFiles[`../../../data/processed/deep/communes/${dep}.json`];
  if (!loader) return Promise.reject(new Error(`département inconnu : ${dep}`));
  const p = loader().then((m) => m.default);
  departementCache.set(dep, p);
  return p;
}

/** Recherche insensible aux accents, à la casse et aux tirets. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchCommunes(
  index: CommuneIndex,
  query: string,
  limit = 12,
): [string, string, string][] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const exact: [string, string, string][] = [];
  const starts: [string, string, string][] = [];
  const contains: [string, string, string][] = [];
  for (const row of index.communes) {
    const n = normalize(row[1]);
    if (n === q || row[0] === query) exact.push(row);
    else if (n.startsWith(q) || row[0].startsWith(q)) starts.push(row);
    else if (n.includes(q)) contains.push(row);
  }
  // « Rennes » doit sortir avant « Rennes-le-Château » : à préfixe égal, le nom
  // le plus court est le plus probable.
  starts.sort((a, b) => a[1].length - b[1].length);
  return [...exact, ...starts, ...contains].slice(0, limit);
}

/* ————— Formulations partagées ————— */

export const BASIS_LABEL: Record<Basis, string> = {
  SEC2010: 'Comptabilité nationale',
  ESSPROS: 'Statistiques européennes de protection sociale',
  LOLF: 'Comptabilité budgétaire de l’État',
  M57: 'Comptes des collectivités',
  CNAM: 'Remboursements d’assurance maladie',
  FISC: 'Chiffrage fiscal',
  DECP: 'Marchés publics notifiés',
};

export const MAPPING_NOTE: Record<Mapping, string> = {
  officiel: 'Ventilation publiée telle quelle par la source.',
  dérivé: 'Recomposée mécaniquement à partir des codes de la source.',
  éditorial: 'Rattachement construit par PoliticsAI, contestable ligne à ligne.',
};

/* ————— Export : n'importe qui doit pouvoir refaire nos additions ————— */

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Aplatit l'arbre en CSV, chemin complet compris. Le fichier porte en tête la
 * source, la requête exacte et l'empreinte : il se vérifie sans l'application.
 */
export function viewToCsv(view: DeepView): string {
  const lines: string[] = [
    `# ${view.title} — ${view.subtitle}`,
    `# Référentiel : ${BASIS_LABEL[view.basis]} (${view.basisLabel})`,
    `# Rattaché à : ${view.parentLabel}`,
    `# Source : ${view.source.name}`,
    ...view.source.queries.map((q) => `# Requête : ${q}`),
    `# Extraction : ${view.extracted} · empreinte SHA-256 : ${view.fingerprint}`,
    `# Montants en millions d'euros.`,
    ['niveau', 'chemin', 'libelle', 'montant_meur', 'sous_conditions_ressources_meur']
      .join(';'),
  ];
  const walk = (nodes: DeepNode[], path: string[], depth: number) => {
    for (const n of nodes) {
      lines.push(
        [
          depth,
          csvCell(path.join(' > ')),
          csvCell(n.label),
          n.amount.toFixed(2).replace('.', ','),
          n.meansTested ? n.meansTested.amount.toFixed(2).replace('.', ',') : '',
        ].join(';'),
      );
      if (n.children?.length) walk(n.children, [...path, n.label], depth + 1);
    }
  };
  walk(view.nodes, [], 0);
  return lines.join('\n');
}

export function downloadCsv(view: DeepView): void {
  const blob = new Blob(['\uFEFF' + viewToCsv(view)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `politicsai-${view.id}-${view.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
