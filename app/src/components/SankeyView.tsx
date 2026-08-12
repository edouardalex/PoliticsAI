import { useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyNode,
  type SankeyLink,
} from 'd3-sankey';
import type { Perimeter, PerimeterId } from '../lib/data';
import { getFunction } from '../lib/data';
import { PERIMETER_INFO } from '../content/text';
import { buildOverview, buildZoom, type SkGraph, type SkNodeDatum, type SkLinkDatum } from '../lib/sankeyModel';
import { fmtInMode, fmtShare, fmtPct, type DisplayMode, type ModeContext } from '../lib/format';
import { pickEquivalences } from '../lib/equivalences';
import { mix } from '../lib/palette';

type LaidNode = SankeyNode<SkNodeDatum, SkLinkDatum>;
type LaidLink = SankeyLink<SkNodeDatum, SkLinkDatum>;

interface Props {
  perimeter: Perimeter;
  perimeterId: PerimeterId;
  mode: DisplayMode;
  zoom: string | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onZoom: (code: string | null) => void;
}

interface TipState {
  x: number;
  y: number;
  node?: LaidNode;
  link?: LaidLink;
}

import { REDUCED_MOTION } from '../lib/motionPrefs';

export default function SankeyView({ perimeter, perimeterId, mode, zoom, selected, onSelect, onZoom }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1100, h: 620 });
  const [tip, setTip] = useState<TipState | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: Math.max(560, r.width), h: Math.max(480, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomFn = zoom ? getFunction(perimeter, zoom) : undefined;
  const graph: SkGraph = useMemo(
    () => (zoomFn ? buildZoom(perimeter, zoomFn, perimeterId) : buildOverview(perimeter, perimeterId)),
    [perimeter, perimeterId, zoomFn],
  );

  const ctx: ModeContext = { refTotal: graph.refTotal, gdp: perimeter.gdp };

  const compact = size.w < 960;
  const marginL = zoomFn ? (compact ? 170 : 230) : compact ? 168 : 224;
  const marginR = compact ? 178 : 240;

  const layout = useMemo(() => {
    const gen = sankey<SkNodeDatum, SkLinkDatum>()
      .nodeId((d) => d.id)
      .nodeWidth(16)
      .nodePadding(graph.nodes.length > 16 ? 10 : 14)
      .nodeSort(null as never)
      .linkSort(null as never)
      .extent([
        [marginL, 34],
        [size.w - marginR, size.h - 14],
      ]);
    return gen({
      nodes: graph.nodes.map((n) => ({ ...n })),
      links: graph.links.map((l) => ({ ...l })),
    });
  }, [graph, size.w, size.h, marginL, marginR]);

  const linkPath = useMemo(() => sankeyLinkHorizontal<SkNodeDatum, SkLinkDatum>(), []);

  /** ids connectés au hover courant (liens + nœuds) */
  const litIds = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const l of layout.links) {
      const s = (l.source as LaidNode).id;
      const t = (l.target as LaidNode).id;
      if (s === hoverId || t === hoverId || l.ownerId === hoverId) {
        set.add(s);
        set.add(t);
        set.add(linkId(l));
      }
    }
    return set;
  }, [hoverId, layout]);

  const moveTip = useCallback((e: React.MouseEvent, node?: LaidNode, link?: LaidLink) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node, link });
  }, []);

  const clearHover = useCallback(() => {
    setHoverId(null);
    setTip(null);
  }, []);

  const handleNodeClick = (n: LaidNode) => {
    if (n.kind === 'source') {
      onZoom(null);
      return;
    }
    onSelect(selected === n.id ? null : n.id);
  };

  const handleNodeDouble = (n: LaidNode) => {
    if (n.kind === 'function') {
      const f = getFunction(perimeter, n.code);
      if (f && f.children.length > 0) onZoom(n.code);
    }
  };

  return (
    <div className="sankey-wrap">
      <HeaderStrip perimeter={perimeter} mode={mode} zoomFn={zoomFn} onBack={() => onZoom(null)} />
      {!zoomFn && perimeterId !== 'S13' && (
        <p className="peri-note">{PERIMETER_INFO[perimeterId].note}</p>
      )}
      <div className="sankey-canvas" ref={containerRef}>
        <AnimatePresence mode="wait">
          <motion.svg
            key={graph.key + (compact ? '-c' : '')}
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            role="img"
            aria-label={
              zoomFn
                ? `Répartition des dépenses de ${zoomFn.label}`
                : `Flux du budget public : recettes vers dépenses, ${perimeter.label}, ${perimeter.year}`
            }
            initial={REDUCED_MOTION ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={REDUCED_MOTION ? undefined : { opacity: 0, x: -14, transition: { duration: 0.16 } }}
            onMouseLeave={clearHover}
          >
            <defs>
              {layout.links.map((l) => {
                const id = gradId(graph.key, l);
                const s = l.source as LaidNode;
                const t = l.target as LaidNode;
                const toRight = t.kind === 'function' || t.kind === 'child' || t.kind === 'surplus';
                const from = toRight ? mix('#8fa2c9', '#0c0f17', 0.15) : mix(l.color, '#c9d4e8', 0.12);
                const to = toRight ? l.color : mix(l.color, '#c9d4e8', 0.45);
                return (
                  <linearGradient
                    key={id}
                    id={id}
                    gradientUnits="userSpaceOnUse"
                    x1={s.x1 ?? 0}
                    x2={t.x0 ?? 0}
                    y1={0}
                    y2={0}
                  >
                    <stop offset="0%" stopColor={from} stopOpacity={toRight ? 0.5 : 0.58} />
                    <stop offset="100%" stopColor={to} stopOpacity={toRight ? 0.72 : 0.74} />
                  </linearGradient>
                );
              })}
              <pattern id="hatch-deficit" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="#d03b3b" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" />
              </pattern>
            </defs>

            {/* Légendes de colonnes */}
            <ColumnCaptions layout={layout} zoomed={!!zoomFn} />

            {/* Liens */}
            <g>
              {layout.links.map((l, i) => {
                const id = linkId(l);
                const cls = litIds ? (litIds.has(id) ? 'sk-link lit' : 'sk-link dim') : 'sk-link';
                const leftSide = (l.source as LaidNode).kind !== 'spine' && (l.source as LaidNode).kind !== 'source';
                return (
                  <motion.path
                    key={id}
                    className={cls}
                    d={linkPath(l) ?? undefined}
                    stroke={`url(#${gradId(graph.key, l)})`}
                    strokeWidth={Math.max(1.1, l.width ?? 1)}
                    fill="none"
                    initial={REDUCED_MOTION ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={
                      REDUCED_MOTION
                        ? { duration: 0 }
                        : {
                            delay: leftSide ? 0.05 + i * 0.028 : 0.28 + i * 0.03,
                            duration: 0.55,
                            ease: 'easeInOut',
                          }
                    }
                    onMouseEnter={(e) => {
                      setHoverId(l.ownerId);
                      moveTip(e, undefined, l);
                    }}
                    onMouseMove={(e) => moveTip(e, undefined, l)}
                    onMouseLeave={clearHover}
                    onClick={() => onSelect(l.ownerId)}
                  />
                );
              })}
            </g>

            {/* Nœuds */}
            <g>
              {layout.nodes.map((n, i) => {
                const h = Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0));
                const isSel = selected === n.id;
                const cls = ['sk-node'];
                if (litIds && !litIds.has(n.id)) cls.push('dim');
                if (isSel) cls.push('sel');
                const fill = n.kind === 'deficit' ? 'url(#hatch-deficit)' : n.color;
                return (
                  <motion.g
                    key={n.id}
                    className={cls.join(' ')}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.label} : ${fmtInMode(n.value, mode, ctx)}`}
                    initial={REDUCED_MOTION ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      REDUCED_MOTION
                        ? { duration: 0 }
                        : { delay: n.kind === 'spine' ? 0.22 : 0.1 + i * 0.02, duration: 0.35 }
                    }
                    onMouseEnter={(e) => {
                      setHoverId(n.id);
                      moveTip(e, n);
                    }}
                    onMouseMove={(e) => moveTip(e, n)}
                    onMouseLeave={clearHover}
                    onClick={() => handleNodeClick(n)}
                    onDoubleClick={() => handleNodeDouble(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNodeClick(n);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={n.x0}
                      y={n.y0}
                      width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                      height={h}
                      rx={3}
                      fill={fill}
                      className="sk-rect"
                      opacity={n.kind === 'spine' ? 0.92 : 1}
                    />
                    <NodeLabel node={n} h={h} mode={mode} ctx={ctx} compact={compact} />
                  </motion.g>
                );
              })}
            </g>
          </motion.svg>
        </AnimatePresence>

        {tip && (tip.node || tip.link) && (
          <TooltipCard tip={tip} mode={mode} ctx={ctx} container={size} zoomed={!!zoomFn} />
        )}
      </div>
    </div>
  );
}

/* ————— Bandeau au-dessus du diagramme ————— */

function HeaderStrip({
  perimeter,
  mode,
  zoomFn,
  onBack,
}: {
  perimeter: Perimeter;
  mode: DisplayMode;
  zoomFn?: { code: string; label: string; value: number } | undefined;
  onBack: () => void;
}) {
  const ctx: ModeContext = { refTotal: perimeter.expenditureTotal, gdp: perimeter.gdp };
  if (zoomFn) {
    return (
      <div className="sankey-header">
        <button className="crumb-back" onClick={onBack}>
          ← Tout le budget
        </button>
        <div className="header-stat main">
          <span className="hs-value">{fmtInMode(zoomFn.value, mode, ctx)}</span>
          <span className="hs-label">
            {fmtShare(zoomFn.value, perimeter.expenditureTotal)} des dépenses · {perimeter.year}
          </span>
        </div>
        <div className="header-spacer" />
      </div>
    );
  }
  return (
    <div className="sankey-header">
      <div className="header-stat">
        <span className="hs-value rev">{fmtInMode(perimeter.revenueTotal, mode, ctx)}</span>
        <span className="hs-label">de recettes</span>
      </div>
      <div className="header-stat main">
        <span className="hs-value">{fmtInMode(perimeter.expenditureTotal, mode, ctx)}</span>
        <span className="hs-label">de dépenses en {perimeter.year}</span>
      </div>
      {perimeter.deficit > 0 ? (
        <div className="header-stat">
          <span className="hs-value def">{fmtInMode(perimeter.deficit, mode, ctx)}</span>
          <span className="hs-label">empruntés (déficit)</span>
        </div>
      ) : (
        <div className="header-spacer" />
      )}
    </div>
  );
}

/* ————— Labels des nœuds ————— */

function NodeLabel({
  node,
  h,
  mode,
  ctx,
  compact,
}: {
  node: LaidNode;
  h: number;
  mode: DisplayMode;
  ctx: ModeContext;
  compact: boolean;
}) {
  if (node.labelSide === 0) return null;
  const right = node.labelSide === 1;
  const x = right ? (node.x1 ?? 0) + 10 : (node.x0 ?? 0) - 10;
  const cy = ((node.y0 ?? 0) + (node.y1 ?? 0)) / 2;
  const anchor = right ? 'start' : 'end';
  const value = fmtInMode(node.value, mode, ctx);
  const name = compact && node.label.length > 26 ? node.label.slice(0, 24) + '…' : node.label;

  if (h >= 30) {
    return (
      <text textAnchor={anchor} className="sk-labels">
        <tspan x={x} y={cy - 3} className="sk-name">
          {name}
        </tspan>
        <tspan x={x} y={cy + 13} className="sk-value">
          {value}
        </tspan>
      </text>
    );
  }
  return (
    <text textAnchor={anchor} className="sk-labels" y={cy + 4}>
      <tspan x={x} className="sk-name">
        {name}
      </tspan>
      <tspan className="sk-value" dx={6}>
        {value}
      </tspan>
    </text>
  );
}

/* ————— Légendes de colonnes ————— */

function ColumnCaptions({ layout, zoomed }: { layout: { nodes: LaidNode[] }; zoomed: boolean }) {
  const left = layout.nodes.filter((n) => n.labelSide === -1);
  const right = layout.nodes.filter((n) => n.labelSide === 1);
  if (left.length === 0 || right.length === 0) return null;
  const lx = (left[0].x0 ?? 0) + ((left[0].x1 ?? 0) - (left[0].x0 ?? 0)) / 2;
  const rx = (right[0].x0 ?? 0) + ((right[0].x1 ?? 0) - (right[0].x0 ?? 0)) / 2;
  return (
    <g className="col-captions" aria-hidden>
      <text x={lx} y={18} textAnchor="middle">
        {zoomed ? 'FONCTION' : 'D’OÙ VIENT L’ARGENT'}
      </text>
      <text x={rx} y={18} textAnchor="middle">
        {zoomed ? 'SOUS-POSTES' : 'OÙ VA L’ARGENT'}
      </text>
    </g>
  );
}

/* ————— Tooltip ————— */

function TooltipCard({
  tip,
  mode,
  ctx,
  container,
  zoomed,
}: {
  tip: TipState;
  mode: DisplayMode;
  ctx: ModeContext;
  container: { w: number; h: number };
  zoomed: boolean;
}) {
  const data = tip.node ?? (tip.link ? (tip.link.target as LaidNode) : undefined);
  const entity: SkNodeDatum | undefined = tip.node ?? undefined;
  const link = tip.link;
  const n = entity ?? (link ? pickLinkEntity(link) : undefined);
  if (!n) return null;

  const W = 272;
  const H = 150;
  const x = Math.min(tip.x + 16, container.w - W - 8);
  const y = tip.y + 18 > container.h - H ? tip.y - H - 12 : tip.y + 18;

  const value = fmtInMode(n.value, mode, ctx);
  const share = fmtShare(n.value, ctx.refTotal);
  const pctGdp = ctx.gdp ? fmtPct((n.value / ctx.gdp) * 100) : null;
  const eq = pickEquivalences(n.value, 1)[0];
  const isSpine = n.kind === 'spine';

  return (
    <div className="viz-tooltip" style={{ transform: `translate(${x}px, ${y}px)`, width: W }}>
      <div className="tt-head">
        <span className="tt-key" style={{ background: n.kind === 'deficit' ? '#d03b3b' : n.color }} />
        <span className="tt-title">{n.label}</span>
      </div>
      <div className="tt-value">{value}</div>
      {!isSpine && (
        <div className="tt-meta">
          {n.kind === 'revenue' || n.kind === 'deficit'
            ? `${share} du total`
            : `${share} des dépenses`}
          {mode !== 'pctGdp' && pctGdp ? ` · ${pctGdp} du PIB` : ''}
        </div>
      )}
      {n.merged && n.merged.length > 0 && (
        <div className="tt-meta">
          dont {n.merged.slice(0, 2).map((m) => m.label.toLowerCase()).join(', ')}
          {n.merged.length > 2 ? '…' : ''}
        </div>
      )}
      {eq && !isSpine && <div className="tt-eq">{eq.text}</div>}
      <div className="tt-hint">
        {n.kind === 'function' && !zoomed ? 'Clic : fiche · double-clic : détailler' : 'Cliquer pour la fiche'}
      </div>
      {data ? null : null}
    </div>
  );
}

function pickLinkEntity(l: LaidLink): SkNodeDatum {
  const t = l.target as LaidNode;
  const s = l.source as LaidNode;
  return t.kind === 'spine' ? s : t;
}

/* ————— utilitaires ————— */

function linkId(l: LaidLink): string {
  return `L-${(l.source as LaidNode).id}-${(l.target as LaidNode).id}`;
}

function gradId(graphKey: string, l: LaidLink): string {
  return `g-${graphKey}-${(l.source as LaidNode).id}-${(l.target as LaidNode).id}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
