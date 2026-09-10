// @vitest-environment jsdom
/**
 * The lesson panel — through its own interface.
 *
 * Until this suite existed, everything AROUND the panel was tested (`STATIONS`,
 * `readouts()`, `lineText()`) while the largest file in the project ran in no test at
 * all. The bugs, though, lived not in the pure functions but in how they were called.
 *
 * Here the real panel is mounted over the real movement, and what is visible is
 * checked: the rail, the card, the chain and the section must all say the same thing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountTestLesson } from './lessonHarness.js';
import { STATIONS } from '../src/lesson/stations.js';
import { t, setLang } from '../src/i18n.js';
import { sectionParts } from '../src/lesson/section.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const btn = (sel, text) => $$(`${sel} button`).find((b) => b.textContent.includes(text));

/** What each region currently shows — as one object, so they can be checked against each other. */
function screen() {
  const railCurrent = $$('#rail .stop').findIndex((b) => b.getAttribute('aria-current') === 'true');
  const chainActive = $$('#chain rect')
    .map((r, i) => [i, r.getAttribute('fill')])
    .filter(([, fill]) => fill === '#caa84a').length;
  return {
    railCurrent,
    cardTitle: $('#card .card-title')?.textContent ?? null,
    chainActive,
    finishVisible: $('#ui').classList.contains('mode-finish'),
    sectionHidden: $('#section').hidden,
    ui: $('#ui').className,
  };
}

describe('lesson panel (jsdom)', () => {
  beforeEach(() => { setLang('ua'); });

  it('opens on the start screen, with nowhere to go back to', () => {
    mountTestLesson();
    expect($('#card .eyebrow').textContent).toBe(t('card.start').toUpperCase());
    expect($('#card .placeholder').textContent).toBe(t('rail.empty'));
    // An empty rail: no station is current yet.
    expect(screen().railCurrent).toBe(-1);
    // At the very start «back» leads nowhere — and only here is the button disabled.
    expect($$('#card .nav button')[0].disabled).toBe(true);
  });

  it('one action — one screen: the rail, the card and the chain agree with each other', () => {
    const { lesson } = mountTestLesson();
    for (let i = 0; i < STATIONS.length; i++) {
      lesson.go(i);
      const s = screen();
      expect(s.railCurrent).toBe(i);
      expect(s.cardTitle).toBe(t(STATIONS[i].nameKey));
      // The chain highlights exactly one box — the one the station is at.
      expect(s.chainActive).toBe(1);
    }
  });

  it('every station points the camera at ITS OWN node', () => {
    // This is where the bug was: half the stations named a point that was not in the list
    // of camera presets, and the flight was silently replaced by the overview — the card
    // said «Winding» while the camera showed the whole movement.
    const { lesson, cam } = mountTestLesson();
    for (let i = 0; i < STATIONS.length; i++) {
      lesson.go(i);
      expect(cam.calls.at(-1), `station ${STATIONS[i].id}`).toBe(STATIONS[i].focus ?? 'overview');
    }
  });

  it('the chrome marks the view the camera is really at', () => {
    const { lesson, cam } = mountTestLesson();
    const pressed = () => $$('#stage-chrome .cams button')
      .find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null;

    lesson.go(3);                                  // the escapement — it is among the presets
    expect(cam.key).toBe('escapement');
    expect(pressed()).toBe(t('part.escapement'));

    lesson.go(2);                                  // the going train — the overview
    expect(pressed()).toBe(t('cam.overview'));

    lesson.go(0);                                  // winding — there is no preset…
    expect(cam.key).toBe('part.winding');          // …but the camera is there all the same
    expect(pressed(), 'no button is lying').toBe(null);
  });

  it('every station visited leaves a sentence in the rail', () => {
    const { lesson } = mountTestLesson();
    expect($('#rail .collected p').textContent).toBe(t('rail.empty'));
    lesson.go(0); lesson.go(1); lesson.go(2);
    expect($$('#rail .bars i.on, #rail .bars i.now')).toHaveLength(3);
    expect($('#rail .collected p').textContent).toContain(t('st.train.line'));
  });

  it('swapping the escapement module redraws both the card and the section', () => {
    const { lesson, cam, movement } = mountTestLesson();
    lesson.go(3);
    btn('#card', t('variants.open')).click();
    expect($('#variants').hidden).toBe(false);

    const rows = $$('#variants .v-row');
    rows[1].click();                                  // the tourbillon
    btn('#variants', t('variants.apply')).click();

    expect(movement.escapement.installed).toBe('tourbillon');
    expect($('#variants').hidden).toBe(true);
    // The camera is taken to the socket — that is an event, not state, so it is checked as an event.
    expect(cam.calls.at(-1)).toBe('escapement');
    // The section must follow the installed variant rather than stay on the old one.
    btn('#stage-chrome', t('view.side')).click();
    expect($('#section').hidden).toBe(false);
    expect($('#section').innerHTML).not.toBe('');
  });

  it('from station 1 you can go back to the beginning, and what was collected stays', () => {
    // The start screen was a one-way door: the «beginning» button was in place, but
    // disabled, and no path led there.
    const { lesson, cam } = mountTestLesson();
    lesson.go(0); lesson.go(1); lesson.go(0);

    const back = $$('#card .nav button')[0];
    expect(back.disabled).toBe(false);
    expect(back.textContent).toBe(`← ${t('card.start')}`);

    back.click();
    expect(screen().railCurrent).toBe(-1);
    expect($('#card .eyebrow').textContent).toBe(t('card.start').toUpperCase());
    expect(cam.calls.at(-1)).toBe('overview');
    // A return is not a new run: what was collected stays, and the text admits it.
    expect($$('#rail .bars i.on, #rail .bars i.now')).toHaveLength(2);
    expect($('#card .placeholder').textContent).toBe(t('card.resume'));
  });

  it('the modal shows what a module DOES, not only what it costs', () => {
    // #13 moved the construction-dependent numbers here — but only the cost arrived, and
    // the behaviour stayed prose without a single number.
    const { lesson, settings } = mountTestLesson();
    lesson.go(3);
    btn('#card', t('variants.open')).click();

    const row = (key) => {
      const tr = $$('#variants .v-table tr')
        .find((r) => r.querySelector('.k')?.textContent === t(key));
      return [...tr.children].slice(1).map((td) => td.textContent);
    };
    const s = (x) => `${x} ${t('unit.s')}`;

    // 2.5 beats/s → a turn of the escape arbor in 12 s. In the tourbillon the wheel also rolls.
    // The dash in the third column is not «not built yet» any more: the double-axis module
    // exists, and the question has no answer for it — the wheel's motion against the plate
    // is a composition of rotations about axes at a right angle.
    expect(row('variants.metric.escapeTurn')).toEqual([s(12), s(6), '—']);
    expect(row('variants.metric.cageTurn')).toEqual(['—', s(12), s(12)]);
    expect(row('variants.metric.innerTurn')).toEqual(['—', '—', s(6)]);

    // The numbers are derived from the rate, not typed in: twice the rate, half the periods.
    settings.set('beatHz', 5);
    btn('#variants', t('variants.keep')).click();
    btn('#card', t('variants.open')).click();
    expect(row('variants.metric.escapeTurn')).toEqual([s(6), s(3), '—']);
    expect(row('variants.metric.cageTurn')).toEqual(['—', s(6), s(6)]);
    expect(row('variants.metric.innerTurn')).toEqual(['—', '—', s(3)]);
  });

  it('the modules\' silhouettes are drawn at one scale', () => {
    // The modal's promise: the difference in height is shown honestly. It rests on all
    // three silhouettes being projected by one mapping with one set of numbers — separate
    // `X()`/`Y()` per drawing would not keep that promise.
    const { lesson } = mountTestLesson();
    lesson.go(3);
    btn('#card', t('variants.open')).click();

    const escOf = (v) => sectionParts(v).parts.filter((x) => x.mod === 'escapement');
    const zBase = Math.min(...['lever', 'tourbillon'].flatMap((v) => escOf(v).map((x) => x.z0)));
    const realAbove = (v) => Math.max(...escOf(v).map((x) => x.z1)) - zBase;

    // The top of the tallest part above the shared base — a raw position, no rounding.
    // The base comes from the plate line the silhouette draws itself, rather than being typed in.
    const drawnAbove = (i) => {
      const sil = $$('#variants .v-row')[i].querySelector('.sil');
      const base = Number(sil.querySelector('line').getAttribute('y1')) - 1;
      const ys = [...sil.querySelectorAll('rect')].map((r) => Number(r.getAttribute('y')));
      return base - Math.min(...ys);
    };

    expect(drawnAbove(1) / drawnAbove(0))
      .toBeCloseTo(realAbove('tourbillon') / realAbove('lever'), 6);
  });

  it('the last step leads to the summary, and «again» starts from the beginning', () => {
    const { lesson } = mountTestLesson();
    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();

    const fin = screen();
    expect(fin.finishVisible).toBe(true);
    expect(fin.sectionHidden).toBe(true);
    // The six collected sentences — one per station.
    expect($$('#finish .line')).toHaveLength(STATIONS.length);

    btn('#finish', t('finish.again')).click();
    const after = screen();
    expect(after.finishVisible).toBe(false);
    // The start screen itself, not the first station: it carries the sentence that
    // explains the whole route, and that is what someone starting again needs.
    expect(after.railCurrent).toBe(-1);
    expect($('#card .eyebrow').textContent).toBe(t('card.start').toUpperCase());
    // What was visited is cleared — and the text honestly promises emptiness again.
    expect($$('#rail .bars i.on, #rail .bars i.now')).toHaveLength(0);
    expect($('#card .placeholder').textContent).toBe(t('rail.empty'));
  });

  it('free mode and back does not lose the station', () => {
    const { lesson } = mountTestLesson();
    lesson.go(2);
    lesson.setMode('free');
    expect($('#ui').classList.contains('mode-free')).toBe(true);
    expect($('#to-lesson').hidden).toBe(false);

    lesson.setMode('lesson');
    expect(screen().railCurrent).toBe(2);
    expect(screen().cardTitle).toBe(t(STATIONS[2].nameKey));
  });

  it('the showcase is a third mode: the scene alone, and back without losing the station', () => {
    const { lesson } = mountTestLesson();
    lesson.go(2);
    lesson.setMode('showcase');
    expect($('#ui').classList.contains('mode-showcase')).toBe(true);
    expect($('#ui').classList.contains('mode-free')).toBe(false);
    expect($('#to-lesson').hidden).toBe(false);

    lesson.setMode('lesson');
    expect(screen().railCurrent).toBe(2);
    expect(screen().cardTitle).toBe(t(STATIONS[2].nameKey));
  });

  it('setMode throws on an unknown mode rather than staying silent', () => {
    const { lesson } = mountTestLesson();
    expect(() => lesson.setMode('no-such-thing')).toThrow();
  });

  it('switching the language redraws the whole screen', () => {
    const { lesson } = mountTestLesson();
    lesson.go(1);
    $$('#hdr .seg.lang button')[1].click();   // EN
    expect(screen().cardTitle).toBe(t(STATIONS[1].nameKey));
    // No Cyrillic is left in the rail, the card or the chain.
    // The exception is the green marker: it quotes the NAME of a real test from the suite,
    // and a test name is an identifier, not interface text. Translating it would break the
    // link the meta-test checks.
    for (const id of ['rail', 'card', 'chain']) {
      const node = document.getElementById(id).cloneNode(true);
      node.querySelectorAll('.marker.ok i').forEach((n) => n.remove());
      expect(node.textContent).not.toMatch(/[а-яіїєґ]/i);
    }
    setLang('ua');
  });

  it('update() refreshes the numbers without rebuilding the card', () => {
    const { lesson, statusOut } = mountTestLesson();
    lesson.go(4);
    const card = $('#card');
    const before = card.firstChild;
    statusOut.time = 125;
    statusOut.charge = 0.5;
    lesson.update();
    // The same node: redrawing every frame would knock the slider out from under the cursor.
    expect(card.firstChild).toBe(before);
    expect($('#chain .clock b').textContent).toBe('02:05');
  });

  it('the section shows only from the side, only in the lesson, and not on the summary', () => {
    const { lesson } = mountTestLesson();
    lesson.go(0);
    expect($('#section').hidden).toBe(true);

    btn('#stage-chrome', t('view.side')).click();
    expect($('#section').hidden).toBe(false);
    expect($('#hint').hidden).toBe(true);

    lesson.setMode('free');
    expect($('#section').hidden).toBe(true);

    lesson.setMode('lesson');
    expect($('#section').hidden).toBe(false);
    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();
    expect($('#section').hidden).toBe(true);
  });

  it('the highlight follows the station and goes out outside the lesson', () => {
    const { lesson, highlighter } = mountTestLesson();
    expect(highlighter.dimCount()).toBe(0);   // at the start — everything at full strength

    lesson.go(0);
    expect(highlighter.dimCount()).toBeGreaterThan(0);

    lesson.setMode('free');
    expect(highlighter.dimCount()).toBe(0);   // free mode dims nothing

    lesson.setMode('lesson');
    expect(highlighter.dimCount()).toBeGreaterThan(0);

    lesson.go(STATIONS.length - 1);
    btn('#card', t('card.summary')).click();
    expect(highlighter.dimCount()).toBe(0);   // the summary shows the whole movement
  });
});
