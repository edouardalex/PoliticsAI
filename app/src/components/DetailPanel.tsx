import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REDUCED_MOTION } from '../lib/motionPrefs';
import type { Nature, Perimeter, PerimeterId } from '../lib/data';
import { getFunction, EUROPE, FRANCE } from '../lib/data';
import { fmtAmount, fmtInMode, fmtShare, fmtPct, type DisplayMode, type ModeContext } from '../lib/format';
import { pickEquivalences } from '../lib/equivalences';
import { functionColor, REVENUE_COLOR, DEFICIT_COLOR, SPINE_COLOR, SURPLUS_COLOR } from '../lib/palette';
import { FUNCTION_INFO, REVENUE_INFO, DEFICIT_INFO, SURPLUS_INFO, SPINE_INFO } from '../content/text';
import { deepViewsForNode, type AnchoredView, type DeepViewSummary } from '../lib/deep';
import DeepDive from './DeepDive';

interface Props {
  perimeter: Perimeter;
  perimeterId: PerimeterId;
  mode: DisplayMode;
  selected: string | null;
  onClose: () => void;
  onZoom: (code: string | null) => void;
  onSelect: (id: string | null) => void;
  onShare: () => void;
}

interface Entity {
  kind: 'function' | 'child' | 'revenue' | 'deficit' | 'surplus' | 'spine';
  code: string;
  label: string;
  value: number;
  color: string;
  description?: string;
  examples?: string;
  parentCode?: string;
  parentLabel?: string;
  merged?: { label: string; value: number }[];
  official?: string;
  natures?: Nature[];
}

function resolve(perimeter: Perimeter, id: string): Entity | null {
  if (id === 'SPINE') {
    return {
      kind: 'spine', code: id, label: SPINE_INFO.short, value: perimeter.expenditureTotal,
      color: SPINE_COLOR, description: SPINE_INFO.description, natures: perimeter.natures,
    };
  }
  if (id === 'DEFICIT') {
    return {
      kind: 'deficit', code: id, label: DEFICIT_INFO.short, value: perimeter.deficit,
      color: DEFICIT_COLOR, description: DEFICIT_INFO.description,
    };
  }
  if (id === 'SURPLUS') {
    return {
      kind: 'surplus', code: id, label: SURPLUS_INFO.short, value: -perimeter.deficit,
      color: SURPLUS_COLOR, description: SURPLUS_INFO.description,
    };
  }
  if (/^GF\d{2}$/.test(id)) {
    const f = getFunction(perimeter, id);
    if (!f) return null;
    const info = FUNCTION_INFO[id];
    return {
      kind: 'function', code: id, label: info?.short ?? f.label, value: f.value,
      color: functionColor(id), description: info?.description, examples: info?.examples,
      official: f.label, natures: f.natures,
    };
  }
  if (/^GF\d{2}/.test(id)) {
    const parentCode = id.slice(0, 4);
    const f = getFunction(perimeter, parentCode);
    if (!f) return null;
    const info = FUNCTION_INFO[parentCode];
    if (id.endsWith('_OTHER') || id.endsWith('_NC')) {
      const childSum = f.children.reduce((s, c) => s + c.value, 0);
      return {
        kind: 'child', code: id,
        label: id.endsWith('_NC') ? 'Non ventilé' : 'Autres sous-postes',
        value: id.endsWith('_NC') ? f.value - childSum : 0,
        color: functionColor(parentCode), parentCode, parentLabel: info?.short ?? f.label,
      };
    }
    const c = f.children.find((ch) => ch.code === id);
    if (!c) return null;
    return {
      kind: 'child', code: id, label: c.label, value: c.value,
      color: functionColor(parentCode), parentCode, parentLabel: info?.short ?? f.label,
      natures: c.natures,
    };
  }
  const r = perimeter.revenues.find((rv) => rv.code === id);
  if (r) {
    const info = REVENUE_INFO[id];
    return {
      kind: 'revenue', code: id, label: info?.short ?? r.label, value: r.value,
      color: REVENUE_COLOR, description: info?.description, official: r.label,
    };
  }
  return null;
}

export default function DetailPanel({ perimeter, perimeterId, mode, selected, onClose, onZoom, onSelect, onShare }: Props) {
  const entity = selected ? resolve(perimeter, selected) : null;
  const ctx: ModeContext = { refTotal: perimeter.expenditureTotal, gdp: perimeter.gdp };
  const [dive, setDive] = useState<DeepViewSummary | null>(null);

  const drillable =
    entity?.kind === 'spine' ||
    entity?.kind === 'function' ||
    entity?.kind === 'child' ||
    entity?.kind === 'revenue';
  const views: AnchoredView[] = drillable
    ? deepViewsForNode(perimeterId, entity.kind === 'spine' ? null : entity.code)
    : [];

  return (
    <AnimatePresence>
      {entity && (
        <motion.aside
          key={entity.code}
          className="detail-panel"
          initial={REDUCED_MOTION ? false : { x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={REDUCED_MOTION ? undefined : { x: 40, opacity: 0 }}
          transition={{ duration: REDUCED_MOTION ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          aria-label={`Fiche : ${entity.label}`}
        >
          <div className="dp-head">
            <span className="dp-chip" style={{ background: entity.color }} />
            <h2 className="dp-title">{entity.label}</h2>
            <button className="dp-close" onClick={onClose} aria-label="Fermer la fiche">
              ✕
            </button>
          </div>

          {entity.official && entity.official !== entity.label && (
            <p className="dp-official">{entity.official}</p>
          )}

          <div className="dp-figures">
            <div className="dp-amount">{fmtInMode(entity.value, mode, ctx)}</div>
            {entity.kind !== 'spine' && (
              <div className="dp-sub">
                {fmtShare(entity.value, perimeter.expenditureTotal)}{' '}
                {entity.kind === 'revenue' || entity.kind === 'deficit' ? 'du total' : 'des dépenses'}
                {perimeter.gdp ? ` · ${fmtPct((entity.value / perimeter.gdp) * 100)} du PIB` : ''}
              </div>
            )}
          </div>

          {entity.description && <p className="dp-desc">{entity.description}</p>}
          {entity.examples && <p className="dp-examples">{entity.examples}</p>}

          {entity.kind === 'function' && <EuCompare code={entity.code} />}

          {entity.kind === 'function' && (
            <FunctionChildren
              perimeter={perimeter}
              code={entity.code}
              onExplore={() => onZoom(entity.code)}
              onPick={(childCode) => {
                onZoom(entity.code);
                // sélectionne le sous-poste après l'ouverture du zoom
                setTimeout(() => onSelect(childCode), 0);
              }}
            />
          )}

          {entity.kind === 'deficit' && <DeficitFacts perimeter={perimeter} />}

          {entity.natures && entity.natures.length > 1 && (
            <NatureBreakdown natures={entity.natures} total={entity.value} />
          )}

          {views.length > 0 && (
            <DeepEntry views={views} onOpen={setDive} />
          )}

          <Equivalences value={entity.value} />

          <div className="dp-foot">
            <button className="btn-ghost" onClick={onShare}>
              Copier le lien de cette vue
            </button>
            <p className="dp-source">
              Source : Eurostat, comptes des administrations publiques, {perimeter.year}.
            </p>
          </div>
        </motion.aside>
      )}
      {dive && entity && (
        <DeepDive
          key={dive.id}
          view={dive}
          parentLabel={entity.label}
          parentColor={entity.color}
          onClose={() => setDive(null)}
        />
      )}
    </AnimatePresence>
  );
}

/* — Décomposition par nature : la deuxième dimension, exactement additive —
   Même source, même millésime, même consolidation que le montant affiché :
   c'est la seule descente qui ne change pas de référentiel. */
function NatureBreakdown({ natures, total }: { natures: Nature[]; total: number }) {
  const max = Math.max(...natures.map((n) => Math.abs(n.value)));
  return (
    <div className="dp-block">
      <h3 className="dp-block-title">Sur quoi part cet argent</h3>
      <ul className="nat-list">
        {natures.map((n) => (
          <li key={n.code} className={n.value < 0 ? 'neg' : ''}>
            <span className="nat-label" title={n.detail}>{n.label}</span>
            <span className="nat-track">
              <span className="nat-bar" style={{ width: `${(Math.abs(n.value) / max) * 100}%` }} />
            </span>
            <span className="nat-value">
              {fmtAmount(n.value)}
              <em>{fmtShare(Math.abs(n.value), Math.abs(total))}</em>
            </span>
          </li>
        ))}
      </ul>
      <p className="dp-eq-note">
        Nature des opérations (SEC 2010). La somme reconstitue exactement le total ci-dessus.
      </p>
    </div>
  );
}

/* — Entrée vers les vues qui changent de source — */
function DeepEntry({
  views,
  onOpen,
}: {
  views: AnchoredView[];
  onOpen: (v: DeepViewSummary) => void;
}) {
  return (
    <div className="dp-block">
      <h3 className="dp-block-title">Descendre plus bas</h3>
      <ul className="deep-entry">
        {views.map(({ view: v, fromPerimeter }) => (
          <li key={v.id}>
            <button onClick={() => onOpen(v)}>
              <span className="de-title">{v.title}</span>
              {fromPerimeter && (
                <span className="de-scope">
                  Sur le périmètre « {FRANCE.perimeters[fromPerimeter].label} »
                </span>
              )}
              <span className="de-meta">
                {v.sourceName.split('(')[0].trim()} · {v.year} ·{' '}
                {v.nodeCount.toLocaleString('fr-FR')} lignes
                {v.coverage != null &&
                  ` · ${Math.round(v.coverage * 100)} % de ${fromPerimeter ? 'ce périmètre' : 'cette ligne'}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="dp-eq-note">
        Ces vues viennent d'une autre comptabilité que celle du diagramme : les totaux ne
        coïncident pas, et c'est normal.
      </p>
    </div>
  );
}

/* — Mini-comparaison européenne (fonctions niveau 1 uniquement) — */
function EuCompare({ code }: { code: string }) {
  const peers = ['FR', 'DE', 'IT', 'ES', 'EU27_2020'];
  const rows = peers
    .map((geo) => EUROPE.countries.find((c) => c.geo === geo))
    .filter((c): c is NonNullable<typeof c> => !!c && c.functions[code] != null)
    .map((c) => ({ geo: c.geo, label: c.label, v: c.functions[code] }));
  if (rows.length < 2) return null;
  const max = Math.max(...rows.map((r) => r.v));
  return (
    <div className="dp-block">
      <h3 className="dp-block-title">En % du PIB, en Europe</h3>
      <div className="eu-mini">
        {rows.map((r) => (
          <div className="eu-mini-row" key={r.geo}>
            <span className={`emr-label${r.geo === 'FR' ? ' fr' : ''}`}>{r.label}</span>
            <span className="emr-track">
              <span
                className={`emr-bar${r.geo === 'FR' ? ' fr' : ''}`}
                style={{ width: `${(r.v / max) * 100}%`, background: r.geo === 'FR' ? functionColor(code) : undefined }}
              />
            </span>
            <span className="emr-value">{fmtPct(r.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* — Sous-postes d'une fonction — */
function FunctionChildren({
  perimeter,
  code,
  onExplore,
  onPick,
}: {
  perimeter: Perimeter;
  code: string;
  onExplore: () => void;
  onPick: (code: string) => void;
}) {
  const f = getFunction(perimeter, code);
  if (!f || f.children.length === 0) return null;
  const top = f.children.slice(0, 5);
  return (
    <div className="dp-block">
      <div className="dp-block-head">
        <h3 className="dp-block-title">Ce que ça contient</h3>
        <button className="btn-link" onClick={onExplore}>
          Détailler dans le flux →
        </button>
      </div>
      <ul className="dp-children">
        {top.map((c) => (
          <li key={c.code}>
            <button onClick={() => onPick(c.code)}>
              <span className="dpc-label">{c.label}</span>
              <span className="dpc-value">{fmtAmount(c.value)}</span>
            </button>
          </li>
        ))}
        {f.children.length > top.length && (
          <li className="dpc-more">+ {f.children.length - top.length} autres sous-postes</li>
        )}
      </ul>
    </div>
  );
}

/* — Repères du déficit — */
function DeficitFacts({ perimeter }: { perimeter: Perimeter }) {
  const debtService = getFunction(perimeter, 'GF01')?.children.find((c) => c.code === 'GF0107');
  return (
    <div className="dp-block">
      <h3 className="dp-block-title">Repères</h3>
      <ul className="dp-facts">
        <li>
          <span>Emprunté cette année</span>
          <strong>{fmtAmount(perimeter.deficit)}</strong>
        </li>
        {perimeter.gdp && (
          <li>
            <span>Soit, en part du PIB</span>
            <strong>{fmtPct((perimeter.deficit / perimeter.gdp) * 100)}</strong>
          </li>
        )}
        {debtService && (
          <li>
            <span>Intérêts payés sur la dette (côté dépenses)</span>
            <strong>{fmtAmount(debtService.value)}</strong>
          </li>
        )}
      </ul>
    </div>
  );
}

/* — Équivalences concrètes — */
function Equivalences({ value }: { value: number }) {
  const eqs = pickEquivalences(value, 3);
  if (eqs.length === 0) return null;
  return (
    <div className="dp-block">
      <h3 className="dp-block-title">Pour se représenter ce montant</h3>
      <ul className="dp-eqs">
        {eqs.map((e) => (
          <li key={e.anchor.id}>{e.text}</li>
        ))}
      </ul>
      <p className="dp-eq-note">Ordres de grandeur indicatifs — sources dans la méthodologie.</p>
    </div>
  );
}
