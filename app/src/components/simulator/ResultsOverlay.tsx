import { useState } from 'react';
import type { Mission } from '../../content/measures';
import type { ActiveMeasure, SimResult, GoalResult } from '../../lib/simulation';
import { downloadBudgetCard } from '../../lib/budgetCard';

interface Props {
  mission: Mission;
  result: SimResult;
  evaluation: { goals: GoalResult[]; stars: number; sandbox: boolean };
  measures: ActiveMeasure[];
  scenarioLabel: string;
  onClose: () => void;
  onReset: () => void;
  onToast: (msg: string) => void;
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export default function ResultsOverlay({
  mission,
  result,
  evaluation,
  measures,
  scenarioLabel,
  onClose,
  onReset,
  onToast,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const f = result.final;
  const fb = result.finalBaseline;
  const b0 = result.baseline[0];
  const allMet = evaluation.goals.length > 0 && evaluation.goals.every((g) => g.met);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onToast('Lien copié — votre budget est partageable');
    } catch {
      onToast(window.location.href);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadBudgetCard({
        mission,
        result,
        stars: evaluation.stars,
        sandbox: evaluation.sandbox,
        measures,
        scenarioLabel,
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="results-box" role="dialog" aria-label="Votre budget présenté" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <div>
            <p className="rb-overline">Mission « {mission.title} »</p>
            <h2 className="rb-title">
              {evaluation.sandbox
                ? 'Votre budget, présenté'
                : allMet
                  ? 'Objectif atteint'
                  : 'Objectif non atteint'}
            </h2>
          </div>
          {!evaluation.sandbox && (
            <div className="rb-stars" aria-label={`${evaluation.stars} étoile(s) sur 3`}>
              {[0, 1, 2].map((i) => (
                <Star key={i} filled={i < evaluation.stars} />
              ))}
            </div>
          )}
        </div>

        {!evaluation.sandbox && (
          <ul className="rb-goals">
            {evaluation.goals.map((g) => (
              <li key={g.label} className={g.met ? 'met' : 'missed'}>
                <span className="rbg-check">{g.met ? '✓' : '✗'}</span>
                <span className="rbg-label">{g.label}</span>
                <span className="rbg-actual">{g.actual}</span>
              </li>
            ))}
            <li className={result.socialGauge >= 40 ? 'met' : 'missed'}>
              <span className="rbg-check">{result.socialGauge >= 40 ? '✓' : '✗'}</span>
              <span className="rbg-label">Climat social préservé (jauge ≥ 40)</span>
              <span className="rbg-actual">{result.socialGauge} / 100</span>
            </li>
            <li className={f.debtPct <= fb.debtPct ? 'met' : 'missed'}>
              <span className="rbg-check">{f.debtPct <= fb.debtPct ? '✓' : '✗'}</span>
              <span className="rbg-label">Dette 2029 sous la tendance sans mesures</span>
              <span className="rbg-actual">
                {nf1.format(f.debtPct)} % vs {nf1.format(fb.debtPct)} %
              </span>
            </li>
          </ul>
        )}

        <div className="rb-grid">
          <Fact label="Déficit 2029" value={`${nf1.format(f.deficitPct)} %`} sub={`2024 : ${nf1.format(b0.deficitPct)} %`} />
          <Fact label="Dette 2029" value={`${nf1.format(f.debtPct)} %`} sub={`tendance : ${nf1.format(fb.debtPct)} %`} />
          <Fact label="Chômage 2029" value={`${nf1.format(f.unemployment)} %`} sub={`2024 : ${nf1.format(b0.unemployment)} %`} />
          <Fact
            label="Solde net des mesures"
            value={`${result.totals2029.net >= 0 ? '+' : '−'}${nf1.format(Math.abs(result.totals2029.net))} Md€/an`}
            sub={`${measures.length} mesure${measures.length > 1 ? 's' : ''}, scénario ${scenarioLabel.toLowerCase()}`}
          />
        </div>

        <div className="rb-actions">
          <button className="btn-primary" onClick={download} disabled={downloading}>
            {downloading ? 'Génération…' : 'Télécharger ma carte (PNG)'}
          </button>
          <button className="btn-ghost" onClick={copyLink}>
            Copier le lien de mon budget
          </button>
          <button className="btn-ghost" onClick={onClose}>
            Continuer à ajuster
          </button>
          <button className="btn-link rb-reset" onClick={onReset}>
            Tout remettre à zéro
          </button>
        </div>

        <p className="rb-note">
          Verdicts factuels au regard des objectifs choisis — le simulateur ne juge pas vos choix.
          Ordres de grandeur au premier ordre, hypothèses publiques.
        </p>
      </div>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rb-fact">
      <span className="rbf-label">{label}</span>
      <span className="rbf-value">{value}</span>
      <span className="rbf-sub">{sub}</span>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z"
        fill={filled ? '#c98500' : 'none'}
        stroke={filled ? '#c98500' : '#2a3145'}
        strokeWidth="1.6"
      />
    </svg>
  );
}
