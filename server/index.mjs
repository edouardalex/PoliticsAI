/**
 * PoliticsAI — serveur du mur collaboratif.
 *
 * Volontairement minimal et auditable :
 *  - zéro dépendance npm (node:http uniquement) ;
 *  - aucune donnée personnelle stockée : pas de compte, pas de cookie,
 *    pas d'IP en base (le rate-limit est en mémoire, éphémère) ;
 *  - persistance en JSONL append-only (server/data/budgets.jsonl),
 *    rejouée au démarrage, agrégats tenus en mémoire ;
 *  - les titres des mesures inventées ne sont PAS republiés (seulement
 *    comptés) tant qu'il n'y a pas de modération.
 *
 * Lancement : node server/index.mjs   (port 8787, PORT pour changer)
 */

import http from 'node:http';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'budgets.jsonl');
const PORT = Number(process.env.PORT ?? 8787);

const MISSIONS = new Set(['maastricht', 'emploi', 'transition', 'libre']);
const SCENARIOS = new Set(['prudent', 'central', 'haut']);
const MEASURE_ID = /^[a-z][a-z0-9_]{1,29}$/;

const MAX_BODY = 16 * 1024;
const MAX_MEASURES = 40;
const RATE_LIMIT = 12; // publications / heure / IP
const RECENT_KEEP = 200;

/* ————— État en mémoire ————— */

const state = {
  total: 0,
  customTotal: 0,
  /** id mesure → { count, sumIntensity } */
  measures: new Map(),
  /** mission → { count, met } */
  missions: new Map(),
  /** buckets déficit 2029 : <3, 3-4, 4-5, 5-6, >6 */
  deficits: [0, 0, 0, 0, 0],
  /** derniers budgets (les plus récents en premier) */
  recent: [],
};

function bucketOf(deficit) {
  if (deficit <= 3) return 0;
  if (deficit <= 4) return 1;
  if (deficit <= 5) return 2;
  if (deficit <= 6) return 3;
  return 4;
}

function ingest(rec) {
  state.total += 1;
  state.customTotal += rec.customCount > 0 ? 1 : 0;
  for (const m of rec.measures) {
    const agg = state.measures.get(m.id) ?? { count: 0, sumIntensity: 0 };
    agg.count += 1;
    agg.sumIntensity += m.i;
    state.measures.set(m.id, agg);
  }
  const mi = state.missions.get(rec.mission) ?? { count: 0, met: 0 };
  mi.count += 1;
  if (rec.met === true) mi.met += 1;
  state.missions.set(rec.mission, mi);
  state.deficits[bucketOf(rec.results.deficit)] += 1;
  state.recent.unshift(rec);
  if (state.recent.length > RECENT_KEEP) state.recent.pop();
}

/* ————— Validation ————— */

function num(x, lo, hi) {
  return typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
}

/** Retourne un enregistrement propre, ou null si invalide. */
function validate(body) {
  if (!body || typeof body !== 'object') return null;
  if (!MISSIONS.has(body.mission)) return null;
  if (!SCENARIOS.has(body.scenario)) return null;
  if (!Array.isArray(body.measures) || body.measures.length > MAX_MEASURES) return null;
  const seen = new Set();
  const measures = [];
  for (const m of body.measures) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.id !== 'string' || !MEASURE_ID.test(m.id)) return null;
    if (seen.has(m.id)) continue;
    if (!num(m.i, 0, 60)) return null;
    seen.add(m.id);
    measures.push({ id: m.id, i: Math.round(m.i * 100) / 100 });
  }
  const r = body.results;
  if (
    !r ||
    !num(r.deficit, -10, 25) ||
    !num(r.debt, 40, 300) ||
    !num(r.unemp, 0, 30) ||
    !num(r.social, 0, 100)
  ) {
    return null;
  }
  if (!num(body.stars, 0, 3)) return null;
  if (!num(body.customCount, 0, 30)) return null;
  const met = body.met === true ? true : body.met === false ? false : null;

  return {
    id: crypto.randomUUID().slice(0, 8),
    created: Date.now(),
    mission: body.mission,
    scenario: body.scenario,
    stars: Math.round(body.stars),
    met,
    customCount: Math.round(body.customCount),
    measures,
    results: {
      deficit: Math.round(r.deficit * 100) / 100,
      debt: Math.round(r.debt * 10) / 10,
      unemp: Math.round(r.unemp * 100) / 100,
      social: Math.round(r.social),
    },
  };
}

/* ————— Rate-limit éphémère ————— */

const hits = new Map(); // ip → { count, resetAt }

function allowed(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  h.count += 1;
  if (hits.size > 10_000) hits.clear(); // garde-fou mémoire
  return h.count <= RATE_LIMIT;
}

/* ————— Persistance ————— */

async function load() {
  if (!existsSync(DATA_FILE)) return;
  const raw = await readFile(DATA_FILE, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  // rejoue dans l'ordre chronologique, ingest gère `recent` (unshift)
  for (const line of lines) {
    try {
      ingest(JSON.parse(line));
    } catch {
      // ligne corrompue : ignorée
    }
  }
  console.log(`↻ ${state.total} budget(s) rechargés depuis ${path.relative(process.cwd(), DATA_FILE)}`);
}

async function persist(rec) {
  await appendFile(DATA_FILE, JSON.stringify(rec) + '\n', 'utf8');
}

/* ————— Réponses ————— */

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function statsPayload() {
  const measures = [...state.measures.entries()]
    .map(([id, agg]) => ({
      id,
      count: agg.count,
      avgIntensity: Math.round((agg.sumIntensity / agg.count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const missions = [...state.missions.entries()].map(([id, mi]) => ({
    id,
    count: mi.count,
    met: mi.met,
  }));
  return {
    total: state.total,
    withCustom: state.customTotal,
    measures,
    missions,
    deficits: state.deficits,
  };
}

function recentPayload() {
  return {
    budgets: state.recent.slice(0, 20).map((r) => ({
      id: r.id,
      created: r.created,
      mission: r.mission,
      scenario: r.scenario,
      stars: r.stars,
      met: r.met,
      customCount: r.customCount,
      measures: r.measures,
      results: r.results,
    })),
  };
}

/* ————— Serveur ————— */

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') return json(res, 200, { ok: true, budgets: state.total });
  if (route === 'GET /api/stats') return json(res, 200, statsPayload());
  if (route === 'GET /api/recent') return json(res, 200, recentPayload());

  if (route === 'POST /api/budgets') {
    const ip = req.socket.remoteAddress ?? '?';
    if (!allowed(ip)) return json(res, 429, { error: 'Trop de publications — réessayez plus tard.' });

    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return json(res, 400, { error: 'JSON invalide' });
      }
      const rec = validate(parsed);
      if (!rec) return json(res, 422, { error: 'Budget invalide' });
      ingest(rec);
      try {
        await persist(rec);
      } catch (e) {
        console.error('persist:', e);
      }
      return json(res, 201, { ok: true, id: rec.id });
    });
    return;
  }

  return json(res, 404, { error: 'introuvable' });
});

await mkdir(DATA_DIR, { recursive: true });
await load();
server.listen(PORT, () => {
  console.log(`▲ Mur PoliticsAI sur http://localhost:${PORT} — ${state.total} budget(s)`);
});
