/**
 * Équivalences concrètes — ordres de grandeur INDICATIFS, sourcés dans
 * la méthodologie. Elles traduisent un montant en objets tangibles.
 * Règle éditoriale : des ancres factuelles, jamais de jugement.
 */

export interface Anchor {
  id: string;
  cost: number; // coût unitaire en euros
  /** libellé pluriel, ex. « collèges neufs » */
  plural: string;
  /** libellé singulier pour n = 1 */
  singular: string;
  source: string;
}

export const ANCHORS: Anchor[] = [
  { id: 'hospit', cost: 1500, plural: 'journées d’hospitalisation', singular: 'journée d’hospitalisation', source: 'ATIH, coût moyen d’une journée en médecine-chirurgie — ordre de grandeur' },
  { id: 'eleve', cost: 11_000, plural: 'années de scolarité d’un élève', singular: 'année de scolarité d’un élève', source: 'DEPP, dépense moyenne par élève et par an (2023)' },
  { id: 'creche', cost: 16_000, plural: 'places de crèche pendant un an', singular: 'place de crèche pendant un an', source: 'CNAF — coût annuel complet moyen d’une place, ordre de grandeur' },
  { id: 'smic', cost: 17_000, plural: 'années de SMIC net', singular: 'année de SMIC net', source: 'SMIC net annuel 2024, ordre de grandeur' },
  { id: 'prof', cost: 60_000, plural: 'enseignants pendant un an', singular: 'enseignant pendant un an', source: 'coût employeur annuel moyen d’un enseignant, ordre de grandeur' },
  { id: 'irm', cost: 1_500_000, plural: 'appareils IRM', singular: 'appareil IRM', source: 'coût d’acquisition d’un IRM, ordre de grandeur' },
  { id: 'piscine', cost: 10_000_000, plural: 'piscines municipales', singular: 'piscine municipale', source: 'coût de construction moyen, ordre de grandeur' },
  { id: 'commune', cost: 12_000_000, plural: 'années de budget d’une ville de 10 000 habitants', singular: 'année de budget d’une ville de 10 000 habitants', source: 'DGCL, dépenses communales moyennes ≈ 1 200 €/hab./an' },
  { id: 'college', cost: 20_000_000, plural: 'collèges neufs', singular: 'collège neuf', source: 'coût de construction moyen d’un collège, ordre de grandeur' },
  { id: 'autoroute', cost: 8_000_000, plural: 'kilomètres d’autoroute neuve', singular: 'kilomètre d’autoroute neuve', source: 'coût moyen au km (2×2 voies), ordre de grandeur' },
  { id: 'lgv', cost: 25_000_000, plural: 'kilomètres de ligne à grande vitesse', singular: 'kilomètre de ligne à grande vitesse', source: 'coût moyen au km d’une LGV, ordre de grandeur' },
  { id: 'rafale', cost: 80_000_000, plural: 'avions Rafale', singular: 'avion Rafale', source: 'coût unitaire hors armement, ordre de grandeur' },
  { id: 'chu', cost: 1_000_000_000, plural: 'hôpitaux universitaires neufs', singular: 'hôpital universitaire neuf', source: 'coût de construction d’un CHU récent, ordre de grandeur' },
];

export interface Equivalence {
  anchor: Anchor;
  count: number;
  text: string; // « ≈ 3 200 collèges neufs »
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function render(anchor: Anchor, count: number): string {
  const rounded =
    count >= 100 ? Math.round(count / 10) * 10 : count >= 10 ? Math.round(count) : Math.round(count * 10) / 10;
  const label = rounded < 1.5 ? anchor.singular : anchor.plural;
  const num = rounded >= 10 ? nf.format(rounded) : `${rounded}`.replace('.', ',');
  return `≈ ${num} ${label}`;
}

/**
 * Choisit jusqu'à `n` équivalences pour un montant (en M€), en visant
 * des comptes « humains » (entre 2 et 5 000) et des ancres variées.
 */
export function pickEquivalences(millions: number, n = 3): Equivalence[] {
  const euros = millions * 1e6;
  const candidates = ANCHORS.map((anchor) => ({ anchor, count: euros / anchor.cost }))
    .filter((c) => c.count >= 1.5 && c.count <= 5000)
    .sort((a, b) => score(b.count) - score(a.count));

  const picked: Equivalence[] = [];
  for (const c of candidates) {
    if (picked.length >= n) break;
    picked.push({ ...c, text: render(c.anchor, c.count) });
  }
  return picked;
}

/** Préférence pour les comptes lisibles (maximum autour de 20–500). */
function score(count: number): number {
  const l = Math.log10(count);
  return -Math.abs(l - 2.2);
}
