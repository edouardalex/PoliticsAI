/**
 * Palette catégorielle — validée avec le validateur dataviz
 * (surface #0C0F17, mode dark) : ΔE CVD adjacent 8,4 (protan),
 * plancher vision normale 19,3, contraste ≥ 3:1, bande L 0.48–0.67.
 * L'ordre d'attribution est GELÉ (rang de taille 2024) : la couleur suit
 * l'entité, jamais son rang du moment — ne pas réattribuer.
 */

export const FUNCTION_COLORS: Record<string, string> = {
  GF10: '#3987e5', // Protection sociale
  GF07: '#d95926', // Santé
  GF01: '#199e70', // Services publics généraux
  GF04: '#c98500', // Affaires économiques
  GF09: '#d55181', // Enseignement
  GF02: '#008300', // Défense
  GF03: '#9085e9', // Ordre et sécurité publics
  GF08: '#e66767', // Loisirs, culture et culte
  GF06: '#6c7a93', // Logement et équipements collectifs (queue)
  GF05: '#4d5a73', // Protection de l'environnement (queue)
};

export const REVENUE_COLOR = '#5e729b';
export const REVENUE_BRIGHT = '#7d92bd';
export const SPINE_COLOR = '#c9d4e8';
export const DEFICIT_COLOR = '#d03b3b';
export const SURPLUS_COLOR = '#0ca30c';

export function functionColor(code: string): string {
  // GF0703 → GF07
  const l1 = code.length > 4 ? code.slice(0, 4) : code;
  return FUNCTION_COLORS[l1] ?? '#6c7a93';
}

/** Déclinaison d'une couleur pour les sous-postes (variation de luminosité stable). */
export function childShade(base: string, index: number, count: number): string {
  const t = count <= 1 ? 0 : index / (count - 1); // 0 → 1
  // éclaircit progressivement vers 22 % de blanc, garde la teinte
  return mix(base, '#f2f4f8', 0.06 + t * 0.24);
}

export function mix(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hex(h: string): number[] {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
