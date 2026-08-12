import type { DisplayMode } from './format';
import type { PerimeterId } from './data';

export type ViewId = 'explore' | 'europe' | 'table';

export interface AppState {
  perimeter: PerimeterId;
  mode: DisplayMode;
  view: ViewId;
  /** nœud sélectionné (code fonction GFxx / GFxxxx, code recette, DEFICIT, SPINE) */
  selected: string | null;
  /** fonction « zoomée » (drill-down niveau 2) */
  zoom: string | null;
  /** l'intro a été vue */
  seen: boolean;
}

export const DEFAULT_STATE: AppState = {
  perimeter: 'S13',
  mode: 'eur',
  view: 'explore',
  selected: null,
  zoom: null,
  seen: false,
};

const PERIMETERS = new Set(['S13', 'S1311', 'S1314', 'S1313']);
const MODES = new Set(['eur', 'per1000', 'pctGdp']);
const VIEWS = new Set(['explore', 'europe', 'table']);

export function parseHash(hash: string): Partial<AppState> {
  const out: Partial<AppState> = {};
  const raw = hash.replace(/^#\/?/, '');
  if (!raw) return out;
  const params = new URLSearchParams(raw);
  const p = params.get('p');
  if (p && PERIMETERS.has(p)) out.perimeter = p as PerimeterId;
  const m = params.get('m');
  if (m && MODES.has(m)) out.mode = m as DisplayMode;
  const v = params.get('v');
  if (v && VIEWS.has(v)) out.view = v as ViewId;
  const sel = params.get('sel');
  if (sel && /^[A-Z0-9_]{2,12}$/.test(sel)) out.selected = sel;
  const zm = params.get('zm');
  if (zm && /^GF\d{2}$/.test(zm)) out.zoom = zm;
  if (params.has('p') || params.has('v') || params.has('sel')) out.seen = true;
  return out;
}

export function serialize(state: AppState): string {
  const params = new URLSearchParams();
  if (state.perimeter !== 'S13') params.set('p', state.perimeter);
  if (state.mode !== 'eur') params.set('m', state.mode);
  if (state.view !== 'explore') params.set('v', state.view);
  if (state.selected) params.set('sel', state.selected);
  if (state.zoom) params.set('zm', state.zoom);
  const s = params.toString();
  return s ? `#${s}` : '';
}

export function writeHash(state: AppState): void {
  const h = serialize(state);
  const url = window.location.pathname + window.location.search + h;
  window.history.replaceState(null, '', url);
}

export function shareUrl(state: AppState): string {
  return window.location.origin + window.location.pathname + serialize(state);
}
