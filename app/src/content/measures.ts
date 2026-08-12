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
  | 'ecologie'
  | 'securite'
  | 'social'
  | 'retraites'
  | 'fonction_publique'
  | 'economie'
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
    title: 'Budget libre',
    pitch:
      'Pas d’objectif imposé : composez le budget qui reflète vos priorités, et observez ses effets mécaniques sur les grands indicateurs.',
    goals: [{ label: 'Aucun objectif — bac à sable', test: 'none', value: 0 }],
  },
];

/* ————— Catalogue ————— */

export const MEASURES: MeasureDef[] = [
  /* ——— Recettes en hausse ——— */
  {
    id: 'tva_normal',
    title: 'Relever le taux normal de TVA',
    desc: 'Le taux de 20 % (biens et services courants) augmente. Rendement fort, payé par tous les consommateurs.',
    category: 'fiscalite_menages',
    kind: 'recette_plus',
    amount: 8,
    param: { unit: 'pt', min: 0.5, max: 3, step: 0.5, default: 1, perUnit: 8 },
    lever: 'tax_conso',
    social: -2,
    phase: 'immediate',
    incidence: 'Tous les ménages, davantage les plus modestes (part de la consommation dans le revenu).',
    basis: '≈ 8 Md€ par point de taux normal (rendement TVA 2024 : 208 Md€).',
  },
  {
    id: 'isf',
    title: 'Rétablir un impôt sur la fortune',
    desc: 'Un impôt annuel sur les patrimoines nets supérieurs à 1,3 M€, sur le modèle d’avant 2018.',
    category: 'fiscalite_menages',
    kind: 'recette_plus',
    amount: 4.5,
    lever: 'tax_menages_aises',
    social: 1,
    phase: 'progressive',
    incidence: 'Environ 350 000 foyers les plus patrimoniaux.',
    basis: 'Rendement du dernier ISF (2017) : ≈ 4,2 Md€, actualisé.',
  },
  {
    id: 'is_hausse',
    title: 'Augmenter l’impôt sur les sociétés',
    desc: 'Le taux normal d’IS remonte au-dessus de 25 %.',
    category: 'fiscalite_entreprises',
    kind: 'recette_plus',
    amount: 3,
    param: { unit: 'pt', min: 1, max: 8, step: 1, default: 3, perUnit: 3 },
    lever: 'tax_entreprises',
    social: 0,
    phase: 'immediate',
    incidence: 'Les entreprises bénéficiaires, surtout les grandes.',
    basis: '≈ 3 Md€ par point (rendement IS 2024 : 84 Md€ au taux de 25 %, avec érosion d’assiette).',
  },
  {
    id: 'csg_hausse',
    title: 'Augmenter la CSG',
    desc: 'La contribution sociale généralisée, assise sur presque tous les revenus, augmente.',
    category: 'fiscalite_menages',
    kind: 'recette_plus',
    amount: 7,
    param: { unit: 'pt', min: 0.5, max: 2, step: 0.5, default: 0.5, perUnit: 14 },
    lever: 'tax_menages',
    social: -2,
    phase: 'immediate',
    incidence: 'Tous les revenus (salaires, retraites, capital), à assiette très large.',
    basis: '≈ 14 Md€ par point de CSG (toutes assiettes).',
  },
  {
    id: 'ir_tranche',
    title: 'Créer une tranche d’IR à 50 %',
    desc: 'Une tranche supplémentaire d’impôt sur le revenu au-delà de 250 000 € par part.',
    category: 'fiscalite_menages',
    kind: 'recette_plus',
    amount: 2,
    lever: 'tax_menages_aises',
    social: 1,
    phase: 'immediate',
    incidence: 'Les 0,2 % de foyers aux revenus les plus élevés.',
    basis: 'Chiffrages parlementaires de mesures similaires : 1,5 à 2,5 Md€.',
  },
  {
    id: 'ttf',
    title: 'Élargir la taxe sur les transactions financières',
    desc: 'Taux relevé et assiette étendue aux transactions intrajournalières.',
    category: 'fiscalite_entreprises',
    kind: 'recette_plus',
    amount: 2,
    lever: 'tax_menages_aises',
    social: 1,
    phase: 'progressive',
    incidence: 'Acteurs de marché ; incidence finale partagée avec les épargnants.',
    basis: 'TTF actuelle ≈ 2 Md€ ; doublement estimé par plusieurs rapports parlementaires.',
  },
  {
    id: 'cir_rabot',
    title: 'Raboter le crédit d’impôt recherche',
    desc: 'Le CIR est recentré sur les PME et plafonné pour les grands groupes.',
    category: 'fiscalite_entreprises',
    kind: 'recette_plus',
    amount: 2,
    lever: 'tax_entreprises',
    social: 0,
    phase: 'progressive',
    incidence: 'Grandes entreprises utilisatrices du CIR (coût actuel ≈ 7 Md€/an).',
    basis: 'Rapports Cour des comptes / CNEPI : 1,5 à 2,5 Md€ récupérables.',
  },
  {
    id: 'taxe_carbone',
    title: 'Reprendre la trajectoire carbone',
    desc: 'La taxe carbone, gelée depuis 2018, reprend sa hausse (+15 €/tonne), avec le rendement affecté au budget.',
    category: 'ecologie',
    kind: 'recette_plus',
    amount: 4,
    lever: 'tax_conso',
    social: -3,
    phase: 'progressive',
    incidence: 'Ménages et entreprises consommateurs d’énergies fossiles, davantage en zone rurale.',
    basis: '≈ 4 Md€ pour +15 €/t (rendement TICPE et assiette carbone).',
  },
  {
    id: 'successions',
    title: 'Durcir les droits de succession élevés',
    desc: 'Abattements réduits et taux relevés sur les transmissions supérieures à 1 M€ par héritier.',
    category: 'fiscalite_menages',
    kind: 'recette_plus',
    amount: 3,
    lever: 'tax_menages_aises',
    social: -1,
    phase: 'progressive',
    incidence: 'Les 10 % de successions les plus importantes.',
    basis: 'Conseil d’analyse économique (2021) : 2 à 4 Md€ selon barème.',
  },
  {
    id: 'fraude',
    title: 'Renforcer la lutte contre la fraude fiscale',
    desc: 'Effectifs de contrôle doublés, données croisées, obligations déclaratives durcies.',
    category: 'fonctionnement_etat',
    kind: 'recette_plus',
    amount: 3,
    lever: 'tax_menages_aises',
    social: 3,
    phase: 'slow',
    incidence: 'Fraudeurs ; coût de mise en œuvre déjà déduit.',
    basis: 'Rendement supplémentaire réaliste estimé par la Cour des comptes : 2 à 4 Md€/an.',
  },

  /* ——— Recettes en baisse ——— */
  {
    id: 'tva_necessite',
    title: 'TVA à 0 % sur les produits de première nécessité',
    desc: 'Alimentaire de base, hygiène : le taux de 5,5 % tombe à zéro.',
    category: 'fiscalite_menages',
    kind: 'recette_moins',
    amount: 4,
    lever: 'tax_conso',
    social: 2,
    phase: 'immediate',
    incidence: 'Tous les ménages, gain relatif plus fort pour les plus modestes.',
    basis: 'Assiette du taux réduit alimentaire : ≈ 4 Md€ pour la suppression des 5,5 %.',
  },
  {
    id: 'ir_baisse',
    title: 'Baisser l’impôt sur le revenu des classes moyennes',
    desc: 'Le taux de la tranche à 30 % diminue.',
    category: 'fiscalite_menages',
    kind: 'recette_moins',
    amount: 5,
    param: { unit: 'pt', min: 1, max: 4, step: 1, default: 2, perUnit: 2.5 },
    lever: 'tax_menages',
    social: 2,
    phase: 'immediate',
    incidence: '≈ 7 millions de foyers imposés dans la tranche à 30 %.',
    basis: '≈ 2,5 Md€ par point de la 2e tranche (DGFiP, simulations parlementaires).',
  },
  {
    id: 'impots_prod',
    title: 'Baisser les impôts de production',
    desc: 'CFE et taxes assises sur l’activité des entreprises réduites.',
    category: 'fiscalite_entreprises',
    kind: 'recette_moins',
    amount: 5,
    lever: 'tax_entreprises',
    social: 0,
    phase: 'progressive',
    incidence: 'Entreprises industrielles surtout ; compensation à prévoir pour les collectivités.',
    basis: 'Sur le modèle des baisses 2021-2023 (CVAE) : 4 à 6 Md€.',
  },
  {
    id: 'heures_sup',
    title: 'Défiscaliser davantage les heures supplémentaires',
    desc: 'Plafond d’exonération relevé, cotisations réduites.',
    category: 'economie',
    kind: 'recette_moins',
    amount: 2,
    lever: 'cotisations',
    social: 1,
    phase: 'immediate',
    incidence: 'Salariés effectuant des heures supplémentaires ; coût pour la Sécurité sociale.',
    basis: 'Extension du dispositif actuel (≈ 2 Md€).',
  },

  /* ——— Dépenses en hausse ——— */
  {
    id: 'hopital',
    title: 'Plan hôpital : 15 000 soignants',
    desc: 'Recrutements et revalorisations dans les hôpitaux publics.',
    category: 'sante',
    kind: 'depense_plus',
    amount: 2.5,
    lever: 'fonctionnement',
    directJobs: 15000,
    social: 3,
    phase: 'progressive',
    incidence: 'Patients et personnels hospitaliers ; financé par l’assurance maladie.',
    basis: '≈ 60 k€ de coût complet par poste + enveloppe de revalorisation.',
  },
  {
    id: 'enseignants',
    title: 'Recruter 20 000 enseignants',
    desc: 'Postes supplémentaires, ciblés sur le primaire et l’éducation prioritaire.',
    category: 'education',
    kind: 'depense_plus',
    amount: 1.3,
    lever: 'fonctionnement',
    directJobs: 20000,
    social: 2,
    phase: 'progressive',
    incidence: 'Élèves et enseignants ; effets de long terme non modélisés ici.',
    basis: '≈ 65 k€ de coût complet moyen par poste.',
  },
  {
    id: 'point_indice',
    title: 'Revaloriser le point d’indice',
    desc: 'Le salaire de base des 5,7 millions d’agents publics augmente.',
    category: 'fonction_publique',
    kind: 'depense_plus',
    amount: 10,
    param: { unit: '%', min: 1, max: 5, step: 1, default: 3, perUnit: 3.3 },
    lever: 'fonctionnement',
    social: 2,
    phase: 'immediate',
    incidence: 'Tous les agents publics ; coût partagé État, hôpitaux, collectivités.',
    basis: '≈ 3,3 Md€ par point de % (masse salariale publique ≈ 330 Md€).',
  },
  {
    id: 'invest_eco',
    title: 'Grand plan d’investissement climat',
    desc: 'Rénovation thermique, transports collectifs, énergies décarbonées : de l’investissement public supplémentaire chaque année.',
    category: 'ecologie',
    kind: 'depense_plus',
    amount: 20,
    param: { unit: 'Md€', min: 5, max: 40, step: 5, default: 20, perUnit: 1 },
    lever: 'invest_public',
    social: 1,
    phase: 'progressive',
    incidence: 'BTP, industrie, ménages aidés ; c’est le levier au multiplicateur le plus fort.',
    basis: 'Rapport Pisani-Ferry–Mahfouz (2023) : besoin public ≈ 25-35 Md€/an d’ici 2030.',
  },
  {
    id: 'minima',
    title: 'Revaloriser les minima sociaux de 10 %',
    desc: 'RSA, ASS, minimum vieillesse et AAH augmentent.',
    category: 'social',
    kind: 'depense_plus',
    amount: 3,
    lever: 'social_cible',
    social: 2,
    phase: 'immediate',
    incidence: '≈ 4 millions de foyers modestes ; consommation quasi intégrale du gain.',
    basis: 'Masse des minima ≈ 30 Md€/an.',
  },
  {
    id: 'justice',
    title: 'Doubler le budget de la justice en 5 ans',
    desc: 'Magistrats, greffiers, places de prison, numérique judiciaire.',
    category: 'securite',
    kind: 'depense_plus',
    amount: 4,
    lever: 'fonctionnement',
    directJobs: 12000,
    social: 2,
    phase: 'slow',
    incidence: 'Justiciables ; budget actuel ≈ 10 Md€ (hors pensions), parmi les plus bas d’Europe par habitant.',
    basis: 'Trajectoire de doublement lissée : ≈ +4 Md€/an en 2029.',
  },
  {
    id: 'defense',
    title: 'Porter la défense vers 2,5 % du PIB',
    desc: 'Accélération de la loi de programmation militaire.',
    category: 'securite',
    kind: 'depense_plus',
    amount: 15,
    lever: 'invest_public',
    social: 0,
    phase: 'slow',
    incidence: 'Industrie de défense, armées ; défense 2024 ≈ 1,9 % du PIB.',
    basis: '+0,5 point de PIB ≈ 15 Md€/an à terme.',
  },
  {
    id: 'universites',
    title: 'Investir dans l’université et la recherche',
    desc: 'Postes, laboratoires, vie étudiante : +5 Md€ par an.',
    category: 'education',
    kind: 'depense_plus',
    amount: 5,
    lever: 'invest_public',
    directJobs: 15000,
    social: 2,
    phase: 'progressive',
    incidence: 'Étudiants et chercheurs ; la France sous-investit vs OCDE (rapports CSR).',
    basis: 'Ordre de grandeur des lois de programmation recherche renforcées.',
  },
  {
    id: 'creches',
    title: 'Service public de la petite enfance',
    desc: '200 000 places d’accueil créées en 5 ans.',
    category: 'social',
    kind: 'depense_plus',
    amount: 4,
    lever: 'fonctionnement',
    directJobs: 40000,
    social: 2,
    phase: 'slow',
    incidence: 'Jeunes parents ; effet favorable sur l’emploi des mères (non modélisé).',
    basis: '≈ 20 k€ de coût complet annuel par place.',
  },
  {
    id: 'police',
    title: 'Recruter 10 000 policiers et gendarmes',
    desc: 'Effectifs supplémentaires sur la voie publique et l’investigation.',
    category: 'securite',
    kind: 'depense_plus',
    amount: 0.7,
    lever: 'fonctionnement',
    directJobs: 10000,
    social: 1,
    phase: 'progressive',
    incidence: 'Sécurité du quotidien ; ≈ 70 k€ de coût complet par poste équipé.',
    basis: 'Chiffrage des plans de recrutement 2017-2027.',
  },
  {
    id: 'dependance',
    title: 'Grand âge : renforcer la branche autonomie',
    desc: 'Personnels en EHPAD et aide à domicile revalorisée.',
    category: 'sante',
    kind: 'depense_plus',
    amount: 5,
    lever: 'fonctionnement',
    directJobs: 50000,
    social: 3,
    phase: 'progressive',
    incidence: 'Personnes âgées dépendantes et leurs familles.',
    basis: 'Rapports Libault / El Khomri : besoin ≈ 5 Md€/an d’ici 2030.',
  },
  {
    id: 'culture',
    title: 'Doubler le pass Culture et le patrimoine',
    desc: 'Soutien à la création, restauration du patrimoine.',
    category: 'social',
    kind: 'depense_plus',
    amount: 1,
    lever: 'fonctionnement',
    social: 1,
    phase: 'immediate',
    incidence: 'Secteur culturel ; budget culture ≈ 4 Md€.',
    basis: 'Ordre de grandeur du budget actuel de la mission Culture.',
  },

  /* ——— Dépenses en baisse ——— */
  {
    id: 'retraite_age',
    title: 'Reporter l’âge légal de départ en retraite',
    desc: 'L’âge légal recule au-delà de 64 ans.',
    category: 'retraites',
    kind: 'depense_moins',
    amount: 10,
    param: { unit: 'an', min: 1, max: 2, step: 1, default: 1, perUnit: 10 },
    lever: 'social_cible',
    social: -3,
    phase: 'slow',
    incidence: 'Salariés proches de la retraite, surtout carrières longues et métiers pénibles.',
    basis: '≈ 10 Md€/an d’économies par année d’âge à horizon 5 ans (COR, études 2023).',
  },
  {
    id: 'retraites_gel',
    title: 'Sous-indexer les pensions un an',
    desc: 'Les pensions augmentent 1 point de moins que l’inflation, une année.',
    category: 'retraites',
    kind: 'depense_moins',
    amount: 4,
    lever: 'social_cible',
    social: -3,
    phase: 'immediate',
    incidence: '17 millions de retraités ; économie pérenne (effet base).',
    basis: 'Masse des pensions ≈ 400 Md€ : 1 point d’indexation ≈ 4 Md€.',
  },
  {
    id: 'fonctionnaires_nr',
    title: 'Ne pas remplacer 1 départ sur 3 (hors santé-éducation)',
    desc: 'Les effectifs administratifs diminuent au fil des départs en retraite.',
    category: 'fonction_publique',
    kind: 'depense_moins',
    amount: 4,
    lever: 'fonctionnement',
    directJobs: -60000,
    social: -2,
    phase: 'slow',
    incidence: 'Services administratifs de l’État et opérateurs.',
    basis: '≈ 60 000 postes en 5 ans × 65 k€ ; montée en charge lente.',
  },
  {
    id: 'agences',
    title: 'Fusionner agences et comités',
    desc: 'Rationalisation des opérateurs de l’État aux missions redondantes.',
    category: 'fonctionnement_etat',
    kind: 'depense_moins',
    amount: 2,
    lever: 'fonctionnement',
    social: 0,
    phase: 'progressive',
    incidence: 'Opérateurs publics (≈ 80 Md€ de budgets cumulés).',
    basis: 'Rapports IGF sur les agences : 1,5 à 3 Md€ mobilisables.',
  },
  {
    id: 'aides_entreprises',
    title: 'Raboter les aides aux entreprises de 10 %',
    desc: 'Niches, subventions et exonérations les moins évaluées sont réduites.',
    category: 'economie',
    kind: 'depense_moins',
    amount: 6,
    lever: 'tax_entreprises',
    social: 0,
    phase: 'progressive',
    incidence: 'Entreprises bénéficiaires d’aides (masse totale estimée 60-110 Md€ selon périmètre).',
    basis: 'Rapports France Stratégie / CLERSÉ sur les aides aux entreprises.',
  },
  {
    id: 'chomage_regles',
    title: 'Durcir l’assurance chômage',
    desc: 'Durée d’indemnisation réduite quand la conjoncture est bonne.',
    category: 'social',
    kind: 'depense_moins',
    amount: 4,
    lever: 'social_cible',
    social: -2,
    phase: 'progressive',
    incidence: 'Demandeurs d’emploi indemnisés ; effets d’activation débattus, non modélisés.',
    basis: 'Chiffrages Unédic des réformes 2023-2025.',
  },
  {
    id: 'train_vie',
    title: 'Réduire le train de vie de l’État',
    desc: 'Immobilier, parc automobile, communication, frais de représentation.',
    category: 'fonctionnement_etat',
    kind: 'depense_moins',
    amount: 1,
    lever: 'fonctionnement',
    social: 2,
    phase: 'immediate',
    incidence: 'Administrations centrales.',
    basis: 'Revues de dépenses successives : ≈ 1 Md€ réaliste.',
  },
  {
    id: 'medicaments',
    title: 'Négocier plus dur le prix des médicaments',
    desc: 'Référencement européen et génériques imposés.',
    category: 'sante',
    kind: 'depense_moins',
    amount: 2,
    lever: 'fonctionnement',
    social: 0,
    phase: 'progressive',
    incidence: 'Industrie pharmaceutique ; dépense de médicaments ≈ 34 Md€.',
    basis: 'Économies CEPS renforcées : 1,5 à 2,5 Md€.',
  },
  {
    id: 'niches_vertes',
    title: 'Supprimer les niches fiscales brunes',
    desc: 'Avantages fiscaux sur le gazole non routier et exonérations kérosène domestiques.',
    category: 'ecologie',
    kind: 'depense_moins',
    amount: 3,
    lever: 'tax_conso',
    social: -2,
    phase: 'progressive',
    incidence: 'BTP, agriculture, transport aérien intérieur.',
    basis: 'Inventaire I4CE des dépenses fiscales défavorables au climat (≈ 3 Md€ ciblables).',
  },
];

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
  ecologie: 'Écologie',
  securite: 'Sécurité & justice',
  social: 'Solidarités',
  retraites: 'Retraites',
  fonction_publique: 'Fonction publique',
  economie: 'Économie & emploi',
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
