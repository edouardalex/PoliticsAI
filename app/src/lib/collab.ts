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

/* ————— File citoyenne ————— */

export interface CitizenChiffrage {
  id: string;
  amountMd: number;
  lever: string;
  kind: string;
  sources: string[];
  note: string;
}

export interface CitizenProposal {
  id: string;
  fp: string;
  text: string;
  count: number;
  created: number;
  status: 'en_attente' | 'chiffree' | 'validee' | 'rejetee';
  chiffrages: CitizenChiffrage[];
  pendingChiffrages: number;
}

export async function submitProposal(
  text: string,
): Promise<{ ok: boolean; merged?: boolean; count?: number; error?: string }> {
  try {
    const r = await fetch(`${API}/proposals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: withTimeout(5000),
    });
    const data = (await r.json().catch(() => null)) as
      | { merged?: boolean; count?: number; error?: string }
      | null;
    if (r.ok) return { ok: true, merged: data?.merged, count: data?.count };
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  } catch {
    return { ok: false, error: 'La file est injoignable' };
  }
}

export async function fetchProposals(): Promise<CitizenProposal[] | null> {
  try {
    const r = await fetch(`${API}/proposals`, { signal: withTimeout(4000) });
    if (!r.ok) return null;
    return ((await r.json()) as { proposals: CitizenProposal[] }).proposals;
  } catch {
    return null;
  }
}

export async function submitChiffrage(input: {
  fp: string;
  amountMd: number;
  lever: string;
  kind: string;
  sources: string[];
  note: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${API}/chiffrages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: withTimeout(5000),
    });
    if (r.ok) return { ok: true };
    const data = (await r.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? `Erreur ${r.status}` };
  } catch {
    return { ok: false, error: 'La file est injoignable' };
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
