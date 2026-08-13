/**
 * Aides au parseur déterministe (aucune IA).
 *
 *  - `keys`   : synonymes que le titre ne contient pas (le parseur extrait déjà
 *               automatiquement les mots du titre et de la description) ;
 *  - `anchor` : valeur actuelle permettant d'interpréter « à X » comme un écart.
 *               Ex. « la retraite à 67 ans » → 67 − 64 = +3 ans.
 *
 * Tout est vérifiable et modifiable à la main : c'est le prix de l'auditabilité.
 */

export interface NlpAnchor {
  /** valeur en vigueur aujourd'hui */
  value: number;
  /** unité telle qu'écrite par les gens (« ans », « % ») */
  unit: string;
  /** libellé affiché : « l'âge légal est aujourd'hui de 64 ans » */
  label: string;
  /** +1 : augmenter l'ancre augmente le paramètre ; −1 : l'inverse */
  direction: 1 | -1;
}

export interface NlpHint {
  keys?: string[];
  anchor?: NlpAnchor;
  /** expressions qui disqualifient la mesure (« justice sociale » ≠ budget de la justice) */
  avoid?: string[];
}

export const NLP_HINTS: Record<string, NlpHint> = {
  /* ——— mesures paramétrées : ancres de conversion ——— */
  retraite_age: {
    keys: ['age legal', 'age de depart', 'partir a la retraite', 'reculer la retraite', 'repousser la retraite', 'travailler plus longtemps', 'travaillent plus longtemps', 'travailler plus long', 'decalage age', 'reculer l age', 'repousser l age'],
    anchor: { value: 64, unit: 'ans', label: 'l’âge légal est aujourd’hui de 64 ans', direction: 1 },
  },
  retraite_age_baisse: {
    keys: ['retraite a 60 ans', 'retraite a 62 ans', 'revenir a 62', 'abroger la reforme des retraites', 'annuler la reforme des retraites', 'baisser age retraite'],
    anchor: { value: 64, unit: 'ans', label: 'l’âge légal est aujourd’hui de 64 ans', direction: -1 },
  },
  tva_normal: {
    keys: ['tva', 'taux normal', 'augmenter la tva', 'hausse tva'],
    anchor: { value: 20, unit: '%', label: 'le taux normal de TVA est de 20 %', direction: 1 },
  },
  tva_reduit: {
    keys: ['tva intermediaire', 'taux reduit', 'tva 10'],
    anchor: { value: 10, unit: '%', label: 'le taux intermédiaire de TVA est de 10 %', direction: 1 },
  },
  csg_hausse: { keys: ['csg', 'crds', 'contribution sociale generalisee'] },
  pfu_hausse: {
    keys: ['flat tax', 'pfu', 'prelevement forfaitaire', 'taxer les dividendes', 'dividendes'],
    anchor: { value: 30, unit: '%', label: 'la flat tax est aujourd’hui de 30 %', direction: 1 },
  },
  is_hausse: {
    keys: ['impot sur les societes', 'is', 'taxer les entreprises', 'benefices des entreprises'],
    anchor: { value: 25, unit: '%', label: 'le taux normal d’IS est de 25 %', direction: 1 },
  },
  cotisations_hausse: { keys: ['cotisations retraite', 'cotisations vieillesse', 'augmenter les cotisations'] },
  ir_baisse: {
    keys: ['baisser les impots', 'baisse impot revenu', 'tranche a 30', 'classes moyennes'],
    anchor: { value: 30, unit: '%', label: 'la deuxième tranche est à 30 %', direction: -1 },
  },
  point_indice: { keys: ['point d indice', 'salaire des fonctionnaires', 'augmenter les fonctionnaires', 'revaloriser les agents'] },
  invest_eco: { keys: ['plan climat', 'investir dans l ecologie', 'transition ecologique', 'plan de transition', 'investissement vert'] },

  /* ——— mesures à montant fixe : synonymes courants ——— */
  isf: { keys: ['isf', 'impot sur la fortune', 'taxer les riches', 'taxer les milliardaires', 'impot fortune'] },
  isf_climat: { keys: ['isf climatique', 'isf vert'] },
  ir_tranche: { keys: ['tranche a 50', 'nouvelle tranche', 'taxer les hauts revenus', 'progressivite'] },
  successions: { keys: ['heritage', 'droits de succession', 'transmission', 'donation'] },
  fraude: { keys: ['fraude fiscale', 'evasion fiscale', 'controle fiscal', 'paradis fiscaux'] },
  fraude_sociale: { keys: ['fraude sociale', 'travail dissimule', 'travail au noir'] },
  superprofits: { keys: ['superprofits', 'super profits', 'profits exceptionnels', 'rente energetique', 'totalenergies'] },
  gafa: { keys: ['gafa', 'taxe numerique', 'plateformes', 'amazon', 'google'] },
  taxe_rachats: { keys: ['rachats d actions', 'buyback'] },
  ttf: { keys: ['taxe sur les transactions', 'taxe financiere', 'ttf', 'speculation'] },
  taxe_carbone: { keys: ['taxe carbone', 'prix du carbone', 'fiscalite carbone'] },
  accises_sante: { keys: ['tabac', 'alcool', 'taxe sur le tabac'] },
  billets_avion: { keys: ['avion', 'aerien', 'taxe sur les vols', 'jets prives'] },
  poids_lourds: { keys: ['ecotaxe', 'camions', 'poids lourds'] },
  malus_auto: { keys: ['malus', 'suv', 'voitures polluantes'] },
  niches_menages: { keys: ['niches fiscales', 'plafonnement des niches'] },
  cir_rabot: { keys: ['credit impot recherche', 'cir'] },
  niches_vertes: { keys: ['niches brunes', 'gazole non routier', 'kerosene', 'niches fossiles'] },
  logements_vacants: { keys: ['logements vides', 'logement vacant'] },
  foncier_valeurs: { keys: ['taxe fonciere', 'valeurs locatives', 'cadastre'] },
  exit_tax: { keys: ['exil fiscal', 'depart a l etranger'] },

  tva_necessite: { keys: ['tva alimentaire', 'produits de premiere necessite', 'supprimer la tva', 'alimentaire', 'alimentation', 'nourriture', 'courses', 'produits de base'] },
  tva_energie: { keys: ['tva energie', 'tva electricite', 'facture d energie'] },
  ir_premiere_tranche: { keys: ['supprimer la premiere tranche', 'sortir de l impot'] },
  impots_prod: { keys: ['impots de production', 'competitivite', 'cfe'] },
  cvae_fin: { keys: ['cvae'] },
  baisse_cotis: { keys: ['baisser les charges', 'allegements de charges', 'charges patronales', 'cout du travail'] },
  heures_sup: { keys: ['heures supplementaires', 'heures sup'] },
  tva_travaux: { keys: ['tva travaux', 'tva renovation'] },
  credit_garde: { keys: ['garde d enfants', 'frais de garde', 'nounou'] },
  tva_restauration: { keys: ['restauration', 'restaurants'] },
  dutreil: { keys: ['pacte dutreil', 'transmission d entreprise'] },

  hopital: { keys: ['hopital', 'hopitaux', 'soignants', 'infirmieres', 'infirmiers', 'urgences', 'lits'] },
  dependance: { keys: ['ehpad', 'grand age', 'dependance', 'personnes agees', 'aide a domicile'] },
  deserts_medicaux: { keys: ['deserts medicaux', 'medecin traitant', 'medecins de campagne'] },
  sante_mentale: { keys: ['psychiatrie', 'sante mentale', 'psychologue'] },
  prevention: { keys: ['prevention', 'depistage', 'vaccination'] },
  medicaments: { keys: ['prix des medicaments', 'medicaments', 'pharmacie'] },
  ame: { keys: ['aide medicale d etat', 'ame', 'soins des sans papiers'] },
  franchises: { keys: ['franchises medicales', 'reste a charge', 'deremboursement'] },
  jours_carence: { keys: ['jours de carence', 'delai de carence', 'arret maladie carence'] },
  arrets_travail: { keys: ['arrets de travail', 'arrets maladie', 'indemnites journalieres'] },

  enseignants: { keys: ['professeurs', 'profs', 'enseignants', 'recruter des profs', 'postes d enseignants'] },
  revalo_profs: { keys: ['salaire des profs', 'payer les profs', 'revaloriser les enseignants'] },
  classes_dedoublees: { keys: ['effectifs par classe', 'dedoublement', 'classes surchargees', 'moins d eleves par classe'] },
  cantines: { keys: ['cantine', 'cantines scolaires', 'repas a 1 euro'] },
  universites: { keys: ['universite', 'fac', 'etudiants', 'enseignement superieur', 'bourses'] },
  recherche_3pct: { keys: ['recherche publique', 'cnrs', 'chercheurs', 'science'] },
  formation_pro: { keys: ['formation professionnelle', 'former les chomeurs', 'reconversion'] },
  apprentissage_plus: { keys: ['apprentissage', 'apprentis', 'alternance'] },
  apprentissage_rabot: { keys: ['prime apprentissage', 'aides a l apprentissage'] },

  renovation: { keys: ['renovation thermique', 'passoires thermiques', 'isolation', 'maprimerenov'] },
  ferroviaire: { keys: ['train', 'trains', 'sncf', 'petites lignes', 'fret ferroviaire', 'rail'] },
  rer_metropolitains: { keys: ['rer metropolitains', 'transports du quotidien'] },
  velo: { keys: ['velo', 'pistes cyclables', 'mobilites douces'] },
  nucleaire: { keys: ['nucleaire', 'epr', 'reacteurs', 'centrales'] },
  renouvelables: { keys: ['renouvelables', 'eolien', 'solaire', 'photovoltaique'] },
  biodiversite: { keys: ['biodiversite', 'nature', 'eau', 'pollution'] },
  adaptation: { keys: ['adaptation climatique', 'inondations', 'incendies', 'secheresse'] },

  justice: {
    keys: ['justice', 'tribunaux', 'magistrats', 'juges', 'greffiers'],
    avoid: ['justice sociale', 'justice fiscale', 'injustice'],
  },
  police: { keys: ['police', 'policiers', 'gendarmes', 'securite', 'commissariats'] },
  prisons: { keys: ['prisons', 'places de prison', 'penitentiaire', 'surpopulation carcerale'] },
  defense: { keys: ['armee', 'defense', 'militaires', 'rearmement', 'munitions'] },
  defense_baisse: { keys: ['baisser le budget militaire', 'reduire l armee', 'desarmement'] },
  cyber: { keys: ['cybersecurite', 'cyberattaques', 'cyberdefense'] },
  secours: { keys: ['pompiers', 'secours', 'securite civile', 'canadair'] },

  minima: { keys: ['rsa', 'minima sociaux', 'aah', 'minimum vieillesse', 'allocation adulte handicape'] },
  rsa_jeunes: { keys: ['rsa jeunes', 'revenu jeunes', 'garantie jeunes'] },
  creches: { keys: ['creches', 'places de creche', 'petite enfance', 'mode de garde'] },
  logement_social: { keys: ['logements sociaux', 'hlm', 'crise du logement', 'construire des logements'] },
  hebergement: { keys: ['sans abri', 'sdf', 'hebergement d urgence', 'mal logement'] },
  apl_hausse: { keys: ['apl', 'aides au logement', 'allocation logement'] },
  apl_baisse: { keys: ['baisser les apl', 'reduire les aides au logement'] },
  handicap: { keys: ['handicap', 'aesh', 'accessibilite', 'personnes handicapees'] },
  aide_alimentaire: { keys: ['aide alimentaire', 'banques alimentaires', 'restos du coeur', 'faim'] },
  allocations_familiales: { keys: ['allocations familiales', 'natalite', 'politique familiale'] },
  conge_parental: { keys: ['conge parental', 'conge paternite', 'conge maternite'] },
  chomage_regles: { keys: ['assurance chomage', 'durcir le chomage', 'reforme du chomage', 'indemnisation chomage'] },
  contrats_aides: { keys: ['contrats aides', 'emplois aides'] },
  prestations_gel: { keys: ['geler les prestations', 'desindexer les prestations'] },

  pensions_revalo: { keys: ['augmenter les retraites', 'revaloriser les pensions', 'pouvoir d achat des retraites'] },
  retraites_gel: { keys: ['geler les pensions', 'desindexer les retraites', 'sous indexer les pensions'] },
  minimum_retraite: { keys: ['minimum retraite', 'petites retraites', 'minimum contributif', '85 % du smic'] },
  penibilite: { keys: ['penibilite', 'carrieres longues', 'metiers penibles', 'usure professionnelle'] },
  regimes_speciaux: { keys: ['regimes speciaux'] },
  decote_surcote: { keys: ['decote', 'surcote', 'taux plein'] },

  fonctionnaires_nr: { keys: ['supprimer des postes de fonctionnaires', 'reduire la fonction publique', 'moins de fonctionnaires', 'non remplacement'] },
  temps_travail_fp: { keys: ['37 heures', 'temps de travail des fonctionnaires', 'travailler plus dans le public'] },
  primes_terrain: { keys: ['primes des agents', 'revaloriser les metiers'] },
  agences: { keys: ['agences de l etat', 'operateurs', 'comites theodule', 'supprimer des agences'] },
  train_vie: { keys: ['train de vie de l etat', 'depenses de l etat', 'gaspillage'] },
  conseil_prives: { keys: ['cabinets de conseil', 'mckinsey', 'consultants'] },
  gel_depenses: { keys: ['geler les depenses', 'norme de depense', 'rigueur', 'austerite'] },
  mille_feuille: { keys: ['millefeuille territorial', 'mille feuille', 'supprimer les departements', 'doublons administratifs'] },
  dotations_baisse: { keys: ['dotations aux collectivites', 'dgf', 'baisser les dotations'] },
  services_publics_ruraux: { keys: ['services publics de proximite', 'france services', 'ruralite', 'desertification'] },
  numerique_etat: { keys: ['numerique de l etat', 'informatique publique', 'souverainete numerique'] },

  aides_entreprises: { keys: ['aides aux entreprises', 'subventions aux entreprises', 'cadeaux aux entreprises'] },
  reindustrialisation: { keys: ['industrie', 'reindustrialisation', 'usines', 'relocalisation'] },
  agriculture_transition: { keys: ['agriculteurs', 'agriculture', 'paysans', 'ferme'] },
  outre_mer: { keys: ['outre mer', 'dom tom', 'mayotte', 'guyane', 'antilles', 'reunion'] },
  culture: { keys: ['culture', 'patrimoine', 'musees', 'spectacle vivant', 'intermittents'] },
  audiovisuel_plus: { keys: ['audiovisuel public', 'france televisions', 'radio france'] },
  audiovisuel_baisse: { keys: ['supprimer l audiovisuel public', 'privatiser france televisions'] },
  sport: { keys: ['sport', 'piscines', 'gymnases', 'clubs sportifs'] },
  aide_developpement: { keys: ['aide au developpement', 'apd', 'solidarite internationale', 'aide a l afrique'] },
  europe_contribution: { keys: ['contribution europeenne', 'budget de l ue', 'bruxelles'] },
  subventions_assos: { keys: ['subventions aux associations', 'associations'] },
};
