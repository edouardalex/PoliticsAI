import { useEffect, useState } from 'react';
import {
  fetchProposals,
  submitChiffrage,
  type CitizenProposal,
  type CitizenChiffrage,
} from '../../lib/collab';
import { MODEL, type LeverType, type MeasureKind } from '../../content/measures';
import { buildCustomMeasure, type ActiveMeasure } from '../../lib/simulation';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdopt: (m: ActiveMeasure) => void;
  onToast: (msg: string) => void;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

const LEVER_LABELS: Record<string, string> = {
  invest_public: 'Investissement public',
  social_cible: 'Prestations ciblées',
  fonctionnement: 'Fonctionnement, salaires publics',
  tax_conso: 'Taxes sur la consommation',
  tax_menages: 'Impôts des ménages',
  tax_menages_aises: 'Impôts hauts revenus / patrimoine',
  tax_entreprises: 'Impôts des entreprises',
  cotisations: 'Cotisations sociales',
};

const KIND_LABELS: Record<string, string> = {
  depense_plus: 'Dépense supplémentaire',
  depense_moins: 'Économie',
  recette_plus: 'Prélèvement supplémentaire',
  recette_moins: 'Baisse de prélèvement',
};

const STATUS_LABELS: Record<CitizenProposal['status'], string> = {
  en_attente: 'à chiffrer',
  chiffree: 'chiffrage en relecture',
  validee: 'chiffrée et validée',
  rejetee: 'écartée',
};

/** Domaine de l'atelier correspondant au levier, pour adopter un chiffrage validé. */
const LEVER_TO_DOMAIN: Record<string, string> = {
  invest_public: 'c_infra',
  social_cible: 'c_social',
  fonctionnement: 'c_fp',
  tax_conso: 'c_tax_conso',
  tax_menages: 'c_tax_men',
  tax_menages_aises: 'c_tax_aises',
  tax_entreprises: 'c_tax_ent',
  cotisations: 'c_tax_ent',
};

export default function CitizenQueue({ open, onClose, onAdopt, onToast }: Props) {
  const [proposals, setProposals] = useState<CitizenProposal[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [formFor, setFormFor] = useState<string | null>(null);

  const load = () => {
    setStatus('loading');
    fetchProposals().then((p) => {
      if (p) {
        setProposals(p);
        setStatus('ready');
      } else {
        setStatus('offline');
      }
    });
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  const adopt = (p: CitizenProposal, c: CitizenChiffrage) => {
    const built = buildCustomMeasure({
      title: p.text.slice(0, 70),
      domainId: LEVER_TO_DOMAIN[c.lever] ?? 'c_infra',
      direction: c.kind === 'depense_plus' || c.kind === 'recette_plus' ? 'plus' : 'moins',
      amountMd: c.amountMd,
      lever: c.lever as LeverType,
    });
    if (built) {
      onAdopt(built);
      onToast('Mesure citoyenne ajoutée à votre projet de loi');
      onClose();
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="wall-box" role="dialog" aria-label="La file citoyenne" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <div>
            <p className="rb-overline">Chiffrage ouvert · anonyme</p>
            <h2>La file citoyenne</h2>
          </div>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="cq-intro">
          Les propositions qui ne sont pas dans le catalogue arrivent ici, regroupées par idée et
          classées par nombre de demandes. <strong>N'importe qui peut proposer un chiffrage</strong>{' '}
          — à condition de citer ses sources. Rien n'est publié avant relecture, et un chiffrage
          validé devient utilisable dans le simulateur.
        </p>

        {status === 'loading' && <p className="wall-status">Chargement de la file…</p>}
        {status === 'offline' && (
          <div className="wall-status">
            <p>
              <strong>La file est hors ligne.</strong> Le simulateur fonctionne normalement sans
              elle.
            </p>
            <p className="wall-hint">
              Pour l’activer en local : <code>node server/index.mjs</code>
            </p>
          </div>
        )}

        {status === 'ready' && proposals && proposals.length === 0 && (
          <p className="wall-status">
            Aucune proposition pour l’instant. Écrivez une mesure hors catalogue dans le champ du
            simulateur : elle atterrira ici.
          </p>
        )}

        {status === 'ready' && proposals && proposals.length > 0 && (
          <ul className="cq-list">
            {proposals.map((p) => (
              <li key={p.id} className={`cq-item ${p.status}`}>
                <div className="cq-head">
                  <span className="cq-count" title={`${p.count} personne(s) ont proposé cette mesure`}>
                    ×{p.count}
                  </span>
                  <span className="cq-text">{p.text}</span>
                  <span className={`cq-status ${p.status}`}>{STATUS_LABELS[p.status]}</span>
                </div>

                {p.chiffrages.map((c) => (
                  <div className="cq-chiffrage" key={c.id}>
                    <div className="cqc-head">
                      <strong>
                        {nf.format(c.amountMd)} Md€/an — {KIND_LABELS[c.kind] ?? c.kind}
                      </strong>
                      <span className="cqc-lever">
                        levier : {LEVER_LABELS[c.lever] ?? c.lever} (multiplicateur{' '}
                        {nf.format(MODEL.multipliers[c.lever as LeverType] ?? 0)})
                      </span>
                    </div>
                    {c.note && <p className="cqc-note">{c.note}</p>}
                    <ul className="cqc-sources">
                      {c.sources.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                    <button className="btn-ghost btn-sm" onClick={() => adopt(p, c)}>
                      Ajouter à mon budget
                    </button>
                  </div>
                ))}

                {p.pendingChiffrages > 0 && (
                  <p className="cq-pending">
                    {p.pendingChiffrages} chiffrage{p.pendingChiffrages > 1 ? 's' : ''} en relecture —
                    non publié{p.pendingChiffrages > 1 ? 's' : ''} tant qu’il{p.pendingChiffrages > 1 ? 's' : ''} n’
                    {p.pendingChiffrages > 1 ? 'ont' : 'a'} pas été vérifié
                    {p.pendingChiffrages > 1 ? 's' : ''}.
                  </p>
                )}

                {formFor === p.fp ? (
                  <ChiffrageForm
                    fp={p.fp}
                    onCancel={() => setFormFor(null)}
                    onDone={(msg) => {
                      setFormFor(null);
                      onToast(msg);
                      load();
                    }}
                  />
                ) : (
                  <button className="btn-link cq-propose" onClick={() => setFormFor(p.fp)}>
                    Proposer un chiffrage →
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="rb-note">
          Publications anonymes, sans compte ni cookie. Les liens sont refusés dans les
          propositions. Un chiffrage n’est publié qu’après relecture, et reste toujours accompagné
          de ses sources — c’est la même exigence que pour les mesures du catalogue.
        </p>
      </div>
    </div>
  );
}

/* ————— Formulaire de chiffrage ————— */

function ChiffrageForm({
  fp,
  onCancel,
  onDone,
}: {
  fp: string;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [amount, setAmount] = useState(5);
  const [lever, setLever] = useState<LeverType>('fonctionnement');
  const [kind, setKind] = useState<MeasureKind>('depense_plus');
  const [sources, setSources] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const list = sources
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    if (list.length === 0) {
      onDone('Au moins une source est nécessaire — c’est la règle du projet.');
      return;
    }
    setSending(true);
    const res = await submitChiffrage({ fp, amountMd: amount, lever, kind, sources: list, note });
    setSending(false);
    onDone(res.ok ? 'Chiffrage transmis — il sera publié après relecture.' : (res.error ?? 'Échec'));
  };

  return (
    <div className="cq-form">
      <div className="cqf-row">
        <label>
          Montant
          <input
            type="number"
            min={0.1}
            max={200}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <span className="cqf-unit">Md€/an</span>
        </label>
        <label>
          Sens
          <select className="cm-select" value={kind} onChange={(e) => setKind(e.target.value as MeasureKind)}>
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="cqf-block">
        Levier économique
        <select className="cm-select" value={lever} onChange={(e) => setLever(e.target.value as LeverType)}>
          {Object.entries(LEVER_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l} — multiplicateur {nf.format(MODEL.multipliers[k as LeverType])}
            </option>
          ))}
        </select>
      </label>
      <label className="cqf-block">
        Sources <span className="cm-note-inline">obligatoires — une par ligne</span>
        <textarea
          rows={3}
          className="cqf-textarea"
          placeholder={'Ex. : Cour des comptes, rapport 2025 sur…\nInsee, comptes nationaux 2024'}
          value={sources}
          onChange={(e) => setSources(e.target.value)}
        />
      </label>
      <label className="cqf-block">
        Méthode <span className="cm-note-inline">comment arrivez-vous à ce montant ?</span>
        <textarea
          rows={2}
          className="cqf-textarea"
          placeholder="Ex. : 17 M de têtes × 500 €/an ≈ 8,5 Md€ avant exemptions."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="cqf-actions">
        <button className="btn-ghost btn-sm" onClick={onCancel}>
          Annuler
        </button>
        <button className="btn-primary btn-sm" onClick={submit} disabled={sending}>
          {sending ? 'Envoi…' : 'Transmettre le chiffrage'}
        </button>
      </div>
    </div>
  );
}
