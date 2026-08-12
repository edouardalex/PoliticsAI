import { useEffect, useMemo, useRef, useState } from 'react';
import type { Perimeter } from '../lib/data';
import { FUNCTION_INFO, REVENUE_INFO, DEFICIT_INFO } from '../content/text';
import { functionColor, REVENUE_COLOR, DEFICIT_COLOR } from '../lib/palette';
import { fmtAmount } from '../lib/format';

export interface SearchPick {
  id: string;
  parent?: string;
}

interface Item {
  id: string;
  parent?: string;
  label: string;
  sub: string;
  value: number;
  color: string;
}

interface Props {
  perimeter: Perimeter;
  open: boolean;
  onClose: () => void;
  onPick: (pick: SearchPick) => void;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default function SearchPalette({ perimeter, open, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo<Item[]>(() => {
    const items: Item[] = [];
    for (const f of perimeter.functions) {
      const info = FUNCTION_INFO[f.code];
      items.push({
        id: f.code,
        label: info?.short ?? f.label,
        sub: `Fonction · ${info?.examples ?? ''}`,
        value: f.value,
        color: functionColor(f.code),
      });
      for (const c of f.children) {
        items.push({
          id: c.code,
          parent: f.code,
          label: c.label,
          sub: `Sous-poste de ${info?.short ?? f.label}`,
          value: c.value,
          color: functionColor(f.code),
        });
      }
    }
    for (const r of perimeter.revenues) {
      const info = REVENUE_INFO[r.code];
      items.push({
        id: r.code,
        label: info?.short ?? r.label,
        sub: 'Recette',
        value: r.value,
        color: REVENUE_COLOR,
      });
    }
    if (perimeter.deficit > 0) {
      items.push({
        id: 'DEFICIT',
        label: DEFICIT_INFO.short,
        sub: 'Solde',
        value: perimeter.deficit,
        color: DEFICIT_COLOR,
      });
    }
    return items;
  }, [perimeter]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return index.filter((i) => !i.parent).slice(0, 9);
    const scored = index
      .map((item) => {
        const l = normalize(item.label);
        const s = normalize(item.sub);
        let score = -1;
        if (l.startsWith(q)) score = 3;
        else if (l.includes(q)) score = 2;
        else if (s.includes(q)) score = 1;
        return { item, score };
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || b.item.value - a.item.value);
    return scored.slice(0, 10).map((r) => r.item);
  }, [query, index]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const pick = (item: Item) => {
    onPick({ id: item.id, parent: item.parent });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="search-box"
        role="dialog"
        aria-label="Rechercher un poste du budget"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Chercher un poste : retraites, dette, TVA, hôpitaux…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && results[cursor]) {
              pick(results[cursor]);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
        />
        <ul className="search-results" role="listbox">
          {results.map((item, i) => (
            <li key={item.id}>
              <button
                role="option"
                aria-selected={i === cursor}
                className={`search-item${i === cursor ? ' active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(item)}
              >
                <span className="si-key" style={{ background: item.color }} />
                <span className="si-text">
                  <span className="si-label">{item.label}</span>
                  <span className="si-sub">{item.sub}</span>
                </span>
                <span className="si-value">{fmtAmount(item.value)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="search-empty">Aucun poste trouvé.</li>}
        </ul>
      </div>
    </div>
  );
}
