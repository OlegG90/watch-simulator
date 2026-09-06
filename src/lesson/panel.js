import './lesson.css';
import { t, tn, getLang, setLang, onLangChange, LANGS } from '../i18n.js';
import { STATIONS } from './stations.js';

/**
 * Оболонка уроку: шапка, ліва рейка зі станціями, картка й підвал-ланцюг.
 *
 * Панель нічого не знає про three.js — вона лише каже, яку станцію обрано.
 * Підсвітка й камера приходять ззовні, тож урок можна перевіряти без сцени.
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

/** Ланцюг у підвалі: головний ряд + два відгалуження + петля ритму. */
const CHAIN_MAIN = ['chain.winding', 'chain.barrel', 'chain.train', 'chain.escape', 'chain.balance'];

export function mountLesson({ highlighter, camera, status, onMode }) {
  const ui = document.getElementById('ui');
  const state = { mode: 'lesson', current: null, visited: new Set(), cam: 'cam.overview' };

  const refs = {}; // живі вузли, які оновлюються щокадру

  // ── Шапка ───────────────────────────────────────────────────────
  function renderHeader() {
    const h = document.getElementById('hdr');
    h.replaceChildren();

    const brand = el('div', 'brand');
    brand.append(gearIcon(), el('b', null, 'SimWatch'), el('span', null, t('app.subtitle')));
    h.append(brand);

    h.append(segmented([
      [t('mode.lesson'), state.mode === 'lesson', () => setMode('lesson')],
      [t('mode.free'), state.mode === 'free', () => setMode('free')],
    ]));

    h.append(el('div', 'spacer'));

    const st = el('div', 'status');
    refs.mode = el('span'); refs.speed = el('b'); refs.wind = el('b');
    st.append(refs.mode, el('i', null, '·'), wrap(t('status.speed'), refs.speed),
              el('i', null, '·'), wrap(t('status.wind'), refs.wind));
    h.append(st, el('div', 'divider'));

    h.append(segmented(LANGS.map((l) => [
      l === 'ua' ? 'УКР' : 'EN', getLang() === l, () => setLang(l),
    ]), 'lang'));
  }

  const wrap = (label, node) => {
    const s = el('span', null, label + ' ');
    s.append(node);
    return s;
  };

  function segmented(items, extra = '') {
    const box = el('div', `seg ${extra}`.trim());
    for (const [label, on, fn, disabled] of items) {
      const b = el('button', null, label);
      b.setAttribute('aria-pressed', String(!!on));
      if (disabled) b.disabled = true;
      else b.addEventListener('click', fn);
      box.append(b);
    }
    return box;
  }

  function gearIcon() {
    const s = svgEl('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
      stroke: '#caa84a', 'stroke-width': 1.4 });
    s.append(svgEl('circle', { cx: 12, cy: 12, r: 9 }), svgEl('circle', { cx: 12, cy: 12, r: 3.2 }),
      svgEl('path', { d: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1' }));
    return s;
  }

  // ── Ліва рейка ──────────────────────────────────────────────────
  function renderRail() {
    const rail = document.getElementById('rail');
    rail.replaceChildren();

    const head = el('div', 'rail-head');
    head.append(el('b', null, t('rail.title')), el('p', null, t('rail.subtitle')));
    rail.append(head);

    const route = el('div', 'route');
    STATIONS.forEach((s, i) => {
      const b = el('button', 'stop');
      const done = state.visited.has(s.id) && state.current !== i;
      if (done) b.classList.add('done');
      b.setAttribute('aria-current', String(state.current === i));
      const num = el('span', 'num');
      num.append(done ? checkIcon() : document.createTextNode(String(i + 1)));
      const txt = el('span', 'txt');
      txt.append(el('b', null, t(s.nameKey)), el('i', null, t(`${s.nameKey}.sub`)));
      b.append(num, txt);
      b.addEventListener('click', () => go(i));
      route.append(b);
    });
    rail.append(route);

    rail.append(el('div', 'spacer'));

    const box = el('div', 'collected');
    box.append(el('b', null, t('rail.collected')), el('p', null, t('rail.empty')));
    const bars = el('div', 'bars');
    STATIONS.forEach((s, i) => {
      const bar = el('i');
      if (state.visited.has(s.id)) bar.className = state.current === i ? 'now' : 'on';
      bars.append(bar);
    });
    box.append(bars);
    rail.append(box);
  }

  function checkIcon() {
    const s = svgEl('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none',
      stroke: '#8fbfa2', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    s.append(svgEl('path', { d: 'M20 6L9 17l-5-5' }));
    return s;
  }

  // ── Хром сцени: пресети камери + вигляд ─────────────────────────
  function renderChrome() {
    const box = document.getElementById('stage-chrome');
    box.replaceChildren();

    const cams = el('div', 'cams');
    for (const [key, fn] of camera.presets) {
      const b = el('button', null, t(key));
      b.setAttribute('aria-pressed', String(state.cam === key));
      b.addEventListener('click', () => { state.cam = key; fn(); renderChrome(); });
      cams.append(b);
    }
    box.append(cams);

    const view = segmented([
      [t('view.top'), true, () => {}],
      [t('view.side'), false, null, true], // вигляд збоку — у своїй фазі
    ], 'mini');
    view.lastChild.title = t('view.sideSoon');
    box.append(view);
  }

  // ── Картка станції ──────────────────────────────────────────────
  function renderCard() {
    const card = document.getElementById('card');
    card.replaceChildren();

    if (state.current === null) {
      card.append(el('div', 'eyebrow', t('rail.title').toUpperCase()));
      card.append(el('div', 'card-title', t('app.subtitle')));
      card.append(el('div', 'placeholder', t('rail.empty')));
      card.append(navRow());
      return;
    }

    const s = STATIONS[state.current];
    card.append(el('div', 'eyebrow', tn('card.station', state.current + 1)));
    card.append(el('div', 'card-title', t(s.nameKey)));
    card.append(el('div', 'card-sub', t(`${s.nameKey}.sub`)));
    card.append(el('div', 'placeholder', t('card.soon')));
    card.append(navRow());
  }

  function navRow() {
    const row = el('div', 'nav');
    const i = state.current;
    const prev = el('button', null, i === null || i === 0
      ? t('card.start') : `← ${t(STATIONS[i - 1].nameKey)}`);
    prev.disabled = i === null || i === 0;
    if (!prev.disabled) prev.addEventListener('click', () => go(i - 1));

    const atEnd = i !== null && i === STATIONS.length - 1;
    const next = el('button', 'next', atEnd
      ? `${t('card.summary')} →` : `${t(STATIONS[(i ?? -1) + 1].nameKey)} →`);
    next.disabled = atEnd; // підсумок — у своїй фазі
    if (!next.disabled) next.addEventListener('click', () => go((i ?? -1) + 1));

    row.append(prev, next);
    return row;
  }

  // ── Підвал: ланцюг ──────────────────────────────────────────────
  function renderChain() {
    const foot = document.getElementById('chain');
    foot.replaceChildren();

    const head = el('div', 'chain-head');
    head.append(el('b', null, t('chain.label')), el('span', null, t('chain.where')));
    foot.append(head, chainSvg());
    foot.append(el('div', 'spacer'));

    const clock = el('div', 'clock');
    refs.clock = el('b', null, '00:00');
    const box = el('span');
    box.append(document.createTextNode(t('foot.modelTime')), refs.clock);
    clock.append(box);
    foot.append(clock);
  }

  /** Ширина коробки рахується з тексту — англійські назви довші за українські. */
  const boxW = (label) => Math.max(64, Math.round(label.length * 6.7) + 24);

  function chainSvg() {
    const here = state.current === null ? null : STATIONS[state.current].chain;
    const labels = CHAIN_MAIN.map(t);
    const w = labels.map(boxW);
    const x = [];
    let cur = 8;
    for (const width of w) { x.push(cur); cur += width + 48; }
    const total = cur - 48 + 8;
    const mid = x.map((xi, i) => xi + w[i] / 2);

    const s = svgEl('svg', { viewBox: `0 0 ${total} 92`, width: total, height: 92 });
    const g = svgEl('g', { 'font-family': 'IBM Plex Sans, sans-serif', 'font-size': 11.5 });
    s.append(g);

    const passed = (i) => here?.row !== undefined && i < here.row;
    const box = (bx, by, bw, label, active, dim) => {
      g.append(svgEl('rect', {
        x: bx, y: by, width: bw, height: by === 52 ? 30 : 28, rx: 4,
        fill: active ? '#caa84a' : '#20242a',
        stroke: active ? 'none' : dim ? '#6d5c30' : '#3a4048',
      }));
      const txt = svgEl('text', {
        x: bx + bw / 2, y: by + (by === 52 ? 19 : 18), 'text-anchor': 'middle',
        fill: active ? '#1a1c20' : dim ? '#e4d9bd' : '#a7adb6',
        'font-weight': active ? 600 : 400,
      });
      txt.textContent = label;
      g.append(txt);
    };

    // відгалуження
    const reserveLabel = t('chain.powerReserve'), handsLabel = t('chain.hands');
    const rw = boxW(reserveLabel), hw = boxW(handsLabel);
    const rx = Math.max(4, (mid[0] + mid[1]) / 2 - rw / 2);
    const hx = mid[2] - hw / 2;
    g.append(svgEl('path', { d: `M${mid[0]} 52 C ${mid[0]} 40, ${rx + 20} 42, ${rx + 34} 40`,
      fill: 'none', stroke: '#3a4048', 'stroke-width': 1.2 }));
    g.append(svgEl('path', { d: `M${mid[1]} 52 C ${mid[1]} 40, ${rx + rw - 20} 42, ${rx + rw - 34} 40`,
      fill: 'none', stroke: '#3a4048', 'stroke-width': 1.2 }));
    box(rx, 12, rw, reserveLabel, here?.branch === 'reserve');
    g.append(svgEl('path', { d: `M${mid[2]} 52 L ${mid[2]} 40`, fill: 'none', stroke: '#3a4048', 'stroke-width': 1.2 }));
    box(hx, 12, hw, handsLabel, here?.branch === 'hands');

    // головний ряд + стрілки
    labels.forEach((label, i) => box(x[i], 52, w[i], label, here?.row === i, passed(i)));
    for (let i = 0; i < labels.length - 1; i++) {
      const a = x[i] + w[i] + 4, b = x[i + 1] - 4;
      g.append(svgEl('path', {
        d: `M${a} 67 L ${b} 67 M${b - 6} 63 L ${b} 67 L ${b - 6} 71`,
        fill: 'none', stroke: passed(i) ? '#caa84a' : '#4a5058', 'stroke-width': 1.4,
      }));
    }

    // петля ритму: баланс керує спуском, який його ж і живить
    const last = mid[4], esc = mid[3];
    g.append(svgEl('path', { d: `M${last} 82 C ${last} 92, ${esc} 92, ${esc} 82`,
      fill: 'none', stroke: '#c0304a', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
    const rate = svgEl('text', { x: (last + esc) / 2, y: 90, 'text-anchor': 'middle',
      fill: '#a05262', 'font-size': 10, 'font-family': 'IBM Plex Mono, monospace' });
    rate.textContent = t('chain.rate');
    g.append(rate);
    return s;
  }

  // ── Дії ─────────────────────────────────────────────────────────
  function go(i) {
    state.current = i;
    const s = STATIONS[i];
    state.visited.add(s.id);
    highlighter.focus(s.highlight);
    if (s.focus) { camera.toKey(s.focus); state.cam = null; }
    else { camera.overview(); state.cam = 'cam.overview'; }
    renderRail(); renderCard(); renderChain(); renderChrome();
  }

  function setMode(mode) {
    state.mode = mode;
    ui.classList.toggle('mode-free', mode === 'free');
    ui.classList.toggle('mode-lesson', mode === 'lesson');
    if (mode === 'free') highlighter.clear();
    else if (state.current !== null) highlighter.focus(STATIONS[state.current].highlight);
    onMode?.(mode);
    renderHeader();
  }

  function renderAll() { renderHeader(); renderRail(); renderChrome(); renderCard(); renderChain(); }

  /** Живі числа в шапці й підвалі — оновлюються з циклу рендеру. */
  function update() {
    const s = status();
    if (refs.mode) refs.mode.textContent = t(s.real ? 'status.realTime' : 'status.modelTime');
    if (refs.speed) refs.speed.textContent = `×${s.speed.toFixed(1)}`;
    if (refs.wind) refs.wind.textContent = `${Math.round(s.charge * 100)} %`;
    if (refs.clock) {
      const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
      refs.clock.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
  }

  onLangChange(renderAll);
  renderAll();

  return { update, go, setMode, state };
}
