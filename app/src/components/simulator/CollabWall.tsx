import { useEffect, useState } from 'react';
import { MEASURES, MISSIONS } from '../../content/measures';
import { fetchWall, type RecentBudget, type WallStats } from '../../lib/collab';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenBudget: (b: RecentBudget) => void;
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const DEFICIT_BUCKETS = ['≤ 3 %', '3-4 %', '4-5 %', '5-6 %', '> 6 %'];

function measureTitle(id: string): string | null {
  return MEASURES.find((m) => m.id === id)?.title ?? null;
}

function missionTitle(id: string): string {
  return MISSIONS.find((m) => m.id === id)?.title ?? id;
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export default function CollabWall({ open, onClose, onOpenBudget }: Props) {
  const [data, setData] = useState<{ stats: WallStats; recent: RecentBudget[] } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');

  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    fetchWall().then((d) => {
      if (d) {
        setData(d);
        setStatus('ready');
      } else {
        setStatus('offline');
      }
    });
  }, [open]);

  if (!open) return null;

  const maxMeasureCount = data ? Math.max(1, ...data.stats.measures.map((m) => m.count)) : 1;
  const maxDeficit = data ? Math.max(1, ...data.stats.deficits) : 1;
  const successTotal = data
    ? data.stats.missions.filter((m) => m.id !== 'libre').reduce((s, m) => s + m.count, 0)
    : 0;
  const successMet = data
    ? data.stats.missions.filter((m) => m.id !== 'libre').reduce((s, m) => s + m.met, 0)
    : 0;

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="wall-box" role="dialog" aria-label="Le mur des budgets" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <div>
            <p className="rb-overline">Collaboratif · anonyme</p>
            <h2>Le mur des budgets</h2>
          </div>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {status === 'loading' && <p className="wall-status">Chargement du mur…</p>}

        {status === 'offline' && (
          <div className="wall-status">
            <p>
              <strong>Le mur est hors ligne.</strong> Cette instance de l'app tourne sans serveur
              collaboratif — l'exploration et le simulateur fonctionnent normalement.
            </p>
            <p className="wall-hint">
              Pour l'activer en local : <code>node server/index.mjs</code>
            </p>
          </div>
        )}

        {status === 'ready' && data && (
          <>
            <div className="wall-stats">
              <div className="ws-tile">
                <span className="ws-value">{data.stats.total.toLocaleString('fr-FR')}</span>
                <span className="ws-label">budget{data.stats.total > 1 ? 's' : ''} publié{data.stats.total > 1 ? 's' : ''}</span>
              </div>
              <div className="ws-tile">
                <span className="ws-value">
                  {successTotal > 0 ? `${Math.round((successMet / successTotal) * 100)} %` : '—'}
                </span>
                <span className="ws-label">des missions réussies</span>
              </div>
              <div className="ws-tile">
                <span className="ws-value">{data.stats.withCustom.toLocaleString('fr-FR')}</span>
                <span className="ws-label">contiennent des mesures inventées</span>
              </div>
            </div>

            {data.stats.total === 0 ? (
              <p className="wall-status">
                Personne n'a encore publié — soyez la première ou le premier : composez un budget et
                « Présenter mon budget » → « Publier sur le mur ».
              </p>
            ) : (
              <>
                <section className="wall-section">
                  <h3 className="dp-block-title">Les mesures les plus choisies</h3>
                  <ul className="wall-measures">
                    {data.stats.measures
                      .filter((m) => measureTitle(m.id))
                      .slice(0, 10)
                      .map((m) => (
                        <li key={m.id}>
                          <span className="wm-label">{measureTitle(m.id)}</span>
                          <span className="wm-track">
                            <span className="wm-bar" style={{ width: `${(m.count / maxMeasureCount) * 100}%` }} />
                          </span>
                          <span className="wm-count">{m.count}</span>
                        </li>
                      ))}
                  </ul>
                </section>

                <div className="wall-cols">
                  <section className="wall-section">
                    <h3 className="dp-block-title">Réussite par mission</h3>
                    <ul className="wall-missions">
                      {data.stats.missions
                        .filter((m) => m.id !== 'libre')
                        .map((m) => (
                          <li key={m.id}>
                            <span className="wmi-label">{missionTitle(m.id)}</span>
                            <span className="wmi-value">
                              {m.count > 0 ? `${Math.round((m.met / m.count) * 100)} %` : '—'}
                              <em> ({m.count})</em>
                            </span>
                          </li>
                        ))}
                      {data.stats.missions.some((m) => m.id === 'libre') && (
                        <li>
                          <span className="wmi-label">Budget libre</span>
                          <span className="wmi-value">
                            <em>({data.stats.missions.find((m) => m.id === 'libre')?.count ?? 0})</em>
                          </span>
                        </li>
                      )}
                    </ul>
                  </section>

                  <section className="wall-section">
                    <h3 className="dp-block-title">Déficit 2029 des budgets publiés</h3>
                    <ul className="wall-deficits">
                      {data.stats.deficits.map((count, i) => (
                        <li key={i}>
                          <span className="wd-label">{DEFICIT_BUCKETS[i]}</span>
                          <span className="wd-track">
                            <span
                              className={`wd-bar${i === 0 ? ' good' : ''}`}
                              style={{ width: `${(count / maxDeficit) * 100}%` }}
                            />
                          </span>
                          <span className="wd-count">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section className="wall-section">
                  <h3 className="dp-block-title">Budgets récents</h3>
                  <ul className="wall-recent">
                    {data.recent.map((b) => (
                      <li key={b.id}>
                        <div className="wr-main">
                          <span className="wr-mission">{missionTitle(b.mission)}</span>
                          <span className="wr-meta">
                            {b.met === true ? 'objectif atteint' : b.met === false ? 'objectif manqué' : 'bac à sable'}
                            {' · '}déficit {nf1.format(b.results.deficit)} % · {b.measures.length + b.customCount}{' '}
                            mesure{b.measures.length + b.customCount > 1 ? 's' : ''}
                            {b.customCount > 0 ? ` (dont ${b.customCount} inventée${b.customCount > 1 ? 's' : ''})` : ''}
                            {' · '}
                            {timeAgo(b.created)}
                          </span>
                        </div>
                        <span className="wr-stars" aria-label={`${b.stars} étoiles`}>
                          {b.met !== null && '★'.repeat(b.stars) + '☆'.repeat(Math.max(0, 3 - b.stars))}
                        </span>
                        <button className="btn-ghost wr-open" onClick={() => onOpenBudget(b)}>
                          Ouvrir
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            <p className="rb-note">
              Publications anonymes — aucun compte, aucun cookie, aucune donnée personnelle. Les
              titres des mesures inventées ne sont pas encore republiés (modération à venir) : elles
              sont comptées. Un budget ouvert depuis le mur recharge ses mesures du catalogue.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
