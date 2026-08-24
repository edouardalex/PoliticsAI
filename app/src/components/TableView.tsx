import { useCallback, useMemo, useState } from 'react';
import type { Perimeter } from '../lib/data';
import { FUNCTION_INFO, REVENUE_INFO } from '../content/text';
import { FUNCTION_COLORS, REVENUE_COLOR, DEFICIT_COLOR } from '../lib/palette';
import { fmtAmount, fmtPct } from '../lib/format';
import {
  BASIS_LABEL,
  deepViewsForNode,
  loadDeepView,
  type AnchoredView,
  type DeepNode,
  type DeepView,
} from '../lib/deep';

interface Props {
  perimeter: Perimeter;
  perimeterId: string;
}

/* Le tableau est l'écran de la vérification : tout ce que l'application sait
   doit pouvoir s'y déplier et s'en exporter. Les vues de zoom sont chargées à
   la demande, ligne par ligne, et l'export emporte celles qui l'ont été. */

const PERIMETER_LABEL: Record<string, string> = {
  S1311: "de l'État",
  S1314: 'de la sécurité sociale',
  S1313: 'des collectivités',
};

export default function TableView({ perimeter, perimeterId }: Props) {
  const total = perimeter.expenditureTotal;
  const gdp = perimeter.gdp;

  // Vues chargées, conservées pour l'export : id de vue → arbre complet.
  const [loaded, setLoaded] = useState<Map<string, DeepView>>(new Map());
  // Ligne dépliée → identifiant de la vue affichée.
  const [openRow, setOpenRow] = useState<Map<string, string>>(new Map());

  const openView = useCallback((rowKey: string, viewId: string | null) => {
    setOpenRow((prev) => {
      const next = new Map(prev);
      if (viewId === null) next.delete(rowKey);
      else next.set(rowKey, viewId);
      return next;
    });
    if (!viewId) return;
    setLoaded((prev) => {
      if (prev.has(viewId)) return prev;
      loadDeepView(viewId)
        .then((v) => setLoaded((m) => (m.has(viewId) ? m : new Map(m).set(viewId, v))))
        .catch(() => undefined);
      return prev;
    });
  }, []);

  const downloadCsv = () => {
    const pct = (v: number) => ((v / total) * 100).toFixed(2).replace('.', ',');
    const pib = (v: number) => (gdp ? ((v / gdp) * 100).toFixed(2).replace('.', ',') : '');
    const num = (v: number) => v.toFixed(2).replace('.', ',');

    const head: string[] = [
      `# PoliticsAI — ${perimeter.label}, ${perimeter.year}. Montants en millions d'euros.`,
      '# Les lignes « depense » et « recette » viennent de la comptabilité nationale (Eurostat/Insee).',
    ];
    const views = [...loaded.values()];
    if (views.length) {
      head.push(
        `# ${views.length} vue(s) de zoom dépliée(s) : chacune change de référentiel comptable,`,
        '# ses montants ne s\'additionnent donc pas à ceux du tableau principal.',
      );
      for (const v of views) {
        head.push(
          `#   [${v.id}] ${v.title} — ${BASIS_LABEL[v.basis]}, ${v.year} — ${v.source.name}`,
          ...v.source.queries.map((q) => `#      requête : ${q}`),
          `#      extraction ${v.extracted} · empreinte ${v.fingerprint}`,
        );
      }
    } else {
      head.push(
        "# Aucune vue de zoom n'était dépliée : dépliez des lignes avant d'exporter",
        '# pour emporter le détail sous-jacent.',
      );
    }

    const lines = [
      ...head,
      [
        'type', 'niveau', 'chemin', 'code', 'poste', 'montant_meur',
        'part_depenses_pct', 'part_pib_pct', 'referentiel', 'millesime',
        'source', 'vue',
      ].join(';'),
    ];

    const base = (t: string, lvl: number, code: string, label: string, v: number) =>
      [t, lvl, '', code, csv(label), num(v), pct(v), pib(v),
       'Comptabilité nationale (SEC 2010)', perimeter.year,
       'Eurostat / Insee', ''].join(';');

    for (const f of perimeter.functions) {
      lines.push(base('depense', 1, f.code, f.label, f.value));
      for (const c of f.children) lines.push(base('depense_detail', 2, c.code, c.label, c.value));
    }
    for (const r of perimeter.revenues) lines.push(base('recette', 1, r.code, r.label, r.value));
    lines.push(base('solde', 1, 'DEFICIT', 'Déficit (dépenses − recettes)', perimeter.deficit));

    for (const v of views) {
      const walk = (nodes: DeepNode[], path: string[], depth: number) => {
        for (const n of nodes) {
          lines.push(
            ['zoom', depth + 3, csv(path.join(' > ')), csv(n.id), csv(n.label),
             num(n.amount), '', '', csv(BASIS_LABEL[v.basis]), v.year,
             csv(v.source.name), csv(v.id)].join(';'),
          );
          if (n.children?.length) walk(n.children, [...path, n.label], depth + 1);
        }
      };
      walk(v.nodes, [v.title], 0);
    }

    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `politicsai-budget-${perimeterId}-${perimeter.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deepCount = loaded.size;

  return (
    <div className="table-view">
      <div className="tv-head">
        <p className="tv-intro">
          Toutes les valeurs du diagramme, accessibles et vérifiables — {perimeter.label.toLowerCase()},{' '}
          {perimeter.year}, en millions d’euros. Les lignes marquées d’un chevron se détaillent plus
          bas, en changeant de source : le référentiel et la part expliquée sont alors affichés.
        </p>
        <button className="btn-ghost" onClick={downloadCsv}>
          Télécharger (CSV)
          {deepCount > 0 && <span className="tv-csv-badge">+ {deepCount} vue{deepCount > 1 ? 's' : ''}</span>}
        </button>
      </div>

      <div className="tv-grid">
        <section>
          <h2 className="tv-title">Dépenses — {fmtAmount(total)}</h2>
          <table className="tv-table">
            <caption className="sr-only">
              Dépenses par fonction (COFOG), avec sous-postes et vues de détail dépliables
            </caption>
            <thead>
              <tr>
                <th scope="col">Poste</th>
                <th scope="col" className="num">Montant</th>
                <th scope="col" className="num">% dép.</th>
                <th scope="col" className="num">% PIB</th>
              </tr>
            </thead>
            <tbody>
              {perimeter.functions.map((f) => (
                <FunctionRows
                  key={f.code}
                  f={f}
                  total={total}
                  gdp={gdp}
                  perimeterId={perimeterId}
                  openRow={openRow}
                  loaded={loaded}
                  onToggle={openView}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total des dépenses</th>
                <td className="num">{fmtAmount(total)}</td>
                <td className="num">100 %</td>
                <td className="num">{gdp ? fmtPct((total / gdp) * 100) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section>
          <h2 className="tv-title">Recettes — {fmtAmount(perimeter.revenueTotal)}</h2>
          <table className="tv-table">
            <caption className="sr-only">Recettes par grande catégorie</caption>
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                <th scope="col" className="num">Montant</th>
                <th scope="col" className="num">% dép.</th>
                <th scope="col" className="num">% PIB</th>
              </tr>
            </thead>
            <tbody>
              {perimeter.revenues.map((r) => (
                <ExpandableRow
                  key={r.code}
                  rowKey={`rev-${r.code}`}
                  label={REVENUE_INFO[r.code]?.short ?? r.label}
                  value={r.value}
                  total={total}
                  gdp={gdp}
                  color={REVENUE_COLOR}
                  views={deepViewsForNode(perimeterId, r.code)}
                  openRow={openRow}
                  loaded={loaded}
                  onToggle={onToggleOf(openView)}
                />
              ))}
              {perimeter.deficit > 0 && (
                <tr className="tv-deficit">
                  <th scope="row">
                    <span className="tv-dot" style={{ background: DEFICIT_COLOR }} />
                    Déficit (emprunt)
                  </th>
                  <td className="num">{fmtAmount(perimeter.deficit)}</td>
                  <td className="num">{fmtPct((perimeter.deficit / total) * 100)}</td>
                  <td className="num">{gdp ? fmtPct((perimeter.deficit / gdp) * 100) : '—'}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Recettes + emprunt</th>
                <td className="num">{fmtAmount(perimeter.revenueTotal + Math.max(0, perimeter.deficit))}</td>
                <td className="num">100 %</td>
                <td className="num">
                  {gdp ? fmtPct(((perimeter.revenueTotal + Math.max(0, perimeter.deficit)) / gdp) * 100) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </div>
  );
}

type Toggle = (rowKey: string, viewId: string | null) => void;

function onToggleOf(t: Toggle): Toggle {
  return t;
}

function FunctionRows({
  f,
  total,
  gdp,
  perimeterId,
  openRow,
  loaded,
  onToggle,
}: {
  f: Perimeter['functions'][number];
  total: number;
  gdp: number | null;
  perimeterId: string;
  openRow: Map<string, string>;
  loaded: Map<string, DeepView>;
  onToggle: Toggle;
}) {
  const info = FUNCTION_INFO[f.code];
  return (
    <>
      <ExpandableRow
        rowKey={`fn-${f.code}`}
        label={info?.short ?? f.label}
        value={f.value}
        total={total}
        gdp={gdp}
        color={FUNCTION_COLORS[f.code]}
        level={1}
        views={deepViewsForNode(perimeterId, f.code)}
        openRow={openRow}
        loaded={loaded}
        onToggle={onToggle}
      />
      {f.children.map((c) => (
        <ExpandableRow
          key={c.code}
          rowKey={`ch-${c.code}`}
          label={c.label}
          value={c.value}
          total={total}
          gdp={gdp}
          level={2}
          views={deepViewsForNode(perimeterId, c.code)}
          openRow={openRow}
          loaded={loaded}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

function ExpandableRow({
  rowKey,
  label,
  value,
  total,
  gdp,
  color,
  level = 1,
  views,
  openRow,
  loaded,
  onToggle,
}: {
  rowKey: string;
  label: string;
  value: number;
  total: number;
  gdp: number | null;
  color?: string;
  level?: number;
  views: AnchoredView[];
  openRow: Map<string, string>;
  loaded: Map<string, DeepView>;
  onToggle: Toggle;
}) {
  const openId = openRow.get(rowKey) ?? null;
  const drillable = views.length > 0;
  const view = openId ? loaded.get(openId) : undefined;
  const anchored = openId ? views.find((v) => v.view.id === openId) : undefined;

  return (
    <>
      <tr className={level === 1 ? 'tv-l1' : 'tv-l2'}>
        <th scope="row">
          {color && <span className="tv-dot" style={{ background: color }} />}
          {drillable ? (
            <button
              className={`tv-expand${openId ? ' open' : ''}`}
              aria-expanded={openId != null}
              onClick={() => onToggle(rowKey, openId ? null : views[0].view.id)}
            >
              <span className="tv-chevron" aria-hidden="true">
                ▸
              </span>
              {label}
              <span className="tv-expand-hint">
                {views.length > 1 ? `${views.length} vues` : 'détail'}
              </span>
            </button>
          ) : (
            label
          )}
        </th>
        <td className="num">{fmtAmount(value)}</td>
        <td className="num">{fmtPct((value / total) * 100)}</td>
        <td className="num">{gdp ? fmtPct((value / gdp) * 100) : '—'}</td>
      </tr>

      {openId && (
        <tr className="tv-relay-row">
          <td colSpan={4}>
            <TableRelay
              views={views}
              openId={openId}
              onPick={(id) => onToggle(rowKey, id)}
              view={view}
              fromPerimeter={anchored?.fromPerimeter ?? null}
            />
          </td>
        </tr>
      )}

      {openId && view && <DeepRows nodes={view.nodes} depth={0} viewId={openId} />}
    </>
  );
}

function TableRelay({
  views,
  openId,
  onPick,
  view,
  fromPerimeter,
}: {
  views: AnchoredView[];
  openId: string;
  onPick: (id: string) => void;
  view: DeepView | undefined;
  fromPerimeter: string | null;
}) {
  const summary = views.find((v) => v.view.id === openId)?.view;
  if (!summary) return null;
  const cov = summary.coverage;

  return (
    <div className="tv-relay">
      <p className="tv-relay-line">
        <span className="tv-basis-from">Comptabilité nationale</span>
        <span aria-hidden="true"> → </span>
        <span className="tv-basis-to">{BASIS_LABEL[summary.basis]}</span>
        <span className="tv-relay-year">{summary.year}</span>
        <span className={`tv-mapping tv-mapping-${summary.mapping}`}>{summary.mapping}</span>
      </p>
      <p className="tv-relay-note">
        {cov == null ? (
          <>
            Périmètre différent : ces montants ne sont pas une part de la ligne ci-dessus.
            Cette vue totalise {fmtAmount(summary.amount)}.
          </>
        ) : (
          <>
            Cette vue détaille {fmtPct(cov * 100, 0)} de la ligne ci-dessus —{' '}
            {fmtAmount(summary.amount)}
            {summary.parentAmount != null && <> sur {fmtAmount(summary.parentAmount)}</>}.
          </>
        )}
        {fromPerimeter && (
          <> Vue rapportée au périmètre {PERIMETER_LABEL[fromPerimeter] ?? fromPerimeter}.</>
        )}{' '}
        Source : {summary.sourceName}.
      </p>
      {views.length > 1 && (
        <p className="tv-relay-pick">
          {views.map(({ view: v }) => (
            <button
              key={v.id}
              className={`tv-pick${v.id === openId ? ' on' : ''}`}
              onClick={() => onPick(v.id)}
            >
              {v.title}
            </button>
          ))}
        </p>
      )}
      {!view && <p className="tv-relay-note">Chargement du détail…</p>}
    </div>
  );
}

/** Arbre de la vue, replié à chaque niveau : le tableau reste lisible même
 *  quand la vue compte des dizaines de milliers de lignes. */
function DeepRows({
  nodes,
  depth,
  viewId,
}: {
  nodes: DeepNode[];
  depth: number;
  viewId: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const shown = useMemo(() => nodes, [nodes]);

  return (
    <>
      {shown.map((n) => {
        const has = !!n.children?.length;
        const isOpen = open.has(n.id);
        return (
          <ExpandedNodeRows
            key={`${viewId}-${n.id}`}
            node={n}
            depth={depth}
            viewId={viewId}
            hasChildren={has}
            isOpen={isOpen}
            onToggle={() =>
              setOpen((prev) => {
                const next = new Set(prev);
                if (next.has(n.id)) next.delete(n.id);
                else next.add(n.id);
                return next;
              })
            }
          />
        );
      })}
    </>
  );
}

function ExpandedNodeRows({
  node,
  depth,
  viewId,
  hasChildren,
  isOpen,
  onToggle,
}: {
  node: DeepNode;
  depth: number;
  viewId: string;
  hasChildren: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="tv-deep" style={{ ['--deep-depth' as string]: depth }}>
        <th scope="row">
          {hasChildren ? (
            <button
              className={`tv-expand tv-expand-deep${isOpen ? ' open' : ''}`}
              aria-expanded={isOpen}
              onClick={onToggle}
            >
              <span className="tv-chevron" aria-hidden="true">
                ▸
              </span>
              {node.label}
            </button>
          ) : (
            <span className="tv-deep-leaf">{node.label}</span>
          )}
          {node.unitCost && (
            <span className="tv-unit">
              {node.unitCost.amount.toLocaleString('fr-FR')} € / {node.unitCost.per}
            </span>
          )}
          {node.meansTested && node.meansTested.amount > 0.5 && (
            <span className="tv-means">
              {fmtPct(node.meansTested.share * 100, 0)} sous conditions de ressources
            </span>
          )}
        </th>
        <td className="num">{fmtAmount(node.amount)}</td>
        <td className="num tv-na">—</td>
        <td className="num tv-na">—</td>
      </tr>
      {isOpen && hasChildren && (
        <DeepRows nodes={node.children!} depth={depth + 1} viewId={viewId} />
      )}
    </>
  );
}

function csv(s: string): string {
  return s.replace(/;/g, ',');
}
