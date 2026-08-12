import { motion } from 'framer-motion';
import { REDUCED_MOTION } from '../lib/motionPrefs';
import type { Perimeter, PerimeterId } from '../lib/data';
import { getFunction } from '../lib/data';
import { buildOverview, buildZoom, type SkNodeDatum } from '../lib/sankeyModel';
import { fmtInMode, fmtShare, type DisplayMode, type ModeContext } from '../lib/format';

interface Props {
  perimeter: Perimeter;
  perimeterId: PerimeterId;
  mode: DisplayMode;
  zoom: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onZoom: (code: string | null) => void;
}

export default function MobileFlow({ perimeter, perimeterId, mode, zoom, selected, onSelect, onZoom }: Props) {
  const ctx: ModeContext = { refTotal: perimeter.expenditureTotal, gdp: perimeter.gdp };
  const zoomFn = zoom ? getFunction(perimeter, zoom) : undefined;
  const graph = zoomFn ? buildZoom(perimeter, zoomFn, perimeterId) : buildOverview(perimeter, perimeterId);

  const left = graph.nodes.filter((n) => n.labelSide === -1 && n.kind !== 'source');
  const right = graph.nodes.filter((n) => n.labelSide === 1);
  const max = Math.max(...[...left, ...right].map((n) => n.value));

  return (
    <div className="mobile-flow">
      {zoomFn ? (
        <>
          <button className="crumb-back" onClick={() => onZoom(null)}>
            ← Tout le budget
          </button>
          <div className="mf-total-card">
            <span className="mf-total">{fmtInMode(zoomFn.value, mode, ctx)}</span>
            <span className="mf-total-label">
              {fmtShare(zoomFn.value, perimeter.expenditureTotal)} des dépenses {perimeter.year}
            </span>
          </div>
          <Section title="Sous-postes" nodes={right} max={max} mode={mode} ctx={ctx} selected={selected} onSelect={onSelect} />
        </>
      ) : (
        <>
          <Section
            title="D’où vient l’argent"
            nodes={left}
            max={max}
            mode={mode}
            ctx={ctx}
            selected={selected}
            onSelect={onSelect}
          />
          <div className="mf-total-card">
            <span className="mf-total">{fmtInMode(perimeter.expenditureTotal, mode, ctx)}</span>
            <span className="mf-total-label">de dépenses publiques en {perimeter.year}</span>
          </div>
          <Section
            title="Où va l’argent"
            nodes={right}
            max={max}
            mode={mode}
            ctx={ctx}
            selected={selected}
            onSelect={onSelect}
            onDrill={(code) => {
              const f = getFunction(perimeter, code);
              if (f && f.children.length > 0) onZoom(code);
            }}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  nodes,
  max,
  mode,
  ctx,
  selected,
  onSelect,
  onDrill,
}: {
  title: string;
  nodes: SkNodeDatum[];
  max: number;
  mode: DisplayMode;
  ctx: ModeContext;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onDrill?: (code: string) => void;
}) {
  return (
    <section className="mf-section">
      <h2 className="mf-title">{title}</h2>
      <ul className="mf-list">
        {nodes.map((n, i) => (
          <li key={n.id}>
            <button
              className={`mf-row${selected === n.id ? ' sel' : ''}${n.kind === 'deficit' ? ' deficit' : ''}`}
              onClick={() => onSelect(selected === n.id ? null : n.id)}
            >
              <span className="mf-row-head">
                <span className="mf-label">{n.label}</span>
                <span className="mf-value">{fmtInMode(n.value, mode, ctx)}</span>
              </span>
              <span className="mf-track">
                <motion.span
                  className="mf-bar"
                  style={{ background: n.kind === 'deficit' ? undefined : n.color }}
                  initial={REDUCED_MOTION ? false : { width: 0 }}
                  animate={{ width: `${(n.value / max) * 100}%` }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              {onDrill && n.kind === 'function' && (
                <span
                  className="mf-drill"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDrill(n.code);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onDrill(n.code);
                    }
                  }}
                >
                  Détailler →
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
