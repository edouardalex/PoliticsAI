import { useEffect, useMemo, useState } from 'react';
import {
  loadCommuneIndex,
  loadDepartement,
  searchCommunes,
  type CommuneIndex,
  type CommuneRow,
} from '../lib/deep';

/* Le plus petit niveau que le lecteur peut se réapproprier n'est pas un compte
   comptable : c'est sa commune, en euros par habitant, comparée à celles de sa
   taille. L'annuaire (34 869 communes) est découpé par département et n'est
   chargé qu'à la première recherche. */

const LINES: { key: string; label: string; hint?: string }[] = [
  { key: 'dt', label: 'Dépenses totales' },
  { key: 'df', label: 'dont fonctionnement' },
  { key: 'fp', label: 'dont frais de personnel' },
  { key: 'ac', label: 'dont achats et charges externes' },
  { key: 'di', label: 'dont interventions et subventions' },
  { key: 'dinv', label: 'dont investissement' },
  { key: 'eq', label: 'dont dépenses d’équipement', hint: 'Travaux, voirie, bâtiments' },
  { key: 'rt', label: 'Recettes totales' },
  { key: 'il', label: 'dont impôts locaux' },
  { key: 'dgf', label: 'dont dotation de l’État (DGF)' },
  { key: 'dette', label: 'Encours de dette' },
];

const euros = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export default function CommuneLookup() {
  const [index, setIndex] = useState<CommuneIndex | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<{ row: CommuneRow; dep: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.length >= 2 && !index) loadCommuneIndex().then(setIndex, () => {});
  }, [query, index]);

  const hits = useMemo(
    () => (index && !picked ? searchCommunes(index, query) : []),
    [index, query, picked],
  );

  async function pick(insee: string, dep: string) {
    setBusy(true);
    try {
      const file = await loadDepartement(dep);
      const row = file.communes.find((c) => c.c === insee);
      if (row) setPicked({ row, dep });
    } finally {
      setBusy(false);
    }
  }

  const median = picked && index ? index.medianeStrate[picked.row.t] : undefined;
  const perHab = picked && picked.row.p > 0 ? (picked.row.v.dt ?? 0) / picked.row.p : null;

  return (
    <div className="cl">
      <div className="cl-head">
        <h3 className="dp-block-title">Et votre commune ?</h3>
        {index && (
          <span className="cl-count">
            {index.communes.length.toLocaleString('fr-FR')} communes · exercice {index.year}
          </span>
        )}
      </div>

      <input
        className="cl-input"
        type="search"
        value={query}
        placeholder="Nom de commune ou code Insee"
        aria-label="Rechercher une commune"
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
        }}
      />

      {hits.length > 0 && (
        <ul className="cl-hits">
          {hits.map(([insee, name, dep]) => (
            <li key={insee}>
              <button onClick={() => pick(insee, dep)}>
                <span className="cl-hit-name">{name}</span>
                <span className="cl-hit-dep">
                  {index?.departements[dep] ?? dep} · {insee}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && <p className="dd-loading">Chargement du département…</p>}

      {picked && (
        <div className="cl-card">
          <div className="cl-card-head">
            <strong>{picked.row.n}</strong>
            <span>
              {euros.format(picked.row.p)} habitants ·{' '}
              {index?.departements[picked.dep] ?? picked.dep}
            </span>
          </div>

          {perHab != null && (
            <p className="cl-headline">
              <strong>{euros.format(perHab)} €</strong> de dépenses par habitant
              {median ? (
                <span className="cl-compare">
                  {' '}
                  — médiane des communes de même taille : {euros.format(median)} €
                </span>
              ) : null}
            </p>
          )}

          <ul className="cl-lines">
            {LINES.map((l) => {
              const v = picked.row.v[l.key];
              if (v == null) return null;
              const ph = picked.row.p > 0 ? v / picked.row.p : null;
              return (
                <li key={l.key} className={l.label.startsWith('dont') ? 'sub' : ''}>
                  <span className="cll-label">{l.label}</span>
                  <span className="cll-value">
                    {euros.format(v)} €{ph != null && <em> · {euros.format(ph)} €/hab</em>}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="cl-note">
            Budget principal seul (hors budgets annexes eau, assainissement, transports). La
            commune n'est qu'un des acteurs locaux : intercommunalité, département et région
            dépensent aussi sur le même territoire.
          </p>
        </div>
      )}
    </div>
  );
}
