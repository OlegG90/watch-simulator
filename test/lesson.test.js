import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';
import { createHighlighter } from '../src/lesson/highlight.js';
import { STATIONS } from '../src/lesson/stations.js';
import { LANGS, dictKeys, t, tf, getLang, setLang, onLangChange } from '../src/i18n.js';
import { readouts } from '../src/lesson/readouts.js';
import { VARIANT_IDS, DEFAULT_VARIANT } from '../src/escapement/index.js';
import { lineText, maybe } from '../src/lesson/cardText.js';
import { sectionParts } from '../src/lesson/section.js';
import { CAGE_R } from '../src/movement.js';
import { balanceR } from '../src/escapement/tourbillon.js';
import { BALANCE_R, ESC_R, FORK_REACH } from '../src/escapement/lever.js';
import { profile as motionProfile } from '../src/motionWorks.js';
import { profile as reserveProfile } from '../src/powerReserve.js';
import { layoutTrain } from '../src/train.js';
import { createSettings } from '../src/settings.js';

const mat = () => new THREE.MeshStandardMaterial();
const build = () => buildMovement({
  brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
  plateMat: mat(), bluedMat: mat(),
  springSteel: mat(), backdropMat: mat(), cageMat: mat(),
});

describe('i18n', () => {
  beforeEach(() => setLang('ua'));

  it('the key sets are identical in every language', () => {
    const base = [...dictKeys(LANGS[0])].sort();
    for (const l of LANGS) expect([...dictKeys(l)].sort(), `language ${l}`).toEqual(base);
  });

  it('no GUI label is written past the dictionary', () => {
    // Key parity does not catch hard-coding: a string written straight into `.name()` never
    // reaches the dictionary at all and stays Ukrainian for EN.
    const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const bad = [...src.matchAll(/\.name\(\s*(['"`])(.*?)\1\s*\)/g)]
      .map((m) => m[2])
      .filter((s) => /[Ѐ-ӿ]/.test(s) && s !== 'УКР');
    expect(bad, 'labels bypassing t(): ' + bad.join(' | ')).toEqual([]);
  });

  it('src/ carries no Cyrillic outside the two dictionaries', () => {
    // Everything written ABOUT the code is English; the Ukrainian interface copy lives in
    // exactly two files. That rule was prose only, and it broke the commit after the sweep
    // that established it - a comment in lesson.css measuring the width of two Ukrainian
    // words. Prose cannot guard itself, so this walks the tree instead.
    //
    // src/ only: a test asserting what the ua dictionary renders holds Cyrillic as DATA,
    // not as prose about the code, and the guards below need the character class itself.
    const DICTS = ['i18n.js', 'content.js'];   // the interface copy, both languages
    const LABEL = /^УКР$/;   // the language switch names itself in its own script
    const found = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { walk(new URL(e.name + '/', dir)); continue; }
        if (!/\.(js|css|html)$/.test(e.name) || DICTS.includes(e.name)) continue;
        const lines = readFileSync(new URL(e.name, dir), 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
          for (const m of line.match(/[Ѐ-ӿ]+/g) ?? []) {
            if (!LABEL.test(m)) found.push(`${e.name}:${i + 1} «${m}»`);
          }
        });
      }
    };
    walk(new URL('../src/', import.meta.url));
    expect(found, 'Cyrillic outside the dictionaries: ' + found.join(' | ')).toEqual([]);
  });

  it('no value is empty', () => {
    for (const l of LANGS) {
      setLang(l);
      for (const k of dictKeys(l)) expect(t(k).trim(), `${l}/${k}`).not.toBe('');
    }
  });

  it('setLang switches the translation and notifies subscribers', () => {
    const seen = [];
    const off = onLangChange((l) => seen.push(l));
    expect(t('part.third')).toBe('Проміжне колесо');
    setLang('en');
    expect(t('part.third')).toBe('Third wheel'); // not «intermediate» — the horological name
    expect(seen).toEqual(['en']);
    off();
    setLang('ua');
    expect(seen).toEqual(['en']); // after unsubscribing it notifies no more
  });

  it('an unknown key comes back as itself — so a gap is visible', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(getLang()).toBe('ua');
  });
});

describe('lesson stations', () => {
  it('every focus point exists in the movement', () => {
    // Stations address points by a stable `id` rather than by name: for the escapement
    // socket the name follows the installed variant.
    const keys = new Set(build().focusPoints.map((f) => f.id));
    for (const s of STATIONS) {
      if (s.focus === null) continue; // the overview
      expect(keys, `station ${s.id}`).toContain(s.focus);
    }
  });

  it('every station name has a translation in both languages', () => {
    const keys = new Set(dictKeys('ua'));
    for (const s of STATIONS) expect(keys, s.id).toContain(s.nameKey);
  });

  it('every station subtitle is translated', () => {
    const keys = new Set(dictKeys('ua'));
    for (const s of STATIONS) expect(keys, s.id).toContain(`${s.nameKey}.sub`);
  });

  it('every station has a place in the footer chain', () => {
    const rows = new Set(), branches = new Set();
    for (const s of STATIONS) {
      expect(s.chain, `station ${s.id} has no place in the chain`).toBeTruthy();
      if (s.chain.row !== undefined) {
        expect(s.chain.row, s.id).toBeGreaterThanOrEqual(0);
        expect(s.chain.row, s.id).toBeLessThan(5); // the main row has 5 nodes
        rows.add(s.chain.row);
      } else {
        expect(['hands', 'reserve'], s.id).toContain(s.chain.branch);
        branches.add(s.chain.branch);
      }
    }
    expect(rows.size + branches.size, 'two stations share one place').toBe(STATIONS.length);
  });

  it('every test a station points at really exists in the suite', () => {
    const names = new Set();
    const quoted = /\bit\(\s*'([^']*)'/g;
    for (const f of readdirSync('test').filter((n) => n.endsWith('.test.js'))) {
      const src = readFileSync(`test/${f}`, 'utf8');
      for (const m of src.matchAll(quoted)) names.add(m[1]);
    }
    for (const s of STATIONS) {
      expect(names, `station «${s.id}» points at a test that does not exist`).toContain(s.test);
    }
  });
});

describe('node highlight', () => {
  it('every module the stations name is present in the scene', () => {
    const h = createHighlighter(build().root);
    const present = h.modules();
    for (const s of STATIONS) {
      for (const m of s.highlight.mods ?? []) expect(present, `station ${s.id}`).toContain(m);
    }
  });

  it('every mesh carries a module tag', () => {
    const h = createHighlighter(build().root);
    expect(h.modules().has(null), 'there are meshes without userData.mod').toBe(false);
  });

  it('focus dims the rest, clear() brings everything back', () => {
    const h = createHighlighter(build().root);
    expect(h.dimCount()).toBe(0);
    h.focus({ mods: ['escapement'] });
    expect(h.dimCount()).toBeGreaterThan(0);
    expect(h.dimCount()).toBeLessThan(h.count); // something did stay lit
    h.clear();
    expect(h.dimCount()).toBe(0);
  });

  it('dimming does not leak between meshes sharing a material', () => {
    const mv = build();
    const h = createHighlighter(mv.root);
    h.focus({ mods: ['barrel'], arbors: [0] });
    const lit = [], dim = [];
    mv.root.traverse((o) => {
      if (!o.isMesh && !o.isLine) return;
      (o.material.opacity === 1 ? lit : dim).push(o.userData.mod);
    });
    // the barrel is lit while the tourbillon is not, despite the shared materials
    expect(lit).toContain('barrel');
    expect(lit).not.toContain('escapement');
    expect(dim).toContain('escapement');
  });

  it('every station leaves something lit', () => {
    const h = createHighlighter(build().root);
    for (const s of STATIONS) {
      h.focus(s.highlight);
      expect(h.count - h.dimCount(), `station ${s.id} highlights nothing`).toBeGreaterThan(0);
    }
  });

  it('the dimmed clones follow a wireframe switched on after they were made', () => {
    const mv = build();
    const h = createHighlighter(mv.root);
    h.focus({ mods: ['escapement'] });          // the clones are made here
    const dimmedMesh = [];
    mv.root.traverse((o) => { if (o.isMesh && o.material.opacity < 1) dimmedMesh.push(o); });
    expect(dimmedMesh.length).toBeGreaterThan(0);

    // The «Wireframe» toggle in free mode switches the ORIGINAL materials.
    h.clear();
    mv.root.traverse((o) => { if (o.isMesh) o.material.wireframe = true; });
    h.focus({ mods: ['escapement'] });
    for (const o of dimmedMesh) {
      expect(o.material.wireframe, 'a dimmed mesh stayed solid').toBe(true);
    }
  });
});

describe('the «Escapement and regulator» station does not depend on the installed module', () => {
  const station = STATIONS.find((s) => s.id === 'escapement');
  const at = (charge) => readouts({ beatHz: 2.5, amplitude: 220, speed: 1, charge });

  it('every number on the card is one the swap does not touch', () => {
    // The strongest proof of the station's claim: swap the escapement in front of the
    // viewer and not a single number on the card moves. Which is why the card has no right
    // to show anything that depends on the construction.
    const r = at(0.75);
    const shown = [
      ...station.formula(r).map((l) => (l.vals ?? []).join('|')),
      ...station.stats(r).map(([, v]) => v),
    ].join(' ');
    // These quantities are the same for any variant: half a tooth pitch, the turn of the
    // escape arbor (that is the drive angle, not the cage's) and the fourth wheel.
    expect(shown).toContain(String(r.halfStepDeg));
    expect(shown).toContain(`${r.cagePeriod} с`);
    expect(shown).toContain(`${r.secondsPeriod} с`);
  });

  it('the card names no particular variant', () => {
    const keys = [station.prose, station.idea, station.hint, station.simplification,
                  ...station.formula(at(0.75)).map((l) => l.key ?? l.note)];
    for (const lang of LANGS) {
      setLang(lang);
      const text = keys.map((k) => t(k)).join(' ').toLowerCase();
      for (const id of VARIANT_IDS) {
        const name = t(`part.${id}`).toLowerCase();
        expect(text, `${lang}: the card mentions «${name}»`).not.toContain(name);
      }
    }
    setLang('ua');
  });

  it('no station writes units past the dictionary', () => {
    // «12 с» stayed Cyrillic in English too: the unit was baked into stations.js instead of
    // being taken from t(). Key parity does not see that.
    const r = at(0.75);
    setLang('en');
    for (const st of STATIONS) {
      for (const [, value] of st.stats?.(r) ?? []) {
        expect(value, `station ${st.id}: «${value}»`).not.toMatch(/[Ѐ-ӿ]/);
      }
    }
    setLang('ua');
  });

  it('the station rests on the test about independence from the construction', () => {
    expect(station.test).toContain('the same β');
  });
});

describe('the developed section keeps no copies of the dimensions', () => {
  const byKind = (mod, kind, variant = DEFAULT_VARIANT) =>
    sectionParts(variant).parts.filter((p) => p.mod === mod && p.kind === kind).map((p) => p.r);

  it('without a variant the section is not drawn — the default is known to the socket', () => {
    // A second default would part from the socket and show something that is not installed.
    expect(() => sectionParts()).toThrow();
  });

  it('the cage and the balance come from the tourbillon\'s constants, not typed in', () => {
    expect(byKind('escapement', 'cage', 'tourbillon')).toEqual([CAGE_R]);
    expect(byKind('escapement', 'flat', 'tourbillon')).toEqual([balanceR(CAGE_R)]);
  });

  it('the lever variant draws its three bodies from its own constants', () => {
    // The development is the one diagram kept truthful here: it must show WHAT IS
    // INSTALLED, and take its dimensions from that same module.
    const parts = sectionParts('lever').parts.filter((p) => p.mod === 'escapement');
    expect(parts.map((p) => p.r)).toEqual([ESC_R, FORK_REACH, BALANCE_R]);
    expect(parts.some((p) => p.kind === 'cage'), 'the lever escapement has no cage').toBe(false);
  });

  it('the lever variant\'s silhouette is lower than the tourbillon\'s — that is the cost of complexity', () => {
    const span = (v) => {
      const p = sectionParts(v).parts.filter((x) => x.mod === 'escapement');
      return Math.max(...p.map((x) => x.z1)) - Math.min(...p.map((x) => x.z0));
    };
    expect(span('lever')).toBeLessThan(span('tourbillon'));
  });

  it('the section places exactly what a node\'s profile declared', () => {
    // The composer has no numbers of its own: it only places the axes. What hangs on them
    // — and how big it is — is said by the node itself. (That the centre-seconds module is
    // really derived from the arbor distance is held by the meshing invariants in
    // `movement.test.js`.)
    const arbors = layoutTrain();
    const shape = (p) => `${p.kind} r=${p.r} z=${p.z0}..${p.z1}`;
    const drawn = sectionParts(DEFAULT_VARIANT).parts;
    for (const [mod, prof] of [['powerReserve', reserveProfile()],
                               ['motionWorks', motionProfile(arbors)]]) {
      expect(drawn.filter((p) => p.mod === mod).map(shape), mod).toEqual(prof.parts.map(shape));
    }
  });
});

describe('running parameters — one table', () => {
  // Until now three sliders were declared twice: in the free-mode panel and in the station
  // cards, with bounds kept in step by hand. Nothing checked them against each other.
  const settings = createSettings();

  it('every station knob names a parameter that exists', () => {
    // `params[c.param] = …` silently created a new key: the slider moved, and nothing at
    // all happened in the movement.
    for (const st of STATIONS) {
      for (const c of st.controls ?? []) {
        if (!c.param) continue;                       // a button, or «Variants»
        expect(() => settings.spec(c.param), `station ${st.id}`).not.toThrow();
      }
    }
  });

  it('a station keeps no bounds or formats of its own', () => {
    // The kind of knob is the station's business; bounds, step, format and label are the table's.
    const src = readFileSync(new URL('../src/lesson/stations.js', import.meta.url), 'utf8');
    for (const own of ['min:', 'max:', 'step:', 'fmt:']) {
      expect(src, `stations.js still carries its own «${own}»`).not.toContain(own);
    }
  });

  it('the free-mode panel is built from the same table', () => {
    // If a knob is added past the table, it will part from the card in silence.
    const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(src).toContain('for (const name of settings.names)');
    // A knob written past the table is recognised by a literal parameter name: the adapter
    // always passes the name as a variable.
    const byHand = src.match(/gui\.add\(params,\s*['"]/g) ?? [];
    expect(byHand, 'a knob past the table: ' + byHand.join(' | ')).toHaveLength(0);
    // lil-gui shows what it read at creation time, so entering free mode must refresh the
    // display — otherwise a knob moved on a card leaves the old number there. Checked as
    // text: `main.js` needs WebGL and is not part of the suite.
    expect(src, 'free mode does not refresh the knobs\' display').toContain('c.updateDisplay()');
  });

  it('the free-mode panel names no escapement module', () => {
    // The composer no longer re-publishes a variant's internals, and the panel takes its
    // node knobs from the socket — so no variant's name should be in it.
    const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    for (const id of VARIANT_IDS) {
      expect(src, `main.js names the variant «${id}»`).not.toContain(`'${id}'`);
    }
    expect(src).not.toContain('movement.tourbillon');
  });

  it('every label in the table has a translation in both languages', () => {
    const keys = new Set(dictKeys('ua'));
    for (const name of settings.names) {
      const spec = settings.spec(name);
      expect(keys, name).toContain(spec.labelKey);
      for (const [, key] of spec.options ?? []) expect(keys, name).toContain(key);
    }
  });

  it('a value out of bounds is clamped by that same table', () => {
    expect(settings.set('beatHz', 99)).toBe(settings.spec('beatHz').max);
    expect(settings.set('beatHz', -1)).toBe(settings.spec('beatHz').min);
    expect(settings.set('beatHz', '3.5')).toBe(3.5);   // a slider hands over a string
  });

  it('an unknown parameter is an error, not silence', () => {
    expect(() => settings.spec('nope')).toThrow();
    expect(() => settings.set('nope', 1)).toThrow();
  });
});

describe('a node is the single source of its own numbers', () => {
  // Each pair's centre distance is derived by the module itself (`profile()`). Until now
  // the same expression sat in three places — in the module, in the cards and in the
  // section — and any one of them could quietly part from the others.

  const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
  const snap = { beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.5 };

  it('the centre-distance expression is not repeated outside its own module', () => {
    const guarded = [
      ['powerReserve.js', 'PRT_HUB + PRT_P'],
      ['motionWorks.js', 'CANNON_T + MINUTE_T'],
      ['motionWorks.js', 'MW_PINION_T + HOUR_T'],
    ];
    for (const [owner, expr] of guarded) {
      for (const rel of ['lesson/readouts.js', 'lesson/section.js']) {
        expect(src(rel), `${expr} must live only in ${owner}`).not.toContain(expr);
      }
    }
  });

  it('the card, the profile and the built movement report the same centre distance', () => {
    // The strongest check of all: the number from the card against the distance between
    // the arbors in the meshes.
    const m = build();
    const { x, y } = m.internals.powerReserve.idler.position;
    const built = Math.hypot(x, y);

    expect(reserveProfile().centres.hub).toBeCloseTo(built, 9);
    expect(readouts(snap).reserve.centreA).toBeCloseTo(built, 3);
  });

  it('both motion-works pairs have the same centre distance', () => {
    // Which is exactly why `MW_M2` is derived from `MW_M1` rather than given separately.
    const prof = motionProfile(layoutTrain());
    expect(prof.centres.equal).toBe(true);
    expect(readouts(snap).mw.equal).toBe(true);
  });

  it('the section draws the balance at the same thickness in both variants', () => {
    // The balance rim is the same in every variant, so the band is the same too. Until now
    // each variant had its own eyeballed number in the section.
    const band = (v) => {
      const p = sectionParts(v).parts
        .filter((x) => x.mod === 'escapement' && x.kind === 'flat').at(-1);
      return p.z1 - p.z0;
    };
    expect(band('lever')).toBeCloseTo(band('tourbillon'), 9);
  });
});

describe('the numbers snapshot does not litter the render loop', () => {
  const inp = { beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.5 };

  it('without a buffer the snapshots are independent', () => {
    const a = readouts(inp);
    const b = readouts({ ...inp, charge: 1 });
    expect(a).not.toBe(b);
    expect(a.chargePct).toBe(50);
  });

  it('with a buffer it creates no new objects', () => {
    const buf = {};
    expect(readouts(inp, buf)).toBe(buf);
    const spring = buf.spring, ratios = buf.ratios;
    readouts({ ...inp, charge: 1 }, buf);
    expect(buf.spring, 'the nested spring object was recreated').toBe(spring);
    expect(buf.ratios, 'the constants were recomputed').toBe(ratios);
    expect(buf.chargePct).toBe(100); // and it was updated all the same
  });
});

describe('live numbers on the cards', () => {
  const at = (beatHz, charge = 0.75, speed = 1) =>
    readouts({ beatHz, amplitude: 220, speed, charge });

  it('reproduce the verified quantities at 2.5 beats/s', () => {
    const r = at(2.5);
    expect(r.cagePeriod).toBe(12);       // the same period as in the cage test
    expect(r.secondsPeriod).toBe(32);    // and in the fourth-wheel test
    expect(r.halfStepDeg).toBe(12);      // half a tooth pitch
    expect(r.clickPct).toBe(37.5);       // one click of winding
    expect(Math.round(r.fullRun)).toBe(213);
  });

  it('the rate scales both periods while their ratio stays', () => {
    const a = at(2.5), b = at(5);
    expect(b.cagePeriod).toBeCloseTo(a.cagePeriod / 2, 6);
    expect(b.secondsPeriod).toBeCloseTo(a.secondsPeriod / 2, 6);
    // this is exactly what the card promises: what is unchanging is the ratio, not the numbers
    expect(b.secondsPeriod / b.cagePeriod).toBeCloseTo(a.secondsPeriod / a.cagePeriod, 9);
  });

  it('the same centre distance in both compound nodes', () => {
    const r = at(2.5);
    expect(r.mw.equal, 'motion works').toBe(true);
    expect(r.mw.centreA).toBe(6.72);
    expect(r.reserve.equal, 'the power-reserve train').toBe(true);
    expect(r.reserve.centreA).toBe(6);
  });

  it('the gear ratios agree with the train test', () => {
    const w = at(2.5).ratios.map((x) => Number(x.omega.toFixed(3)));
    expect(w).toEqual([1, -4, 13.333, -40, 106.667]);
  });

  it('the bevel pair\'s angles complement each other to 90°', () => {
    expect(at(2.5).bevel.sum).toBe(90);
  });

  it('the charge and the speed enter the numbers rather than being written as text', () => {
    expect(at(2.5, 0).spring.turns).toBe(3.4);
    expect(at(2.5, 1).spring.turns).toBe(7);
    expect(at(2.5, 1, 2).fullRunMin).toBeCloseTo(at(2.5, 1, 1).fullRunMin / 2, 6);
  });
});

describe('card content', () => {
  const r = readouts({ beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.75 });

  it('every card key exists in both languages', () => {
    const need = [];
    for (const s of STATIONS) {
      need.push(s.prose, s.idea, s.hint);
      if (s.simplification) need.push(s.simplification);
      for (const line of s.formula(r)) need.push(line.key ?? line.note);
      for (const [label] of s.stats?.(r) ?? []) need.push(label);
      for (const c of s.controls ?? []) {
        if (c.labelKey) need.push(c.labelKey);
        for (const [, key] of c.options ?? []) need.push(key);
      }
    }
    for (const l of LANGS) {
      const keys = new Set(dictKeys(l));
      for (const k of need) expect(keys, `${l}: ${k} is missing`).toContain(k);
    }
  });

  it('after substitution no slot is left unfilled', () => {
    for (const l of LANGS) {
      setLang(l);
      for (const s of STATIONS) {
        // The same helpers as in the panel — otherwise the test checks the intent rather
        // than what actually reaches the screen.
        const texts = [
          maybe(s.prose, s.proseVals?.(r)),
          maybe(s.hint, s.hintVals?.(r)),
          ...s.formula(r).map(lineText),
          ...(s.stats?.(r) ?? []).map(([, v]) => String(v)),
        ];
        // We look for the substitution slots themselves, not for a percent sign in «+37.5 %».
        const holes = ['%1', '%2', '%3', '%n'];
        for (const x of texts) {
          const left = holes.find((h) => x.includes(h));
          expect(left, `${l}/${s.id}: unfilled ${left} in «${x}»`).toBeUndefined();
        }
      }
    }
    setLang('ua');
  });
});

describe('the route\'s summary', () => {
  it('every station leaves a sentence behind — in both languages', () => {
    for (const l of LANGS) {
      const keys = new Set(dictKeys(l));
      for (const s of STATIONS) {
        expect(keys, `${l}: the sentence for station ${s.id} is missing`).toContain(`st.${s.id}.line`);
      }
    }
  });

  it('the sentences are neither empty nor identical to each other', () => {
    setLang('ua');
    const lines = STATIONS.map((s) => t(`st.${s.id}.line`));
    for (const x of lines) expect(x.length).toBeGreaterThan(20);
    expect(new Set(lines).size, 'two identical sentences').toBe(STATIONS.length);
  });

  it('every caption in the summary is translated', () => {
    const need = ['finish.eyebrow', 'finish.title', 'finish.lead', 'finish.loop', 'finish.next',
                  'finish.side', 'finish.sideBody', 'finish.freeBody', 'finish.again',
                  'finish.goFree', 'finish.footnote', 'rail.more'];
    for (const l of LANGS) {
      const keys = new Set(dictKeys(l));
      for (const k of need) expect(keys, `${l}: ${k} is missing`).toContain(k);
    }
  });
});
