import { t, tf } from '../i18n.js';
import { sectionParts, zTicks, V_SCALE } from './section.js';

/**
 * Малює розгортку у SVG. Одна діаграма на всі станції — підсвітка змінюється
 * так само, як у вигляді згори: та сама сцена, різний фокус.
 */

const SVG = 'http://www.w3.org/2000/svg';
const W = 740, H = 716, PAD = 30, TOP_PAD = 96, BOTTOM_PAD = 64;

const n = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/** Кольори — ті самі матеріали, що й у сцені. */
const STYLE = {
  wheel: { fill: '#8a7440', stroke: '#caa84a' },
  pinion: { fill: '#3b4048', stroke: '#b8bec8' },
  drum: { fill: '#221f19', stroke: '#8a7440' },
  sun: { fill: '#3b4048', stroke: '#b8bec8' },
  flat: { fill: '#8a7440', stroke: '#caa84a' },
  hand: { fill: '#5b7fd4', stroke: '#5b7fd4' },
  cage: { fill: 'none', stroke: '#2f4b8c' },
  plate: { fill: '#2b3038', stroke: 'none' },
};

export function renderSection(host, focusMods, variant) {
  const { parts, meshes, bounds } = sectionParts(variant);
  const zMin = Math.min(...parts.map((p) => p.z0));
  const zMax = Math.max(...parts.map((p) => p.z1));
  const sx = (W - 2 * PAD) / (bounds.uMax - bounds.uMin);
  // Вертикаль розтягується, щоб шари в 1.1 не злилися, — але не «на око»:
  // масштаб рахується під в'юпорт, а справжній коефіцієнт іде в підпис.
  const sy = Math.min(sx * 4, (H - TOP_PAD - BOTTOM_PAD) / (zMax - zMin));
  const exaggeration = Math.round((sy / sx) * 10) / 10;
  const X = (u) => PAD + (u - bounds.uMin) * sx;
  const Y = (z) => H - BOTTOM_PAD - (z - zMin) * sy;

  const lit = (mod) => !focusMods || focusMods.size === 0 || focusMods.has(mod);

  const svg = n('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%' });
  svg.append(n('rect', { width: W, height: H, fill: '#16181c' }));

  // ── Шкала висот ──
  const axis = n('g', { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#6f757e' });
  for (const z of zTicks()) {
    const y = Y(z);
    axis.append(n('line', { x1: 26, y1: y, x2: W - 24, y2: y, stroke: '#20242a', 'stroke-width': 1, 'stroke-dasharray': '3 6' }));
    const label = n('text', { x: 20, y: y + 3.5, 'text-anchor': 'end' });
    label.textContent = Number.isInteger(z) ? String(z) : z.toFixed(2).replace(/0$/, '');
    axis.append(label);
  }
  const zMark = n('text', { x: 26, y: Y(zTicks().at(-1)) - 16, 'text-anchor': 'middle', fill: '#6f757e' });
  zMark.textContent = 'z';
  axis.append(zMark);
  svg.append(axis);

  // ── Деталі ──
  const body = n('g');
  for (const p of parts) {
    const st = STYLE[p.kind] ?? STYLE.wheel;
    const h = Math.max(3, (p.z1 - p.z0) * sy);
    const rect = n('rect', {
      x: X(p.u - p.r), y: Y(p.z1), width: Math.max(3, 2 * p.r * sx), height: h, rx: 3,
      fill: st.fill, stroke: st.stroke,
      'stroke-width': p.kind === 'cage' ? 4 : 1.4,
      opacity: p.mod === 'plate' ? 1 : lit(p.mod) ? 1 : 0.14,
    });
    body.append(rect);
  }
  svg.append(body);

  // ── Точки зачеплення: тріб торкається колеса сусіда по ділильних колах ──
  const trainLit = lit('train');
  const mg = n('g', { opacity: trainLit ? 1 : 0.2 });
  for (const m of meshes) {
    mg.append(n('circle', { cx: X(m.u), cy: Y(m.z), r: 10, fill: 'none', stroke: '#c0304a', 'stroke-width': 2 }));
    const lab = n('text', {
      x: X(m.u), y: Y(m.z) + 26, 'text-anchor': 'middle',
      'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5, fill: '#c0304a',
    });
    lab.textContent = m.text;
    mg.append(lab);
  }
  svg.append(mg);

  // ── Підписи вузлів: у два яруси, щоб не налазили ──
  const labels = n('g', { 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11 });
  parts.filter((p) => p.labelKey && lit(p.mod)).forEach((p, i) => {
    const y = Y(p.z1) - (i % 2 ? 24 : 9);
    const lab = n('text', { x: X(p.u), y, 'text-anchor': 'middle', fill: '#d8dce2' });
    lab.textContent = t(p.labelKey);
    labels.append(lab);
    if (i % 2) labels.append(n('line', { x1: X(p.u), y1: y + 5, x2: X(p.u), y2: Y(p.z1) - 3,
      stroke: '#4a5058', 'stroke-width': 1 }));
  });
  svg.append(labels);

  const caption = n('text', {
    x: 26, y: H - 22, 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11.5, fill: '#6f757e',
  });
  caption.textContent = tf('view.caption', exaggeration);
  svg.append(caption);

  host.replaceChildren(svg);
}
