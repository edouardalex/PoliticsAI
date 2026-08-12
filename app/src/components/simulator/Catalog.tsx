import { useMemo, useState } from 'react';
import {
  MEASURES,
  CATEGORY_LABELS,
  type MeasureDef,
  type MeasureKind,
  type MeasureCategory,
} from '../../content/measures';
import { type ActiveMeasure, soldeSign } from '../../lib/simulation';

interface Props {
  active: ActiveMeasure[];
  sandbox?: boolean;
  onAdd: (m: ActiveMeasure) => void;
  onCustom: () => void;
}

type SortId = 'amount' | 'alpha' | 'social';

const KIND_FILTERS: { id: MeasureKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'depense_plus', label: 'Dépenser +' },
  { id: 'depense_moins', label: 'Dépenser −' },
  { id: 'recette_plus', label: 'Taxer +' },
  { id: 'recette_moins', label: 'Taxer −' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'amount', label: 'Montant' },
  { id: 'alpha', label: 'A → Z' },
  { id: 'social', label: 'Réception sociale' },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export default function Catalog({ active, sandbox, onAdd, onCustom }: Props) {
  const [kind, setKind] = useState<MeasureKind | 'all'>('all');
  const [category, setCategory] = useState<MeasureCategory | 'all'>('all');
  const [sort, setSort] = useState<SortId>('amount');
  const [query, setQuery] = useState('');
  const activeIds = useMemo(() => new Set(active.map((m) => m.def.id)), [active]);

  /** catégories réellement présentes, triées par libellé */
  const categories = useMemo(() => {
    const present = new Set(MEASURES.map((m) => m.category));
    return (Object.keys(CATEGORY_LABELS) as MeasureCategory[])
      .filter((c) => present.has(c))
      .sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'fr'));
  }, []);

  const list = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = MEASURES.filter((m) => {
      if (kind !== 'all' && m.kind !== kind) return false;
      if (category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return (
        normalize(m.title).includes(q) ||
        normalize(m.desc).includes(q) ||
        normalize(m.incidence).includes(q) ||
        normalize(CATEGORY_LABELS[m.category]).includes(q)
      );
    });
    const amountOf = (m: MeasureDef) => (m.param ? m.param.default * m.param.perUnit : m.amount);
    switch (sort) {
      case 'alpha':
        return filtered.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      case 'social':
        return filtered.sort((a, b) => b.social - a.social || amountOf(b) - amountOf(a));
      default:
        return filtered.sort((a, b) => amountOf(b) - amountOf(a));
    }
  }, [kind, category, sort, query]);

  const add = (def: MeasureDef) => {
    onAdd({ uid: def.id, def, intensity: def.param?.default ?? 1 });
  };

  return (
    <aside className="simu-catalog">
      <div className="cat-head">
        <h2 className="cat-title">
          Les mesures <span className="cat-total">{MEASURES.length}</span>
        </h2>
        <button className="btn-invent" onClick={onCustom}>
          {sandbox ? '+ Atelier' : '+ Inventer la mienne'}
        </button>
      </div>
      <input
        className="cat-search"
        placeholder="Chercher : retraite, TVA, hôpital, climat…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="cat-kinds" role="group" aria-label="Filtrer par type">
        {KIND_FILTERS.map((k) => (
          <button
            key={k.id}
            className={`chip small${kind === k.id ? ' active' : ''}`}
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="cat-selects">
        <select
          className="cat-select"
          value={category}
          onChange={(e) => setCategory(e.target.value as MeasureCategory | 'all')}
          aria-label="Filtrer par domaine"
        >
          <option value="all">Tous les domaines</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          className="cat-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          aria-label="Trier"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Tri : {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="cat-count" aria-live="polite">
        {list.length} mesure{list.length > 1 ? 's' : ''}
        {list.length !== MEASURES.length ? ` sur ${MEASURES.length}` : ''}
      </p>

      <div className="cat-list">
        {list.map((def) => {
          const added = activeIds.has(def.id);
          const gain = soldeSign(def) > 0;
          const amount = def.param ? def.param.default * def.param.perUnit : def.amount;
          return (
            <button
              key={def.id}
              className={`m-card${added ? ' added' : ''}`}
              onClick={() => !added && add(def)}
              disabled={added}
              aria-label={`${def.title} — ${gain ? 'rapporte' : 'coûte'} ${nf1.format(amount)} milliards d'euros par an${added ? ' (déjà au projet de loi)' : ''}`}
            >
              <span className="mc-top">
                <span className="mc-cat">{CATEGORY_LABELS[def.category]}</span>
                {def.social <= -2 && (
                  <span className="mc-flag" title="Mesure socialement sensible (jauge de jeu)">
                    <BoltIcon /> sensible
                  </span>
                )}
                {(def.directJobs ?? 0) !== 0 && (
                  <span className="mc-jobs">
                    {def.directJobs! > 0 ? '+' : '−'}
                    {Math.abs(def.directJobs!) >= 1000
                      ? `${Math.round(Math.abs(def.directJobs!) / 1000)} k postes`
                      : `${Math.abs(def.directJobs!)} postes`}
                  </span>
                )}
              </span>
              <span className="mc-title">{def.title}</span>
              <span className="mc-desc">{def.desc}</span>
              <span className="mc-foot">
                <span className={`mc-amount ${gain ? 'gain' : 'cost'}`}>
                  {gain ? '+' : '−'}
                  {nf1.format(amount)} Md€/an
                  {def.param ? ` (${def.param.default} ${def.param.unit})` : ''}
                </span>
                <span className="mc-add">{added ? 'Au projet ✓' : 'Ajouter +'}</span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="cat-empty">
            Aucune mesure ne correspond.{' '}
            <button className="btn-link" onClick={onCustom}>
              Inventez la vôtre
            </button>
            .
          </p>
        )}
      </div>
    </aside>
  );
}

function BoltIcon() {
  return (
    <svg width="9" height="11" viewBox="0 0 10 12" fill="none" aria-hidden>
      <path d="M5.8 0.5 1 7h3l-0.8 4.5L8.5 5h-3l0.3-4.5z" fill="currentColor" />
    </svg>
  );
}
