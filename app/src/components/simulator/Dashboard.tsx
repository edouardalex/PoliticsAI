import type { Mission } from '../../content/measures';
import type { SimResult } from '../../lib/simulation';
import { useAnimatedNumber } from '../../lib/useAnimatedNumber';

interface Props {
  result: SimResult;
  mission: Mission;
}

const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtPct(x: number): string {
  return `${nf1.format(x)} %`;
}

function fmtDelta(x: number, unit = 'pt'): string {
  const s = x > 0 ? '+' : '';
  return `${s}${nf1.format(x)} ${unit}`;
}

export default function Dashboard({ result, mission }: Props) {
  const f = result.final;
  const b0 = result.baseline[0];
  const fb = result.finalBaseline;

  const avgGrowth =
    result.scenario.slice(1).reduce((s, p) => s + p.growth, 0) / (result.scenario.length - 1);
  const avgGrowthBase = b0.growth;

  const deficitGoal = mission.goals.find((g) => g.test === 'deficit_max');
  const unempGoal = mission.goals.find((g) => g.test === 'unemp_max');

  return (
    <div className="simu-dash">
      <Tile
        label="Déficit public 2029"
        value={f.deficitPct}
        format={fmtPct}
        deltaValue={f.deficitPct - b0.deficitPct}
        deltaLabel="vs 2024"
        goodWhenDown
        target={deficitGoal ? { value: deficitGoal.value, label: `objectif ≤ ${nf1.format(deficitGoal.value)} %` } : undefined}
        spark={result.scenario.map((p) => p.deficitPct)}
        sparkBase={result.baseline.map((p) => p.deficitPct)}
        inverted
      />
      <Tile
        label="Dette publique 2029"
        value={f.debtPct}
        format={fmtPct}
        deltaValue={f.debtPct - fb.debtPct}
        deltaLabel="vs tendance"
        goodWhenDown
        spark={result.scenario.map((p) => p.debtPct)}
        sparkBase={result.baseline.map((p) => p.debtPct)}
        inverted
      />
      <Tile
        label="Croissance moyenne 2025-29"
        value={avgGrowth}
        format={fmtPct}
        deltaValue={avgGrowth - avgGrowthBase}
        deltaLabel="vs tendance"
        spark={result.scenario.map((p) => p.growth)}
        sparkBase={result.baseline.map((p) => p.growth)}
      />
      <Tile
        label="Chômage 2029"
        value={f.unemployment}
        format={fmtPct}
        deltaValue={f.unemployment - b0.unemployment}
        deltaLabel="vs 2024"
        goodWhenDown
        target={unempGoal ? { value: unempGoal.value, label: `objectif ≤ ${nf1.format(unempGoal.value)} %` } : undefined}
        spark={result.scenario.map((p) => p.unemployment)}
        sparkBase={result.baseline.map((p) => p.unemployment)}
        inverted
      />
      <SocialTile gauge={result.socialGauge} />
    </div>
  );
}

/* ————— Tuile indicateur ————— */

interface TileProps {
  label: string;
  value: number;
  format: (x: number) => string;
  deltaValue: number;
  deltaLabel: string;
  goodWhenDown?: boolean;
  target?: { value: number; label: string };
  spark: number[];
  sparkBase: number[];
  /** true si « plus bas » doit s'afficher côté amélioration du solde (bleu) */
  inverted?: boolean;
}

function Tile({ label, value, format, deltaValue, deltaLabel, target, spark, sparkBase, inverted }: TileProps) {
  const animated = useAnimatedNumber(value);
  const changed = Math.abs(deltaValue) >= 0.05;
  const dirClass = !changed ? '' : (deltaValue < 0) === !!inverted ? ' up' : ' down';
  return (
    <div className="dash-tile">
      <span className="dt-label">{label}</span>
      <span className="dt-value">{format(animated)}</span>
      <span className={`dt-delta${dirClass}`}>
        {changed ? `${fmtDelta(deltaValue)} ${deltaLabel}` : `inchangé ${deltaLabel}`}
      </span>
      <Spark values={spark} base={sparkBase} target={target?.value} />
      {target && <span className="dt-target">{target.label}</span>}
    </div>
  );
}

function Spark({ values, base, target }: { values: number[]; base: number[]; target?: number }) {
  const W = 132;
  const H = 34;
  const all = [...values, ...base, ...(target != null ? [target] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max(0.15, (max - min) * 0.12);
  const y = (v: number) => H - ((v - (min - pad)) / (max - min + 2 * pad)) * H;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const path = (vs: number[]) => vs.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="dt-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      {target != null && (
        <line x1={0} x2={W} y1={y(target)} y2={y(target)} className="spark-target" />
      )}
      <path d={path(base)} className="spark-base" />
      <path d={path(values)} className="spark-main" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} className="spark-dot" />
    </svg>
  );
}

/* ————— Jauge climat social ————— */

const BANDS = [
  { min: 60, label: 'apaisé', color: '#0ca30c' },
  { min: 40, label: 'stable', color: '#7d92bd' },
  { min: 25, label: 'tendu', color: '#fab219' },
  { min: 12, label: 'très tendu', color: '#ec835a' },
  { min: 0, label: 'explosif', color: '#d03b3b' },
];

function SocialTile({ gauge }: { gauge: number }) {
  const animated = useAnimatedNumber(gauge);
  const band = BANDS.find((b) => gauge >= b.min) ?? BANDS[BANDS.length - 1];
  return (
    <div className="dash-tile social">
      <span className="dt-label">
        Climat social <em className="dt-ludique">jauge de jeu</em>
      </span>
      <span className="dt-value" style={{ color: band.color }}>
        {band.label}
      </span>
      <div className="social-track" role="img" aria-label={`Climat social : ${band.label} (${gauge}/100)`}>
        <div className="social-fill" style={{ width: `${animated}%`, background: band.color }} />
        <span className="social-mark" style={{ left: '50%' }} />
      </div>
      <span className="dt-delta">{Math.round(animated)} / 100 — départ 50</span>
    </div>
  );
}
