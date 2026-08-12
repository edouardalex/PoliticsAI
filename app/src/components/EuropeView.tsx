import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { REDUCED_MOTION } from '../lib/motionPrefs';
import { EUROPE, type PerimeterId } from '../lib/data';
import { FUNCTION_INFO } from '../content/text';
import { FUNCTION_COLORS } from '../lib/palette';
import { fmtPct } from '../lib/format';

interface Props {
  onInspect: (code: string) => void;
  perimeter: PerimeterId;
}

const DEFAULT_ACTIVE = ['FR', 'DE', 'IT', 'ES', 'EU27_2020'];

export default function EuropeView({ onInspect }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set(DEFAULT_ACTIVE));
  const [hover, setHover] = useState<{ geo: string; code: string; x: number; y: number; v: number } | null>(null);

  const fr = EUROPE.countries.find((c) => c.geo === 'FR')!;
  const eu = EUROPE.countries.find((c) => c.geo === 'EU27_2020');

  const rows = useMemo(() => {
    const codes = Object.keys(FUNCTION_INFO);
    return codes
      .map((code) => ({ code, fr: fr.functions[code] ?? 0 }))
      .sort((a, b) => b.fr - a.fr);
  }, [fr]);

  const activeCountries = EUROPE.countries.filter((c) => active.has(c.geo));
  const maxVal = useMemo(() => {
    let m = 0;
    for (const c of activeCountries) {
      for (const code of Object.keys(FUNCTION_INFO)) {
        m = Math.max(m, c.functions[code] ?? 0);
      }
    }
    return Math.ceil(m / 5) * 5;
  }, [activeCountries]);

  const toggle = (geo: string) => {
    if (geo === 'FR') return;
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(geo)) next.delete(geo);
      else next.add(geo);
      return next;
    });
  };

  const ticks: number[] = [];
  for (let t = 5; t <= maxVal; t += 5) ticks.push(t);

  return (
    <div className="europe-view">
      <div className="eu-head">
        <div className="eu-stats">
          <div className="eu-stat">
            <span className="eu-stat-value">{fmtPct(fr.totalPctGdp)}</span>
            <span className="eu-stat-label">du PIB dépensé par la France ({fr.year})</span>
          </div>
          {eu && (
            <div className="eu-stat dim">
              <span className="eu-stat-value">{fmtPct(eu.totalPctGdp)}</span>
              <span className="eu-stat-label">en moyenne dans l’Union européenne</span>
            </div>
          )}
        </div>
        <p className="eu-intro">
          Dépenses publiques par fonction, en part de la richesse nationale (% du PIB) — secteur
          consolidé, source Eurostat. Cliquez sur une fonction pour la retrouver dans le flux.
        </p>
      </div>

      <div className="eu-chips" role="group" aria-label="Pays comparés">
        {EUROPE.countries.map((c) => (
          <button
            key={c.geo}
            className={`chip${active.has(c.geo) ? ' active' : ''}${c.geo === 'FR' ? ' locked' : ''}`}
            aria-pressed={active.has(c.geo)}
            onClick={() => toggle(c.geo)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="eu-grid">
        <div className="eu-axis" aria-hidden>
          <span className="eu-axis-spacer" />
          <div className="eu-axis-strip">
            {ticks.map((t) => (
              <span key={t} className="eu-tick" style={{ left: `${(t / maxVal) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <span className="eu-axis-unit">% du PIB</span>
        </div>

        {rows.map((row) => {
          const info = FUNCTION_INFO[row.code];
          return (
            <div className="eu-row" key={row.code}>
              <button className="eu-row-label" onClick={() => onInspect(row.code)}>
                <span className="eu-dot" style={{ background: FUNCTION_COLORS[row.code] }} />
                {info.short}
              </button>
              <div className="eu-strip">
                {ticks.map((t) => (
                  <span key={t} className="eu-gridline" style={{ left: `${(t / maxVal) * 100}%` }} />
                ))}
                {activeCountries
                  .filter((c) => c.geo !== 'FR')
                  .map((c) => {
                    const v = c.functions[row.code];
                    if (v == null) return null;
                    const isEu = c.geo === 'EU27_2020';
                    return (
                      <motion.span
                        key={c.geo}
                        className={`eu-pt${isEu ? ' eu27' : ''}`}
                        initial={false}
                        animate={{ left: `${(v / maxVal) * 100}%` }}
                        transition={{ duration: REDUCED_MOTION ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                        onMouseEnter={(e) => {
                          const r = (e.currentTarget.closest('.eu-grid') as HTMLElement).getBoundingClientRect();
                          setHover({ geo: c.geo, code: row.code, v, x: e.clientX - r.left, y: e.clientY - r.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                        aria-label={`${c.label} : ${fmtPct(v)} du PIB`}
                      />
                    );
                  })}
                <motion.span
                  className="eu-pt fr"
                  style={{ background: FUNCTION_COLORS[row.code] }}
                  initial={false}
                  animate={{ left: `${(row.fr / maxVal) * 100}%` }}
                  transition={{ duration: REDUCED_MOTION ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                  onMouseEnter={(e) => {
                    const r = (e.currentTarget.closest('.eu-grid') as HTMLElement).getBoundingClientRect();
                    setHover({ geo: 'FR', code: row.code, v: row.fr, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                  aria-label={`France : ${fmtPct(row.fr)} du PIB`}
                />
              </div>
              <span className="eu-row-value">{fmtPct(row.fr)}</span>
            </div>
          );
        })}

        {hover && (
          <div className="viz-tooltip eu-tt" style={{ transform: `translate(${hover.x + 14}px, ${hover.y + 14}px)` }}>
            <div className="tt-head">
              <span
                className="tt-key"
                style={{ background: hover.geo === 'FR' ? FUNCTION_COLORS[hover.code] : '#6b7386' }}
              />
              <span className="tt-title">{EUROPE.countries.find((c) => c.geo === hover.geo)?.label}</span>
            </div>
            <div className="tt-value">{fmtPct(hover.v)} du PIB</div>
            <div className="tt-meta">{FUNCTION_INFO[hover.code].short}</div>
          </div>
        )}
      </div>

      <p className="eu-note">
        Lecture : chaque point est un pays ; le point coloré est la France, l’anneau est la moyenne
        UE-27. Millésime {fr.year}. Les écarts reflètent aussi des choix d’organisation (assurance
        privée vs publique, périmètres différents).
      </p>
    </div>
  );
}
