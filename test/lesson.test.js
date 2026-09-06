import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';
import { createHighlighter } from '../src/lesson/highlight.js';
import { STATIONS } from '../src/lesson/stations.js';
import { LANGS, dictKeys, t, tf, getLang, setLang, onLangChange } from '../src/i18n.js';
import { readouts } from '../src/lesson/readouts.js';
import { lineText, maybe } from '../src/lesson/cardText.js';
import { sectionParts } from '../src/lesson/section.js';
import { CAGE_R } from '../src/movement.js';
import { balanceR } from '../src/tourbillon.js';
import { HAND_L, CS_DRIVE, layoutMotionWorks } from '../src/motionWorks.js';
import { SUN_T, DIFF_M, DIAL_R, PR_HAND_L } from '../src/powerReserve.js';
import { layoutTrain } from '../src/train.js';
import { pitchR } from '../src/common.js';

const mat = () => new THREE.MeshStandardMaterial();
const build = () => buildMovement({
  brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
  plateMat: mat(), bluedMat: mat(),
  springSteel: mat(), backdropMat: mat(), cageMat: mat(),
});

describe('i18n', () => {
  beforeEach(() => setLang('ua'));

  it('набори ключів однакові в усіх мовах', () => {
    const base = [...dictKeys(LANGS[0])].sort();
    for (const l of LANGS) expect([...dictKeys(l)].sort(), `мова ${l}`).toEqual(base);
  });

  it('жоден підпис GUI не вписаний повз словник', () => {
    // Ключі-парність не ловлять хардкод: рядок, вписаний просто в `.name()`,
    // у словник узагалі не потрапляє й лишається українським для EN.
    const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    const bad = [...src.matchAll(/\.name\(\s*(['"`])(.*?)\1\s*\)/g)]
      .map((m) => m[2])
      .filter((s) => /[Ѐ-ӿ]/.test(s) && s !== 'УКР');
    expect(bad, 'підписи в обхід t(): ' + bad.join(' | ')).toEqual([]);
  });

  it('жодне значення не порожнє', () => {
    for (const l of LANGS) {
      setLang(l);
      for (const k of dictKeys(l)) expect(t(k).trim(), `${l}/${k}`).not.toBe('');
    }
  });

  it('setLang перемикає переклад і сповіщає підписників', () => {
    const seen = [];
    const off = onLangChange((l) => seen.push(l));
    expect(t('part.third')).toBe('Проміжне колесо');
    setLang('en');
    expect(t('part.third')).toBe('Third wheel'); // не «intermediate» — горологічна назва
    expect(seen).toEqual(['en']);
    off();
    setLang('ua');
    expect(seen).toEqual(['en']); // після відписки більше не сповіщає
  });

  it('невідомий ключ повертається як є — щоб пропуск було видно', () => {
    expect(t('нема.такого')).toBe('нема.такого');
    expect(getLang()).toBe('ua');
  });
});

describe('станції уроку', () => {
  it('усі точки фокуса існують у механізмі', () => {
    const keys = new Set(build().focusPoints.map((f) => f.nameKey));
    for (const s of STATIONS) {
      if (s.focus === null) continue; // загальний вид
      expect(keys, `станція ${s.id}`).toContain(s.focus);
    }
  });

  it('усі назви станцій мають переклад в обох мовах', () => {
    const keys = new Set(dictKeys('ua'));
    for (const s of STATIONS) expect(keys, s.id).toContain(s.nameKey);
  });

  it('усі підзаголовки станцій перекладені', () => {
    const keys = new Set(dictKeys('ua'));
    for (const s of STATIONS) expect(keys, s.id).toContain(`${s.nameKey}.sub`);
  });

  it('кожна станція має місце в ланцюгу підвалу', () => {
    const rows = new Set(), branches = new Set();
    for (const s of STATIONS) {
      expect(s.chain, `станція ${s.id} без місця в ланцюгу`).toBeTruthy();
      if (s.chain.row !== undefined) {
        expect(s.chain.row, s.id).toBeGreaterThanOrEqual(0);
        expect(s.chain.row, s.id).toBeLessThan(5); // головний ряд — 5 вузлів
        rows.add(s.chain.row);
      } else {
        expect(['hands', 'reserve'], s.id).toContain(s.chain.branch);
        branches.add(s.chain.branch);
      }
    }
    expect(rows.size + branches.size, 'дві станції ділять одне місце').toBe(STATIONS.length);
  });

  it('кожен тест, на який посилається станція, справді існує в наборі', () => {
    const names = new Set();
    const quoted = /\bit\(\s*'([^']*)'/g;
    for (const f of readdirSync('test').filter((n) => n.endsWith('.test.js'))) {
      const src = readFileSync(`test/${f}`, 'utf8');
      for (const m of src.matchAll(quoted)) names.add(m[1]);
    }
    for (const s of STATIONS) {
      expect(names, `станція «${s.id}» посилається на неіснуючий тест`).toContain(s.test);
    }
  });
});

describe('підсвітка вузла', () => {
  it('усі модулі станцій присутні у сцені', () => {
    const h = createHighlighter(build().root);
    const present = h.modules();
    for (const s of STATIONS) {
      for (const m of s.highlight.mods ?? []) expect(present, `станція ${s.id}`).toContain(m);
    }
  });

  it('кожен меш має мітку модуля', () => {
    const h = createHighlighter(build().root);
    expect(h.modules().has(null), 'є меші без userData.mod').toBe(false);
  });

  it('фокус приглушує решту, clear() повертає все', () => {
    const h = createHighlighter(build().root);
    expect(h.dimCount()).toBe(0);
    h.focus({ mods: ['tourbillon'] });
    expect(h.dimCount()).toBeGreaterThan(0);
    expect(h.dimCount()).toBeLessThan(h.count); // щось таки лишилось світитись
    h.clear();
    expect(h.dimCount()).toBe(0);
  });

  it('приглушення не тече між мешами зі спільним матеріалом', () => {
    const mv = build();
    const h = createHighlighter(mv.root);
    h.focus({ mods: ['barrel'], arbors: [0] });
    const lit = [], dim = [];
    mv.root.traverse((o) => {
      if (!o.isMesh && !o.isLine) return;
      (o.material.opacity === 1 ? lit : dim).push(o.userData.mod);
    });
    // барабан світиться, а турбійон — ні, попри спільні матеріали
    expect(lit).toContain('barrel');
    expect(lit).not.toContain('tourbillon');
    expect(dim).toContain('tourbillon');
  });

  it('кожна станція лишає щось освітленим', () => {
    const h = createHighlighter(build().root);
    for (const s of STATIONS) {
      h.focus(s.highlight);
      expect(h.count - h.dimCount(), `станція ${s.id} нічого не підсвічує`).toBeGreaterThan(0);
    }
  });

  it('приглушені клони йдуть за каркасом, увімкненим після їх створення', () => {
    const mv = build();
    const h = createHighlighter(mv.root);
    h.focus({ mods: ['tourbillon'] });          // клони створюються тут
    const dimmedMesh = [];
    mv.root.traverse((o) => { if (o.isMesh && o.material.opacity < 1) dimmedMesh.push(o); });
    expect(dimmedMesh.length).toBeGreaterThan(0);

    // Тумблер «Каркас» у вільному режимі перемикає ОРИГІНАЛИ матеріалів.
    h.clear();
    mv.root.traverse((o) => { if (o.isMesh) o.material.wireframe = true; });
    h.focus({ mods: ['tourbillon'] });
    for (const o of dimmedMesh) {
      expect(o.material.wireframe, 'приглушений меш лишився суцільним').toBe(true);
    }
  });
});

describe('розріз збоку не має власних копій розмірів', () => {
  const byKind = (mod, kind) =>
    sectionParts().parts.filter((p) => p.mod === mod && p.kind === kind).map((p) => p.r);

  it('кліть і баланс — з констант турбійона, а не вписані', () => {
    expect(byKind('tourbillon', 'cage')).toEqual([CAGE_R]);
    expect(byKind('tourbillon', 'flat')).toEqual([balanceR(CAGE_R)]);
  });

  it('стрілки й шкала — з констант своїх модулів', () => {
    expect(byKind('motionWorks', 'hand')).toEqual([HAND_L.hour, HAND_L.minute, HAND_L.second]);
    expect(byKind('powerReserve', 'hand')).toEqual([PR_HAND_L]);
    expect(byKind('powerReserve', 'flat')).toEqual([DIAL_R]);
    expect(byKind('powerReserve', 'sun')).toEqual([pitchR(SUN_T, DIFF_M)]);
  });

  it('модуль центральної секунди береться з розкладки', () => {
    // Він виводиться з фактичної відстані осей: варто зрушити передачу —
    // і вписане число розвело б діаграму з механізмом.
    const csM = layoutMotionWorks(layoutTrain()).CS_M;
    expect(byKind('motionWorks', 'wheel')).toContain(pitchR(CS_DRIVE, csM));
  });
});

describe('знімок чисел не смітить у циклі рендеру', () => {
  const inp = { beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.5 };

  it('без буфера знімки незалежні', () => {
    const a = readouts(inp);
    const b = readouts({ ...inp, charge: 1 });
    expect(a).not.toBe(b);
    expect(a.chargePct).toBe(50);
  });

  it('з буфером не створює нових обʼєктів', () => {
    const buf = {};
    expect(readouts(inp, buf)).toBe(buf);
    const spring = buf.spring, ratios = buf.ratios;
    readouts({ ...inp, charge: 1 }, buf);
    expect(buf.spring, 'вкладений обʼєкт пружини перестворено').toBe(spring);
    expect(buf.ratios, 'сталі перераховано').toBe(ratios);
    expect(buf.chargePct).toBe(100); // і при цьому оновився
  });
});

describe('живі числа карток', () => {
  const at = (beatHz, charge = 0.75, speed = 1) =>
    readouts({ beatHz, amplitude: 220, speed, charge });

  it('відтворюють перевірені величини при 2.5 уд/с', () => {
    const r = at(2.5);
    expect(r.cagePeriod).toBe(12);       // той самий період, що й у тесті кліті
    expect(r.secondsPeriod).toBe(32);    // і в тесті секундного колеса
    expect(r.halfStepDeg).toBe(12);      // пів-кроку зубця
    expect(r.clickPct).toBe(37.5);       // один клік заведення
    expect(Math.round(r.fullRun)).toBe(213);
  });

  it('хід масштабує обидва періоди, а їхнє відношення лишається', () => {
    const a = at(2.5), b = at(5);
    expect(b.cagePeriod).toBeCloseTo(a.cagePeriod / 2, 6);
    expect(b.secondsPeriod).toBeCloseTo(a.secondsPeriod / 2, 6);
    // саме це й обіцяє картка: незмінне — відношення, а не самі числа
    expect(b.secondsPeriod / b.cagePeriod).toBeCloseTo(a.secondsPeriod / a.cagePeriod, 9);
  });

  it('однакова міжосьова в обох компаундних вузлах', () => {
    const r = at(2.5);
    expect(r.mw.equal, 'моторний механізм').toBe(true);
    expect(r.mw.centreA).toBe(6.72);
    expect(r.reserve.equal, 'передача запасу ходу').toBe(true);
    expect(r.reserve.centreA).toBe(6);
  });

  it('передавальні відношення збігаються з тестом передачі', () => {
    const w = at(2.5).ratios.map((x) => Number(x.omega.toFixed(3)));
    expect(w).toEqual([1, -4, 13.333, -40, 106.667]);
  });

  it('кути конічної пари доповнюють один одного до 90°', () => {
    expect(at(2.5).bevel.sum).toBe(90);
  });

  it('заряд і швидкість входять у числа, а не вписані текстом', () => {
    expect(at(2.5, 0).spring.turns).toBe(3.4);
    expect(at(2.5, 1).spring.turns).toBe(7);
    expect(at(2.5, 1, 2).fullRunMin).toBeCloseTo(at(2.5, 1, 1).fullRunMin / 2, 6);
  });
});

describe('зміст карток', () => {
  const r = readouts({ beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.75 });

  it('усі ключі карток є в обох мовах', () => {
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
      for (const k of need) expect(keys, `${l}: бракує ${k}`).toContain(k);
    }
  });

  it('після підстановки не лишається незаповнених місць', () => {
    for (const l of LANGS) {
      setLang(l);
      for (const s of STATIONS) {
        // Ті самі хелпери, що й у панелі — інакше тест перевіряє намір, а не
        // те, що справді потрапляє на екран.
        const texts = [
          maybe(s.prose, s.proseVals?.(r)),
          maybe(s.hint, s.hintVals?.(r)),
          ...s.formula(r).map(lineText),
          ...(s.stats?.(r) ?? []).map(([, v]) => String(v)),
        ];
        // Шукаємо саме місця підстановки, а не знак відсотка в «+37.5 %».
        const holes = ['%1', '%2', '%3', '%n'];
        for (const x of texts) {
          const left = holes.find((h) => x.includes(h));
          expect(left, `${l}/${s.id}: незаповнене ${left} у «${x}»`).toBeUndefined();
        }
      }
    }
    setLang('ua');
  });
});

describe('підсумок маршруту', () => {
  it('кожна станція лишає по себе речення — в обох мовах', () => {
    for (const l of LANGS) {
      const keys = new Set(dictKeys(l));
      for (const s of STATIONS) {
        expect(keys, `${l}: бракує речення станції ${s.id}`).toContain(`st.${s.id}.line`);
      }
    }
  });

  it('речення не порожні й не збігаються між собою', () => {
    setLang('ua');
    const lines = STATIONS.map((s) => t(`st.${s.id}.line`));
    for (const x of lines) expect(x.length).toBeGreaterThan(20);
    expect(new Set(lines).size, 'два однакові речення').toBe(STATIONS.length);
  });

  it('усі написи підсумку перекладені', () => {
    const need = ['finish.eyebrow', 'finish.title', 'finish.lead', 'finish.loop', 'finish.next',
                  'finish.side', 'finish.sideBody', 'finish.freeBody', 'finish.again',
                  'finish.goFree', 'finish.footnote', 'rail.more'];
    for (const l of LANGS) {
      const keys = new Set(dictKeys(l));
      for (const k of need) expect(keys, `${l}: бракує ${k}`).toContain(k);
    }
  });
});
