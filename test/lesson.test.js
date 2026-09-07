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
    // Станції адресують точки за стабільним `id`, а не за назвою: у гнізда
    // спуску назва йде за встановленим варіантом.
    const keys = new Set(build().focusPoints.map((f) => f.id));
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
    h.focus({ mods: ['escapement'] });
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
    expect(lit).not.toContain('escapement');
    expect(dim).toContain('escapement');
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
    h.focus({ mods: ['escapement'] });          // клони створюються тут
    const dimmedMesh = [];
    mv.root.traverse((o) => { if (o.isMesh && o.material.opacity < 1) dimmedMesh.push(o); });
    expect(dimmedMesh.length).toBeGreaterThan(0);

    // Тумблер «Каркас» у вільному режимі перемикає ОРИГІНАЛИ матеріалів.
    h.clear();
    mv.root.traverse((o) => { if (o.isMesh) o.material.wireframe = true; });
    h.focus({ mods: ['escapement'] });
    for (const o of dimmedMesh) {
      expect(o.material.wireframe, 'приглушений меш лишився суцільним').toBe(true);
    }
  });
});

describe('станція «Спуск і регулятор» не залежить від встановленого модуля', () => {
  const station = STATIONS.find((s) => s.id === 'escapement');
  const at = (charge) => readouts({ beatHz: 2.5, amplitude: 220, speed: 1, charge });

  it('усі числа картки — з тих, що заміна не чіпає', () => {
    // Найсильніший доказ тези станції: замінюєш спуск на очах у глядача, а на
    // картці не ворухнеться жодне число. Тому картка й не має права показувати
    // нічого, що залежить від конструкції.
    const r = at(0.75);
    const shown = [
      ...station.formula(r).map((l) => (l.vals ?? []).join('|')),
      ...station.stats(r).map(([, v]) => v),
    ].join(' ');
    // Ці величини однакові при будь-якому варіанті: пів-кроку зубця, оберт
    // анкерної осі (це кут приводу, а не кліті) і секундне колесо.
    expect(shown).toContain(String(r.halfStepDeg));
    expect(shown).toContain(`${r.cagePeriod} с`);
    expect(shown).toContain(`${r.secondsPeriod} с`);
  });

  it('картка не називає жодного конкретного варіанта', () => {
    const keys = [station.prose, station.idea, station.hint, station.simplification,
                  ...station.formula(at(0.75)).map((l) => l.key ?? l.note)];
    for (const lang of LANGS) {
      setLang(lang);
      const text = keys.map((k) => t(k)).join(' ').toLowerCase();
      for (const id of VARIANT_IDS) {
        const name = t(`part.${id}`).toLowerCase();
        expect(text, `${lang}: картка згадує «${name}»`).not.toContain(name);
      }
    }
    setLang('ua');
  });

  it('жодна станція не вписує одиниць повз словник', () => {
    // «12 с» лишалося кириличним і в англійській: одиниця була вшита в
    // stations.js, а не взята з t(). Ключі-парність такого не бачать.
    const r = at(0.75);
    setLang('en');
    for (const st of STATIONS) {
      for (const [, value] of st.stats?.(r) ?? []) {
        expect(value, `станція ${st.id}: «${value}»`).not.toMatch(/[Ѐ-ӿ]/);
      }
    }
    setLang('ua');
  });

  it('станція спирається на тест про незалежність від конструкції', () => {
    expect(station.test).toContain('однаковий β');
  });
});

describe('розріз збоку не має власних копій розмірів', () => {
  const byKind = (mod, kind, variant = DEFAULT_VARIANT) =>
    sectionParts(variant).parts.filter((p) => p.mod === mod && p.kind === kind).map((p) => p.r);

  it('без варіанта розгортка не малюється — типовий знає гніздо', () => {
    // Друге замовчування розійшлося б із гніздом і показало б те, чого не стоїть.
    expect(() => sectionParts()).toThrow();
  });

  it('кліть і баланс — з констант турбійона, а не вписані', () => {
    expect(byKind('escapement', 'cage', 'tourbillon')).toEqual([CAGE_R]);
    expect(byKind('escapement', 'flat', 'tourbillon')).toEqual([balanceR(CAGE_R)]);
  });

  it('анкерний варіант малює свої три тіла з власних констант', () => {
    // Розгортка — єдина діаграма, яку тут тримають правдивою: вона мусить
    // показувати ТЕ, ЩО СТОЇТЬ, і брати розміри з того ж модуля.
    const parts = sectionParts('lever').parts.filter((p) => p.mod === 'escapement');
    expect(parts.map((p) => p.r)).toEqual([ESC_R, FORK_REACH, BALANCE_R]);
    expect(parts.some((p) => p.kind === 'cage'), 'кліті в анкерному спуску немає').toBe(false);
  });

  it('силует анкерного варіанта нижчий за турбійонний — це і є ціна складності', () => {
    const span = (v) => {
      const p = sectionParts(v).parts.filter((x) => x.mod === 'escapement');
      return Math.max(...p.map((x) => x.z1)) - Math.min(...p.map((x) => x.z0));
    };
    expect(span('lever')).toBeLessThan(span('tourbillon'));
  });

  it('розгортка ставить рівно те, що оголосив профіль вузла', () => {
    // Композитор не має власних чисел: він лише розставляє осі. Що на них
    // висить — і якого розміру — каже сам вузол. (Що модуль центральної
    // секунди справді виведений із відстані осей, тримають інваріанти
    // зачеплення в `movement.test.js`.)
    const arbors = layoutTrain();
    const shape = (p) => `${p.kind} r=${p.r} z=${p.z0}..${p.z1}`;
    const drawn = sectionParts(DEFAULT_VARIANT).parts;
    for (const [mod, prof] of [['powerReserve', reserveProfile()],
                               ['motionWorks', motionProfile(arbors)]]) {
      expect(drawn.filter((p) => p.mod === mod).map(shape), mod).toEqual(prof.parts.map(shape));
    }
  });
});

describe('налаштування ходу — одна таблиця', () => {
  // Доти три повзунки були оголошені двічі: у панелі вільного режиму й у
  // картках станцій, з межами, зведеними вручну. Ніщо не звіряло їх між собою.
  const settings = createSettings();

  it('кожна ручка станції називає наявний параметр', () => {
    // `params[c.param] = …` мовчки створював новий ключ: повзунок їздив, а в
    // механізмі не відбувалося нічого.
    for (const st of STATIONS) {
      for (const c of st.controls ?? []) {
        if (!c.param) continue;                       // кнопка або «Варіанти»
        expect(() => settings.spec(c.param), `станція ${st.id}`).not.toThrow();
      }
    }
  });

  it('станція не тримає власних меж і форматів', () => {
    // Вид ручки — справа станції; межі, крок, формат і підпис — таблиці.
    const src = readFileSync(new URL('../src/lesson/stations.js', import.meta.url), 'utf8');
    for (const own of ['min:', 'max:', 'step:', 'fmt:']) {
      expect(src, `у stations.js лишилося власне «${own}»`).not.toContain(own);
    }
  });

  it('панель вільного режиму будується з тієї ж таблиці', () => {
    // Якщо ручку додадуть повз таблицю, вона розійдеться з карткою мовчки.
    const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    expect(src).toContain('for (const name of settings.names)');
    // Ручка, вписана повз таблицю, впізнається за літералом імені параметра:
    // адаптер завжди передає імʼя змінною.
    const byHand = src.match(/gui\.add\(params,\s*['"]/g) ?? [];
    expect(byHand, 'ручка повз таблицю: ' + byHand.join(' | ')).toHaveLength(0);
  });

  it('кожен підпис таблиці має переклад в обох мовах', () => {
    const keys = new Set(dictKeys('ua'));
    for (const name of settings.names) {
      const spec = settings.spec(name);
      expect(keys, name).toContain(spec.labelKey);
      for (const [, key] of spec.options ?? []) expect(keys, name).toContain(key);
    }
  });

  it('значення поза межами затискається за тією ж таблицею', () => {
    expect(settings.set('beatHz', 99)).toBe(settings.spec('beatHz').max);
    expect(settings.set('beatHz', -1)).toBe(settings.spec('beatHz').min);
    expect(settings.set('beatHz', '3.5')).toBe(3.5);   // з повзунка приходить рядок
  });

  it('невідомий параметр — помилка, а не тиша', () => {
    expect(() => settings.spec('нема')).toThrow();
    expect(() => settings.set('нема', 1)).toThrow();
  });
});

describe('вузол — єдине джерело своїх чисел', () => {
  // Міжосьову кожної пари виводить сам модуль (`profile()`). Доти той самий
  // вираз стояв у трьох місцях — у модулі, у картках і в розгортці, — і будь-яке
  // з них могло тихо розійтися з іншими.

  const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
  const snap = { beatHz: 2.5, amplitude: 220, speed: 1, charge: 0.5 };

  it('вираз міжосьової не повторюється поза своїм модулем', () => {
    const guarded = [
      ['powerReserve.js', 'PRT_HUB + PRT_P'],
      ['motionWorks.js', 'CANNON_T + MINUTE_T'],
      ['motionWorks.js', 'MW_PINION_T + HOUR_T'],
    ];
    for (const [owner, expr] of guarded) {
      for (const rel of ['lesson/readouts.js', 'lesson/section.js']) {
        expect(src(rel), `${expr} має жити тільки в ${owner}`).not.toContain(expr);
      }
    }
  });

  it('картка, профіль і зібраний механізм кажуть ту саму міжосьову', () => {
    // Найсильніша звірка: число з картки проти відстані між осями у мешах.
    const m = build();
    // Група проміжного стоїть відносно осі барабана, тож її зсув і Є міжосьова.
    const { x, y } = m.powerReserve.idler.position;
    const built = Math.hypot(x, y);

    expect(reserveProfile().centres.hub).toBeCloseTo(built, 9);
    expect(readouts(snap).reserve.centreA).toBeCloseTo(built, 3);
  });

  it('обидві пари моторного механізму мають однакову міжосьову', () => {
    // Саме тому `MW_M2` виведений із `MW_M1`, а не заданий окремо.
    const prof = motionProfile(layoutTrain());
    expect(prof.centres.equal).toBe(true);
    expect(readouts(snap).mw.equal).toBe(true);
  });

  it('розгортка малює баланс однакової товщини в обох варіантах', () => {
    // Обід балансу той самий у кожному варіанті, тож і смуга та сама. Доти
    // кожен варіант мав у розгортці власне окомірне число.
    const band = (v) => {
      const p = sectionParts(v).parts
        .filter((x) => x.mod === 'escapement' && x.kind === 'flat').at(-1);
      return p.z1 - p.z0;
    };
    expect(band('lever')).toBeCloseTo(band('tourbillon'), 9);
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
