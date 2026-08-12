import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getPerimeter } from '../lib/data';
import { fmtPct } from '../lib/format';
import { REDUCED_MOTION } from '../lib/motionPrefs';

interface Props {
  onEnter: () => void;
  onAbout: () => void;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

function useCountUp(target: number, duration = 2000): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (REDUCED_MOTION) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

export default function IntroOverlay({ onEnter, onAbout }: Props) {
  const s13 = getPerimeter('S13');
  const euros = s13.expenditureTotal * 1e6;
  const value = useCountUp(euros);

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={
        REDUCED_MOTION
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, y: -30, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
      }
    >
      <FlowBackdrop />
      <div className="intro-inner">
        <motion.p
          className="intro-overline"
          initial={REDUCED_MOTION ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={REDUCED_MOTION ? { duration: 0 } : { delay: 0.15, duration: 0.5 }}
        >
          En {s13.year}, l’État, la Sécurité sociale et les collectivités ont dépensé
        </motion.p>
        <motion.div
          className="intro-number"
          initial={REDUCED_MOTION ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={REDUCED_MOTION ? { duration: 0 } : { delay: 0.3, duration: 0.55 }}
          aria-label={`${nf.format(euros)} euros`}
        >
          {nf.format(Math.round(value))} €
        </motion.div>
        <motion.p
          className="intro-sub"
          initial={REDUCED_MOTION ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={REDUCED_MOTION ? { duration: 0 } : { delay: 1.1, duration: 0.55 }}
        >
          Soit {s13.expenditurePctGdp ? fmtPct(s13.expenditurePctGdp) : ''} de tout ce que le pays
          produit en un an. D’où vient cet argent&nbsp;? Où va-t-il&nbsp;? Chaque flux, chaque poste,
          chaque comparaison — sans jugement, à vous de vous faire le vôtre.
        </motion.p>
        <motion.div
          className="intro-actions"
          initial={REDUCED_MOTION ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={REDUCED_MOTION ? { duration: 0 } : { delay: 1.45, duration: 0.5 }}
        >
          <button className="btn-primary" onClick={onEnter}>
            Explorer le budget
          </button>
          <button className="btn-ghost" onClick={onAbout}>
            La méthode
          </button>
        </motion.div>
        <motion.p
          className="intro-source"
          initial={REDUCED_MOTION ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={REDUCED_MOTION ? { duration: 0 } : { delay: 1.9, duration: 0.6 }}
        >
          Données officielles Eurostat / Insee · millésime {s13.year} · projet ouvert
        </motion.p>
      </div>
    </motion.div>
  );
}

function FlowBackdrop() {
  return (
    <svg className="intro-bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path className="ib ib1" d="M-40 260 C 360 250, 520 140, 740 150 S 1180 260, 1480 210" />
      <path className="ib ib2" d="M-40 450 C 380 460, 560 430, 750 440 S 1160 480, 1480 450" />
      <path className="ib ib3" d="M-40 640 C 360 650, 540 740, 760 720 S 1200 620, 1480 680" />
      <path className="ib ib4" d="M-40 350 C 400 360, 600 300, 800 310 S 1200 380, 1480 330" />
    </svg>
  );
}
