import { t } from '../i18n.js';
import { sectionParts } from './section.js';
import { cagePeriod as arborPeriod } from './readouts.js';
import { el, svgEl, linear } from './draw.js';

/**
 * The «Variants» modal — a comparison of escapement modules.
 *
 * The movement always has exactly one module built in. Here it can be swapped, and
 * here it is visible what a more complex one costs.
 *
 * WHAT IS HONEST HERE AND WHAT IS NOT. The cost numbers are measured by walking the
 * scene graph (`escapement/metrics.js`), the behaviour numbers are derived from the
 * same meshings that move the meshes — none of them is typed in. The tourbillon's
 * benefit, though, the model does not reproduce at all, and that is stated on its own
 * line under an amber marker.
 *
 * The third variant is shown but cannot be chosen: it has not been built, so there is
 * nothing to measure — its column carries dashes, not invented numbers.
 */


const SIL_W = 120, SIL_H = 66, SIL_PAD = 7;

/**
 * A variant's silhouette — the same section as in the side view, only small.
 *
 * The scale is SHARED by all three: otherwise a tall tower and a low slab would look
 * the same, and the difference in height is half of the whole conversation.
 */
function silhouette(id, scale) {
  const s = svgEl('svg', { viewBox: `0 0 ${SIL_W} ${SIL_H}`, class: 'sil' });
  if (!scale) { // a variant not yet built — a dashed frame with a question mark
    s.append(svgEl('rect', { x: 26, y: 18, width: SIL_W - 52, height: SIL_H - 36,
      rx: 4, fill: 'none', stroke: '#3a4048', 'stroke-dasharray': '4 4' }));
    const q = svgEl('text', { x: SIL_W / 2, y: SIL_H / 2 + 6, 'text-anchor': 'middle',
      fill: '#4d545d', 'font-size': 18 });
    q.textContent = '?';
    s.append(q);
    return s;
  }
  const { parts, zMin, kx, ky } = scale;
  const mine = parts.get(id);
  const uMid = (Math.min(...mine.map((p) => p.u - p.r)) + Math.max(...mine.map((p) => p.u + p.r))) / 2;
  // The same projector as in the full development. `kx`/`ky` are shared by all three
  // silhouettes — that is what the promise of an honest height comparison rests on.
  const Y = linear({ from: zMin, at: SIL_H - SIL_PAD, k: -ky });
  const X = linear({ from: uMid, at: SIL_W / 2, k: kx });
  // The plate's line, so it is visible what the height is measured from.
  s.append(svgEl('line', { x1: 4, y1: Y(zMin) + 1, x2: SIL_W - 4, y2: Y(zMin) + 1, stroke: '#2b3038' }));
  for (const p of mine) {
    s.append(svgEl('rect', {
      x: X(p.u - p.r), y: Y(p.z1), width: Math.max(2, 2 * p.r * kx),
      height: Math.max(2, (p.z1 - p.z0) * ky),
      rx: 1, fill: p.kind === 'cage' ? 'none' : '#2f3f66', stroke: '#5b7fd4',
    }));
  }
  return s;
}

/**
 * The shared scale for every silhouette.
 *
 * Vertically it is its own, stretched: escapement parts are 0.2–0.4 thick and at a
 * shared scale would turn into 2-pixel strokes. The stretch is the same for all
 * three, so comparing heights stays honest — just as in the full development, where
 * the factor is computed for the viewport.
 */
function silhouetteScale(ids) {
  const parts = new Map();
  let zMin = Infinity, zMax = -Infinity, wMax = 0;
  for (const id of ids) {
    const p = sectionParts(id).parts.filter((x) => x.mod === 'escapement');
    parts.set(id, p);
    const lo = Math.min(...p.map((x) => x.u - x.r)), hi = Math.max(...p.map((x) => x.u + x.r));
    wMax = Math.max(wMax, hi - lo);
    for (const x of p) { zMin = Math.min(zMin, x.z0); zMax = Math.max(zMax, x.z1); }
  }
  return {
    parts, zMin,
    kx: (SIL_W - 2 * SIL_PAD) / wMax,
    ky: (SIL_H - 2 * SIL_PAD) / (zMax - zMin),
  };
}

/**
 * @param escapement the socket from `movement`
 * @param planned    identifiers of variants not yet built
 * @param beatHz     the current rate — the periods depend on it, so it is taken at
 *                   the moment of display rather than remembered
 * @param onApply    called with the chosen id when «Change» is pressed
 */
export function mountVariantsModal({ escapement, planned = [], beatHz, onApply }) {
  const host = document.getElementById('variants');
  let picked = escapement.installed;
  let open = false;

  const ids = [...escapement.ids, ...planned];
  const isPlanned = (id) => planned.includes(id);

  function render() {
    host.replaceChildren();
    const sheet = el('div', 'v-sheet');
    // The body scrolls by itself, the footer with the buttons stays put at any window
    // height — otherwise it either hides content or drifts off screen.
    const body = el('div', 'v-body');

    body.append(el('div', 'eyebrow', t('variants.eyebrow').toUpperCase()));
    body.append(el('div', 'card-title', t('variants.title')));
    body.append(el('p', 'v-lead', t('variants.lead')));

    const scale = silhouetteScale(escapement.ids);

    // ── The three variants ──
    const list = el('div', 'v-list');
    for (const id of ids) {
      const row = el('button', 'v-row');
      row.setAttribute('aria-pressed', String(picked === id));
      if (isPlanned(id)) {
        row.disabled = true;
        row.classList.add('planned');
      } else {
        row.addEventListener('click', () => { picked = id; render(); });
      }
      row.append(silhouette(id, isPlanned(id) ? null : scale));

      const txt = el('div', 'v-txt');
      const head = el('div', 'v-head');
      head.append(el('b', null, t(`part.${id}`)));
      if (id === escapement.installed) head.append(el('span', 'v-now', t('variants.installed')));
      if (isPlanned(id)) head.append(el('span', 'v-planned', t('variants.planned')));
      txt.append(head, el('p', null, t(`variants.${id}.desc`)));
      row.append(txt);
      list.append(row);
    }
    body.append(list);

    // ── Two tables: what the module does, and what it costs ──
    const table = (headKey, rows, sourceOf) => {
      const tbl = el('table', 'v-table');
      const head = el('tr');
      head.append(el('th', null, t(headKey)));
      for (const id of ids) head.append(el('th', picked === id ? 'on' : null, t(`part.${id}`)));
      tbl.append(head);
      for (const [key, fmt] of rows) {
        const tr = el('tr');
        tr.append(el('td', 'k', t(key)));
        for (const id of ids) {
          // A variant not yet built has nothing to measure — a dash, not an invented
          // number: the rule «never type in what should be derived» holds here too.
          const v = isPlanned(id) ? '—' : fmt(sourceOf(id));
          tr.append(el('td', picked === id ? 'on' : null, v));
        }
        tbl.append(tr);
      }
      return tbl;
    };

    // The escape arbor's period is shared by every module (the balance sets it).
    // The difference is how many turns the escape wheel makes per turn of the arbor,
    // and whether there is a cage with anything to rotate at all.
    const arborT = arborPeriod(beatHz());
    const secs = (x) => `${Math.round(x * 10) / 10} ${t('unit.s')}`;
    body.append(table('variants.behaviour', [
      ['variants.metric.escapeTurn', (m) => secs(arborT / m.escapeTurns)],
      ['variants.metric.cageTurn', (m) => (m.hasCage ? secs(arborT) : '—')],
    ], (id) => escapement.variant(id).motion));

    body.append(table('variants.metric', [
      ['variants.metric.parts', (c) => String(c.parts)],
      ['variants.metric.moving', (c) => String(c.moving)],
      ['variants.metric.axes', (c) => String(c.axes)],
      ['variants.metric.size', (c) => `${c.r} × ${c.h}`],
    ], (id) => escapement.variant(id).cost));

    // ── Honesty ──
    const m = el('div', 'marker warn');
    const span = el('span');
    span.append(document.createTextNode(t('card.simplified')), el('i', null, t('variants.honesty')));
    m.append(span);
    body.append(m);

    // ── Buttons ──
    const row = el('div', 'v-actions');
    const keep = el('button', 'ghost', t('variants.keep'));
    keep.addEventListener('click', close);
    const apply = el('button', 'act', t('variants.apply'));
    apply.disabled = picked === escapement.installed;
    apply.addEventListener('click', () => {
      const id = picked;
      close();
      if (id !== escapement.installed) onApply(id);
    });
    row.append(keep, apply);
    sheet.append(body, row);

    host.append(sheet);
  }

  function show() {
    picked = escapement.installed;
    open = true;
    host.hidden = false;
    render();
  }
  function close() {
    open = false;
    host.hidden = true;
    host.replaceChildren();
  }

  host.addEventListener('click', (e) => { if (e.target === host) close(); });
  document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') close(); });

  return { show, close, get isOpen() { return open; }, refresh: () => { if (open) render(); } };
}
