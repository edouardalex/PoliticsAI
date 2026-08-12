/**
 * Moteur de simulation budgétaire — premier ordre, transparent, côté client.
 * Toutes les règles sont documentées dans content/measures.ts (HYPOTHESES)
 * et affichées dans l'app. Aucun chiffre ne sort d'un modèle d'IA.
 */

import { MODEL, BASE_INDICATORS, MEASURES, CUSTOM_DOMAINS, type MeasureDef, type Mission } from '../content/measures';
import { getPerimeter } from './data';

export type ScenarioId = 'prudent' | 'central' | 'haut';

/** Une mesure activée par le joueur (catalogue ou personnalisée). */
export interface ActiveMeasure {
  uid: string;
  def: MeasureDef;
  /** intensité dans l'unité du paramètre (ou 1 si mesure fixe) */
  intensity: number;
  isCustom?: boolean;
  /** entrée d'origine d'une mesure personnalisée (pour la sérialisation) */
  customInput?: { t: string; d: string; dir: 'plus' | 'moins'; a: number };
}

export interface YearPoint {
  year: number;
  deficitPct: number;
  debtPct: number;
  growth: number;
  unemployment: number;
  /** écart de niveau de PIB vs référence (%) */
  gdpDeltaPct: number;
  soldeBrutMd: number;
  retoursMd: number;
  interestMd: number;
  soldeNetMd: number;
}

export interface SimResult {
  scenario: YearPoint[]; // 2024 → 2029
  baseline: YearPoint[]; // 2024 → 2029
  final: YearPoint;
  finalBaseline: YearPoint;
  socialGauge: number; // 0-100
  ecoInvestMd: number;
  directJobs: number;
  totals2029: { brut: number; retours: number; interets: number; net: number };
}

/* ————— Base 2024 (données réelles de l'app) ————— */

const S13 = getPerimeter('S13');
export const SIM_BASE = {
  gdpMd: S13.gdp ?? 2_935_236 / 1000, // M€ → garde en M€ ? Non : tout en Md€ ici.
};

// Tout le moteur travaille en Md€.
const GDP_MD = (S13.gdp ?? 2_935_236) / 1000;
const BASE_DEFICIT_PCT = (S13.deficit / (S13.gdp ?? 1)) * 100;

export const BASE_2024: YearPoint = {
  year: MODEL.baseYear,
  deficitPct: round2(BASE_DEFICIT_PCT),
  debtPct: BASE_INDICATORS.debtPct,
  growth: BASE_INDICATORS.growth,
  unemployment: BASE_INDICATORS.unemployment,
  gdpDeltaPct: 0,
  soldeBrutMd: 0,
  retoursMd: 0,
  interestMd: 0,
  soldeNetMd: 0,
};

/* ————— Aides ————— */

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Montant brut à plein régime (Md€, magnitude positive). */
export function grossAmount(m: ActiveMeasure): number {
  return m.def.param ? m.intensity * m.def.param.perUnit : m.def.amount;
}

/** +1 si la mesure améliore le solde public (recette en plus, dépense en moins). */
export function soldeSign(def: MeasureDef): 1 | -1 {
  return def.kind === 'recette_plus' || def.kind === 'depense_moins' ? 1 : -1;
}

/** +1 si la mesure soutient l'activité (dépense en plus, impôt en moins). */
export function demandSign(def: MeasureDef): 1 | -1 {
  return def.kind === 'depense_plus' || def.kind === 'recette_moins' ? 1 : -1;
}

/** Effet net d'une mesure sur le solde 2029 (Md€ signés, bouclage compris) — pour l'affichage par mesure. */
export function measureNetEffect(m: ActiveMeasure, scenario: ScenarioId): number {
  const g = grossAmount(m);
  const mult = MODEL.multipliers[m.def.lever] * MODEL.scenarios[scenario];
  const gdpDelta = demandSign(m.def) * g * mult;
  return soldeSign(m.def) * g + MODEL.poRate * gdpDelta;
}

/* ————— Cœur du calcul ————— */

export function computeSimulation(measures: ActiveMeasure[], scenario: ScenarioId): SimResult {
  const scenFactor = MODEL.scenarios[scenario];
  const years = MODEL.horizon;

  const scenarioPts: YearPoint[] = [BASE_2024];
  const baselinePts: YearPoint[] = [BASE_2024];

  let debtScen = BASE_INDICATORS.debtPct;
  let debtBase = BASE_INDICATORS.debtPct;
  let extraDebtMd = 0;
  let prevGdpDelta = 0;

  for (let i = 0; i < years.length; i++) {
    // Agrégats de l'année (Md€)
    let soldeBrut = 0;
    let gdpDeltaMd = 0;
    let jobs = 0;
    for (const m of measures) {
      const phase = MODEL.phases[m.def.phase][i];
      const g = grossAmount(m) * phase;
      soldeBrut += soldeSign(m.def) * g;
      gdpDeltaMd += demandSign(m.def) * g * MODEL.multipliers[m.def.lever] * scenFactor;
      if (m.def.directJobs) jobs += m.def.directJobs * phase;
    }

    const gdpDeltaPct = (gdpDeltaMd / GDP_MD) * 100;
    const retours = MODEL.poRate * gdpDeltaMd;
    const interest = MODEL.newDebtRate * extraDebtMd;
    const soldeNet = soldeBrut + retours - interest;

    const deficitPct = BASE_DEFICIT_PCT - (soldeNet / GDP_MD) * 100;
    const growth = BASE_INDICATORS.growth + (gdpDeltaPct - prevGdpDelta);
    const unemployment = Math.max(
      2,
      BASE_INDICATORS.unemployment - MODEL.okun * gdpDeltaPct - (jobs / MODEL.activePopulation) * 100,
    );

    // Dette : déficit + effet dénominateur (croissance nominale du scénario)
    const gNomScen = MODEL.nominalGrowth + (gdpDeltaPct - prevGdpDelta) / 100;
    debtScen = debtScen + deficitPct - debtScen * gNomScen;
    debtBase = debtBase + BASE_DEFICIT_PCT - debtBase * MODEL.nominalGrowth;

    extraDebtMd += -soldeNet;
    prevGdpDelta = gdpDeltaPct;

    scenarioPts.push({
      year: years[i],
      deficitPct: round2(deficitPct),
      debtPct: round2(debtScen),
      growth: round2(growth),
      unemployment: round2(unemployment),
      gdpDeltaPct: round2(gdpDeltaPct),
      soldeBrutMd: round2(soldeBrut),
      retoursMd: round2(retours),
      interestMd: round2(interest),
      soldeNetMd: round2(soldeNet),
    });
    baselinePts.push({
      year: years[i],
      deficitPct: round2(BASE_DEFICIT_PCT),
      debtPct: round2(debtBase),
      growth: BASE_INDICATORS.growth,
      unemployment: BASE_INDICATORS.unemployment,
      gdpDeltaPct: 0,
      soldeBrutMd: 0,
      retoursMd: 0,
      interestMd: 0,
      soldeNetMd: 0,
    });
  }

  // Jauge sociale (plein régime, indépendante de l'année)
  let social = MODEL.socialBase;
  for (const m of measures) {
    const impact = m.def.social * (0.6 + grossAmount(m) / 8);
    social += Math.max(-14, Math.min(14, impact));
  }
  social = Math.max(0, Math.min(100, Math.round(social)));

  const ecoInvestMd = measures
    .filter((m) => m.def.category === 'ecologie' && m.def.kind === 'depense_plus')
    .reduce((s, m) => s + grossAmount(m), 0);

  const directJobs = measures.reduce((s, m) => s + (m.def.directJobs ?? 0), 0);

  const final = scenarioPts[scenarioPts.length - 1];
  return {
    scenario: scenarioPts,
    baseline: baselinePts,
    final,
    finalBaseline: baselinePts[baselinePts.length - 1],
    socialGauge: social,
    ecoInvestMd: round2(ecoInvestMd),
    directJobs,
    totals2029: {
      brut: final.soldeBrutMd,
      retours: final.retoursMd,
      interets: final.interestMd,
      net: final.soldeNetMd,
    },
  };
}

/* ————— Évaluation de mission ————— */

export interface GoalResult {
  label: string;
  met: boolean;
  actual: string;
}

export function evaluateMission(mission: Mission, result: SimResult): { goals: GoalResult[]; stars: number; sandbox: boolean } {
  const sandbox = mission.id === 'libre';
  const goals: GoalResult[] = mission.goals
    .filter((g) => g.test !== 'none')
    .map((g) => {
      switch (g.test) {
        case 'deficit_max':
          return {
            label: g.label,
            met: result.final.deficitPct <= g.value,
            actual: `${result.final.deficitPct.toFixed(1).replace('.', ',')} % en 2029`,
          };
        case 'unemp_max':
          return {
            label: g.label,
            met: result.final.unemployment <= g.value,
            actual: `${result.final.unemployment.toFixed(1).replace('.', ',')} % en 2029`,
          };
        case 'eco_invest_min':
          return {
            label: g.label,
            met: result.ecoInvestMd >= g.value,
            actual: `+${Math.round(result.ecoInvestMd)} Md€/an`,
          };
        default:
          return { label: g.label, met: true, actual: '' };
      }
    });

  let stars = 0;
  if (goals.length > 0 && goals.every((g) => g.met)) stars += 1;
  if (result.socialGauge >= 40) stars += 1;
  if (result.final.debtPct <= result.finalBaseline.debtPct) stars += 1;
  return { goals, stars: sandbox ? 0 : stars, sandbox };
}

/* ————— Fabrique de mesures personnalisées ————— */

let customSeq = 0;

export function buildCustomMeasure(input: {
  title: string;
  domainId: string;
  direction: 'plus' | 'moins';
  amountMd: number;
}): ActiveMeasure | null {
  const domain = CUSTOM_DOMAINS.find((d) => d.id === input.domainId);
  if (!domain || !input.title.trim() || input.amountMd <= 0) return null;
  const kind =
    domain.side === 'depense'
      ? input.direction === 'plus'
        ? 'depense_plus'
        : 'depense_moins'
      : input.direction === 'plus'
        ? 'recette_plus'
        : 'recette_moins';
  // sensibilité : dépenser plus / taxer moins est mieux accueilli que l'inverse
  const social =
    domain.side === 'depense'
      ? input.direction === 'plus'
        ? Math.abs(domain.social)
        : -Math.abs(domain.social || 1) - 1
      : input.direction === 'plus'
        ? domain.social - 1
        : Math.abs(domain.social) + 1;
  const def: MeasureDef = {
    id: `custom_${customSeq++}`,
    title: input.title.trim(),
    desc: `Mesure proposée par vous — ${domain.label.toLowerCase()}, ${
      domain.side === 'depense'
        ? input.direction === 'plus'
          ? 'dépense supplémentaire'
          : 'économie'
        : input.direction === 'plus'
          ? 'prélèvement supplémentaire'
          : 'baisse de prélèvement'
    } de ${input.amountMd} Md€ par an.`,
    category: domain.category,
    kind,
    amount: input.amountMd,
    lever: domain.lever,
    social: Math.max(-3, Math.min(3, social)),
    phase: 'progressive',
    incidence: 'Selon le périmètre exact de votre mesure.',
    basis: 'Montant fixé par vous — le moteur applique les mêmes règles qu’aux autres mesures.',
  };
  return {
    uid: def.id,
    def,
    intensity: 1,
    isCustom: true,
    customInput: { t: input.title.trim(), d: input.domainId, dir: input.direction, a: input.amountMd },
  };
}

/* ————— Sérialisation (partage par URL) ————— */

export interface SimShareState {
  mission: string;
  scenario: ScenarioId;
  measures: { id: string; i: number }[];
  custom: { t: string; d: string; dir: 'plus' | 'moins'; a: number }[];
}

export function encodeSimState(state: SimShareState): string {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSimState(encoded: string): SimShareState | null {
  try {
    const bin = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as SimShareState;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.measures)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Reconstruit les mesures actives depuis un état partagé. */
export function hydrateMeasures(state: SimShareState): ActiveMeasure[] {
  const out: ActiveMeasure[] = [];
  for (const m of state.measures) {
    const def = MEASURES.find((d) => d.id === m.id);
    if (!def) continue;
    const intensity = def.param
      ? Math.max(def.param.min, Math.min(def.param.max, m.i))
      : 1;
    out.push({ uid: def.id, def, intensity });
  }
  for (const c of state.custom ?? []) {
    const built = buildCustomMeasure({
      title: String(c.t).slice(0, 80),
      domainId: c.d,
      direction: c.dir === 'moins' ? 'moins' : 'plus',
      amountMd: Math.max(0.5, Math.min(60, Number(c.a) || 0)),
    });
    if (built) out.push(built);
  }
  return out;
}
