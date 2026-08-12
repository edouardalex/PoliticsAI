import { useRef, useState, useLayoutEffect, useMemo } from 'react';
import type { SimResult, YearPoint } from '../../lib/simulation';

interface Props {
  result: SimResult;
}

export default function Trajectories({ result }: Props) {
  return (
    <div className="simu-charts">
      <ChartPanel
        title="Déficit public"
        unit="% du PIB"
        result={result}
        accessor={(p) => p.deficitPct}
        reference={{ value: 3, label: '3 % (traités UE)' }}
      />
      <ChartPanel
        title="Dette publique"
        unit="% du PIB"
        result={result}
        accessor={(p) => p.debtPct}
      />
      <div className="charts-legend" aria-hidden>
        <span className="cl-item">
          <span className="cl-key main" /> votre budget
        </span>
        <span className="cl-item">
          <span className="cl-key base" /> tendance sans mesure
        </span>
      </div>
    </div>
  );
}

/* ————— Un panneau ————— */

interface PanelProps {
  title: string;
  unit: string;
  result: SimResult;
  accessor: (p: YearPoint) => number;
  reference?: { value: number; label: string };
}

const M = { top: 14, right: 58, bottom: 22, left: 34 };

function ChartPanel({ title, unit, result, accessor, reference }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  const [hover, setHover] = useState<number | null>(null);
  const H = 190;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(300, e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scen = result.scenario.map(accessor);
  const base = result.baseline.map(accessor);
  const years = result.scenario.map((p) => p.year);

  const { x, y, ticks } = useMemo(() => {
    const all = [...scen, ...base, ...(reference ? [reference.value] : [])];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = Math.max(0.3, (hi - lo) * 0.15);
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (i: number) => M.left + (i / (years.length - 1)) * (w - M.left - M.right);
    const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * (H - M.top - M.bottom);
    const span = y1 - y0;
    const step = span > 14 ? 5 : span > 7 ? 2 : span > 3.2 ? 1 : 0.5;
    const ticks: number[] = [];
    for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) ticks.push(Math.round(t * 10) / 10);
    return { x, y, ticks };
  }, [scen, base, reference, w, years.length]);

  const path = (vs: number[]) =>
    vs.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const area = () => {
    const line = scen.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `${line} L${x(scen.length - 1).toFixed(1)},${H - M.bottom} L${x(0).toFixed(1)},${H - M.bottom} Z`;
  };

  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
  const last = scen.length - 1;
  const gid = `area-${title.replace(/\W/g, '')}`;

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < years.length; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div className="chart-panel" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <div className="cp-head">
        <span className="cp-title">{title}</span>
        <span className="cp-unit">{unit}</span>
      </div>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${title}, trajectoire 2024-2029`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3987e5" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#3987e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} className="cp-grid" />
            <text x={M.left - 7} y={y(t) + 3.5} className="cp-tick" textAnchor="end">
              {nf.format(t)}
            </text>
          </g>
        ))}
        {reference && (
          <g>
            <line x1={M.left} x2={w - M.right} y1={y(reference.value)} y2={y(reference.value)} className="cp-ref" />
            <text x={w - M.right + 5} y={y(reference.value) + 3.5} className="cp-ref-label">
              {reference.label}
            </text>
          </g>
        )}
        {years.map((yr, i) => (
          <text key={yr} x={x(i)} y={H - 6} className="cp-tick" textAnchor="middle">
            {String(yr).slice(2)}
          </text>
        ))}

        <path d={area()} fill={`url(#${gid})`} />
        <path d={path(base)} className="cp-line base" />
        <path d={path(scen)} className="cp-line main" />
        <circle cx={x(last)} cy={y(scen[last])} r={4} className="cp-dot" />
        <text x={x(last) + 8} y={y(scen[last]) + 4} className="cp-endlabel">
          {nf.format(scen[last])}
        </text>

        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={H - M.bottom} className="cp-crosshair" />
        )}
      </svg>
      {hover != null && (
        <div
          className="viz-tooltip cp-tt"
          style={{ transform: `translate(${Math.min(x(hover) + 12, w - 190)}px, 30px)` }}
        >
          <div className="tt-title">{years[hover]}</div>
          <div className="cp-tt-row">
            <span className="cl-key main" /> votre budget <strong>{nf.format(scen[hover])}</strong>
          </div>
          <div className="cp-tt-row">
            <span className="cl-key base" /> tendance <strong>{nf.format(base[hover])}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
