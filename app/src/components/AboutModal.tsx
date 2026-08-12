import { FRANCE, EUROPE } from '../lib/data';
import { ANCHORS } from '../lib/equivalences';

interface Props {
  open: boolean;
  onClose: () => void;
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export default function AboutModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="about-box" role="dialog" aria-label="Méthodologie" onClick={(e) => e.stopPropagation()}>
        <div className="ab-head">
          <h2>Méthode &amp; sources</h2>
          <button className="dp-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <section>
          <h3>Le projet</h3>
          <p>
            PoliticsAI est un projet citoyen : rendre le budget public français — État, Sécurité
            sociale, collectivités — compréhensible, explorable et vérifiable par n’importe qui.
            <em> PoliticsAI est un nom de code ; le produit trouvera son nom.</em>
          </p>
        </section>

        <section>
          <h3>Nos règles (constitution de neutralité)</h3>
          <ul>
            <li><strong>Décrire, jamais qualifier.</strong> Les chiffres, les comparaisons — le jugement vous appartient.</li>
            <li><strong>Tout chiffre est sourcé</strong> et traçable jusqu’à la statistique publique.</li>
            <li><strong>Méthodologie ouverte</strong> : le code et le pipeline de données sont publics.</li>
            <li><strong>Mêmes règles pour tous</strong>, quel que soit le bord politique.</li>
            <li><strong>Les chiffres viennent des données, jamais d’un modèle d’IA.</strong></li>
          </ul>
        </section>

        <section>
          <h3>Les données</h3>
          <p>
            Comptes nationaux des administrations publiques (SEC 2010), publiés par l’Insee et
            diffusés par <a href="https://ec.europa.eu/eurostat/fr/web/government-finance-statistics" target="_blank" rel="noreferrer">Eurostat</a>.
            Dépenses par fonction : nomenclature internationale CFAP/COFOG (jeux{' '}
            <code>gov_10a_exp</code>, <code>gov_10a_main</code>, <code>nama_10_gdp</code>).
            Millésime : {FRANCE.perimeters.S13.year}, extraction du {FRANCE.meta.extracted}.
          </p>
          <ul>
            <li>
              Le périmètre « Toutes administrations » est <strong>consolidé</strong> : les transferts
              internes (dotations de l’État aux collectivités, par exemple) sont neutralisés.
            </li>
            <li>
              Les périmètres État / Sécurité sociale / Collectivités sont <strong>non consolidés</strong> :
              les transferts entre administrations y apparaissent, leurs totaux ne s’additionnent donc pas.
            </li>
            <li>
              Le « déficit » affiché est l’écart dépenses − recettes du périmètre ; il peut différer de
              quelques centaines de millions du besoin de financement officiel (B9) pour des raisons
              comptables (traitement des crédits d’impôts).
            </li>
          </ul>
        </section>

        <section>
          <h3>Les équivalences</h3>
          <p>
            Des ordres de grandeur <strong>indicatifs</strong>, pour se représenter les montants — pas des
            chiffrages : les coûts réels varient selon les projets et les territoires.
          </p>
          <table className="ab-table">
            <thead>
              <tr>
                <th>Ancre</th>
                <th className="num">Coût retenu</th>
                <th>Source / base</th>
              </tr>
            </thead>
            <tbody>
              {ANCHORS.map((a) => (
                <tr key={a.id}>
                  <td>{a.singular}</td>
                  <td className="num">{nf.format(a.cost)} €</td>
                  <td>{a.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Comparaison européenne</h3>
          <p>
            {EUROPE.meta.note} Les écarts entre pays reflètent aussi des différences d’organisation :
            un pays qui assure la santé par des assurances privées obligatoires affichera moins de
            dépense « publique » à service comparable.
          </p>
        </section>

        <section>
          <h3>La suite</h3>
          <p>
            V1.5 : le « ticket de caisse fiscal » et un quiz quotidien. V2 : le simulateur « à vous de
            faire le budget ». V3 : le chiffrage des programmes pour la présidentielle 2027 — mêmes
            règles pour tous les candidats.
          </p>
        </section>

        <p className="ab-foot">
          Code source et données :{' '}
          <a href="https://github.com/edouardalex/PoliticsAI" target="_blank" rel="noreferrer">
            github.com/edouardalex/PoliticsAI
          </a>
        </p>
      </div>
    </div>
  );
}
