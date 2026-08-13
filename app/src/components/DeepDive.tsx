import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { REDUCED_MOTION } from '../lib/motionPrefs';
import {
  BASIS_LABEL,
  MAPPING_NOTE,
  downloadCsv,
  loadDeepView,
  type DeepNode,
  type DeepView,
  type DeepViewSummary,
} from '../lib/deep';
import { fmtAmount, fmtPct } from '../lib/format';
import CommuneLookup from './CommuneLookup';

interface Props {
  view: DeepViewSummary;
  /** Ce qu'on quittait : nœud COFOG d'origine. */
  parentLabel: string;
  parentColor: string;
  onClose: () => void;
}

/**
 * Vue de zoom. Le point important n'est pas l'arbre : c'est le bandeau de
 * passage de relais. On change de source, donc de comptabilité, donc de
 * périmètre — et on le dit avant de montrer le moindre chiffre.
 */
export default function DeepDive({ view: summary, parentLabel, parentColor, onClose }: Props) {
  const [view, setView] = useState<DeepView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadDeepView(summary.id).then(
      (v) => alive && setView(v),
      (e) => alive && setError(String(e)),
    );
    return () => {
      alive = false;
    };
  }, [summary.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="dd-scrim"
      initial={REDUCED_MOTION ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={REDUCED_MOTION ? undefined : { opacity: 0 }}
      transition={{ duration: REDUCED_MOTION ? 0 : 0.18 }}
      onClick={onClose}
    >
      <motion.section
        className="dd-panel"
        role="dialog"
        aria-label={summary.title}
        initial={REDUCED_MOTION ? false : { y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={REDUCED_MOTION ? undefined : { y: 18, opacity: 0 }}
        transition={{ duration: REDUCED_MOTION ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dd-head">
          <div>
            <p className="dd-kicker">
              <span className="dd-chip" style={{ background: parentColor }} />
              {parentLabel}
            </p>
            <h2 className="dd-title">{summary.title}</h2>
            <p className="dd-subtitle">{summary.subtitle}</p>
          </div>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        <Relay summary={summary} view={view} />

        {error && <p className="dd-error">Cette vue n'a pas pu être chargée.</p>}
        {!view && !error && <p className="dd-loading">Chargement…</p>}

        {view && (
          <>
            {view.anchor === 'S1313' && <CommuneLookup />}
            <Tree view={view} />
            <Footer view={view} />
          </>
        )}
      </motion.section>
    </motion.div>
  );
}

/* — Bandeau de passage de relais — */
function Relay({ summary, view }: { summary: DeepViewSummary; view: DeepView | null }) {
  const cov = summary.coverage;
  const over = cov != null && cov > 1;
  return (
    <div className="dd-relay">
      <div className="dd-relay-line">
        <span className="dd-basis dd-basis-from">Comptabilité nationale</span>
        <span className="dd-arrow" aria-hidden="true">
          →
        </span>
        <span className="dd-basis dd-basis-to">{BASIS_LABEL[summary.basis]}</span>
        <span className="dd-year">{summary.year}</span>
        <span className={`dd-mapping dd-mapping-${summary.mapping}`}>{summary.mapping}</span>
      </div>

      {cov == null ? (
        <p className="dd-coverage-none">
          Périmètre différent : ces montants ne sont pas une part de la ligne parente, mais un
          ordre de grandeur à mettre en regard.{' '}
          {summary.parentAmount != null && (
            <>
              Cette vue totalise <strong>{fmtAmount(summary.amount)}</strong> ; la ligne parente
              vaut {fmtAmount(summary.parentAmount)}. Les deux ne se recouvrent pas.
            </>
          )}
        </p>
      ) : (
        <div className="dd-coverage">
          <div className="dd-cov-track">
            <div
              className={`dd-cov-bar${over ? ' over' : ''}`}
              style={{ width: `${Math.min(cov, 1) * 100}%` }}
            />
          </div>
          <p className="dd-cov-text">
            {over ? (
              <>
                Cette vue <strong>dépasse</strong> la ligne parente ({fmtPct(cov * 100, 0)}) : les
                deux périmètres ne coïncident pas.
              </>
            ) : (
              <>
                Cette vue détaille <strong>{fmtPct(cov * 100, 0)}</strong> de la ligne parente —{' '}
                {fmtAmount(summary.amount)} sur {fmtAmount(summary.parentAmount ?? 0)}.
              </>
            )}
          </p>
        </div>
      )}

      {view?.parentLabel && (
        <p className="dd-scope">Rapporté à : {view.parentLabel}.</p>
      )}
      {view?.perimeterNote && <p className="dd-perimeter">{view.perimeterNote}</p>}
      {view && <p className="dd-mapping-note">{MAPPING_NOTE[view.mapping]}</p>}
    </div>
  );
}

/* — Arbre — */
function Tree({ view }: { view: DeepView }) {
  const rest = useMemo(() => {
    if (view.coverage == null || !view.parentAmount) return null;
    const gap = view.parentAmount - view.amount;
    return gap > view.parentAmount * 0.005 ? gap : null;
  }, [view]);

  return (
    <div className="dd-tree" role="tree">
      {view.nodes.map((n) => (
        <Row key={n.id} node={n} total={view.amount} depth={0} />
      ))}
      {rest != null && (
        <div className="dd-rest">
          <span className="dd-rest-label">Non détaillé par cette source</span>
          <span className="dd-rest-value">{fmtAmount(rest)}</span>
        </div>
      )}
    </div>
  );
}

function Row({ node, total, depth }: { node: DeepNode; total: number; depth: number }) {
  const [open, setOpen] = useState(false);
  const kids = node.children ?? [];
  const share = total > 0 ? (node.amount / total) * 100 : 0;

  return (
    <div className="dd-row-wrap" style={{ ['--depth' as string]: depth }}>
      <div className={`dd-row${kids.length ? ' has-kids' : ''}`} role="treeitem" aria-expanded={kids.length ? open : undefined}>
        <button
          className="dd-row-main"
          onClick={() => kids.length && setOpen((o) => !o)}
          disabled={!kids.length}
        >
          <span className="dd-caret" aria-hidden="true">
            {kids.length ? (open ? '▾' : '▸') : ''}
          </span>
          <span className="dd-label">
            {node.label}
            {node.confidence && node.confidence !== 'haute' && (
              <span className={`dd-conf dd-conf-${node.confidence}`} title={node.confidenceLabel}>
                {node.confidence === 'basse' ? 'rattachement conventionnel' : 'programme composite'}
              </span>
            )}
          </span>
          <span className="dd-bar-track" aria-hidden="true">
            <span className="dd-bar" style={{ width: `${Math.min(Math.abs(share), 100)}%` }} />
          </span>
          <span className="dd-value">{fmtAmount(node.amount)}</span>
        </button>
        {(node.unitCost || node.detail || node.meansTested) && (
          <p className="dd-row-note">
            {node.meansTested && node.meansTested.amount > 0.5 && (
              <span className="dd-means">
                {fmtPct(node.meansTested.share * 100, 0)} sous conditions de ressources (
                {fmtAmount(node.meansTested.amount)})
              </span>
            )}
            {node.unitCost && (
              <span className="dd-unit">
                {new Intl.NumberFormat('fr-FR').format(node.unitCost.amount)} € par{' '}
                {node.unitCost.per} ·{' '}
                {new Intl.NumberFormat('fr-FR').format(node.unitCost.count)} personnes concernées
              </span>
            )}
            {node.detail && <span className="dd-detail">{node.detail}</span>}
          </p>
        )}
      </div>
      {open && kids.length > 0 && (
        <div className="dd-kids">
          {kids.map((k) => (
            <Row key={k.id} node={k} total={node.amount} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* — Réserves et source — */
function Footer({ view }: { view: DeepView }) {
  return (
    <div className="dd-foot">
      {view.caveats.length > 0 && (
        <>
          <h3 className="dp-block-title">Ce qu'il faut savoir avant de citer ces chiffres</h3>
          <ul className="dd-caveats">
            {view.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
      <h3 className="dp-block-title">Vérifier ces chiffres</h3>
      <p className="dd-source">
        Source : {view.source.name}.{' '}
        <a href={view.source.url} target="_blank" rel="noreferrer">
          {view.source.dataset}
        </a>{' '}
        — extraction du {view.extracted}.{' '}
        {view.sourceRows != null && (
          <>{view.sourceRows.toLocaleString('fr-FR')} lignes lues à la source, </>
        )}
        {view.nodeCount.toLocaleString('fr-FR')} publiées sur {view.depth} niveaux.
      </p>

      {view.source.queries.length > 0 && (
        <ul className="dd-queries">
          {view.source.queries.slice(0, 4).map((q) => (
            <li key={q}>
              <a href={q} target="_blank" rel="noreferrer">
                Rejouer la requête source
              </a>
              <code>{q.replace(/^https?:\/\//, '').slice(0, 96)}</code>
            </li>
          ))}
          {view.source.queries.length > 4 && (
            <li className="dd-queries-more">
              + {view.source.queries.length - 4} autres requêtes (voir le manifeste du dépôt)
            </li>
          )}
        </ul>
      )}

      <div className="dd-audit">
        <button className="btn-ghost" onClick={() => downloadCsv(view)}>
          Télécharger cette vue (CSV)
        </button>
        <span className="dd-fingerprint" title="SHA-256 de l'arbre publié">
          empreinte {view.fingerprint.slice(0, 16)}…
        </span>
      </div>
    </div>
  );
}
