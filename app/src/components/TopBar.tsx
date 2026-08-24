import { PERIMETER_IDS, type PerimeterId, FRANCE } from '../lib/data';
import { PERIMETER_INFO, BRAND } from '../content/text';
import { MODE_LABELS, type DisplayMode } from '../lib/format';
import type { ViewId } from '../lib/urlState';

interface Props {
  perimeter: PerimeterId;
  mode: DisplayMode;
  view: ViewId;
  onPerimeter: (p: PerimeterId) => void;
  onMode: (m: DisplayMode) => void;
  onView: (v: ViewId) => void;
  onSearch: () => void;
  onShare: () => void;
  onAbout: () => void;
}

const MODES: DisplayMode[] = ['eur', 'per1000', 'pctGdp'];
const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'explore', label: 'Le flux' },
  { id: 'simu', label: 'Le simulateur' },
  { id: 'europe', label: 'L’Europe' },
  { id: 'table', label: 'Le tableau' },
  { id: 'data', label: 'Les données' },
];

export default function TopBar({
  perimeter,
  mode,
  view,
  onPerimeter,
  onMode,
  onView,
  onSearch,
  onShare,
  onAbout,
}: Props) {
  const year = FRANCE.perimeters[perimeter]?.year ?? 2024;
  return (
    <header className="topbar">
      <div className="tb-row tb-main">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">
            {BRAND.name}
            <sup className="brand-beta">{BRAND.beta}</sup>
          </span>
        </div>

        <nav className="view-tabs" aria-label="Vues">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`vt${view === v.id ? ' active' : ''}`}
              aria-current={view === v.id ? 'page' : undefined}
              onClick={() => onView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className="tb-actions">
          <button className="tb-btn" onClick={onSearch} aria-label="Rechercher un poste (Cmd+K)">
            <SearchIcon />
            <span className="tb-btn-label">Rechercher</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="tb-btn" onClick={onShare} aria-label="Copier le lien de cette vue">
            <LinkIcon />
            <span className="tb-btn-label">Partager</span>
          </button>
          <button className="tb-btn" onClick={onAbout} aria-label="Méthodologie et sources">
            <InfoIcon />
            <span className="tb-btn-label">Méthode</span>
          </button>
        </div>
      </div>

      {/* Ni le simulateur ni la banque de données ne dépendent du périmètre
          ni de l'unité d'affichage : la barre secondaire s'efface. */}
      <div
        className="tb-row tb-sub"
        style={view === 'simu' || view === 'data' ? { display: 'none' } : undefined}
      >
        <div className="perimeter-tabs" role="tablist" aria-label="Périmètre">
          {PERIMETER_IDS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={perimeter === p}
              className={`pt${perimeter === p ? ' active' : ''}`}
              onClick={() => onPerimeter(p)}
              title={PERIMETER_INFO[p].note}
            >
              {PERIMETER_INFO[p].short}
            </button>
          ))}
        </div>

        <div className="tb-sub-right">
          <div className="mode-switch" role="radiogroup" aria-label="Unité d’affichage">
            {MODES.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                className={`ms${mode === m ? ' active' : ''}`}
                onClick={() => onMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <span className="tb-vintage">Eurostat · {year}</span>
        </div>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0c0f17" stroke="#2a3145" strokeWidth="1" />
      <path d="M6 10 C 14 10, 18 8, 26 7" stroke="#3987e5" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M6 16 C 14 16, 18 16, 26 15" stroke="#d95926" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M6 22 C 14 22, 18 24, 26 24" stroke="#199e70" strokeWidth="2.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
