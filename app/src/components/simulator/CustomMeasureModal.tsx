import { useState } from 'react';
import { CUSTOM_DOMAINS, MODEL } from '../../content/measures';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; domainId: string; direction: 'plus' | 'moins'; amountMd: number }) => void;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export default function CustomMeasureModal({ open, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState(CUSTOM_DOMAINS[0].id);
  const [direction, setDirection] = useState<'plus' | 'moins'>('plus');
  const [amount, setAmount] = useState(5);

  if (!open) return null;
  const domain = CUSTOM_DOMAINS.find((d) => d.id === domainId)!;
  const isSpending = domain.side === 'depense';
  const mult = MODEL.multipliers[domain.lever];

  const dirLabel =
    (isSpending && direction === 'plus') || (!isSpending && direction === 'moins')
      ? 'soutient l’activité'
      : 'freine l’activité';

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({ title, domainId, direction, amountMd: amount });
    setTitle('');
    setAmount(5);
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="custom-box" role="dialog" aria-label="Inventer une mesure" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <h2>Inventer une mesure</h2>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p className="cm-intro">
          Donnez-lui un nom, un domaine et un montant : le moteur lui applique <strong>les mêmes
          règles</strong> qu'aux mesures du catalogue (multiplicateur du domaine, bouclage, montée en
          charge progressive). C'est vous qui chiffrez — le simulateur n'invente aucun chiffre.
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

        <p className="cm-preview">
          Levier « {domain.label} » : multiplicateur {nf.format(mult)} — cette mesure {dirLabel}.{' '}
          {((isSpending && direction === 'moins') || (!isSpending && direction === 'plus')) &&
            'Elle améliore le solde public.'}
          {((isSpending && direction === 'plus') || (!isSpending && direction === 'moins')) &&
            'Elle pèse sur le solde public.'}
        </p>

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
