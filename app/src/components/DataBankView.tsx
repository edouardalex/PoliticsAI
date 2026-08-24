import { useMemo, useState } from 'react';
import databankRaw from '../../../data/processed/databank.json';
import historyRaw from '../../../data/processed/databank-history.json';
import { fmtAmount, fmtPct } from '../lib/format';
import { BASIS_LABEL, type Basis } from '../lib/deep';

/* La banque de données répond à deux questions que le reste de l'application
   ne pose pas frontalement : d'où sortent ces chiffres, et jusqu'où peut-on
   descendre. Tout ce qui est affiché ici est calculé par le pipeline
   (build_databank.py) : ajouter une source la fait apparaître, sans rien
   saisir à la main. */

interface Source {
  key: string; name: string; dataset: string; url: string;
  producer: string; licence: string; cadence: string; brings: string;
  basis: string; basisLabel: string; role: string;
  views: number; nodes: number; terminal: number;
  years: number[]; mappings: string[]; anchors: string[];
  sourceRows: number | null; queries: string[];
}
interface Coverage { perimeter: string; label: string; total: number; covered: number; share: number }
interface AnchorEntry {
  anchor: string; perimeter: string; perimeterLabel: string; label: string;
  parentAmount: number | null;
  views: { id: string; title: string; basis: string; year: number; amount: number;
           coverage: number | null; mapping: string; nodes: number; depth: number }[];
}
interface WallLine {
  amount: number; path: string; label: string; context: string; basis: string;
  viewId: string; viewTitle: string; source: string; year: number;
}
interface Unreached { code: string; label: string; amount: number; inherited: string | null }
interface DataBank {
  extracted: string; spineYear: number;
  stats: {
    sources: number; views: number; nodes: number; terminal: number;
    medianTerminal: number; smallestTerminal: number; maxDepth: number;
    queries: number; expenditure: number; revenue: number;
  };
  sources: Source[]; coverage: Coverage[]; orchestration: AnchorEntry[];
  wall: WallLine[]; unreached: Unreached[];
}
interface History {
  note: string;
  snapshots: { date: string; sources: number; views: number; nodes: number;
               terminal: number; spineYear: number; sourceKeys: string[] }[];
}

const DB = databankRaw as unknown as DataBank;
const HISTORY = historyRaw as unknown as History;

const BASIS_COLOR: Record<string, string> = {
  SEC2010: '#6ea8fe',
  ESSPROS: '#8f7bd8',
  CNAM: '#4fbf9f',
  LOLF: '#e8b64c',
  FISC: '#d98a5a',
  M57: '#5fb0c9',
  DECP: '#c96f8a',
};

function basisName(b: string): string {
  return BASIS_LABEL[b as Basis] ?? b;
}

export default function DataBankView() {
  const { stats } = DB;
  const [openSource, setOpenSource] = useState<string | null>(null);

  const anchors = useMemo(
    () => DB.orchestration.filter((a) => a.parentAmount).slice(0, 14),
    [],
  );

  return (
    <div className="db-view">
      <header className="db-head">
        <p className="db-kicker">Banque de données</p>
        <h1 className="db-title">D’où viennent ces chiffres, et jusqu’où ils descendent</h1>
        <p className="db-lede">
          L’application n’invente aucun montant : chacun vient d’un fichier public, cité,
          daté et rejouable. Cette page est produite par le pipeline lui-même — ajouter une
          source la fait apparaître ici, sans que personne n’écrive une ligne.
        </p>
        <p className="db-extract">
          Dernière extraction : {DB.extracted} · millésime de référence {DB.spineYear}
        </p>
      </header>

      <section className="db-stats">
        {[
          [stats.sources, 'sources publiques'],
          [stats.views, 'vues de détail'],
          [stats.nodes.toLocaleString('fr-FR'), 'lignes publiées'],
          [stats.terminal.toLocaleString('fr-FR'), 'lignes terminales'],
          [stats.maxDepth, 'niveaux de profondeur'],
          [stats.queries, 'requêtes citées'],
        ].map(([v, l]) => (
          <div key={String(l)} className="db-stat">
            <span className="db-stat-v">{v}</span>
            <span className="db-stat-l">{l}</span>
          </div>
        ))}
      </section>

      {/* ————— Le principe ————— */}
      <section className="db-section">
        <h2 className="db-h2">Comment c’est orchestré</h2>
        <p className="db-p">
          Une seule source donne l’ossature : la comptabilité nationale, qui couvre la
          totalité de la dépense publique mais s’arrête au deuxième niveau de la
          nomenclature européenne. Toutes les autres viennent s’<em>accrocher</em> sous une
          ligne précise pour la détailler — en changeant de comptabilité, donc de périmètre.
          C’est ce changement que l’application affiche au lieu de le masquer.
        </p>

        <div className="db-principle">
          <div className="db-pbox db-pbox-spine">
            <span className="db-pbox-t">L’ossature</span>
            <strong>Comptabilité nationale</strong>
            <span className="db-pbox-d">
              {fmtAmount(stats.expenditure)} de dépenses, {fmtAmount(stats.revenue)} de
              recettes. Exhaustive et consolidée, mais s’arrête à 64 sous-fonctions.
            </span>
          </div>
          <div className="db-parrow" aria-hidden="true">
            <span>point d’accroche</span>
          </div>
          <div className="db-pbox">
            <span className="db-pbox-t">Une ligne</span>
            <strong>« Santé », « Vieillesse », « Cotisations sociales »…</strong>
            <span className="db-pbox-d">
              {DB.orchestration.length} lignes de l’application portent au moins une vue de
              détail.
            </span>
          </div>
          <div className="db-parrow" aria-hidden="true">
            <span>changement de source</span>
          </div>
          <div className="db-pbox db-pbox-view">
            <span className="db-pbox-t">Une vue</span>
            <strong>L’arbre venu d’ailleurs</strong>
            <span className="db-pbox-d">
              Porte son référentiel, son millésime, sa source, la part du parent qu’elle
              explique et la qualité de son rattachement. Rien n’est mis à l’échelle.
            </span>
          </div>
        </div>

        <table className="db-table">
          <caption className="sr-only">Points d’accroche et vues rattachées</caption>
          <thead>
            <tr>
              <th scope="col">Ligne de l’application</th>
              <th scope="col" className="num">Montant</th>
              <th scope="col">Vues rattachées</th>
            </tr>
          </thead>
          <tbody>
            {anchors.map((a) => (
              <tr key={a.anchor}>
                <th scope="row">
                  {a.label}
                  <span className="db-anchor-p">{a.perimeterLabel}</span>
                </th>
                <td className="num">{a.parentAmount ? fmtAmount(a.parentAmount) : '—'}</td>
                <td>
                  <span className="db-chips">
                    {a.views.map((v) => (
                      <span
                        key={v.id}
                        className="db-chip"
                        style={{ borderColor: BASIS_COLOR[v.basis] ?? 'var(--hairline)' }}
                        title={`${v.title} — ${basisName(v.basis)}, ${v.year}, ${v.nodes.toLocaleString('fr-FR')} lignes`}
                      >
                        <span className="db-chip-dot" style={{ background: BASIS_COLOR[v.basis] }} />
                        {v.title}
                        {v.coverage != null && (
                          <em className="db-chip-cov">{fmtPct(v.coverage * 100, 0)}</em>
                        )}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="db-note">
          Les {DB.orchestration.length - anchors.length} autres points d’accroche sont
          accessibles depuis le diagramme et le tableau. Le pourcentage indique la part de
          la ligne que la vue explique ; son absence signale un périmètre différent, qu’on
          ne prétend pas rapporter au parent.
        </p>
      </section>

      {/* ————— Les sources ————— */}
      <section className="db-section">
        <h2 className="db-h2">Les {DB.sources.length} sources</h2>
        <div className="db-sources">
          {DB.sources.map((s) => {
            const open = openSource === s.key;
            return (
              <article key={s.key} className={`db-source${s.role === 'spine' ? ' spine' : ''}`}>
                <header>
                  <span
                    className="db-basis"
                    style={{ borderColor: BASIS_COLOR[s.basis] ?? 'var(--hairline)' }}
                  >
                    <span className="db-chip-dot" style={{ background: BASIS_COLOR[s.basis] }} />
                    {basisName(s.basis)}
                  </span>
                  {s.role === 'spine' && <span className="db-role">ossature</span>}
                  <h3>{s.producer}</h3>
                </header>
                <p className="db-brings">{s.brings || s.name}</p>
                <dl className="db-meta">
                  <div><dt>Jeu de données</dt><dd>{s.dataset}</dd></div>
                  <div><dt>Millésime</dt><dd>{s.years.join(', ') || '—'}</dd></div>
                  <div><dt>Mise à jour</dt><dd>{s.cadence}</dd></div>
                  <div><dt>Licence</dt><dd>{s.licence}</dd></div>
                  <div>
                    <dt>Apport</dt>
                    <dd>
                      {s.nodes.toLocaleString('fr-FR')} lignes
                      {s.views > 0 && <> · {s.views} vue{s.views > 1 ? 's' : ''}</>}
                    </dd>
                  </div>
                  <div>
                    <dt>Rattachement</dt>
                    <dd>{s.mappings.join(', ')}</dd>
                  </div>
                </dl>
                <div className="db-source-foot">
                  <a href={s.url} target="_blank" rel="noreferrer">Voir la source</a>
                  {s.queries.length > 0 && (
                    <button className="db-link" onClick={() => setOpenSource(open ? null : s.key)}>
                      {open ? 'Masquer' : 'Voir'} les {s.queries.length} point
                      {s.queries.length > 1 ? 's' : ''} d’interrogation
                    </button>
                  )}
                </div>
                {open && (
                  <ul className="db-queries">
                    {s.queries.map((q) => (
                      <li key={q}><code>{q}</code></li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ————— Jusqu'où on descend ————— */}
      <section className="db-section">
        <h2 className="db-h2">Jusqu’où on descend</h2>
        <p className="db-p">
          La profondeur n’est pas uniforme. Une vue « comparable » explique une part mesurée
          de sa ligne parente ; les autres décrivent un périmètre voisin qu’on ne prétend pas
          rapporter au total. Voici ce qui est réellement atteint, périmètre par périmètre.
        </p>
        <ul className="db-coverage">
          {DB.coverage.map((c) => (
            <li key={c.perimeter}>
              <span className="db-cov-label">{c.label}</span>
              <span className="db-cov-track">
                <span className="db-cov-bar" style={{ width: `${Math.min(c.share, 1) * 100}%` }} />
              </span>
              <span className="db-cov-num">
                {fmtPct(c.share * 100, 0)}
                <em>{fmtAmount(c.covered)} sur {fmtAmount(c.total)}</em>
              </span>
            </li>
          ))}
        </ul>
        <p className="db-note">
          « Toutes administrations » affiche 0 % parce qu’aucune vue consolidée n’existe à ce
          niveau : la profondeur y est empruntée aux sous-secteurs, dont la couverture est
          mesurée ci-dessus. C’est une limite de la comptabilité, pas un manque de données.
        </p>

        <h3 className="db-h3">Le mur : ce que plus rien ne divise</h3>
        <p className="db-p">
          Ces lignes sont les plus grosses que l’application sache produire sans pouvoir les
          découper davantage. Aucune source publique et lisible par machine ne va plus loin.
          C’est, très exactement, la feuille de route.
        </p>
        <ol className="db-wall">
          {DB.wall.slice(0, 8).map((w) => (
            <li key={`${w.viewId}-${w.path}`}>
              <span className="db-wall-amount">{fmtAmount(w.amount)}</span>
              <span className="db-wall-label">
                {w.label}
                <em>
                  {w.context && <>dans {w.context} — </>}
                  {w.source} · {w.year}
                </em>
              </span>
            </li>
          ))}
        </ol>

        {DB.unreached.length > 0 && (
          <>
            <h3 className="db-h3">Les lignes sans vue dédiée</h3>
            <p className="db-p">
              Elles héritent de la vue de leur fonction, faute de source qui les traite pour
              elles-mêmes.
            </p>
            <ul className="db-unreached">
              {DB.unreached.slice(0, 6).map((u) => (
                <li key={u.code}>
                  <span className="db-wall-amount">{fmtAmount(u.amount)}</span>
                  <span className="db-wall-label">
                    {u.label}
                    {u.inherited && <em>hérite de « {u.inherited} »</em>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ————— Évolution ————— */}
      <section className="db-section">
        <h2 className="db-h2">Évolution</h2>
        <p className="db-p">
          Le pipeline dépose un instantané à chaque exécution. Au fil des millésimes et des
          sources ajoutées, cette liste montre la profondeur du projet s’étendre — ou une
          source disparaître, ce qui arrive aussi.
        </p>
        <table className="db-table db-history">
          <caption className="sr-only">Instantanés successifs du pipeline</caption>
          <thead>
            <tr>
              <th scope="col">Exécution</th>
              <th scope="col" className="num">Sources</th>
              <th scope="col" className="num">Vues</th>
              <th scope="col" className="num">Lignes</th>
              <th scope="col" className="num">Millésime</th>
            </tr>
          </thead>
          <tbody>
            {[...HISTORY.snapshots].reverse().map((s, i, arr) => {
              const prev = arr[i + 1];
              const delta = prev ? s.nodes - prev.nodes : null;
              return (
                <tr key={s.date}>
                  <th scope="row">{s.date}</th>
                  <td className="num">{s.sources}</td>
                  <td className="num">{s.views}</td>
                  <td className="num">
                    {s.nodes.toLocaleString('fr-FR')}
                    {delta != null && delta !== 0 && (
                      <em className="db-delta">
                        {delta > 0 ? '+' : ''}
                        {delta.toLocaleString('fr-FR')}
                      </em>
                    )}
                  </td>
                  <td className="num">{s.spineYear}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {HISTORY.snapshots.length < 2 && (
          <p className="db-note">
            Premier instantané. Les suivants s’ajouteront à chaque exécution du pipeline.
          </p>
        )}
      </section>
    </div>
  );
}
