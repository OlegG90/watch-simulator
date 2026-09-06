import './lesson.css';
import { t, tn, tf, getLang, setLang, onLangChange, LANGS } from '../i18n.js';
import { readouts } from './readouts.js';
import { renderSection } from './sectionView.js';
import { lineText, maybe } from './cardText.js';
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

export function mountLesson({ highlighter, camera, status, onMode, params, run }) {
  const ui = document.getElementById('ui');
  const state = { mode: 'lesson', current: null, visited: new Set(), cam: 'cam.overview', view: 'top', finished: false };

  const refs = {};   // живі вузли шапки й підвала
  let dyn = [];      // вузли картки з живими числами: {node, fn}

  /** Поточний знімок чисел — сталі з констант, змінні з налаштувань і заряду. */
  const snap = () => readouts({
    beatHz: params.beatHz, amplitude: params.amplitude,
    speed: params.speed, charge: status().charge,
  });

  /**
   * Текст, що сам себе оновлює. Перемальовувати картку щокадру не можна:
   * повзунок вислизнув би з-під курсора посеред перетягування.
   */
  function live(fn) {
    const node = document.createTextNode(fn(snap()));
    dyn.push({ node, fn });
    return node;
  }

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
    box.append(el('b', null, t('rail.collected')));
    const got = STATIONS.filter((x) => state.visited.has(x.id));
    if (got.length === 0) {
      box.append(el('p', null, t('rail.empty')));
    } else {
      const p = el('p');
      // Показуємо два останні речення — решта чекає на підсумку.
      got.slice(-2).forEach((x, k) => {
        if (k) p.append(document.createElement('br'));
        const num = el('span', null, `${STATIONS.indexOf(x) + 1}. `);
        num.style.color = '#6f757e';
        p.append(num, document.createTextNode(t(`st.${x.id}.line`)));
      });
      box.append(p);
      if (got.length > 2) box.append(el('div', 'more', tn('rail.more', got.length - 2)));
    }
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

    cams.style.display = state.view === 'side' ? 'none' : ''; // камера в розрізі ні до чого

    box.append(segmented([
      [t('view.top'), state.view === 'top', () => setView('top')],
      [t('view.side'), state.view === 'side', () => setView('side')],
    ], 'mini'));
  }

  // ── Картка станції ──────────────────────────────────────────────
  function renderCard() {
    const card = document.getElementById('card');
    card.replaceChildren();
    dyn = [];

    if (state.current === null) {
      card.append(el('div', 'eyebrow', t('rail.title').toUpperCase()));
      card.append(el('div', 'card-title', t('app.subtitle')));
      card.append(el('div', 'placeholder', t('rail.empty')));
      card.append(navRow());
      return;
    }

    const s = STATIONS[state.current];
    const r = snap();

    card.append(el('div', 'eyebrow', tn('card.station', state.current + 1)));
    card.append(el('div', 'card-title', t(s.nameKey)));
    card.append(el('div', 'card-sub', t(`${s.nameKey}.sub`)));

    const prose = el('div', 'prose');
    prose.append(s.proseVals ? live((x) => maybe(s.prose, s.proseVals(x))) : document.createTextNode(t(s.prose)));
    card.append(prose);

    const idea = el('div', 'idea');
    idea.append(el('b', null, t('card.idea')), el('p', null, t(s.idea)));
    card.append(idea);

    // ── Як це рахується ──
    const fBlock = el('div', 'block');
    fBlock.append(el('b', null, t('card.formula')));
    const fBox = el('div', 'formula');
    s.formula(r).forEach((line, i) => {
      // Рядок перечитується за індексом із свіжого знімка — так живі числа
      // оновлюються, а розмітка лишається на місці.
      const text = (x) => lineText(s.formula(x)[i]);
      const isDyn = Boolean(line.vals);
      const node = el(line.note ? 'span' : 'div', line.note ? 'note' : null);
      node.append(isDyn ? live(text) : document.createTextNode(text(r)));
      fBox.append(node);
    });
    fBlock.append(fBox);

    if (s.ladder) fBlock.append(ladder(r));
    else if (s.stats) {
      const row = el('div', 'stats');
      s.stats(r).forEach(([labelKey], i) => {
        const box = el('div', 'stat');
        const val = el('b');
        val.append(live((x) => s.stats(x)[i][1]));
        box.append(el('i', null, t(labelKey)), val);
        row.append(box);
      });
      fBlock.append(row);
    }
    card.append(fBlock);

    // ── Спробуйте ──
    const tBlock = el('div', 'block');
    tBlock.append(el('b', null, t('card.try')));
    const ctl = el('div', 'controls');
    for (const c of s.controls ?? []) ctl.append(control(c));
    tBlock.append(ctl);
    const hint = el('div', 'hint-text');
    hint.append(s.hintVals ? live((x) => maybe(s.hint, s.hintVals(x))) : document.createTextNode(t(s.hint)));
    tBlock.append(hint);
    card.append(tBlock);

    card.append(el('div', 'spacer'));
    if (s.simplification) card.append(marker('warn', 'card.simplified', t(s.simplification)));
    card.append(marker('ok', 'card.verified', `«${s.test}»`));
    card.append(navRow());
  }

  /** Драбина передавальних відношень — для станції «Колісна передача». */
  function ladder(r) {
    const box = el('div', 'ladder');
    r.ratios.forEach((row, i) => {
      const d = el('div');
      if (i === r.ratios.length - 1) d.className = 'last';
      d.append(el('span', 'nm', t(row.nameKey)), el('span', 'pr', row.pair ?? '—'),
               el('span', 'om', `${row.omega > 0 ? '+' : ''}${row.omega.toFixed(2)}×`));
      box.append(d);
    });
    return box;
  }

  /** Одна ручка: кнопка, повзунок або перемикач. */
  function control(c) {
    const wrapEl = el('div', 'control');
    if (c.kind === 'button') {
      const b = el('button', 'act', t(c.labelKey));
      b.addEventListener('click', () => run(c.action));
      wrapEl.append(b);
      return wrapEl;
    }
    if (c.kind === 'toggle') {
      wrapEl.append(segmented(c.options.map(([val, key]) => [
        t(key), params[c.param] === val, () => { params[c.param] = val; renderCard(); },
      ])));
      return wrapEl;
    }
    const row = el('div', 'row');
    const val = el('b', null, c.fmt(params[c.param]));
    row.append(el('span', null, t(c.labelKey)), val);
    const input = document.createElement('input');
    input.type = 'range';
    Object.assign(input, { min: c.min, max: c.max, step: c.step, value: params[c.param] });
    input.addEventListener('input', () => {
      params[c.param] = Number(input.value);
      val.textContent = c.fmt(params[c.param]);
      update(); // числа в картці залежать від ходу — оновити, не перемальовуючи
    });
    wrapEl.append(row, input);
    return wrapEl;
  }

  function marker(kind, titleKey, body) {
    const m = el('div', `marker ${kind}`);
    m.append(kind === 'ok' ? checkIcon() : warnIcon());
    const s = el('span');
    s.append(document.createTextNode(t(titleKey)), el('i', null, body));
    m.append(s);
    return m;
  }

  function warnIcon() {
    const s = svgEl('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
      stroke: '#caa84a', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    s.append(svgEl('path', { d: 'M12 9v4M12 17h.01M10.3 3.9L2 18a1.9 1.9 0 0 0 1.7 2.8h16.6A1.9 1.9 0 0 0 22 18L13.7 3.9a1.9 1.9 0 0 0-3.4 0z' }));
    return s;
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
    next.addEventListener('click', () => (atEnd ? showFinish() : go((i ?? -1) + 1)));

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

  function chainSvg({ all = false } = {}) {
    const here = all ? null : state.current === null ? null : STATIONS[state.current].chain;
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

    const passed = (i) => all || (here?.row !== undefined && i < here.row);
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
    box(rx, 12, rw, reserveLabel, here?.branch === 'reserve', all);
    g.append(svgEl('path', { d: `M${mid[2]} 52 L ${mid[2]} 40`, fill: 'none', stroke: '#3a4048', 'stroke-width': 1.2 }));
    box(hx, 12, hw, handsLabel, here?.branch === 'hands', all);

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

  /** Розріз малюється з тих самих `layout…()`, що й сцена — розійтися не може. */
  function drawSection() {
    const host = document.getElementById('section');
    const on = state.view === 'side' && state.mode === 'lesson';
    host.hidden = !on;
    document.getElementById('hint').hidden = on; // підказка про орбіту в розрізі ні до чого
    if (!on) return;
    const s = state.current === null ? null : STATIONS[state.current];
    renderSection(host, s ? new Set(s.highlight.mods ?? []) : null);
  }

  function setView(v) {
    state.view = v;
    drawSection();
    renderChrome();
  }

  // ── Підсумок маршруту ───────────────────────────────────────────
  function renderFinish() {
    const host = document.getElementById('finish');
    host.replaceChildren();
    const box = el('div', 'fin');

    const head = el('div', 'fin-head');
    head.append(el('div', 'eyebrow', t('finish.eyebrow')));
    head.append(el('h1', null, t('finish.title')));
    head.append(el('p', null, t('finish.lead')));
    box.append(head);

    // Шість зібраних речень — разом вони і є описом ходу.
    const grid = el('div', 'lines');
    STATIONS.forEach((st, i) => {
      const row = el('div', 'line');
      row.append(el('span', 'n', String(i + 1)));
      const body = el('div');
      body.append(el('i', null, t(st.nameKey).toLowerCase()), el('p', null, t(`st.${st.id}.line`)));
      row.append(body);
      grid.append(row);
    });
    box.append(grid);

    const chain = el('div', 'fin-chain');
    chain.append(chainSvg({ all: true }), el('p', null, t('finish.loop')));
    box.append(chain);

    const nextBlock = el('div', 'block');
    nextBlock.append(el('b', null, t('finish.next')));
    const cards = el('div', 'next-grid');
    cards.append(nextCard('finish.side', 'finish.sideBody', () => {
      hideFinish(); go(2); setView('side');
    }));
    cards.append(nextCard('mode.free', 'finish.freeBody', () => setMode('free')));
    nextBlock.append(cards);
    box.append(nextBlock);

    const actions = el('div', 'fin-actions');
    const again = el('button', 'primary', t('finish.again'));
    again.addEventListener('click', () => { hideFinish(); state.visited.clear(); go(0); });
    const toFree = el('button', null, t('finish.goFree'));
    toFree.addEventListener('click', () => setMode('free'));
    actions.append(again, toFree, el('span', null, t('finish.footnote')));
    box.append(actions);

    host.append(box);
  }

  function nextCard(titleKey, bodyKey, fn) {
    const b = el('button', 'next-card');
    const body = el('div');
    body.append(el('b', null, t(titleKey)), el('span', null, t(bodyKey)));
    b.append(body);
    b.addEventListener('click', fn);
    return b;
  }

  function showFinish() {
    state.finished = true;
    ui.classList.remove('mode-lesson');
    ui.classList.add('mode-finish');
    highlighter.clear();
    camera.overview();
    document.getElementById('section').hidden = true;
    renderFinish();
    renderHeader();
  }

  function hideFinish() {
    state.finished = false;
    ui.classList.remove('mode-finish');
    ui.classList.add('mode-lesson');
  }

  // ── Дії ─────────────────────────────────────────────────────────
  function go(i) {
    if (state.finished) hideFinish();
    state.current = i;
    const s = STATIONS[i];
    state.visited.add(s.id);
    highlighter.focus(s.highlight);
    if (s.focus) { camera.toKey(s.focus); state.cam = null; }
    else { camera.overview(); state.cam = 'cam.overview'; }
    renderRail(); renderCard(); renderChain(); renderChrome(); drawSection();
  }

  function setMode(mode) {
    state.mode = mode;
    state.finished = false;
    ui.classList.remove('mode-finish');
    ui.classList.toggle('mode-free', mode === 'free');
    ui.classList.toggle('mode-lesson', mode === 'lesson');
    if (mode === 'free') highlighter.clear();
    else if (state.current !== null) highlighter.focus(STATIONS[state.current].highlight);
    onMode?.(mode);
    renderHeader();
    drawSection();
  }

  function renderAll() { renderHeader(); renderRail(); renderChrome(); renderCard(); renderChain(); drawSection(); }

  /** Живі числа в шапці й підвалі — оновлюються з циклу рендеру. */
  function update() {
    const s = status();
    const r = snap();
    for (const d of dyn) {
      const next = d.fn(r);
      if (d.node.nodeValue !== next) d.node.nodeValue = next;
    }
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
