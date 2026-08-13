/**
 * Parseur déterministe de propositions en langage libre — SANS IA.
 *
 * Règles du projet : les chiffres viennent des données, jamais d'un modèle.
 * Ici, rien n'est « deviné » : on reconnaît des mots-clés et des nombres, on
 * les convertit avec des ancres publiques (l'âge légal est à 64 ans, la TVA à
 * 20 %…), et **on refuse de répondre hors du domaine de validité** en
 * expliquant pourquoi. Tout le comportement est lisible dans ce fichier.
 */

import { MEASURES, type MeasureDef } from '../content/measures';
import { NLP_HINTS } from '../content/nlp';

export type ParseStatus = 'matched' | 'out_of_range' | 'ambiguous' | 'unknown';

export interface ParseResult {
  status: ParseStatus;
  measure?: MeasureDef;
  /** intensité calculable (dans la plage de validité) */
  intensity?: number;
  /** ce qui a été demandé, quand c'est hors plage */
  requested?: number;
  /** phrase « voici ce que j'ai compris » */
  understood: string;
  /** explication complémentaire (refus, échelle du catalogue…) */
  detail?: string;
  /** propositions quand c'est ambigu */
  candidates?: MeasureDef[];
  score: number;
}

/* ————— Normalisation ————— */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9%€\s.,+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(
  ('le la les de des du un une et ou a au aux en pour par sur dans avec sans plus moins il elle on ' +
    'faut faudrait doit devrait que qui quoi est sont ce cet cette ces son sa ses leur leurs notre ' +
    'nos votre vos mon ma mes je tu nous vous ils elles y d l s n je veux voudrais aimerais mettre ' +
    'passer faire tout tous toute toutes autre autres etre avoir plus').split(' '),
);

function words(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/* ————— Extraction des nombres ————— */

export interface ParsedNumber {
  value: number;
  /** unité normalisée : 'ans' | '%' | 'pt' | 'md' | 'postes' | null */
  unit: string | null;
  /** vrai si la phrase dit « à X » (valeur cible) plutôt qu'un écart */
  isTarget: boolean;
}

const NUM = String.raw`(\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?)`;

export function extractNumbers(input: string): ParsedNumber[] {
  const s = normalize(input);
  const out: ParsedNumber[] = [];
  const push = (raw: string, unit: string | null, at: number) => {
    const value = parseFloat(raw.replace(/[ .](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!Number.isFinite(value)) return;
    // « à 67 ans », « a 22 % » → valeur cible ; sinon écart
    const before = s.slice(Math.max(0, at - 14), at);
    const isTarget = /\b(a|vers|jusqu a|jusque|atteindre|porter a|passer a)\s*$/.test(before);
    out.push({ value, unit, isTarget });
  };

  const patterns: [RegExp, string | null][] = [
    [new RegExp(NUM + String.raw`\s*(?:ans?|annees?)\b`, 'g'), 'ans'],
    [new RegExp(NUM + String.raw`\s*(?:points?|pts?|pt)\b`, 'g'), 'pt'],
    [new RegExp(NUM + String.raw`\s*%`, 'g'), '%'],
    [new RegExp(NUM + String.raw`\s*(?:milliards?|md|mds|mde|md€|milliard)\b`, 'g'), 'md'],
    [new RegExp(NUM + String.raw`\s*(?:postes?|emplois?|profs?|professeurs?|enseignants?|soignants?|infirmiers?|policiers?|agents?|fonctionnaires?|places?|logements?)\b`, 'g'), 'postes'],
  ];

  for (const [re, unit] of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) push(m[1], unit, m.index);
  }
  if (out.length === 0) {
    const re = new RegExp(String.raw`\b` + NUM + String.raw`\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) push(m[1], null, m.index);
  }
  return out;
}

/* ————— Sens de la demande ————— */

const UP = ['augmenter', 'augmente', 'hausse', 'relever', 'releve', 'monter', 'creer', 'creation', 'recruter', 'embaucher', 'investir', 'doubler', 'renforcer', 'revaloriser', 'financer', 'ajouter', 'developper', 'ouvrir', 'construire', 'taxer', 'reculer', 'repousser', 'reporter', 'decaler'];
const DOWN = ['baisser', 'baisse', 'reduire', 'reduction', 'diminuer', 'supprimer', 'suppression', 'raboter', 'couper', 'geler', 'gel', 'economiser', 'economie', 'abaisser', 'annuler', 'abroger', 'defiscaliser', 'exonerer', 'avancer', 'ramener'];

function direction(s: string): 1 | -1 | 0 {
  const n = normalize(s);
  const up = UP.some((w) => n.includes(w));
  const down = DOWN.some((w) => n.includes(w));
  if (up && !down) return 1;
  if (down && !up) return -1;
  return 0;
}

/* ————— Index de recherche (construit une fois) ————— */

interface Entry {
  def: MeasureDef;
  keys: string[];
  avoid: string[];
  titleWords: Set<string>;
  bodyWords: Set<string>;
}

const INDEX: Entry[] = MEASURES.map((def) => ({
  def,
  keys: (NLP_HINTS[def.id]?.keys ?? []).map(normalize),
  avoid: (NLP_HINTS[def.id]?.avoid ?? []).map(normalize),
  titleWords: new Set(words(def.title)),
  bodyWords: new Set([...words(def.desc), ...words(def.incidence)]),
}));

/* ————— Correspondance ————— */

function scoreEntry(e: Entry, input: string, nums: ParsedNumber[], dir: 1 | -1 | 0): number {
  const n = normalize(input);
  const w = words(input);
  let score = 0;

  // expressions disqualifiantes (« justice sociale » n'est pas le budget de la justice)
  for (const a of e.avoid) {
    if (a && n.includes(a)) return 0;
  }

  // synonymes explicites : le signal le plus fort
  for (const k of e.keys) {
    if (!k) continue;
    if (n.includes(k)) score += 6 + k.split(' ').length * 2;
  }
  // mots du titre
  for (const word of w) {
    if (e.titleWords.has(word)) score += 3;
    else if (e.bodyWords.has(word)) score += 0.8;
  }
  if (score === 0) return 0;

  // une unité qui correspond à l'ancre de la mesure : signal décisif
  const anchor = NLP_HINTS[e.def.id]?.anchor;
  if (anchor) {
    const unitKey = anchor.unit === 'ans' ? 'ans' : '%';
    if (nums.some((x) => x.unit === unitKey || (unitKey === '%' && x.unit === 'pt'))) score += 7;
  }
  if (e.def.param) {
    const u = e.def.param.unit;
    if (nums.some((x) => (u === 'Md€' && x.unit === 'md') || (u === 'an' && x.unit === 'ans') || ((u === 'pt' || u === '%') && (x.unit === 'pt' || x.unit === '%')))) {
      score += 3;
    }
  }
  if (nums.some((x) => x.unit === 'postes') && e.def.directJobs) score += 3;

  // cohérence de sens : dépenser/taxer plus vs moins
  if (dir !== 0) {
    const adds = e.def.kind === 'depense_plus' || e.def.kind === 'recette_plus';
    score += (dir === 1) === adds ? 2 : -3;
  }
  return score;
}

/** Couples symétriques : une demande de sens opposé bascule vers l'autre. */
const SYMMETRIC: Record<string, string> = {
  retraite_age: 'retraite_age_baisse',
  retraite_age_baisse: 'retraite_age',
  apl_hausse: 'apl_baisse',
  apl_baisse: 'apl_hausse',
  audiovisuel_plus: 'audiovisuel_baisse',
  audiovisuel_baisse: 'audiovisuel_plus',
  defense: 'defense_baisse',
  defense_baisse: 'defense',
  pensions_revalo: 'retraites_gel',
  retraites_gel: 'pensions_revalo',
};

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/* ————— Point d'entrée ————— */

export function parseProposal(input: string): ParseResult {
  const text = input.trim();
  if (text.length < 3) {
    return { status: 'unknown', understood: '', score: 0 };
  }

  const nums = extractNumbers(text);
  const dir = direction(text);

  const scored = INDEX.map((e) => ({ e, s: scoreEntry(e, text, nums, dir) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const ambiguousLow = scored.length > 1 && scored[0].s < 8 && scored[1].s > scored[0].s * 0.82;
  if (scored.length === 0 || scored[0].s < 4 || ambiguousLow) {
    return {
      status: 'unknown',
      understood: '',
      detail:
        'Aucune mesure du catalogue ne correspond à cette proposition. Vous pouvez la créer vous-même dans l’atelier, ou la soumettre à la file citoyenne pour qu’elle soit chiffrée.',
      score: scored[0]?.s ?? 0,
    };
  }

  let best = scored[0].e.def;
  const runnerUp = scored[1];

  // ——— conversion du nombre en intensité, via l'ancre ———
  const anchorOf = (id: string) => NLP_HINTS[id]?.anchor;
  let anchor = anchorOf(best.id);
  let requested: number | undefined;

  if (anchor) {
    const unitKey = anchor.unit === 'ans' ? 'ans' : '%';
    const num = nums.find((x) => x.unit === unitKey || (unitKey === '%' && x.unit === 'pt'));
    if (num) {
      const delta = num.isTarget || num.value > anchor.value * 0.8 ? (num.value - anchor.value) : num.value;
      const signed = delta * anchor.direction;
      // demande de sens opposé → bascule vers la mesure symétrique
      if (signed < 0 && SYMMETRIC[best.id]) {
        const sym = MEASURES.find((m) => m.id === SYMMETRIC[best.id]);
        if (sym) {
          best = sym;
          anchor = anchorOf(sym.id);
          requested = anchor ? Math.abs((num.value - anchor.value) * anchor.direction) : Math.abs(signed);
        }
      } else {
        requested = Math.abs(signed);
      }
    }
  } else if (best.param) {
    const u = best.param.unit;
    const num =
      nums.find((x) => (u === 'Md€' && x.unit === 'md') || (u === 'an' && x.unit === 'ans') || ((u === 'pt' || u === '%') && (x.unit === 'pt' || x.unit === '%'))) ??
      nums.find((x) => x.unit === null);
    if (num) requested = Math.abs(num.value);
  }

  // ambiguïté : deux mesures très proches et pas de nombre discriminant.
  // En dessous de 8, la correspondance est trop faible pour proposer quoi que ce
  // soit — mieux vaut dire « je ne sais pas » que suggérer au hasard.
  if (runnerUp && runnerUp.s > scored[0].s * 0.82 && requested === undefined && scored[0].s >= 8) {
    return {
      status: 'ambiguous',
      understood: 'Plusieurs mesures correspondent à votre proposition.',
      candidates: [best, runnerUp.e.def, ...(scored[2] ? [scored[2].e.def] : [])],
      score: scored[0].s,
    };
  }

  // ——— mesure paramétrée : contrôle du domaine de validité ———
  if (best.param && requested !== undefined) {
    const { min, max, unit } = best.param;
    if (requested > max) {
      return {
        status: 'out_of_range',
        measure: best,
        requested,
        intensity: max,
        understood: describe(best, requested, unit, anchor?.label),
        detail: best.validityNote,
        score: scored[0].s,
      };
    }
    const intensity = Math.max(min, Math.round(requested / best.param.step) * best.param.step);
    return {
      status: 'matched',
      measure: best,
      intensity,
      understood: describe(best, intensity, unit, anchor?.label),
      score: scored[0].s,
    };
  }

  // ——— mesure à montant fixe ———
  const detail =
    requested !== undefined && best.directJobs
      ? `Le catalogue chiffre cette mesure à ${nf.format(Math.abs(best.directJobs))} postes (${nf.format(best.amount)} Md€). Pour une autre ampleur, l’atelier vous laisse fixer le montant.`
      : undefined;
  return {
    status: 'matched',
    measure: best,
    intensity: 1,
    understood: `« ${best.title} » — chiffrée ${nf.format(best.amount)} Md€ par an.`,
    detail,
    score: scored[0].s,
  };
}

function describe(def: MeasureDef, value: number, unit: string, anchorLabel?: string): string {
  const u = unit === 'an' ? (value > 1 ? 'ans' : 'an') : unit;
  const base = `« ${def.title} » de ${nf.format(value)} ${u}`;
  return anchorLabel ? `${base} (${anchorLabel}).` : `${base}.`;
}
