import franceRaw from '../../../data/processed/france.json';
import europeRaw from '../../../data/processed/europe.json';

/* ————— Types du pipeline ————— */

/** Décomposition par nature de dépense (opérations SEC 2010).
 *  Additive : la somme reconstitue exactement le total du nœud. */
export interface Nature {
  code: string;
  label: string;
  value: number; // M€ — peut être négatif (SIFIM, cessions nettes)
  detail?: string;
}

export interface CofogChild {
  code: string;
  label: string;
  value: number; // M€
  natures: Nature[];
}

export interface CofogFunction {
  code: string;
  label: string;
  value: number; // M€
  pctGdp: number | null;
  natures: Nature[];
  children: CofogChild[];
}

export interface RevenueCategory {
  code: string;
  label: string;
  value: number; // M€
  detail?: string;
}

export interface Perimeter {
  label: string;
  year: number;
  gdp: number | null;
  expenditureTotal: number;
  expenditurePctGdp: number | null;
  revenueTotal: number;
  netLending: number | null;
  deficit: number; // TE - TR (positif = déficit)
  natures: Nature[];
  functions: CofogFunction[];
  revenues: RevenueCategory[];
}

export interface FranceData {
  meta: { source: string; extracted: string; note: string; url: string };
  perimeters: Record<string, Perimeter>;
}

export interface EuropeCountry {
  geo: string;
  label: string;
  year: number;
  totalPctGdp: number;
  functions: Record<string, number>; // GFxx → % PIB
}

export interface EuropeData {
  meta: { source: string; extracted: string; note: string };
  countries: EuropeCountry[];
}

export const FRANCE = franceRaw as unknown as FranceData;
export const EUROPE = europeRaw as unknown as EuropeData;

export type PerimeterId = 'S13' | 'S1311' | 'S1314' | 'S1313';
export const PERIMETER_IDS: PerimeterId[] = ['S13', 'S1311', 'S1314', 'S1313'];

export function getPerimeter(id: PerimeterId): Perimeter {
  return FRANCE.perimeters[id];
}

export function getFunction(p: Perimeter, code: string): CofogFunction | undefined {
  return p.functions.find((f) => f.code === code);
}

export function euCountry(geo: string): EuropeCountry | undefined {
  return EUROPE.countries.find((c) => c.geo === geo);
}

/** France dans le jeu Europe (pour les mini-comparaisons). */
export const EU_FRANCE = euCountry('FR');
