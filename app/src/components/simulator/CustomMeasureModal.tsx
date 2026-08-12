import { useMemo, useState } from 'react';
import { CUSTOM_DOMAINS, MODEL, type LeverType } from '../../content/measures';
import type { CustomMeasureInput, PhaseId } from '../../lib/simulation';

interface Props {
  open: boolean;
  /** bac à sable : l'atelier avancé est ouvert par défaut */
  sandbox?: boolean;
  onClose: () => void;
  onSubmit: (input: CustomMeasureInput) => void;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

const LEVER_LABELS: Record<LeverType, string> = {
  invest_public: 'Investissement public',
  social_cible: 'Prestations ciblées',
  fonctionnement: 'Fonctionnement, salaires publics',
  tax_conso: 'Taxes sur la consommation',
  tax_menages: 'Impôts des ménages',
  tax_menages_aises: 'Impôts hauts revenus / patrimoine',
  tax_entreprises: 'Impôts des entreprises',
  cotisations: 'Cotisations sociales',
};

const PHASE_LABELS: Record<PhaseId, string> = {
  immediate: 'Immédiate (100 % dès 2025)',
  progressive: 'Progressive (⅓, ⅔, plein régime)',
  slow: 'Lente (réforme de structure, 5 ans)',
};

const SOCIAL_LABELS: Record<string, string> = {
  '-3': 'très conflictuelle',
  '-2': 'conflictuelle',
  '-1': 'plutôt mal reçue',
  '0': 'neutre',
  '1': 'plutôt bien reçue',
  '2': 'populaire',
  '3': 'consensuelle',
};

export default function CustomMeasureModal({ open, sandbox = false, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState(CUSTOM_DOMAINS[0].id);
  const [direction, setDirection] = useState<'plus' | 'moins'>('plus');
  const [amount, setAmount] = useState(5);
  const [advanced, setAdvanced] = useState(sandbox);
  const [lever, setLever] = useState<LeverType | null>(null);
  const [phase, setPhase] = useState<PhaseId>('progressive');
  const [social, setSocial] = useState<number | null>(null);
  const [jobs, setJobs] = useState(0);

  const domain = CUSTOM_DOMAINS.find((d) => d.id === domainId)!;
  const isSpending = domain.side === 'depense';
  const effectiveLever = lever ?? domain.lever;
  const mult = MODEL.multipliers[effectiveLever];

  /** aperçu au premier ordre, plein régime, scénario central */
  const preview = useMemo(() => {
    const improvesBalance = (isSpending && direction === 'moins') || (!isSpending && direction === 'plus');
    const supportsDemand = !improvesBalance;
    const gdpMd = (supportsDemand ? 1 : -1) * amount * mult;
    const gdpPct = (gdpMd / 2935) * 100; // PIB 2024 ≈ 2 935 Md€
    const retours = MODEL.poRate * gdpMd;
    const soldeNet = (improvesBalance ? amount : -amount) + retours;
    const unemp = -MODEL.okun * gdpPct - (jobs / MODEL.activePopulation) * 100;
    return { improvesBalance, soldeNet, gdpPct, unemp };
  }, [isSpending, direction, amount, mult, jobs]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title,
      domainId,
      direction,
      amountMd: amount,
      ...(advanced
        ? {
            lever: effectiveLever,
            phase,
            ...(social != null ? { social } : {}),
            ...(jobs !== 0 ? { directJobs: jobs } : {}),
          }
        : {}),
    });
    setTitle('');
    setAmount(5);
    setJobs(0);
    setSocial(null);
    setLever(null);
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="custom-box" role="dialog" aria-label="Inventer une mesure" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <h2>{sandbox ? 'L’atelier de mesures' : 'Inventer une mesure'}</h2>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="cm-intro">
          Donnez-lui un nom, un domaine et un montant : le moteur lui applique <strong>les mêmes
          règles</strong> qu'aux mesures du catalogue. C'est vous qui chiffrez — le simulateur
          n'invente aucun chiffre.
        </p>

        <label className="cm-label" htmlFor="cm-title">
          Le nom de votre mesure
        </label>
        <input
          id="cm-title"
          className="cat-search"
          maxLength={70}
          placeholder="Ex. : Repas à 1 € pour tous les étudiants"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <label className="cm-label">Le domaine</label>
        <div className="cm-domains">
          {CUSTOM_DOMAINS.map((d) => (
            <button
              key={d.id}
              className={`chip small${domainId === d.id ? ' active' : ''}`}
              aria-pressed={domainId === d.id}
              onClick={() => setDomainId(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <label className="cm-label">Le sens</label>
        <div className="mode-switch cm-dir" role="radiogroup">
          <button
            role="radio"
            aria-checked={direction === 'plus'}
            className={`ms${direction === 'plus' ? ' active' : ''}`}
            onClick={() => setDirection('plus')}
          >
            {isSpending ? 'Dépenser plus' : 'Prélever plus'}
          </button>
          <button
            role="radio"
            aria-checked={direction === 'moins'}
            className={`ms${direction === 'moins' ? ' active' : ''}`}
            onClick={() => setDirection('moins')}
          >
            {isSpending ? 'Dépenser moins' : 'Prélever moins'}
          </button>
        </div>

        <label className="cm-label" htmlFor="cm-amount">
          Le montant : <strong>{nf.format(amount)} Md€/an</strong>
        </label>
        <input
          id="cm-amount"
          type="range"
          min={0.5}
          max={50}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />

        <button className="cm-toggle" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
          {advanced ? '▾' : '▸'} Réglages avancés
          <span className="cm-toggle-hint">levier, montée en charge, réception, emplois</span>
        </button>

        {advanced && (
          <div className="cm-advanced">
            <label className="cm-label" htmlFor="cm-lever">
              Levier économique <span className="cm-note-inline">détermine le multiplicateur</span>
            </label>
            <select
              id="cm-lever"
              className="cm-select"
              value={effectiveLever}
              onChange={(e) => setLever(e.target.value as LeverType)}
            >
              {(Object.keys(LEVER_LABELS) as LeverType[]).map((l) => (
                <option key={l} value={l}>
                  {LEVER_LABELS[l]} — multiplicateur {nf.format(MODEL.multipliers[l])}
                </option>
              ))}
            </select>

            <label className="cm-label" htmlFor="cm-phase">
              Montée en charge
            </label>
            <select
              id="cm-phase"
              className="cm-select"
              value={phase}
              onChange={(e) => setPhase(e.target.value as PhaseId)}
            >
              {(Object.keys(PHASE_LABELS) as PhaseId[]).map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>

            <label className="cm-label" htmlFor="cm-social">
              Réception sociale :{' '}
              <strong>{SOCIAL_LABELS[String(social ?? 0)] ?? 'neutre'}</strong>{' '}
              <span className="cm-note-inline">jauge de jeu</span>
            </label>
            <input
              id="cm-social"
              type="range"
              min={-3}
              max={3}
              step={1}
              value={social ?? 0}
              onChange={(e) => setSocial(Number(e.target.value))}
            />

            <label className="cm-label" htmlFor="cm-jobs">
              Emplois publics directs :{' '}
              <strong>
                {jobs === 0 ? 'aucun' : `${jobs > 0 ? '+' : '−'}${nf0.format(Math.abs(jobs))}`}
              </strong>
            </label>
            <input
              id="cm-jobs"
              type="range"
              min={-100000}
              max={100000}
              step={5000}
              value={jobs}
              onChange={(e) => setJobs(Number(e.target.value))}
            />
          </div>
        )}

        <div className="cm-preview">
          <div className="cmp-row">
            <span>Effet sur le solde public</span>
            <strong className={preview.soldeNet >= 0 ? 'gain' : 'cost'}>
              {preview.soldeNet >= 0 ? '+' : '−'}
              {nf.format(Math.abs(preview.soldeNet))} Md€/an
            </strong>
          </div>
          <div className="cmp-row">
            <span>Effet sur l’activité (PIB)</span>
            <strong className={preview.gdpPct >= 0 ? 'gain' : 'cost'}>
              {preview.gdpPct >= 0 ? '+' : '−'}
              {nf.format(Math.abs(preview.gdpPct * 10) / 10)} %
            </strong>
          </div>
          <div className="cmp-row">
            <span>Effet sur le chômage</span>
            <strong className={preview.unemp <= 0 ? 'gain' : 'cost'}>
              {preview.unemp >= 0 ? '+' : '−'}
              {nf.format(Math.abs(preview.unemp))} pt
            </strong>
          </div>
          <p className="cmp-note">
            Aperçu à plein régime, scénario central, hors charge d’intérêts — le tableau de bord
            fait le calcul complet une fois la mesure ajoutée.
          </p>
        </div>

        <div className="cm-actions">
          <button className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" onClick={submit} disabled={!title.trim()}>
            Ajouter au projet de loi
          </button>
        </div>
      </div>
    </div>
  );
}
