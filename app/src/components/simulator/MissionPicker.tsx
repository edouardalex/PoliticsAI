import { motion } from 'framer-motion';
import { MISSIONS } from '../../content/measures';
import { BASE_2024 } from '../../lib/simulation';
import { REDUCED_MOTION } from '../../lib/motionPrefs';
import HypothesesModal from './HypothesesModal';

interface Props {
  onPick: (id: string) => void;
  onHypotheses: () => void;
  hypoOpen: boolean;
  onCloseHypo: () => void;
  onWall?: () => void;
}

const fmtPct = (x: number) => `${x.toFixed(1).replace('.', ',')} %`;

export default function MissionPicker({ onPick, onHypotheses, hypoOpen, onCloseHypo, onWall }: Props) {
  return (
    <div className="mission-picker">
      <motion.div
        initial={REDUCED_MOTION ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: REDUCED_MOTION ? 0 : 0.45 }}
        className="mp-head"
      >
        <p className="mp-overline">Le simulateur</p>
        <h1 className="mp-title">Vous êtes ministre du Budget.</h1>
        <p className="mp-sub">
          La France 2024 : {fmtPct(BASE_2024.deficitPct)} de déficit, {fmtPct(BASE_2024.debtPct)} de
          dette, {fmtPct(BASE_2024.unemployment)} de chômage. Choisissez votre mission, piochez dans
          les mesures — ou inventez les vôtres — et regardez les grands indicateurs réagir. Chaque
          règle du modèle est publique&nbsp;:{' '}
          <button className="btn-link" onClick={onHypotheses}>
            les hypothèses
          </button>
          .
        </p>
      </motion.div>

      <div className="mp-grid">
        {MISSIONS.map((m, i) => (
          <motion.button
            key={m.id}
            className={`mp-card${m.id === 'libre' ? ' free' : ''}`}
            initial={REDUCED_MOTION ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: REDUCED_MOTION ? 0 : 0.12 + i * 0.08, duration: REDUCED_MOTION ? 0 : 0.4 }}
            onClick={() => onPick(m.id)}
          >
            <span className="mpc-title">{m.title}</span>
            <span className="mpc-pitch">{m.pitch}</span>
            <span className="mpc-goals">
              {m.goals
                .filter((g) => g.test !== 'none')
                .map((g) => (
                  <span className="mpc-goal" key={g.label}>
                    {g.label}
                  </span>
                ))}
              {m.id === 'libre' && <span className="mpc-goal">Aucune contrainte</span>}
            </span>
            <span className="mpc-cta">Prendre le poste →</span>
          </motion.button>
        ))}
      </div>

      <p className="mp-note">
        Simulation mécanique au premier ordre, à règles publiques — des ordres de grandeur pour
        comprendre les arbitrages, pas des prédictions.
        {onWall && (
          <>
            {' '}
            <button className="btn-link" onClick={onWall}>
              Voir les budgets publiés →
            </button>
          </>
        )}
      </p>
      <HypothesesModal open={hypoOpen} onClose={onCloseHypo} />
    </div>
  );
}
