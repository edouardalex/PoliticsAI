/**
 * Simulateur — catalogue de mesures, missions et paramètres du modèle.
 *
 * Règles éditoriales :
 *  - chaque chiffrage est un ORDRE DE GRANDEUR, sourcé dans `basis` ;
 *  - aucune mesure n'est qualifiée de bonne ou mauvaise : on décrit qui paie,
 *    qui reçoit, et ce que le moteur en déduit mécaniquement ;
 *  - la « sensibilité sociale » alimente une jauge assumée comme LUDIQUE,
 *    calibrée sur des règles simples et publiques (voir HYPOTHESES).
 */

/* ————— Types ————— */

export type LeverType =
  | 'invest_public' // investissement public (multiplicateur fort)
  | 'social_cible' // prestations ciblées bas revenus
  | 'fonctionnement' // masse salariale / fonctionnement public
  | 'tax_menages' // impôts des ménages (moyenne)
  | 'tax_menages_aises' // impôts concentrés sur hauts revenus/patrimoines
  | 'tax_entreprises' // impôts des entreprises
  | 'tax_conso' // TVA, accises
  | 'cotisations'; // cotisations sociales

export type MeasureKind = 'depense_plus' | 'depense_moins' | 'recette_plus' | 'recette_moins';

export type MeasureCategory =
  | 'sante'
  | 'education'
  | 'recherche'
  | 'ecologie'
  | 'transports'
  | 'logement'
  | 'securite'
  | 'social'
  | 'famille'
  | 'retraites'
  | 'emploi'
  | 'fonction_publique'
  | 'economie'
  | 'agriculture'
  | 'numerique'
  | 'culture'
  | 'territoires'
  | 'international'
  | 'fiscalite_menages'
  | 'fiscalite_entreprises'
  | 'fonctionnement_etat';

export interface MeasureParam {
  /** libellé de l'unité (pt, an, %, Md€…) */
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** effet budgétaire en Md€ PAR unité */
  perUnit: number;
}

export interface MeasureDef {
  id: string;
  title: string;
  desc: string;
  category: MeasureCategory;
  kind: MeasureKind;
  /** effet budgétaire brut en Md€/an à plein régime (>0 toujours ; le sens vient de `kind`) */
  amount: number;
  param?: MeasureParam;
  lever: LeverType;
  /** emplois publics directs créés (+) ou supprimés (−) à plein régime */
  directJobs?: number;
  /** −3 (très conflictuel) … +3 (très consensuel) — jauge ludique */
  social: number;
  /** montée en charge : part de l'effet par année (2025…2029) */
  phase: 'immediate' | 'progressive' | 'slow';
  /** qui est concerné en premier lieu */
  incidence: string;
  /** base du chiffrage (ordre de grandeur) */
  basis: string;
}

export interface Mission {
  id: string;
  title: string;
  pitch: string;
  /** objectifs évalués en 2029 — descriptions factuelles */
  goals: { label: string; test: 'deficit_max' | 'unemp_max' | 'eco_invest_min' | 'none'; value: number }[];
}

/* ————— Paramètres du modèle (tous affichés dans l'app) ————— */

export const MODEL = {
  baseYear: 2024,
  horizon: [2025, 2026, 2027, 2028, 2029],
  /** multiplicateurs budgétaires par levier (impact PIB d'1 € au premier ordre).
   *  Fourchettes usuelles de la littérature (OFCE, FMI, DG Trésor) — valeurs centrales. */
  multipliers: {
    invest_public: 1.2,
    social_cible: 0.9,
    fonctionnement: 0.8,
    tax_menages: 0.5,
    tax_menages_aises: 0.3,
    tax_entreprises: 0.4,
    tax_conso: 0.6,
    cotisations: 0.5,
  } as Record<LeverType, number>,
  /** scénarios d'incertitude appliqués aux multiplicateurs */
  scenarios: { prudent: 0.6, central: 1.0, haut: 1.3 },
  /** loi d'Okun simplifiée : Δchômage (pts) = −okun × ΔPIB (%) */
  okun: 0.4,
  /** part d'un supplément de PIB récupérée en prélèvements (bouclage) */
  poRate: 0.45,
  /** taux d'intérêt moyen sur la dette nouvelle */
  newDebtRate: 0.03,
  /** croissance nominale tendancielle (réel ~1,1 % + prix ~1,8 %) */
  nominalGrowth: 0.029,
  /** population active (pour convertir les emplois directs en points de chômage) */
  activePopulation: 30_500_000,
  /** phase-in */
  phases: {
    immediate: [1, 1, 1, 1, 1],
    progressive: [0.34, 0.67, 1, 1, 1],
    slow: [0.15, 0.35, 0.6, 0.85, 1],
  } as Record<'immediate' | 'progressive' | 'slow', number[]>,
  /** climat social : jauge 0-100, départ 50 ; impact = social × (0,6 + |Md€|/8), borné à ±14 par mesure */
  socialBase: 50,
};

/** Indicateurs de départ (année de base 2024) — sources affichées dans l'app. */
export const BASE_INDICATORS = {
  growth: 1.1, // Insee, comptes nationaux 2024
  unemployment: 7.4, // Insee, T4 2024 (BIT)
  debtPct: 113.0, // Insee, dette publique fin 2024 (% PIB)
  inflation: 1.8,
  sources:
    'Croissance et dette : Insee, comptes nationaux 2024. Chômage : Insee, enquête Emploi T4 2024. Déficit : calculé des données Eurostat de l’app (dépenses − recettes 2024).',
};

/* ————— Missions ————— */

export const MISSIONS: Mission[] = [
  {
    id: 'maastricht',
    title: 'Sous les 3 %',
    pitch:
      'Ramener le déficit public sous 3 % du PIB en 2029, le plafond des traités européens. À vous de choisir le chemin : recettes, dépenses, ou pari sur la croissance.',
    goals: [{ label: 'Déficit 2029 ≤ 3 % du PIB', test: 'deficit_max', value: 3.0 }],
  },
  {
    id: 'emploi',
    title: 'Cap sur le plein emploi',
    pitch:
      'Faire passer le chômage sous 5 % en 2029 — le plein emploi au sens usuel. Investissements, baisses de charges, embauches publiques : tous les leviers sont sur la table.',
    goals: [{ label: 'Chômage 2029 ≤ 5 %', test: 'unemp_max', value: 5.0 }],
  },
  {
    id: 'transition',
    title: 'Financer la transition',
    pitch:
      'Porter l’investissement climat à au moins 25 Md€ par an de plus qu’aujourd’hui, sans laisser filer le déficit au-delà de 4 % du PIB en 2029.',
    goals: [
      { label: 'Investissement écologie ≥ +25 Md€/an', test: 'eco_invest_min', value: 25 },
      { label: 'Déficit 2029 ≤ 4 % du PIB', test: 'deficit_max', value: 4.0 },
    ],
  },
  {
    id: 'libre',
    title: 'Le bac à sable',
    pitch:
      'Aucun objectif, aucune limite : les 120 mesures du catalogue, et surtout l’atelier complet pour inventer les vôtres — vous réglez le levier économique, la montée en charge, les emplois créés. Le laboratoire du budget.',
    goals: [{ label: 'Aucun objectif — liberté totale', test: 'none', value: 0 }],
  },
];

/* ————— Catalogue (dans catalog.ts) ————— */

export { MEASURES } from './catalog';

/* ————— Domaines proposés pour les mesures personnalisées ————— */

export interface CustomDomain {
  id: string;
  label: string;
  side: 'depense' | 'recette';
  lever: LeverType;
  social: number;
  category: MeasureCategory;
}

export const CUSTOM_DOMAINS: CustomDomain[] = [
  { id: 'c_sante', label: 'Santé & hôpital', side: 'depense', lever: 'fonctionnement', social: 2, category: 'sante' },
  { id: 'c_educ', label: 'École & université', side: 'depense', lever: 'fonctionnement', social: 2, category: 'education' },
  { id: 'c_eco', label: 'Écologie & transports', side: 'depense', lever: 'invest_public', social: 1, category: 'ecologie' },
  { id: 'c_secu', label: 'Sécurité & justice', side: 'depense', lever: 'fonctionnement', social: 1, category: 'securite' },
  { id: 'c_social', label: 'Solidarités', side: 'depense', lever: 'social_cible', social: 2, category: 'social' },
  { id: 'c_infra', label: 'Infrastructures & industrie', side: 'depense', lever: 'invest_public', social: 1, category: 'economie' },
  { id: 'c_fp', label: 'Fonction publique', side: 'depense', lever: 'fonctionnement', social: 0, category: 'fonction_publique' },
  { id: 'c_tax_men', label: 'Impôts des ménages', side: 'recette', lever: 'tax_menages', social: -1, category: 'fiscalite_menages' },
  { id: 'c_tax_aises', label: 'Impôts hauts revenus / patrimoine', side: 'recette', lever: 'tax_menages_aises', social: 0, category: 'fiscalite_menages' },
  { id: 'c_tax_ent', label: 'Impôts des entreprises', side: 'recette', lever: 'tax_entreprises', social: 0, category: 'fiscalite_entreprises' },
  { id: 'c_tax_conso', label: 'Taxes sur la consommation', side: 'recette', lever: 'tax_conso', social: -2, category: 'fiscalite_menages' },
];

export const CATEGORY_LABELS: Record<MeasureCategory, string> = {
  sante: 'Santé',
  education: 'Éducation',
  recherche: 'Recherche & université',
  ecologie: 'Écologie & énergie',
  transports: 'Transports',
  logement: 'Logement',
  securite: 'Sécurité, justice, défense',
  social: 'Solidarités',
  famille: 'Famille & petite enfance',
  retraites: 'Retraites',
  emploi: 'Emploi & formation',
  fonction_publique: 'Fonction publique',
  economie: 'Économie & industrie',
  agriculture: 'Agriculture',
  numerique: 'Numérique',
  culture: 'Culture & sport',
  territoires: 'Territoires & collectivités',
  international: 'International',
  fiscalite_menages: 'Impôts des ménages',
  fiscalite_entreprises: 'Impôts des entreprises',
  fonctionnement_etat: 'Fonctionnement de l’État',
};

/* ————— Hypothèses (texte affiché) ————— */

export const HYPOTHESES = [
  {
    title: 'Un modèle au premier ordre, pas une boule de cristal',
    body:
      'Le simulateur applique des règles mécaniques simples et publiques. Il ne prédit pas l’avenir : il montre les ordres de grandeur qu’impliquent vos choix, toutes choses égales par ailleurs, à partir d’une prolongation naïve de 2024 (croissance 1,1 %/an, chômage 7,4 %, déficit constant en % du PIB).',
  },
  {
    title: 'Effet sur l’activité (PIB)',
    body:
      'Chaque mesure porte un multiplicateur budgétaire selon son levier — investissement public 1,2 ; prestations ciblées 0,9 ; fonctionnement 0,8 ; TVA/accises 0,6 ; impôt sur le revenu 0,5 ; cotisations 0,5 ; impôts des entreprises 0,4 ; impôts des plus aisés 0,3 (valeurs centrales des fourchettes OFCE, FMI, DG Trésor). ΔPIB = montant ÷ PIB × multiplicateur. Le sélecteur de scénario multiplie l’ensemble par 0,6 (prudent), 1 (central) ou 1,3 (haut).',
  },
  {
    title: 'Effet sur le chômage',
    body:
      'Loi d’Okun simplifiée : 1 point de PIB en plus ≈ 0,4 point de chômage en moins. Les créations ou suppressions directes de postes publics s’ajoutent, rapportées aux 30,5 millions d’actifs.',
  },
  {
    title: 'Bouclage budgétaire',
    body:
      'Quand l’activité varie, les recettes suivent : 45 % d’un supplément de PIB revient en prélèvements (taux de prélèvements obligatoires moyen). Le coût net d’une mesure = coût brut − retours fiscaux. C’est pour cela qu’un investissement de 20 Md€ ne creuse pas le déficit de 20 Md€ — et qu’une économie de 20 Md€ ne le réduit pas de 20 Md€.',
  },
  {
    title: 'Dette et intérêts',
    body:
      'La dette évolue avec le déficit, la croissance nominale (≈ 2,9 %/an, effet dénominateur) et la charge des intérêts sur la dette nouvelle (taux 3 %). Les déficits supplémentaires d’aujourd’hui augmentent les intérêts de demain — et réciproquement.',
  },
  {
    title: 'Montée en charge',
    body:
      'Les mesures ne produisent pas tout leur effet la première année : immédiates (100 % dès 2025), progressives (⅓, ⅔, plein régime), lentes (15 % → 100 % sur 5 ans, typique des réformes de structure comme les retraites).',
  },
  {
    title: 'Le climat social est une jauge de jeu',
    body:
      'Elle part de 50 et réagit mécaniquement à la sensibilité de chaque mesure (de −3 à +3, pondérée par le montant). Ce n’est ni un sondage ni une prédiction — c’est une contrainte ludique qui rappelle qu’un budget se fait avec un pays, pas seulement avec un tableur.',
  },
  {
    title: 'Ce que le modèle ignore',
    body:
      'Les effets de long terme (éducation, santé, climat), les comportements (offre de travail, optimisation), les réactions des marchés et de l’UE, la qualité d’exécution. Les chiffrages des mesures sont des ordres de grandeur sourcés, pas des évaluations officielles.',
  },
];
