import { t } from '../i18n.js';
import { sectionParts } from './section.js';
import { cagePeriod as arborPeriod } from './readouts.js';

/**
 * Модалка «Варіанти» — порівняння модулів спуску.
 *
 * Механізм завжди має рівно один вбудований модуль. Тут його можна поміняти,
 * і тут же видно, у що обходиться складніший.
 *
 * ЩО ТУТ ЧЕСНО, А ЩО НІ. Числа ціни виміряні обходом графа (`escapement/
 * metrics.js`), числа поведінки виведені з тих самих зачеплень, що рухають
 * меші, — жодне не вписане. А от вигоду турбійона модель не відтворює
 * взагалі, і про це сказано окремим рядком під бурштиновою позначкою.
 *
 * Третій варіант показано, але не вибрати: його ще не збудовано, тож і міряти
 * нема чого — у його колонці стоять прочерки, а не вигадані числа.
 */

const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

const SIL_W = 120, SIL_H = 66, SIL_PAD = 7;

/**
 * Силует варіанта — той самий розріз, що й у вигляді збоку, тільки маленький.
 *
 * Масштаб СПІЛЬНИЙ для всіх трьох: інакше висока вежа й низька плитка
 * виглядали б однаково, а різниця у висоті — це половина всієї розмови.
 */
function silhouette(id, scale) {
  const s = svgEl('svg', { viewBox: `0 0 ${SIL_W} ${SIL_H}`, class: 'sil' });
  if (!scale) { // ще не збудований варіант — пунктирна рамка зі знаком питання
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
  const Y = (z) => SIL_H - SIL_PAD - (z - zMin) * ky;
  const X = (u) => SIL_W / 2 + (u - uMid) * kx;
  // Лінія платини, щоб було видно, від чого рахується висота.
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
 * Спільний масштаб для всіх силуетів.
 *
 * По вертикалі — окремий, розтягнутий: деталі спуску завтовшки 0.2–0.4, і при
 * спільному масштабі перетворилися б на риски по 2 пікселі. Розтяг однаковий
 * для всіх трьох, тож порівняння висот лишається чесним — так само, як у
 * великій розгортці, де коефіцієнт рахується під в'юпорт.
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
 * @param escapement гніздо з `movement`
 * @param planned    ідентифікатори ще не збудованих варіантів
 * @param beatHz     поточний хід — періоди залежать від нього, тож беремо його
 *                   в момент показу, а не запамʼятовуємо
 * @param onApply    викликається з обраним id, коли натиснули «Змінити»
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
    // Тіло гортається саме, підвал із кнопками лишається на місці за будь-якої
    // висоти вікна — інакше він або ховає вміст, або сам їде за екран.
    const body = el('div', 'v-body');

    body.append(el('div', 'eyebrow', t('variants.eyebrow').toUpperCase()));
    body.append(el('div', 'card-title', t('variants.title')));
    body.append(el('p', 'v-lead', t('variants.lead')));

    const scale = silhouetteScale(escapement.ids);

    // ── Три варіанти ──
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

    // ── Дві таблиці: що модуль робить і чого коштує ──
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
          // У ще не збудованого варіанта немає чого міряти — прочерк, а не
          // вигадане число: правило «не вписувати виведене» діє й тут.
          const v = isPlanned(id) ? '—' : fmt(sourceOf(id));
          tr.append(el('td', picked === id ? 'on' : null, v));
        }
        tbl.append(tr);
      }
      return tbl;
    };

    // Період анкерної осі — спільний для всіх модулів (його задає баланс).
    // Різниця в тому, скільки обертів робить анкерне колесо на один оберт осі,
    // і чи є взагалі кліть, якій є що обертати.
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

    // ── Чесність ──
    const m = el('div', 'marker warn');
    const span = el('span');
    span.append(document.createTextNode(t('card.simplified')), el('i', null, t('variants.honesty')));
    m.append(span);
    body.append(m);

    // ── Кнопки ──
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
