/**
 * Génère la carte « Mon budget 2029 » en PNG (1200×630), 100 % côté client.
 * Utilise les polices déjà chargées du document (canvas 2D).
 */

import type { Mission } from '../content/measures';
import { grossAmount, soldeSign, type ActiveMeasure, type SimResult } from './simulation';

const W = 1200;
const H = 630;

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadBudgetCard(opts: {
  mission: Mission;
  result: SimResult;
  stars: number;
  sandbox: boolean;
  measures: ActiveMeasure[];
  scenarioLabel: string;
}): Promise<void> {
  const { mission, result, stars, sandbox, measures, scenarioLabel } = opts;
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const display = '"Space Grotesk Variable", "Space Grotesk", sans-serif';
  const text = '"Inter Variable", Inter, sans-serif';

  /* — fond — */
  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, W, H);
  const glow1 = ctx.createRadialGradient(W * 0.75, -60, 0, W * 0.75, -60, 640);
  glow1.addColorStop(0, 'rgba(16,26,53,0.55)');
  glow1.addColorStop(1, 'rgba(16,26,53,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(60, H + 40, 0, 60, H + 40, 520);
  glow2.addColorStop(0, 'rgba(13,27,42,0.5)');
  glow2.addColorStop(1, 'rgba(13,27,42,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // flux décoratifs
  const flows: [string, number, number][] = [
    ['#3987e5', 150, 26],
    ['#d95926', 190, 18],
    ['#199e70', 226, 12],
  ];
  ctx.globalAlpha = 0.16;
  for (const [color, yBase, width] of flows) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-40, yBase + 340);
    ctx.bezierCurveTo(W * 0.3, yBase + 320, W * 0.55, yBase + 400, W + 40, yBase + 330);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  /* — marque + mission — */
  ctx.fillStyle = '#f2f4f8';
  ctx.font = `600 30px ${display}`;
  ctx.fillText('PoliticsAI', 64, 78);
  ctx.fillStyle = '#3987e5';
  ctx.font = `600 15px ${text}`;
  ctx.fillText('BÊTA', 214, 76);

  ctx.fillStyle = '#6b7386';
  ctx.font = `500 19px ${text}`;
  ctx.fillText(`Mission « ${mission.title} » · scénario ${scenarioLabel.toLowerCase()}`, 64, 120);

  ctx.fillStyle = '#f2f4f8';
  ctx.font = `700 54px ${display}`;
  ctx.fillText('Mon budget 2029', 64, 184);

  /* — étoiles — */
  if (!sandbox) {
    for (let i = 0; i < 3; i++) {
      drawStar(ctx, W - 200 + i * 46, 78, 17, i < stars ? '#c98500' : '#2a3145');
    }
  }

  /* — indicateurs — */
  const f = result.final;
  const b0 = result.baseline[0];
  const fb = result.finalBaseline;
  const avgGrowth =
    result.scenario.slice(1).reduce((s, p) => s + p.growth, 0) / (result.scenario.length - 1);

  const tiles = [
    { label: 'Déficit', value: `${nf1.format(f.deficitPct)} %`, delta: f.deficitPct - b0.deficitPct, vs: 'vs 2024' },
    { label: 'Dette', value: `${nf1.format(f.debtPct)} %`, delta: f.debtPct - fb.debtPct, vs: 'vs tendance' },
    { label: 'Chômage', value: `${nf1.format(f.unemployment)} %`, delta: f.unemployment - b0.unemployment, vs: 'vs 2024' },
    { label: 'Croissance moy.', value: `${nf1.format(avgGrowth)} %`, delta: avgGrowth - b0.growth, vs: 'vs tendance' },
  ];

  const tileW = 252;
  const tileH = 148;
  const gap = 22;
  const x0 = 64;
  const y0 = 226;
  tiles.forEach((t, i) => {
    const x = x0 + i * (tileW + gap);
    ctx.fillStyle = 'rgba(18,23,36,0.92)';
    rounded(ctx, x, y0, tileW, tileH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,49,69,0.9)';
    ctx.lineWidth = 1.5;
    rounded(ctx, x, y0, tileW, tileH, 18);
    ctx.stroke();

    ctx.fillStyle = '#6b7386';
    ctx.font = `600 15px ${text}`;
    ctx.fillText(t.label.toUpperCase(), x + 22, y0 + 38);
    ctx.fillStyle = '#f2f4f8';
    ctx.font = `700 46px ${display}`;
    ctx.fillText(t.value, x + 22, y0 + 90);
    const sign = t.delta >= 0 ? '+' : '−';
    const improving = t.delta < 0;
    ctx.fillStyle = Math.abs(t.delta) < 0.05 ? '#6b7386' : improving ? '#7d92bd' : '#e08585';
    ctx.font = `600 17px ${text}`;
    ctx.fillText(`${sign}${nf1.format(Math.abs(t.delta))} pt ${t.vs}`, x + 22, y0 + 122);
  });

  /* — mesures phares — */
  const top = [...measures].sort((a, b) => grossAmount(b) - grossAmount(a)).slice(0, 3);
  ctx.fillStyle = '#6b7386';
  ctx.font = `600 15px ${text}`;
  ctx.fillText(`${measures.length} MESURE${measures.length > 1 ? 'S' : ''} — DONT`, 64, 428);
  ctx.font = `500 21px ${text}`;
  top.forEach((m, i) => {
    const y = 462 + i * 34;
    const gain = soldeSign(m.def) > 0;
    ctx.fillStyle = gain ? '#7d92bd' : '#e08585';
    ctx.fillText(`${gain ? '+' : '−'}${nf1.format(grossAmount(m))} Md€`, 64, y);
    ctx.fillStyle = '#c9d2e3';
    const title = m.def.title.length > 74 ? m.def.title.slice(0, 72) + '…' : m.def.title;
    ctx.fillText(title, 188, y);
  });

  /* — pied — */
  ctx.strokeStyle = 'rgba(42,49,69,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 574);
  ctx.lineTo(W - 64, 574);
  ctx.stroke();
  ctx.fillStyle = '#6b7386';
  ctx.font = `500 16px ${text}`;
  ctx.fillText(
    'Simulation au premier ordre, règles publiques · données Eurostat/Insee 2024 · faites le vôtre sur PoliticsAI',
    64,
    602,
  );

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'politicsai-mon-budget-2029.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }
      resolve();
    }, 'image/png');
  });
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
