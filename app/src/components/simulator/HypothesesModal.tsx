import { HYPOTHESES, MODEL, BASE_INDICATORS } from '../../content/measures';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HypothesesModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="about-box" role="dialog" aria-label="Hypothèses du simulateur" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <h2>Hypothèses &amp; méthode</h2>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {HYPOTHESES.map((h) => (
          <section key={h.title}>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </section>
        ))}

        <section>
          <h3>Les paramètres, noir sur blanc</h3>
          <table className="ab-table">
            <tbody>
              <tr>
                <td>Multiplicateurs (centraux)</td>
                <td>
                  investissement {MODEL.multipliers.invest_public} · prestations ciblées{' '}
                  {MODEL.multipliers.social_cible} · fonctionnement {MODEL.multipliers.fonctionnement} ·
                  TVA {MODEL.multipliers.tax_conso} · IR {MODEL.multipliers.tax_menages} · cotisations{' '}
                  {MODEL.multipliers.cotisations} · IS {MODEL.multipliers.tax_entreprises} · hauts
                  patrimoines {MODEL.multipliers.tax_menages_aises}
                </td>
              </tr>
              <tr>
                <td>Scénarios</td>
                <td>
                  prudent × {MODEL.scenarios.prudent} · central × {MODEL.scenarios.central} · haut ×{' '}
                  {MODEL.scenarios.haut}
                </td>
              </tr>
              <tr>
                <td>Okun / bouclage / taux</td>
                <td>
                  {MODEL.okun} pt de chômage par point de PIB · {Math.round(MODEL.poRate * 100)} % de
                  retours fiscaux · dette nouvelle à {Math.round(MODEL.newDebtRate * 100)} %
                </td>
              </tr>
              <tr>
                <td>Départ 2024</td>
                <td>{BASE_INDICATORS.sources}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
