/**
 * Formatage des nombres à la française.
 * Valeurs du pipeline en MILLIONS d'euros (M€).
 */

export type DisplayMode = 'eur' | 'per1000' | 'pctGdp';

const NBSP = ' '; // espace fine insécable

const fmt0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmt2 = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1671794 (M€) → « 1 672 Md€ » ; 51180 → « 51,2 Md€ » ; 399 → « 399 M€ » */
export function fmtAmount(millions: number): string {
  const md = millions / 1000;
  if (Math.abs(md) >= 100) return `${fmt0.format(md)}${NBSP}Md€`;
  if (Math.abs(md) >= 1) return `${fmt1.format(md)}${NBSP}Md€`;
  return `${fmt0.format(millions)}${NBSP}M€`;
}

/** Montant complet en euros, pour les grands compteurs. */
export function fmtEuros(millions: number): string {
  return `${fmt0.format(Math.round(millions * 1e6))}${NBSP}€`;
}

export function fmtPct(x: number, decimals = 1): string {
  const f = decimals === 2 ? fmt2 : decimals === 0 ? fmt0 : fmt1;
  return `${f.format(x)}${NBSP}%`;
}

export function fmtPer1000(euros: number): string {
  if (euros >= 10) return `${fmt0.format(euros)}${NBSP}€`;
  if (euros >= 1) return `${fmt1.format(euros)}${NBSP}€`;
  return `${fmt2.format(euros)}${NBSP}€`;
}

export interface ModeContext {
  /** total de référence en M€ (dépenses totales du périmètre) */
  refTotal: number;
  /** PIB en M€ */
  gdp: number | null;
}

/** Valeur d'un nœud dans le mode d'affichage courant. */
export function fmtInMode(millions: number, mode: DisplayMode, ctx: ModeContext): string {
  switch (mode) {
    case 'eur':
      return fmtAmount(millions);
    case 'per1000':
      return fmtPer1000((millions / ctx.refTotal) * 1000);
    case 'pctGdp':
      return ctx.gdp ? `${fmtPct((millions / ctx.gdp) * 100)} du PIB` : fmtAmount(millions);
  }
}

export const MODE_LABELS: Record<DisplayMode, string> = {
  eur: 'Md€',
  per1000: 'pour 1 000 €',
  pctGdp: '% du PIB',
};

/** Part d'un montant dans un total, formatée. */
export function fmtShare(millions: number, total: number): string {
  return fmtPct((millions / total) * 100);
}
