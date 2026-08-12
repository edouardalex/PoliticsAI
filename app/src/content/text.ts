/**
 * Contenu éditorial — descriptions pédagogiques.
 * Règle (constitution de neutralité) : décrire, jamais qualifier.
 * Aucun chiffre en dur ici : les montants viennent toujours des données.
 */

export interface FunctionInfo {
  short: string;
  description: string;
  examples: string;
}

export const FUNCTION_INFO: Record<string, FunctionInfo> = {
  GF10: {
    short: 'Protection sociale',
    description:
      'Le premier poste de dépense publique. Il couvre les pensions de retraite, les allocations familiales, l’indemnisation du chômage, les minima sociaux et les aides au logement. L’essentiel est versé par la Sécurité sociale et les régimes de retraite.',
    examples: 'Retraites, allocations familiales, chômage, RSA, APL…',
  },
  GF07: {
    short: 'Santé',
    description:
      'Les dépenses de soins remboursées par l’assurance maladie : hôpitaux, médecine de ville, médicaments et dispositifs médicaux, ainsi que la prévention et la recherche médicale publique.',
    examples: 'Hôpitaux, consultations, médicaments, prévention…',
  },
  GF01: {
    short: 'Services publics généraux',
    description:
      'Le fonctionnement général des institutions : Parlement, Élysée, ministères transversaux, corps diplomatique, recherche fondamentale — mais aussi les intérêts payés sur la dette publique et les transferts généraux entre administrations.',
    examples: 'Institutions, diplomatie, recherche fondamentale, intérêts de la dette…',
  },
  GF04: {
    short: 'Affaires économiques',
    description:
      'Le soutien public à l’économie : subventions et aides aux entreprises, infrastructures de transport (routes, rail), agriculture, énergie, industrie et emploi.',
    examples: 'Transports, aides aux entreprises, agriculture, énergie…',
  },
  GF09: {
    short: 'Enseignement',
    description:
      'De la maternelle à l’université : salaires des enseignants, fonctionnement des établissements, enseignement supérieur, formation continue et vie scolaire.',
    examples: 'Écoles, collèges, lycées, universités, cantines…',
  },
  GF02: {
    short: 'Défense',
    description:
      'Les armées et leur équipement : personnels militaires, matériels, opérations extérieures, dissuasion, et la recherche militaire.',
    examples: 'Armées, équipements militaires, opérations extérieures…',
  },
  GF03: {
    short: 'Ordre et sécurité',
    description:
      'La sécurité intérieure et la justice : police et gendarmerie, tribunaux, administration pénitentiaire et services d’incendie et de secours.',
    examples: 'Police, gendarmerie, justice, prisons, pompiers…',
  },
  GF08: {
    short: 'Loisirs, culture et culte',
    description:
      'Le sport, la culture et l’audiovisuel public : équipements sportifs, musées, bibliothèques, spectacle vivant, patrimoine, France Télévisions et Radio France.',
    examples: 'Sport, musées, bibliothèques, audiovisuel public…',
  },
  GF06: {
    short: 'Logement et équipements',
    description:
      'Le développement urbain et les services collectifs de proximité : aménagement, adduction d’eau, éclairage public et politique du logement (hors aides personnelles, comptées en protection sociale).',
    examples: 'Urbanisme, eau potable, éclairage public…',
  },
  GF05: {
    short: 'Environnement',
    description:
      'La protection de l’environnement : collecte et traitement des déchets, assainissement des eaux usées, lutte contre la pollution et protection de la biodiversité.',
    examples: 'Déchets, eaux usées, biodiversité, lutte contre la pollution…',
  },
};

export interface RevenueInfo {
  short: string;
  description: string;
}

export const REVENUE_INFO: Record<string, RevenueInfo> = {
  D61: {
    short: 'Cotisations sociales',
    description:
      'Prélevées sur les salaires (parts employeur et salarié) et les revenus des indépendants, elles financent principalement les retraites, l’assurance maladie et les prestations familiales.',
  },
  D51A: {
    short: 'Impôts sur le revenu',
    description:
      'Les impôts payés par les ménages sur leurs revenus : impôt sur le revenu (IR), mais aussi CSG et CRDS, qui financent la protection sociale.',
  },
  D211: {
    short: 'TVA',
    description:
      'La taxe sur la valeur ajoutée, payée sur la quasi-totalité des achats. Première recette fiscale de France, elle est aujourd’hui partagée entre l’État, la Sécurité sociale et les collectivités.',
  },
  D21X: {
    short: 'Accises (TICPE, tabac…)',
    description:
      'Les taxes sur des produits spécifiques : carburants (TICPE), tabac, alcool, assurances, transactions immobilières…',
  },
  D29: {
    short: 'Impôts sur la production',
    description:
      'Payés par les entreprises indépendamment de leurs bénéfices : taxe foncière des entreprises, cotisation foncière (CFE), versement mobilité…',
  },
  D51B: {
    short: 'Impôt sur les sociétés',
    description: 'L’impôt payé par les entreprises sur leurs bénéfices.',
  },
  D5X_D91: {
    short: 'Patrimoine et successions',
    description:
      'Les impôts sur la détention et la transmission du patrimoine des ménages : taxe foncière, impôt sur la fortune immobilière, droits de succession et de donation.',
  },
  SALES: {
    short: 'Ventes et redevances',
    description:
      'Ce que les administrations facturent directement : cantines scolaires, entrées des musées, redevances, péages, prestations diverses.',
  },
  D73: {
    short: 'Transferts entre administrations',
    description:
      'Les dotations et transferts reçus d’autres administrations publiques — par exemple les dotations de l’État aux collectivités locales. Ces flux internes disparaissent dans le total consolidé.',
  },
  OTHER: {
    short: 'Autres recettes',
    description:
      'Revenus du patrimoine public (dividendes, loyers, intérêts), fonds européens, dons et transferts divers.',
  },
};

export const DEFICIT_INFO = {
  short: 'Déficit public',
  description:
    'Les recettes ne couvrent pas la totalité des dépenses : la différence est empruntée sur les marchés financiers et s’ajoute à la dette publique. Les intérêts payés chaque année sur cette dette figurent côté dépenses, dans « Services publics généraux ».',
};

export const SURPLUS_INFO = {
  short: 'Excédent',
  description:
    'Les recettes dépassent les dépenses : l’excédent réduit le besoin d’emprunt.',
};

export const SPINE_INFO = {
  short: 'Administrations publiques',
  description:
    'Le point de passage de tout l’argent public. À gauche, d’où il vient ; à droite, où il va. Les recettes étant fongibles, aucun impôt n’est affecté à une dépense précise : c’est l’ensemble des recettes qui finance l’ensemble des dépenses.',
};

export interface PerimeterInfo {
  short: string;
  tag: string;
  note: string;
}

export const PERIMETER_INFO: Record<string, PerimeterInfo> = {
  S13: {
    short: 'Toutes administrations',
    tag: 'Consolidé',
    note: 'État + Sécurité sociale + collectivités, flux internes neutralisés : chaque euro n’est compté qu’une fois.',
  },
  S1311: {
    short: 'État',
    tag: 'Non consolidé',
    note: 'L’État et ses organismes (universités, opérateurs…). Comprend les transferts versés aux autres administrations — dotations aux collectivités notamment.',
  },
  S1314: {
    short: 'Sécurité sociale',
    tag: 'Non consolidé',
    note: 'Régimes d’assurance maladie, retraite, famille, chômage. Premier budget public de France.',
  },
  S1313: {
    short: 'Collectivités',
    tag: 'Non consolidé',
    note: 'Communes, départements, régions et leurs groupements. Une partie de leurs recettes vient de dotations de l’État.',
  },
};

export const BRAND = {
  name: 'PoliticsAI',
  beta: 'bêta',
  tagline: 'Le budget public, enfin lisible.',
};
