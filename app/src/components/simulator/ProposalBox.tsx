import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { REDUCED_MOTION } from '../../lib/motionPrefs';
import { parseProposal, type ParseResult } from '../../lib/parser';
import type { MeasureDef } from '../../content/measures';
import type { ActiveMeasure } from '../../lib/simulation';

interface Props {
  onAdd: (m: ActiveMeasure) => void;
  onAtelier: () => void;
  onQueue: (text: string) => void;
  /** le serveur de la file citoyenne est-il joignable ? */
  queueAvailable: boolean;
}

const EXAMPLES = [
  'la retraite à 67 ans',
  'augmenter la TVA de 2 points',
  'recruter 50 000 profs',
  'taxer les riches',
];

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export default function ProposalBox({ onAdd, onAtelier, onQueue, queueAvailable }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);

  const run = (value: string) => {
    setText(value);
    setResult(value.trim().length >= 3 ? parseProposal(value) : null);
  };

  const accept = (def: MeasureDef, intensity: number) => {
    onAdd({ uid: def.id, def, intensity: def.param ? intensity : 1 });
    setText('');
    setResult(null);
  };

  const queue = () => {
    onQueue(text.trim());
    setText('');
    setResult(null);
  };

  return (
    <section className="proposal-box">
      <div className="pb-main">
        <div className="pb-field">
          <label className="pb-label" htmlFor="pb-input">
            Proposez une mesure, avec vos mots
          </label>
          <input
            id="pb-input"
            className="pb-input"
            placeholder="Ex. : passer la retraite à 67 ans"
            value={text}
            onChange={(e) => run(e.target.value)}
            autoComplete="off"
          />
        </div>
        <p className="pb-hint">
          Analyse locale, sans intelligence artificielle : votre phrase est comparée aux mesures du
          catalogue. Aucun chiffre n’est inventé — et quand la demande sort du domaine où le modèle
          est valide, il le dit.
        </p>
        {!result && (
          <div className="pb-examples">
            {EXAMPLES.map((e) => (
              <button key={e} className="chip small" onClick={() => run(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.status + (result.measure?.id ?? '')}
            className={`pb-result ${result.status}`}
            initial={REDUCED_MOTION ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={REDUCED_MOTION ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: REDUCED_MOTION ? 0 : 0.2 }}
          >
            {result.status === 'matched' && result.measure && (
              <>
                <div className="pbr-head">
                  <span className="pbr-tag ok">Compris</span>
                  <span className="pbr-text">{result.understood}</span>
                </div>
                {result.detail && <p className="pbr-detail">{result.detail}</p>}
                <div className="pbr-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => accept(result.measure!, result.intensity ?? 1)}
                  >
                    Ajouter au projet de loi
                  </button>
                  <button className="btn-ghost btn-sm" onClick={onAtelier}>
                    Ce n’est pas ça — atelier
                  </button>
                </div>
              </>
            )}

            {result.status === 'out_of_range' && result.measure && (
              <>
                <div className="pbr-head">
                  <span className="pbr-tag limit">Hors du domaine de validité</span>
                  <span className="pbr-text">{result.understood}</span>
                </div>
                <p className="pbr-detail">{result.detail}</p>
                <p className="pbr-detail strong">
                  Notre modèle chiffre cette mesure jusqu’à{' '}
                  {nf.format(result.measure.param!.max)}{' '}
                  {result.measure.param!.unit === 'an' ? 'ans' : result.measure.param!.unit} — vous
                  demandiez {nf.format(result.requested ?? 0)}.
                </p>
                <div className="pbr-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => accept(result.measure!, result.measure!.param!.max)}
                  >
                    Ajouter la version calculable ({nf.format(result.measure.param!.max)}{' '}
                    {result.measure.param!.unit === 'an' ? 'ans' : result.measure.param!.unit})
                  </button>
                  {queueAvailable && (
                    <button className="btn-ghost btn-sm" onClick={queue}>
                      Soumettre quand même à la file
                    </button>
                  )}
                </div>
              </>
            )}

            {result.status === 'ambiguous' && result.candidates && (
              <>
                <div className="pbr-head">
                  <span className="pbr-tag ask">Plusieurs possibilités</span>
                  <span className="pbr-text">Laquelle vouliez-vous dire&nbsp;?</span>
                </div>
                <div className="pbr-choices">
                  {result.candidates.map((c) => (
                    <button key={c.id} className="pbr-choice" onClick={() => accept(c, c.param?.default ?? 1)}>
                      <span className="pbrc-title">{c.title}</span>
                      <span className="pbrc-amount">
                        {nf.format(c.param ? c.param.default * c.param.perUnit : c.amount)} Md€/an
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {result.status === 'unknown' && (
              <>
                <div className="pbr-head">
                  <span className="pbr-tag none">Hors catalogue</span>
                  <span className="pbr-text">Aucune mesure connue ne correspond à cette phrase.</span>
                </div>
                <p className="pbr-detail">{result.detail}</p>
                <div className="pbr-actions">
                  <button className="btn-primary btn-sm" onClick={onAtelier}>
                    La créer dans l’atelier
                  </button>
                  {queueAvailable && (
                    <button className="btn-ghost btn-sm" onClick={queue}>
                      Proposer au chiffrage citoyen
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
