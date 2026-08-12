/**
 * Client du mur collaboratif.
 * L'app doit fonctionner SANS serveur (hébergement statique) :
 * détection de disponibilité avec timeout court, échecs silencieux.
 */

export interface PublishPayload {
  mission: string;
  scenario: string;
  stars: number;
  met: boolean | null;
  customCount: number;
  measures: { id: string; i: number }[];
  results: { deficit: number; debt: number; unemp: number; social: number };
}

export interface WallMeasureStat {
  id: string;
  count: number;
  avgIntensity: number;
}

export interface WallStats {
  total: number;
  withCustom: number;
  measures: WallMeasureStat[];
  missions: { id: string; count: number; met: number }[];
  deficits: number[];
}

export interface RecentBudget {
  id: string;
  created: number;
  mission: string;
  scenario: string;
  stars: number;
  met: boolean | null;
  customCount: number;
  measures: { id: string; i: number }[];
  results: { deficit: number; debt: number; unemp: number; social: number };
}

const API = '/api';

function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

let availability: Promise<boolean> | null = null;

/** Le serveur du mur est-il joignable ? (résultat mémoïsé) */
export function collabAvailable(): Promise<boolean> {
  if (!availability) {
    availability = fetch(`${API}/health`, { signal: withTimeout(2500) })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return availability;
}

export async function publishBudget(payload: PublishPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${API}/budgets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: withTimeout(5000),
    });
    if (r.ok) return { ok: true };
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  } catch {
    return { ok: false, error: 'Le mur est injoignable' };
  }
}

export async function fetchWall(): Promise<{ stats: WallStats; recent: RecentBudget[] } | null> {
  try {
    const [statsRes, recentRes] = await Promise.all([
      fetch(`${API}/stats`, { signal: withTimeout(4000) }),
      fetch(`${API}/recent`, { signal: withTimeout(4000) }),
    ]);
    if (!statsRes.ok || !recentRes.ok) return null;
    const stats = (await statsRes.json()) as WallStats;
    const recent = ((await recentRes.json()) as { budgets: RecentBudget[] }).budgets;
    return { stats, recent };
  } catch {
    return null;
  }
}
