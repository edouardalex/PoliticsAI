import type { Perimeter } from '../lib/data';
import { FUNCTION_INFO, REVENUE_INFO } from '../content/text';
import { FUNCTION_COLORS, REVENUE_COLOR, DEFICIT_COLOR } from '../lib/palette';
import { fmtAmount, fmtPct } from '../lib/format';

interface Props {
  perimeter: Perimeter;
  perimeterId: string;
}

export default function TableView({ perimeter, perimeterId }: Props) {
  const total = perimeter.expenditureTotal;
  const gdp = perimeter.gdp;

  const downloadCsv = () => {
    const lines: string[] = ['type;code;poste;montant_meur;part_depenses_pct;part_pib_pct'];
    const pct = (v: number) => ((v / total) * 100).toFixed(2).replace('.', ',');
    const pib = (v: number) => (gdp ? ((v / gdp) * 100).toFixed(2).replace('.', ',') : '');
    for (const f of perimeter.functions) {
      lines.push(`depense;${f.code};${csv(f.label)};${f.value};${pct(f.value)};${pib(f.value)}`);
      for (const c of f.children) {
        lines.push(`depense_detail;${c.code};${csv(c.label)};${c.value};${pct(c.value)};${pib(c.value)}`);
      }
    }
    for (const r of perimeter.revenues) {
      lines.push(`recette;${r.code};${csv(r.label)};${r.value};${pct(r.value)};${pib(r.value)}`);
    }
    lines.push(`solde;DEFICIT;Déficit (dépenses − recettes);${perimeter.deficit};${pct(perimeter.deficit)};${pib(perimeter.deficit)}`);
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `politicsai-budget-${perimeterId}-${perimeter.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="table-view">
      <div className="tv-head">
        <p className="tv-intro">
          Toutes les valeurs du diagramme, accessibles et vérifiables — {perimeter.label.toLowerCase()},{' '}
          {perimeter.year}, en millions d’euros.
        </p>
        <button className="btn-ghost" onClick={downloadCsv}>
          Télécharger (CSV)
        </button>
      </div>

      <div className="tv-grid">
        <section>
          <h2 className="tv-title">Dépenses — {fmtAmount(total)}</h2>
          <table className="tv-table">
            <caption className="sr-only">Dépenses par fonction (COFOG), avec sous-postes</caption>
            <thead>
              <tr>
                <th scope="col">Poste</th>
                <th scope="col" className="num">Montant</th>
                <th scope="col" className="num">% dép.</th>
                <th scope="col" className="num">% PIB</th>
              </tr>
            </thead>
            <tbody>
              {perimeter.functions.map((f) => (
                <FunctionRows key={f.code} f={f} total={total} gdp={gdp} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total des dépenses</th>
                <td className="num">{fmtAmount(total)}</td>
                <td className="num">100 %</td>
                <td className="num">{gdp ? fmtPct((total / gdp) * 100) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section>
          <h2 className="tv-title">Recettes — {fmtAmount(perimeter.revenueTotal)}</h2>
          <table className="tv-table">
            <caption className="sr-only">Recettes par grande catégorie</caption>
            <thead>
              <tr>
                <th scope="col">Catégorie</th>
                <th scope="col" className="num">Montant</th>
                <th scope="col" className="num">% dép.</th>
                <th scope="col" className="num">% PIB</th>
              </tr>
            </thead>
            <tbody>
              {perimeter.revenues.map((r) => (
                <tr key={r.code}>
                  <th scope="row">
                    <span className="tv-dot" style={{ background: REVENUE_COLOR }} />
                    {REVENUE_INFO[r.code]?.short ?? r.label}
                  </th>
                  <td className="num">{fmtAmount(r.value)}</td>
                  <td className="num">{fmtPct((r.value / total) * 100)}</td>
                  <td className="num">{gdp ? fmtPct((r.value / gdp) * 100) : '—'}</td>
                </tr>
              ))}
              {perimeter.deficit > 0 && (
                <tr className="tv-deficit">
                  <th scope="row">
                    <span className="tv-dot" style={{ background: DEFICIT_COLOR }} />
                    Déficit (emprunt)
                  </th>
                  <td className="num">{fmtAmount(perimeter.deficit)}</td>
                  <td className="num">{fmtPct((perimeter.deficit / total) * 100)}</td>
                  <td className="num">{gdp ? fmtPct((perimeter.deficit / gdp) * 100) : '—'}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Recettes + emprunt</th>
                <td className="num">{fmtAmount(perimeter.revenueTotal + Math.max(0, perimeter.deficit))}</td>
                <td className="num">100 %</td>
                <td className="num">
                  {gdp ? fmtPct(((perimeter.revenueTotal + Math.max(0, perimeter.deficit)) / gdp) * 100) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>
    </div>
  );
}

function FunctionRows({
  f,
  total,
  gdp,
}: {
  f: Perimeter['functions'][number];
  total: number;
  gdp: number | null;
}) {
  const info = FUNCTION_INFO[f.code];
  return (
    <>
      <tr className="tv-l1">
        <th scope="row">
          <span className="tv-dot" style={{ background: FUNCTION_COLORS[f.code] }} />
          {info?.short ?? f.label}
        </th>
        <td className="num">{fmtAmount(f.value)}</td>
        <td className="num">{fmtPct((f.value / total) * 100)}</td>
        <td className="num">{gdp ? fmtPct((f.value / gdp) * 100) : '—'}</td>
      </tr>
      {f.children.map((c) => (
        <tr key={c.code} className="tv-l2">
          <th scope="row">{c.label}</th>
          <td className="num">{fmtAmount(c.value)}</td>
          <td className="num">{fmtPct((c.value / total) * 100)}</td>
          <td className="num">{gdp ? fmtPct((c.value / gdp) * 100) : '—'}</td>
        </tr>
      ))}
    </>
  );
}

function csv(s: string): string {
  return s.replace(/;/g, ',');
}
