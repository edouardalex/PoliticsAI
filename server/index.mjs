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
const PROPOSALS_FILE = path.join(DATA_DIR, 'proposals.jsonl');
const PORT = Number(process.env.PORT ?? 8787);

/** Jeton de modération : `PAI_ADMIN_TOKEN=… node server/index.mjs`.
 *  Sans jeton, aucune validation n'est possible — rien ne peut être publié. */
const ADMIN_TOKEN = process.env.PAI_ADMIN_TOKEN ?? '';

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
  /** file citoyenne : empreinte du texte → proposition */
  proposals: new Map(),
};

/* ————— File citoyenne ————— */

/** Mots vides ignorés dans l'empreinte : « 500 € » et « 500 euros » doivent se rejoindre. */
const FP_STOP = new Set(
  ('les des une aux par pour dans avec sans plus moins euro euros eur euros€ ' +
    'faut faudrait doit devrait que qui est sont cette ces son ses leur leurs ' +
    'notre nos votre vos mettre passer faire tout tous toute toutes etre avoir ' +
    'instaurer creer mois annee annees par an').split(' '),
);

/** Empreinte permettant de regrouper les propositions équivalentes. */
function fingerprint(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/€/g, ' euros ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FP_STOP.has(w))
    .sort()
    .join(' ')
    .slice(0, 160);
}

function ingestProposal(rec) {
  const existing = state.proposals.get(rec.fp);
  if (!existing) {
    state.proposals.set(rec.fp, { ...rec, count: 1, chiffrages: rec.chiffrages ?? [] });
    return;
  }
  // même demande : on incrémente et on garde la formulation la plus ancienne
  existing.count += 1;
  existing.updated = rec.created;
  if (rec.chiffrages?.length) existing.chiffrages.push(...rec.chiffrages);
}

function ingestChiffrage(fp, ch) {
  const p = state.proposals.get(fp);
  if (!p) return false;
  p.chiffrages.push(ch);
  return true;
}

function setProposalStatus(fp, status) {
  const p = state.proposals.get(fp);
  if (!p) return false;
  p.status = status;
  return true;
}

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

/** Valide une proposition citoyenne (texte libre). */
function validateProposal(body) {
  if (!body || typeof body !== 'object') return null;
  const text = typeof body.text === 'string' ? body.text.trim().replace(/\s+/g, ' ') : '';
  if (text.length < 6 || text.length > 180) return null;
  // pas de lien : la file est une boîte à idées, pas un canal de diffusion
  if (/https?:\/\/|www\.|@[a-z0-9]/i.test(text)) return null;
  const fp = fingerprint(text);
  if (fp.length < 4) return null;
  return {
    fp,
    id: crypto.randomUUID().slice(0, 8),
    created: Date.now(),
    text,
    /** en_attente → chiffree (au moins un chiffrage) → validee (modération) */
    status: 'en_attente',
    chiffrages: [],
  };
}

/** Valide un chiffrage proposé par un contributeur — sources OBLIGATOIRES. */
function validateChiffrage(body) {
  if (!body || typeof body !== 'object') return null;
  const fp = typeof body.fp === 'string' ? body.fp.slice(0, 160) : '';
  if (!fp) return null;
  const amount = Number(body.amountMd);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 200) return null;
  const LEVERS = new Set([
    'invest_public', 'social_cible', 'fonctionnement', 'tax_menages',
    'tax_menages_aises', 'tax_entreprises', 'tax_conso', 'cotisations',
  ]);
  if (!LEVERS.has(body.lever)) return null;
  if (!['depense_plus', 'depense_moins', 'recette_plus', 'recette_moins'].includes(body.kind)) return null;
  const sources = Array.isArray(body.sources)
    ? body.sources.map((s) => String(s).trim().slice(0, 240)).filter((s) => s.length > 8)
    : [];
  if (sources.length === 0) return null; // pas de source, pas de chiffrage
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 400) : '';
  return {
    fp,
    id: crypto.randomUUID().slice(0, 8),
    created: Date.now(),
    amountMd: Math.round(amount * 100) / 100,
    lever: body.lever,
    kind: body.kind,
    sources,
    note,
    validated: false,
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
  if (existsSync(DATA_FILE)) {
    const raw = await readFile(DATA_FILE, 'utf8');
    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        ingest(JSON.parse(line));
      } catch {
        // ligne corrompue : ignorée
      }
    }
    console.log(`↻ ${state.total} budget(s) rechargés`);
  }
  if (existsSync(PROPOSALS_FILE)) {
    const raw = await readFile(PROPOSALS_FILE, 'utf8');
    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        const e = JSON.parse(line);
        if (e.type === 'proposal') ingestProposal(e.rec);
        else if (e.type === 'chiffrage') ingestChiffrage(e.rec.fp, e.rec);
        else if (e.type === 'status') setProposalStatus(e.fp, e.status);
        else if (e.type === 'validate') {
          const p = state.proposals.get(e.fp);
          const ch = p?.chiffrages.find((c) => c.id === e.chiffrageId);
          if (ch) ch.validated = true;
        }
      } catch {
        // ligne corrompue : ignorée
      }
    }
    console.log(`↻ ${state.proposals.size} proposition(s) citoyenne(s) rechargée(s)`);
  }
}

async function persist(rec) {
  await appendFile(DATA_FILE, JSON.stringify(rec) + '\n', 'utf8');
}

async function persistProposalEvent(event) {
  await appendFile(PROPOSALS_FILE, JSON.stringify(event) + '\n', 'utf8');
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

function proposalsPayload() {
  const list = [...state.proposals.values()]
    .map((p) => ({
      id: p.id,
      fp: p.fp,
      text: p.text,
      count: p.count,
      created: p.created,
      status: p.status,
      // seuls les chiffrages VALIDÉS sont republiés ; les autres sont comptés
      chiffrages: p.chiffrages.filter((c) => c.validated).map((c) => ({
        id: c.id,
        amountMd: c.amountMd,
        lever: c.lever,
        kind: c.kind,
        sources: c.sources,
        note: c.note,
      })),
      pendingChiffrages: p.chiffrages.filter((c) => !c.validated).length,
    }))
    .sort((a, b) => b.count - a.count || b.created - a.created)
    .slice(0, 60);
  return { total: state.proposals.size, proposals: list };
}

/* ————— Corps de requête ————— */

function readBody(req, res, handler) {
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
    await handler(parsed);
  });
}

/* ————— Serveur ————— */

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${url.pathname}`;
  const ip = req.socket.remoteAddress ?? '?';

  if (route === 'GET /api/health') {
    return json(res, 200, { ok: true, budgets: state.total, proposals: state.proposals.size });
  }
  if (route === 'GET /api/stats') return json(res, 200, statsPayload());
  if (route === 'GET /api/recent') return json(res, 200, recentPayload());
  if (route === 'GET /api/proposals') return json(res, 200, proposalsPayload());

  /* — file citoyenne : déposer une proposition — */
  if (route === 'POST /api/proposals') {
    if (!allowed(ip)) return json(res, 429, { error: 'Trop de propositions — réessayez plus tard.' });
    return readBody(req, res, async (body) => {
      const rec = validateProposal(body);
      if (!rec) {
        return json(res, 422, {
          error: 'Proposition invalide (6 à 180 caractères, sans lien).',
        });
      }
      const known = state.proposals.get(rec.fp);
      ingestProposal(rec);
      await persistProposalEvent({ type: 'proposal', rec }).catch((e) => console.error(e));
      return json(res, 201, {
        ok: true,
        merged: !!known,
        count: state.proposals.get(rec.fp).count,
      });
    });
  }

  /* — proposer un chiffrage (sources obligatoires) — */
  if (route === 'POST /api/chiffrages') {
    if (!allowed(ip)) return json(res, 429, { error: 'Trop de contributions — réessayez plus tard.' });
    return readBody(req, res, async (body) => {
      const rec = validateChiffrage(body);
      if (!rec) {
        return json(res, 422, {
          error: 'Chiffrage invalide : montant, levier, sens et au moins une source sont requis.',
        });
      }
      if (!ingestChiffrage(rec.fp, rec)) return json(res, 404, { error: 'Proposition introuvable' });
      setProposalStatus(rec.fp, 'chiffree');
      await persistProposalEvent({ type: 'chiffrage', rec }).catch((e) => console.error(e));
      await persistProposalEvent({ type: 'status', fp: rec.fp, status: 'chiffree' }).catch(() => {});
      return json(res, 201, { ok: true, id: rec.id });
    });
  }

  /* — modération : valider un chiffrage (jeton requis) — */
  if (route === 'POST /api/moderate') {
    if (!ADMIN_TOKEN) return json(res, 503, { error: 'Modération non configurée sur ce serveur.' });
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) return json(res, 401, { error: 'Jeton invalide' });
    return readBody(req, res, async (body) => {
      const { fp, chiffrageId, status } = body ?? {};
      const p = typeof fp === 'string' ? state.proposals.get(fp) : null;
      if (!p) return json(res, 404, { error: 'Proposition introuvable' });
      if (chiffrageId) {
        const ch = p.chiffrages.find((c) => c.id === chiffrageId);
        if (!ch) return json(res, 404, { error: 'Chiffrage introuvable' });
        ch.validated = true;
        setProposalStatus(fp, 'validee');
        await persistProposalEvent({ type: 'validate', fp, chiffrageId }).catch(() => {});
        await persistProposalEvent({ type: 'status', fp, status: 'validee' }).catch(() => {});
        return json(res, 200, { ok: true });
      }
      if (['en_attente', 'chiffree', 'validee', 'rejetee'].includes(status)) {
        setProposalStatus(fp, status);
        await persistProposalEvent({ type: 'status', fp, status }).catch(() => {});
        return json(res, 200, { ok: true });
      }
      return json(res, 422, { error: 'Requête de modération invalide' });
    });
  }

  if (route === 'POST /api/budgets') {
    if (!allowed(ip)) return json(res, 429, { error: 'Trop de publications — réessayez plus tard.' });
    return readBody(req, res, async (parsed) => {
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
  }

  return json(res, 404, { error: 'introuvable' });
});

await mkdir(DATA_DIR, { recursive: true });
await load();
server.listen(PORT, () => {
  console.log(
    `▲ Mur PoliticsAI sur http://localhost:${PORT} — ${state.total} budget(s), ` +
      `${state.proposals.size} proposition(s)` +
      (ADMIN_TOKEN ? ' · modération activée' : ' · modération désactivée (PAI_ADMIN_TOKEN absent)'),
  );
});
