import './lesson.css';
import { t, tn, tf, getLang, setLang, onLangChange, LANGS } from '../i18n.js';
import { readouts } from './readouts.js';
import { renderSection } from './sectionView.js';
import { lineText, maybe } from './cardText.js';
import { STATIONS } from './stations.js';
import { mountVariantsModal } from './variantsModal.js';
import { el, svgEl } from './draw.js';

/**
 * The lesson shell: the header, the left rail of stations, the card and the footer chain.
 *
 * The panel knows nothing about three.js — it only says which station is chosen. The
 * highlight and the camera come from outside, so the lesson can be tested without a scene.
 */


/** The chain in the footer: the main row + two branches + the rhythm loop. */
const CHAIN_MAIN = ['chain.winding', 'chain.barrel', 'chain.train', 'chain.escape', 'chain.balance'];

export function mountLesson({ highlighter, camera, status, onMode, settings, run, escapement, planned = [] }) {
  const params = settings.values;   // read by the render loop; writes go only through settings.set()
  const ui = document.getElementById('ui');
  const state = { mode: 'lesson', current: null, visited: new Set(), view: 'top', finished: false };

  const refs = {};   // live nodes of the header and the footer

  // Free mode hides the whole header along with the mode switch, so the way back lives
  // as a separate button right in the scene.
  const back = document.getElementById('to-lesson');
  back.addEventListener('click', () => setMode('lesson'));
  let dyn = [];      // card nodes carrying live numbers: {node, fn}

  // The snapshot buffer: `update()` is called every frame, so a new object per frame
  // would mean garbage in the render loop. The snapshot is read synchronously and never
  // stored, so one buffer per panel is safe.
  const buf = {};
  const inp = { beatHz: 0, amplitude: 0, speed: 1, charge: 0 };

  /** The current snapshot of the numbers — constants from the constants, variables from the settings and the charge. */
  function snap() {
    inp.beatHz = params.beatHz;
    inp.amplitude = params.amplitude;
    inp.speed = params.speed;
    inp.charge = status().charge;
    return readouts(inp, buf);
  }

  /**
   * Text that updates itself. The card must not be redrawn every frame: a slider would
   * slip out from under the cursor mid-drag.
   */
  function live(fn) {
    const node = document.createTextNode(fn(snap()));
    dyn.push({ node, fn });
    return node;
  }

  // ── Header ──────────────────────────────────────────────────────
  function renderHeader() {
    const h = document.getElementById('hdr');
    h.replaceChildren();

    const brand = el('div', 'brand');
    brand.append(gearIcon(), el('b', null, 'SimWatch'),
                 el('span', 'ver', `v${__APP_VERSION__}`),
                 el('span', 'sub', t('app.subtitle')));
    h.append(brand);

    h.append(segmented([
      [t('mode.lesson'), state.mode === 'lesson', () => setMode('lesson')],
      [t('mode.free'), state.mode === 'free', () => setMode('free')],
      [t('mode.showcase'), state.mode === 'showcase', () => setMode('showcase')],
    ]));

    h.append(el('div', 'spacer'));

    const st = el('div', 'status');
    refs.mode = el('span', 'mode'); refs.speed = el('b'); refs.wind = el('b');
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

  // ── Left rail ───────────────────────────────────────────────────
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
      // Show the last two sentences — the rest wait for the summary.
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

  // ── Scene chrome: camera presets + view ─────────────────────────
  function renderChrome() {
    const box = document.getElementById('stage-chrome');
    box.replaceChildren();

    // Where the camera is pointed is known to the camera — the panel keeps no copy of
    // the answer. It used to, and the copy parted from reality every time a station asked
    // for a point that was not in the list of presets.
    const cams = el('div', 'cams');
    const camBtn = (label, on, fn) => {
      const b = el('button', null, label);
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => { fn(); render(); });
      return b;
    };
    cams.append(camBtn(t('cam.overview'), camera.current === null, () => camera.overview()));
    for (const { id, nameKey } of camera.targets()) {
      cams.append(camBtn(t(nameKey), camera.current === id, () => camera.goto(id)));
    }
    box.append(cams);

    cams.style.display = state.view === 'side' ? 'none' : ''; // the camera is of no use in the section

    box.append(segmented([
      [t('view.top'), state.view === 'top', () => setView('top')],
      [t('view.side'), state.view === 'side', () => setView('side')],
    ], 'mini'));
  }

  // ── Station card ────────────────────────────────────────────────
  function renderCard() {
    const card = document.getElementById('card');
    card.replaceChildren();
    dyn = [];

    if (state.current === null) {
      // The empty state: the heading is the chain's name, not the app's (that is in the header).
      card.append(el('div', 'eyebrow', t('card.start').toUpperCase()));
      card.append(el('div', 'card-title', t('rail.title')));
      // The text depends on whether anything has been collected: the promise «empty, this
      // is the first stop» would be untrue for someone who came back here.
      card.append(el('div', 'placeholder', t(state.visited.size ? 'card.resume' : 'rail.empty')));
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

    // ── How it is computed ──
    const fBlock = el('div', 'block');
    fBlock.append(el('b', null, t('card.formula')));
    const fBox = el('div', 'formula');
    s.formula(r).forEach((line, i) => {
      // The line is re-read by index from a fresh snapshot — that way the live numbers
      // update while the markup stays where it is.
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

    // ── Try it ──
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

  /** The ladder of gear ratios — for the «Going train» station. */
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

  /** One knob: a button, a slider or a toggle. */
  function control(c) {
    const wrapEl = el('div', 'control');
    if (c.kind === 'button') {
      const b = el('button', 'act', t(c.labelKey));
      b.addEventListener('click', () => run(c.action));
      wrapEl.append(b);
      return wrapEl;
    }
    if (c.kind === 'variants') {
      const b = el('button', 'act', t(c.labelKey));
      b.addEventListener('click', () => variants.show());
      wrapEl.append(b);
      return wrapEl;
    }
    // Below: knobs over the settings. A station names only the parameter; the kind,
    // bounds, step, format and label come from the table — the same one the free-mode
    // panel is built from, so they cannot drift apart.
    const spec = settings.spec(c.param);

    if (c.kind === 'toggle') {
      wrapEl.append(segmented(spec.options.map(([val, key]) => [
        t(key), params[c.param] === val, () => { settings.set(c.param, val); render(); },
      ])));
      return wrapEl;
    }
    const row = el('div', 'row');
    const val = el('b', null, spec.fmt(params[c.param]));
    row.append(el('span', null, t(spec.labelKey)), val);
    const input = document.createElement('input');
    input.type = 'range';
    Object.assign(input, { min: spec.min, max: spec.max, step: spec.step, value: params[c.param] });
    input.addEventListener('input', () => {
      val.textContent = spec.fmt(settings.set(c.param, input.value));
      update(); // the card's numbers depend on the rate — refresh without redrawing
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
    // The «start» button was here from the beginning — but disabled, so the start screen
    // became a one-way door: no path led back to it. The arrow appears exactly when the
    // button does something.
    const atStart = i === null;
    const prev = el('button', null, atStart ? t('card.start')
      : i === 0 ? `← ${t('card.start')}` : `← ${t(STATIONS[i - 1].nameKey)}`);
    prev.disabled = atStart;
    if (!atStart) prev.addEventListener('click', () => (i === 0 ? goStart() : go(i - 1)));

    const atEnd = i !== null && i === STATIONS.length - 1;
    const next = el('button', 'next', atEnd
      ? `${t('card.summary')} →` : `${t(STATIONS[(i ?? -1) + 1].nameKey)} →`);
    next.addEventListener('click', () => (atEnd ? showFinish() : go((i ?? -1) + 1)));

    row.append(prev, next);
    return row;
  }

  // ── Footer: the chain ───────────────────────────────────────────
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

  /**
   * A box's width from its text.
   *
   * AN ASSUMPTION covering two languages: the font ships with the app, the size is fixed
   * (11.5 px IBM Plex Sans), and Latin and Cyrillic are about equally wide in it — hence
   * 6.7 px per character. Real measurement (`getComputedTextLength`) needs a node already
   * in the document, so the box would have to be drawn twice. A third language with wider
   * glyphs (CJK, say) will not survive this assumption — at that point measurement comes
   * here, not a bigger coefficient.
   */
  const CHAR_W = 6.7, BOX_PAD = 24, BOX_MIN = 64;
  const boxW = (label) => Math.max(BOX_MIN, Math.round(label.length * CHAR_W) + BOX_PAD);

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

    // branches
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

    // the main row + arrows
    labels.forEach((label, i) => box(x[i], 52, w[i], label, here?.row === i, passed(i)));
    for (let i = 0; i < labels.length - 1; i++) {
      const a = x[i] + w[i] + 4, b = x[i + 1] - 4;
      g.append(svgEl('path', {
        d: `M${a} 67 L ${b} 67 M${b - 6} 63 L ${b} 67 L ${b - 6} 71`,
        fill: 'none', stroke: passed(i) ? '#caa84a' : '#4a5058', 'stroke-width': 1.4,
      }));
    }

    // the rhythm loop: the balance governs the escapement, which in turn feeds it
    const last = mid[4], esc = mid[3];
    g.append(svgEl('path', { d: `M${last} 82 C ${last} 92, ${esc} 92, ${esc} 82`,
      fill: 'none', stroke: '#c0304a', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
    const rate = svgEl('text', { x: (last + esc) / 2, y: 90, 'text-anchor': 'middle',
      fill: '#a05262', 'font-size': 10, 'font-family': 'IBM Plex Mono, monospace' });
    rate.textContent = t('chain.rate');
    g.append(rate);
    return s;
  }

  /** The section is drawn from the same `layout…()` as the scene — it cannot drift apart. */
  function drawSection() {
    const host = document.getElementById('section');
    const on = state.view === 'side' && state.mode === 'lesson' && !state.finished;
    host.hidden = !on;
    document.getElementById('hint').hidden = on; // the orbit hint is of no use in the section
    if (!on) return;
    const s = state.current === null ? null : STATIONS[state.current];
    renderSection(host, s ? new Set(s.highlight.mods ?? []) : null, escapement.installed);
  }

  function setView(v) {
    state.view = v;
    render();
  }

  // ── The route's summary ─────────────────────────────────────────
  function renderFinish() {
    const host = document.getElementById('finish');
    host.replaceChildren();
    const box = el('div', 'fin');

    const head = el('div', 'fin-head');
    head.append(el('div', 'eyebrow', t('finish.eyebrow')));
    head.append(el('h1', null, t('finish.title')));
    head.append(el('p', null, t('finish.lead')));
    box.append(head);

    // The six collected sentences — together they are the description of the movement.
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
      go(2); setView('side');
    }));
    cards.append(nextCard('mode.free', 'finish.freeBody', () => setMode('free')));
    nextBlock.append(cards);
    box.append(nextBlock);

    const actions = el('div', 'fin-actions');
    const again = el('button', 'primary', t('finish.again'));
    // The beginning is the start screen, not the first station: it carries the sentence
    // that explains the whole route, and that is what someone starting again needs.
    again.addEventListener('click', () => { state.visited.clear(); goStart(); });
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
    camera.overview();
    render();
  }

  // ── Actions ─────────────────────────────────────────────────────
  function go(i) {
    const s = STATIONS[i];
    state.finished = false;
    state.current = i;
    state.visited.add(s.id);
    // A station names its point by a stable `id`; an unknown id is an error, not a quiet
    // overview.
    if (s.focus) camera.goto(s.focus); else camera.overview();
    render();
  }

  /**
   * Go back to the start screen.
   *
   * What has been visited is NOT reset: this is a return, not a new run — the rail on the
   * left keeps the collected sentences. Only «Run again» on the summary clears them.
   */
  function goStart() {
    state.finished = false;
    state.current = null;
    camera.overview();
    render();
  }

  function setMode(mode) {
    if (mode !== 'lesson' && mode !== 'free' && mode !== 'showcase')
      throw new Error(`unknown mode: ${mode}`);
    state.mode = mode;
    state.finished = false;
    back.hidden = mode === 'lesson'; // the way out of the full-screen modes — otherwise a one-way door
    onMode?.(mode);
    render();
  }

  /**
   * The ONE place where what is on screen is decided.
   *
   * An action changes `state` and calls `render()` — nothing else. Until now every action
   * remembered for itself which of the five `render…()` it needed, and a state nobody
   * thought to call the right set for became unreachable (which is exactly what happened
   * to the start screen).
   *
   * The camera is NOT part of this: a camera flight is an event, not a projection of
   * state; redrawing the card must not send the camera flying again. The highlight IS
   * part of it — it is idempotent and describes precisely the state.
   */
  function render() {
    back.textContent = t('mode.back');

    const lesson = state.mode === 'lesson';
    const showcase = state.mode === 'showcase';
    ui.classList.toggle('mode-free', state.mode === 'free');
    ui.classList.toggle('mode-showcase', showcase);
    ui.classList.toggle('mode-finish', lesson && state.finished);
    ui.classList.toggle('mode-lesson', lesson && !state.finished);

    highlighter.focus(lesson && !state.finished && state.current !== null
      ? STATIONS[state.current].highlight : null);

    renderHeader();
    renderRail();
    renderChrome();
    // The summary and the card share one grid cell: we render whichever's turn it is and
    // leave the other alone — the shell's class hides it.
    if (state.finished) renderFinish(); else renderCard();
    renderChain();
    drawSection();
  }

  /** The live numbers in the header and footer — refreshed from the render loop. */
  function update() {
    // In free mode neither the header nor the card is on screen. Free mode is the app as
    // it was before v2.0.0, so it must not pay for the Explore layer.
    if (state.mode !== 'lesson') return;
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

  // ── The «Variants» modal ────────────────────────────────────────
  const variants = mountVariantsModal({
    escapement,
    planned,
    beatHz: () => params.beatHz,
    onApply(id) {
      escapement.install(id);
      // The movement never stopped and noticed nothing — but the eye could have missed
      // the swap on the overview, so we take the camera to the escapement.
      camera.goto('escapement');
      render();   // the installed variant's name lives on the card and in the section
    },
  });

  onLangChange(render);
  render();

  return { update, go, setMode, state };
}
