import { AnimatePresence, motion } from 'framer-motion';
import { REDUCED_MOTION } from '../../lib/motionPrefs';
import {
  grossAmount,
  soldeSign,
  measureNetEffect,
  type ActiveMeasure,
  type ScenarioId,
  type SimResult,
} from '../../lib/simulation';

interface Props {
  measures: ActiveMeasure[];
  scenario: ScenarioId;
  result: SimResult;
  onRemove: (uid: string) => void;
  onIntensity: (uid: string, intensity: number) => void;
  onCustom: () => void;
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function signed(x: number): string {
  return `${x >= 0 ? '+' : '−'}${nf1.format(Math.abs(x))}`;
}

export default function Bill({ measures, scenario, result, onRemove, onIntensity, onCustom }: Props) {
  const t = result.totals2029;
  return (
    <aside className="simu-bill">
      <div className="bill-head">
        <h2 className="cat-title">Votre projet de loi</h2>
        <span className="bill-count">{measures.length} mesure{measures.length > 1 ? 's' : ''}</span>
      </div>

      {measures.length === 0 ? (
        <div className="bill-empty">
          <p>
            Rien pour l'instant. Piochez des mesures à gauche, ou{' '}
            <button className="btn-link" onClick={onCustom}>
              inventez la vôtre
            </button>
            .
          </p>
        </div>
      ) : (
        <ul className="bill-list">
          <AnimatePresence initial={false}>
            {measures.map((m) => {
              const net = measureNetEffect(m, scenario);
              return (
                <motion.li
                  key={m.uid}
                  className="bill-item"
                  initial={REDUCED_MOTION ? false : { opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={REDUCED_MOTION ? undefined : { opacity: 0, x: 18, transition: { duration: 0.14 } }}
                  transition={{ duration: REDUCED_MOTION ? 0 : 0.22 }}
                  layout={!REDUCED_MOTION}
                >
                  <div className="bi-row">
                    <span className="bi-title">
                      {m.isCustom && <span className="bi-custom">votre mesure</span>}
                      {m.def.title}
                    </span>
                    <button className="bi-remove" onClick={() => onRemove(m.uid)} aria-label={`Retirer ${m.def.title}`}>
                      ✕
                    </button>
                  </div>
                  {m.def.param && (
                    <div className="bi-param">
                      <input
                        type="range"
                        min={m.def.param.min}
                        max={m.def.param.max}
                        step={m.def.param.step}
                        value={m.intensity}
                        onChange={(e) => onIntensity(m.uid, Number(e.target.value))}
                        aria-label={`Intensité : ${m.intensity} ${m.def.param.unit}`}
                      />
                      <span className="bi-param-value">
                        {nf1.format(m.intensity)} {m.def.param.unit}
                      </span>
                    </div>
                  )}
                  <div className="bi-effects">
                    <span className={soldeSign(m.def) > 0 ? 'gain' : 'cost'}>
                      {soldeSign(m.def) > 0 ? '+' : '−'}
                      {nf1.format(grossAmount(m))} Md€ brut
                    </span>
                    <span className="bi-net" title="Après retours d'activité (bouclage)">
                      net {signed(net)} Md€
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <div className="bill-totals">
        <h3 className="bt-title">Effet sur le solde en 2029</h3>
        <div className="bt-row">
          <span>Effort budgétaire brut</span>
          <strong className={t.brut >= 0 ? 'gain' : 'cost'}>{signed(t.brut)} Md€</strong>
        </div>
        <div className="bt-row">
          <span>Retours d'activité (bouclage)</span>
          <strong className={t.retours >= 0 ? 'gain' : 'cost'}>{signed(t.retours)} Md€</strong>
        </div>
        <div className="bt-row">
          <span>Charge d'intérêts induite</span>
          <strong className={t.interets <= 0 ? 'gain' : 'cost'}>{signed(-t.interets)} Md€</strong>
        </div>
        <div className="bt-row net">
          <span>Solde net</span>
          <strong className={t.net >= 0 ? 'gain' : 'cost'}>{signed(t.net)} Md€/an</strong>
        </div>
        {result.directJobs !== 0 && (
          <div className="bt-row">
            <span>Postes publics directs</span>
            <strong>
              {result.directJobs > 0 ? '+' : '−'}
              {Math.abs(result.directJobs).toLocaleString('fr-FR')}
            </strong>
          </div>
        )}
      </div>
    </aside>
  );
}
