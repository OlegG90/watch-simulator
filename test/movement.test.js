import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildMovement, CAGE_R } from '../src/movement.js';
import { buildEscapementSocket } from '../src/escapement/index.js';
import { BALANCE_OFF, BALANCE_R } from '../src/escapement/lever.js';
import { dictKeys } from '../src/i18n.js';

// ── Хелпери ───────────────────────────────────────────────────────
const TWO = Math.PI * 2;
const mod = (a, q) => ((a % q) + q) % q;
const wrap = (a) => { a = mod(a, TWO); return a > Math.PI ? a - TWO : a; };

const mat = () => new THREE.MeshStandardMaterial();
const buildFresh = () =>
  buildMovement({
    brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
    plateMat: mat(), bluedMat: mat(), springSteel: mat(),
  });

/** Інваріант зачеплення: u + v ≡ 0 (mod 1) — див. README «Common meshing formulas». */
function meshInvariant(posA, posB, ZA, ZB, RA, RB) {
  const theta = Math.atan2(posB.y - posA.y, posB.x - posA.x);
  const sA = TWO / ZA, sB = TWO / ZB;
  const u = mod(theta - RA, sA) / sA;
  const v = mod(theta + Math.PI - sB / 2 - RB, sB) / sB;
  const e = mod(u + v, 1);
  return Math.min(e, 1 - e);
}

/**
 * Нутрощі турбійона — для перевірок.
 *
 * Гніздо віддає назовні лише `{ rotating, fixed, update, nodes }`; меші
 * варіанта живуть за окремими дверима, названими так, щоб їх не сплутали з
 * інтерфейсом. Перевірки ходу спуску мусять їх бачити — але через ці двері.
 */
const tb = (m) => m.escapement.variant('tourbillon').internals;

/** Світовий кут навколо Z: сума rotation.z по ланцюгу до root (усі обертання тут — навколо Z). */
const worldZ = (obj, root) => { let z = 0, o = obj; while (o && o !== root) { z += o.rotation.z; o = o.parent; } return z; };
const findHand = (grp) => grp.children.find((c) => c.type === 'Group');
const clockAngle = (u) => Math.PI / 2 - u * TWO;

let m;
beforeAll(() => { m = buildFresh(); });

// ── Колісна передача ──────────────────────────────────────────────
describe('колісна передача (going train)', () => {
  it('передавальні відношення: ω = [1, −4, +40/3, −40, +320/3]', () => {
    m.update(0); const r0 = m.arbors.map((a) => a.group.rotation.z);
    m.update(1); const r1 = m.arbors.map((a) => a.group.rotation.z);
    const omegas = r1.map((v, i) => v - r0[i]);
    const expected = [1, -4, 40 / 3, -40, 320 / 3];
    omegas.forEach((w, i) => expect(w).toBeCloseTo(expected[i], 10));
  });

  it('інваріант зачеплення = 0 на всіх 4 парах за довільних кутів', () => {
    for (const drive of [0, 0.37, 2.9, 11.1]) {
      m.update(drive);
      for (let k = 1; k < 5; k++) {
        const A = m.arbors[k - 1], B = m.arbors[k];
        const e = meshInvariant(A.pos, B.pos, A.spec.wheel, B.spec.pinion,
          A.group.rotation.z, B.group.rotation.z);
        expect(e).toBeLessThan(1e-9);
      }
    }
  });
});

// ── Спуск у турбійоні ─────────────────────────────────────────────
describe('спуск (tourbillon escapement)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };
  const Tb = 1 / params.beatHz;
  const halfStep = Math.PI / 15;
  // Типовий варіант — анкерний спуск; ці перевірки про турбійон, тож ставимо його.
  beforeAll(() => m.escapement.install('tourbillon'));

  it('θ_cage = β: спокій між ударами, +π/15 за удар', () => {
    const b = (u) => m.setTime(u * Tb, params);
    const restA = b(0.45), restB = b(0.55), restNext = b(1.45);
    expect(restB - restA).toBeCloseTo(0, 12);
    expect(restNext - restA).toBeCloseTo(halfStep, 12);
  });

  it('баланс (у кліті): амплітуда на пів-ударі, нуль на ударі', () => {
    const A = (params.amplitude * Math.PI) / 180;
    m.setTime(0.5 * Tb, params);
    expect(tb(m).balance.rotation.z).toBeCloseTo(A, 9);
    m.setTime(1.0 * Tb, params);
    expect(tb(m).balance.rotation.z).toBeCloseTo(0, 9);
  });

  it('вилка (у кліті) чергується ±0.14 рад у спокоях', () => {
    m.setTime(0.5 * Tb, params); const f0 = tb(m).fork.rotation.z;
    m.setTime(1.5 * Tb, params); const f1 = tb(m).fork.rotation.z;
    m.setTime(2.5 * Tb, params); const f2 = tb(m).fork.rotation.z;
    expect(Math.abs(f0)).toBeCloseTo(0.14, 9);
    expect(f1).toBeCloseTo(-f0, 9);
    expect(f2).toBeCloseTo(f0, 9);
  });

  it('період секундного колеса = 32 с при 2.5 уд/с (таймінг не змінився)', () => {
    m.setTime(0, params); const r0 = m.arbors[3].group.rotation.z;
    m.setTime(60, params); const r1 = m.arbors[3].group.rotation.z;
    expect(60 / (Math.abs(r1 - r0) / TWO)).toBeCloseTo(32, 6);
  });
});

// ── Турбійон: кліть ───────────────────────────────────────────────
describe('турбійон (tourbillon cage)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };
  beforeAll(() => m.escapement.install('tourbillon'));

  it('кліть = arbor4.group і обертається на θ_cage (12 с/оберт при 2.5 уд/с)', () => {
    // Кліть — той самий вузол, що arbor4 (несе триб, що меншить секундне колесо).
    expect(tb(m).cage.parent).toBe(m.arbors[4].group);
    m.setTime(0, params); const c0 = m.arbors[4].group.rotation.z;
    m.setTime(60, params); const c1 = m.arbors[4].group.rotation.z;
    expect(60 / (Math.abs(c1 - c0) / TWO)).toBeCloseTo(12, 4);
  });

  it('нерухоме колесо стоїть на місці, поки кліть обертається', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const fixedR0 = tb(f).fixed.rotation.z;
    f.setTime(0, params); const cage0 = f.arbors[4].group.rotation.z;
    f.setTime(30, params); const cage1 = f.arbors[4].group.rotation.z;
    expect(tb(f).fixed.rotation.z).toBe(fixedR0); // нерухоме = не крутиться
    expect(cage1).not.toBe(cage0);                        // кліть крутиться
  });

  it('анкерне колесо обкочується навколо нерухомого (Zf=Zp → відносно кліті = β)', () => {
    const b0 = m.setTime(0.55 * (1 / params.beatHz), params);
    const e0 = tb(m).escSub.rotation.z;
    const b1 = m.setTime(1.55 * (1 / params.beatHz), params);
    const e1 = tb(m).escSub.rotation.z;
    // Кут анкерного колеса відносно кліті дорівнює θ_cage (β) — Zf=Zp.
    expect(e1 - e0).toBeCloseTo(b1 - b0, 9);
  });

  it('спіраль дихає в тій самій геометрії: вершини рухаються, буфер той самий', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const hair = tb(f).hairGroup.children[0];
    // Моменти навмисно НЕ симетричні відносно піку балансу: при u і 1−u
    // амплітуда однакова, і спіраль правомірно стояла б на місці.
    f.setTime(0.05, params); // u = 0.125
    const geo = hair.geometry;
    const buf = geo.attributes.position.array;
    const first = buf.slice(0, 12);

    f.setTime(0.17, params); // u = 0.425
    // Геометрію не можна перестворювати щокадру: TubeGeometry коштувала
    // ~5.7 КБ сміття й ~285 мкс на кадр — більше за весь інший механізм.
    expect(hair.geometry, 'геометрію спіралі перестворено').toBe(geo);
    expect(geo.attributes.position.array, 'буфер позицій замінено').toBe(buf);
    const later = geo.attributes.position.array.slice(0, 12);
    expect([...later].some((v, i) => Math.abs(v - first[i]) > 1e-6),
      'вершини спіралі не рухаються').toBe(true);
  });

  it('спіраль лишається трубкою сталої товщини при будь-якому куті балансу', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const RADIAL = 8, VROW = RADIAL + 1, HAIR_R = 0.034;
    const pos = tb(f).hairGroup.children[0].geometry.attributes.position;
    const rings = pos.count / VROW;
    for (const t of [0, 0.13, 0.27, 0.41]) {
      f.setTime(t, params);
      for (let i = 0; i < rings; i++) {
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < RADIAL; j++) {
          cx += pos.getX(i * VROW + j); cy += pos.getY(i * VROW + j); cz += pos.getZ(i * VROW + j);
        }
        cx /= RADIAL; cy /= RADIAL; cz /= RADIAL;
        for (let j = 0; j <= RADIAL; j++) {
          const d = Math.hypot(pos.getX(i * VROW + j) - cx,
                               pos.getY(i * VROW + j) - cy,
                               pos.getZ(i * VROW + j) - cz);
          expect(d, `t=${t}, кільце ${i}`).toBeCloseTo(HAIR_R, 5);
        }
      }
    }
  });
});

// ── Гніздо спуску ─────────────────────────────────────────────────
describe('гніздо спуску (escapement socket)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  const visibleIds = (f) =>
    f.escapement.ids.filter((id) => {
      const v = f.escapement.variant(id);
      return v.rotating.visible || v.fixed.visible;
    });

  it('встановлений варіант — один із відомих', () => {
    const f = buildFresh();
    expect(f.escapement.ids.length).toBeGreaterThan(0);
    expect(f.escapement.ids).toContain(f.escapement.installed);
  });

  it('видимий рівно один варіант — і після кожної заміни теж', () => {
    const f = buildFresh();
    // Механізм завжди має рівно один вбудований модуль: вибір нічого в цьому
    // не міняє. Це не обіцянка в нотатці, а те, що ламається тут.
    expect(visibleIds(f)).toEqual([f.escapement.installed]);
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      expect(visibleIds(f), `після install(${id})`).toEqual([id]);
    }
  });

  it('оновлюється тільки встановлений варіант', () => {
    const f = buildFresh();
    // Спіраль переписує 1089 вершин щокадру — три працюючі спуски потроїли б
    // кадровий бюджет. Рахуємо виклики: підміна на самому варіанті видима
    // гнізду, бо воно читає `update` у момент виклику.
    const calls = new Map();
    for (const id of f.escapement.ids) {
      const v = f.escapement.variant(id);
      const real = v.update;
      calls.set(id, 0);
      v.update = (...a) => { calls.set(id, calls.get(id) + 1); return real(...a); };
    }
    for (const id of f.escapement.ids) {
      for (const k of calls.keys()) calls.set(k, 0);
      f.escapement.install(id);
      f.setTime(0.3, params);
      f.setTime(0.7, params);
      for (const [k, n] of calls) {
        expect(n, `варіант ${k} при встановленому ${id}`).toBe(k === id ? 2 : 0);
      }
    }
  });

  it('при старті стоїть анкерний спуск — найпростіший модуль', () => {
    // Подача веде від простого до складного, тож застосунок відкривається
    // анкерним спуском, а не турбійоном.
    expect(buildFresh().escapement.installed).toBe('lever');
  });

  it('вибір не переживає перезбирання механізму', () => {
    const a = buildFresh();
    a.escapement.install('tourbillon');
    expect(a.escapement.installed).toBe('tourbillon');
    // Новий механізм = новий сеанс: жодного збереженого стану.
    expect(buildFresh().escapement.installed).toBe('lever');
  });

  it('усі варіанти дають однаковий β — таймінг не залежить від конструкції', () => {
    // Це головна теза всієї заміни, і вона тримається структурно: фазу рахує
    // спільний двигун удару, тож β фізично один. Тест стереже саме це.
    const f = buildFresh();
    for (const t of [0, 0.13, 0.4, 1.7, 9.3]) {
      const betas = f.escapement.ids.map((id) => {
        f.escapement.install(id);
        return f.setTime(t, params);
      });
      for (const b of betas) expect(b, `t=${t}`).toBe(betas[0]);
    }
  });

  it('секундне колесо = 32 с при будь-якому встановленому варіанті', () => {
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      f.setTime(0, params); const r0 = f.arbors[3].group.rotation.z;
      f.setTime(60, params); const r1 = f.arbors[3].group.rotation.z;
      expect(60 / (Math.abs(r1 - r0) / TWO), `варіант ${id}`).toBeCloseTo(32, 6);
    }
  });

  it('баланс у всіх варіантів однакового розміру — заради чистого порівняння', () => {
    const f = buildFresh();
    const radii = f.escapement.ids.map((id) => f.escapement.variant(id).internals.balR);
    for (const r of radii) expect(r).toBe(radii[0]);
  });

  it('анкерне колесо: 12 с у важільному, 6 с у турбійоні (їде на кліті)', () => {
    // Різниця справжня й видима — тому вона належить порівнянню, а не картці
    // станції, де мають бути тільки незмінні числа.
    const f = buildFresh();
    const absPeriod = (mesh) => {
      f.setTime(0, params); const a0 = worldZ(mesh, f.root);
      f.setTime(60, params); const a1 = worldZ(mesh, f.root);
      return 60 / (Math.abs(a1 - a0) / TWO);
    };
    f.escapement.install('lever');
    expect(absPeriod(f.escapement.variant('lever').internals.escWheel)).toBeCloseTo(12, 4);
    f.escapement.install('tourbillon');
    expect(absPeriod(f.escapement.variant('tourbillon').internals.escSub)).toBeCloseTo(6, 4);
  });

  it('сцена називає ГНІЗДО, а не встановлений модуль', () => {
    // Рішення #21: хром сцени — список МІСЦЬ у механізмі (барабан, центральне
    // колесо, стрілки, заведення), тож і спуск там назване місцем. Назва
    // модуля звучить там, де про нього йдеться: модалка, розгортка, таблиця.
    const f = buildFresh();
    const esc = f.focusPoints.find((p) => p.id === 'escapement');
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      expect(esc.nameKey, `після встановлення «${id}»`).toBe('part.escapement');
      expect(f.escapement.nameKey, 'сам модуль назву має').toBe(`part.${id}`);
    }
  });

  it('ручки вузлів адресують ЛИШЕ встановлений модуль', () => {
    // Доти панель вільного режиму зверталася до турбійона на імʼя: при
    // встановленому анкерному спуску галочка «Баланс» вмикала баланс
    // прихованого турбійона — два спуски в механізмі, де завжди рівно один.
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      const v = f.escapement.variant(id);
      const own = new Set();
      for (const root of [v.rotating, v.fixed]) root.traverse((o) => own.add(o));
      for (const n of f.escapement.nodes()) {
        if (!n.obj.isObject3D) continue;           // прозорість кліті — не меш
        expect(own.has(n.obj), `${id} / ${n.labelKey}`).toBe(true);
      }
    }
  });

  it('усі ручки вузлів увімкнені — чужий модуль однаково не видно', () => {
    const f = buildFresh();
    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      for (const n of f.escapement.nodes()) if (n.kind === 'flag') n.obj[n.prop] = true;
      for (const other of f.escapement.ids) {
        if (other === id) continue;
        const v = f.escapement.variant(other);
        let shown = 0;
        for (const root of [v.rotating, v.fixed]) root.traverse((o) => { if (o.isMesh && visible(o)) shown++; });
        expect(shown, `при ${id} видно меші ${other}`).toBe(0);
      }
    }
  });

  it('кожен модуль спуску має власні ручки, і всі вони перекладені', () => {
    const f = buildFresh();
    const keys = new Set(dictKeys('ua'));
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      const nodes = f.escapement.nodes();
      expect(nodes.length, `варіант ${id} без жодної ручки`).toBeGreaterThan(0);
      for (const n of nodes) expect(keys, `${id} / ${n.labelKey}`).toContain(n.labelKey);
    }
  });

  it('ціна складності виміряна, а не вписана: деталі рахуються обходом', () => {
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      const v = f.escapement.variant(id);
      let n = 0;
      for (const root of [v.rotating, v.fixed]) root.traverse((o) => { if (o.isMesh) n++; });
      expect(v.cost.parts, `варіант ${id}`).toBe(n);
    }
  });

  it('габарит іде за геометрією: більша кліть — більша ніша', () => {
    // Найпряміший доказ, що число не вписане: міняємо констант і дивимось,
    // чи піде міра за нею.
    const socket = (cageR) => buildEscapementSocket(
      { brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(), springSteel: mat(), plateMat: mat() },
      { escTeeth: 15, cageMat: mat(), cageR },
      { arbor: new THREE.Group(), root: new THREE.Group(), pos: { x: 0, y: 0 }, zBase: 0 }
    );
    const small = socket(4.3).variant('tourbillon').cost.r;
    const big = socket(5.5).variant('tourbillon').cost.r;
    expect(big).toBeGreaterThan(small);
  });

  it('турбійон дорожчий за всіма мірами, крім ширини', () => {
    const f = buildFresh();
    const lever = f.escapement.variant('lever').cost;
    const tb = f.escapement.variant('tourbillon').cost;
    expect(tb.parts).toBeGreaterThan(lever.parts);      // 50 проти 18
    expect(tb.axes).toBe(lever.axes + 1);               // кліть — зайвий рівень
    expect(tb.h).toBeGreaterThan(lever.h);              // вища вежа
    // А от ніша в анкерного ШИРША: баланс винесений убік виступає далі, ніж
    // край кліті. Ціна складності — у деталях і висоті, не в ширині.
    expect(lever.r).toBeGreaterThan(tb.r);
  });

  it('у турбійоні в русі більша частка деталей — кліть везе весь спуск', () => {
    const f = buildFresh();
    const tb = f.escapement.variant('tourbillon').cost;
    const lever = f.escapement.variant('lever').cost;
    // Нерухомим у турбійоні лишається рівно нерухоме колесо з колонкою — у
    // цьому й суть вузла: анкерний триб обкочується САМЕ навколо нерухомого.
    expect(tb.parts - tb.moving).toBe(2);
    expect(tb.moving / tb.parts).toBeGreaterThan(lever.moving / lever.parts);
    expect(lever.moving).toBeGreaterThan(0);
  });

  it('ніша анкерного варіанта = винесений баланс, турбійона = край кліті', () => {
    const f = buildFresh();
    expect(f.escapement.variant('lever').cost.r)
      .toBeGreaterThanOrEqual(BALANCE_OFF + BALANCE_R);
    expect(f.escapement.variant('tourbillon').cost.r).toBeCloseTo(CAGE_R, 0);
  });

  it('невідомий варіант відхиляється, а не мовчки ігнорується', () => {
    const f = buildFresh();
    expect(() => f.escapement.install('нема-такого')).toThrow();
    expect(visibleIds(f)).toEqual([f.escapement.installed]);
  });
});

// ── Моторний механізм і центральна секунда ────────────────────────
describe('моторний механізм + центральна секунда', () => {
  it('годинна вісь = центральне колесо / 12, той самий напрям', () => {
    m.update(0); const c0 = m.arbors[1].group.rotation.z, h0 = m.internals.motionWorks.hourGroup.rotation.z;
    m.update(3); const c1 = m.arbors[1].group.rotation.z, h1 = m.internals.motionWorks.hourGroup.rotation.z;
    expect((h1 - h0) / (c1 - c0)).toBeCloseTo(1 / 12, 12);
  });

  it('центральна секунда : хвилинна вісь = 60', () => {
    m.update(0); const s0 = m.internals.motionWorks.centralSecondsGroup.rotation.z, c0 = m.arbors[1].group.rotation.z;
    m.update(1); const s1 = m.internals.motionWorks.centralSecondsGroup.rotation.z, c1 = m.arbors[1].group.rotation.z;
    expect((s1 - s0) / (c1 - c0)).toBeCloseTo(60, 10);
  });

  it('інваріанти моторних пар (12→36, 10→40) = 0', () => {
    const P1 = m.arbors[1].pos;
    const mw = m.internals.motionWorks.mwArbor.position;
    for (const drive of [0, 1.7]) {
      m.update(drive);
      const e1 = meshInvariant(P1, mw, 12, 36, m.arbors[1].group.rotation.z, m.internals.motionWorks.mwArbor.rotation.z);
      const e2 = meshInvariant(mw, P1, 10, 40, m.internals.motionWorks.mwArbor.rotation.z, m.internals.motionWorks.hourGroup.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });

  it('інваріанти пар центральної секунди (48→20, 20→8) = 0', () => {
    const P3 = m.arbors[3].pos, P1 = m.arbors[1].pos;
    const idler = m.internals.motionWorks.csIdlerGroup.position;
    for (const drive of [0, 0.9]) {
      m.update(drive);
      const e1 = meshInvariant(P3, idler, 48, 20, m.arbors[3].group.rotation.z, m.internals.motionWorks.csIdlerGroup.rotation.z);
      const e2 = meshInvariant(idler, P1, 20, 8, m.internals.motionWorks.csIdlerGroup.rotation.z, m.internals.motionWorks.centralSecondsGroup.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });
});

// ── Режим реального часу ──────────────────────────────────────────
describe('реальний час (setClockTime)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('стрілки стають точно на годинникові кути; кліть зчеплена', () => {
    const phi4 = m.arbors[4].phi;
    for (const [hh, mm, ss, beatT] of [[3, 0, 0, 0.4], [9, 0, 30, 12.6], [12, 30, 15, 101.9], [6, 45, 52, 250.3]]) {
      const beta = tb(m).update(beatT, params.beatHz, params.amplitude);
      m.setClockTime(new Date(2026, 0, 1, hh, mm, ss, 0), beatT, params);
      const su = ss / 60, mu = (mm + su) / 60, hu = ((hh % 12) + mu) / 12;
      expect(wrap(worldZ(findHand(m.internals.motionWorks.centralSecondsGroup), m.root) - clockAngle(su))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.internals.motionWorks.cannonSub), m.root) - clockAngle(mu))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.internals.motionWorks.hourGroup), m.root) - clockAngle(hu))).toBeCloseTo(0, 9);
      expect(m.arbors[4].group.rotation.z - phi4 - beta).toBeCloseTo(0, 9); // кліть = phi4 + β
    }
  });
});

// ── Заведення ─────────────────────────────────────────────────────
describe('заведення (winding)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('charge похідний від диференціала: хід витрачає, клік докручує, кламп на упорі', () => {
    const f = buildFresh(); // c₀ = 0.75
    expect(f.winder.charge).toBeCloseTo(0.75, 9);
    // Хід до зупинки (емуляція демо-гейта charge>0): 0.75·2·SWEEP/RB = π/4 рад
    // барабана ≈ 160 c при 2.5 уд/с (RA=1, RB=4).
    let t = 0;
    while (f.winder.charge > 0 && t < 250) { t += 0.1; f.setTime(t, params); }
    expect(f.winder.charge).toBe(0);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(172);
    // Клік = π/2 храповика → +RA·(π/2)/(2·SWEEP) = 0.375 заряду.
    f.winder.wind();
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(f.winder.charge).toBeCloseTo(0.375, 2);
    // Кламп на упорі: багато кліків → рівно 1 (головка перестає крутитись).
    for (let k = 0; k < 5; k++) { f.winder.wind(); for (let i = 0; i < 300; i++) f.winder.update(0.05); }
    expect(f.winder.charge).toBe(1);
  });

  it('собачка клацає по зубцях храповика при заведенні', () => {
    const f = buildFresh();
    const click = f.winder.click;
    expect(click.rotation.z).toBe(0); // у спокої лежить у западині
    f.winder.wind();
    const lifts = [];
    for (let i = 0; i < 40; i++) { f.winder.update(0.01); lifts.push(click.rotation.z); }
    expect(Math.max(...lifts)).toBeGreaterThan(0.03);          // піднімалась на зубцях
    let drops = 0;
    for (let i = 1; i < lifts.length; i++) {
      expect(lifts[i]).toBeGreaterThanOrEqual(0);
      expect(lifts[i]).toBeLessThanOrEqual(0.07 + 1e-9);       // у межах ходу важеля
      if (lifts[i] < lifts[i - 1] - 0.02) drops++;             // різкий спад = «клац»
    }
    expect(drops).toBeGreaterThanOrEqual(3);                   // кілька зубців за клік заводу
  });

  it('барабанне колесо нерухоме під час заведення', () => {
    const f = buildFresh();
    const r0 = f.arbors[0].group.rotation.z;
    f.winder.wind();
    for (let i = 0; i < 200; i++) f.winder.update(0.05);
    expect(f.arbors[0].group.rotation.z).toBe(r0);
  });

  it('конічна пара: ділильні кола дотикаються, апекси збігаються', () => {
    m.root.updateMatrixWorld(true);
    let bw = null, bp = null;
    m.winder.group.traverse((o) => {
      if (o.isMesh && o.userData.gear) {
        if (o.userData.gear.teeth === 16) bw = o;
        if (o.userData.gear.teeth === 8) bp = o;
      }
    });
    expect(bw).toBeTruthy(); expect(bp).toBeTruthy();
    const RATCH_M = 0.33;
    const Rw = (RATCH_M * 16) / 2, gw = 1 / Math.tan(Math.atan(16 / 8));
    const Rp = (RATCH_M * 8) / 2, gp = 1 / Math.tan(Math.atan(8 / 16));
    // Спільний апекс: локальні нулі обох мешів у світі.
    const apexW = bw.localToWorld(new THREE.Vector3());
    const apexP = bp.localToWorld(new THREE.Vector3());
    expect(apexW.distanceTo(apexP)).toBeLessThan(1e-9);
    // Дотик ділильних кіл — аналітично (точка кола колеса → коло триба),
    // без залежності від кроку семплінгу.
    const pC = bp.localToWorld(new THREE.Vector3(0, 0, Rp * gp)); // центр кола триба
    const pN = bp.localToWorld(new THREE.Vector3(0, 0, 1)).sub(bp.localToWorld(new THREE.Vector3())).normalize();
    const distToPinionCircle = (pt) => {
      const d = pt.clone().sub(pC);
      const h = d.dot(pN);                       // відстань до площини кола
      const radial = d.clone().addScaledVector(pN, -h).length(); // проєкція в площині
      return Math.hypot(radial - Rp, h);
    };
    let minD = Infinity;
    for (let i = 0; i < 1440; i++) {
      const a = (i / 1440) * TWO;
      minD = Math.min(minD, distToPinionCircle(
        bw.localToWorld(new THREE.Vector3(Math.cos(a) * Rw, Math.sin(a) * Rw, Rw * gw))
      ));
    }
    expect(minD).toBeLessThan(1e-4);
  });
});

// ── Індикатор запасу ходу (диференціал) ───────────────────────────
describe('запас ходу (power reserve differential)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('кут водила-стрілки: α(c) = α₀ + (α₁−α₀)·c', () => {
    const f = buildFresh();
    const { hand, emptyAngle, fullAngle } = f.internals.powerReserve;
    const expectAt = (c) => emptyAngle + (fullAngle - emptyAngle) * c;
    expect(hand.rotation.z).toBeCloseTo(expectAt(0.75), 9); // початковий заряд
    f.winder.wind(); // 0.75 + 0.375 → кламп на 1 (упор)
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(hand.rotation.z).toBeCloseTo(expectAt(1), 9);
  });

  it('стрілка монотонно йде до «порожньо» під час ходу', () => {
    const f = buildFresh();
    const angles = [];
    for (let i = 0; i < 5; i++) { angles.push(f.internals.powerReserve.hand.rotation.z); f.setTime(15 * (i + 1), params); }
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]); // до PR_EMPTY (150°)
  });

  it('умова диференціала: Δводило = (ΔS_up + ΔS_low)/2 при заведенні й ході', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const snap = () => ({ u: pr.sunUp.rotation.z, l: pr.sunLow.rotation.z, c: pr.hand.rotation.z });
    const s0 = snap();
    f.winder.wind(); for (let i = 0; i < 100; i++) f.winder.update(0.02); // часткове заведення
    const s1 = snap();
    expect(s1.c - s0.c).toBeCloseTo(((s1.u - s0.u) + (s1.l - s0.l)) / 2, 12);
    f.setTime(20, params); // хід
    const s2 = snap();
    expect(s2.c - s1.c).toBeCloseTo(((s2.u - s1.u) + (s2.l - s1.l)) / 2, 12);
  });

  it('нижнє сонце нерухоме при заведенні; верхнє — при ході', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const low0 = pr.sunLow.rotation.z;
    f.winder.wind(); for (let i = 0; i < 100; i++) f.winder.update(0.02);
    expect(pr.sunLow.rotation.z).toBe(low0);          // барабан тримає передача
    const up1 = pr.sunUp.rotation.z;
    f.setTime(10, params);
    expect(pr.sunUp.rotation.z).toBe(up1);            // храповик тримає собачка
    expect(pr.sunLow.rotation.z).not.toBe(low0);      // а нижнє рухається
  });

  it('інваріанти зачеплень шляху ходу = 0 (маточинне→компаунд→трубка сонця)', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const A0 = f.arbors[0].pos; // диференціал коаксіальний з барабаном
    const I = { x: pr.group.position.x + pr.idler.position.x, y: pr.group.position.y + pr.idler.position.y };
    // Кілька станів: заведення + хід.
    f.winder.wind(); for (let i = 0; i < 60; i++) f.winder.update(0.02);
    for (const t of [0, 7.3]) {
      f.setTime(t, params);
      // маточинне колесо (32, кероване барабанним колесом) → тріб компаунда (8)
      const eHI = meshInvariant(A0, I, 32, 8, f.arbors[0].group.rotation.z, pr.idler.rotation.z);
      // колесо компаунда (20) → колесо трубки нижнього сонця (20)
      const eIG = meshInvariant(I, A0, 20, 20, pr.idler.rotation.z, pr.sunLow.rotation.z);
      expect(eHI).toBeLessThan(1e-9);
      expect(eIG).toBeLessThan(1e-9);
    }
  });

  it('реальний час = автопідзавод: стрілка запасу ходу стоїть, храповик докручується', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const hand0 = pr.hand.rotation.z;
    const ratchet0 = f.winder.ratchet.rotation.z;
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 0), 0.5, params);
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 30), 30.5, params);
    expect(pr.hand.rotation.z).toBeCloseTo(hand0, 9);          // запас не падає
    expect(f.winder.ratchet.rotation.z).toBeLessThan(ratchet0); // автопідзавод крутить храповик (контр-обертання)
  });
});

// ── Компоновка ────────────────────────────────────────────────────
describe('компоновка (layout)', () => {
  it('усі точки фокуса всередині платини', () => {
    const { cx, cy, plateR } = m.internals.bounds;
    for (const fp of m.focusPoints) {
      expect(Math.hypot(fp.pos.x - cx, fp.pos.y - cy) + Math.min(fp.r, 3.8)).toBeLessThan(plateR + 1e-6);
    }
  });

  it('немає глибоких колізій тіл на нижніх Z-шарах', () => {
    m.setTime(0.5, { beatHz: 2.5, amplitude: 220 });
    m.root.updateMatrixWorld(true);
    const bodies = [];
    m.root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // Невстановлені варіанти спуску стоять у сцені схованими й у механізмі
      // не співіснують: їхні баланси законно займають одне місце.
      if (o.userData.variant && o.userData.variant !== m.escapement.installed) return;
      const t = o.geometry.type;
      if (t !== 'ExtrudeGeometry' && t !== 'TorusGeometry') return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const e = o.matrixWorld.elements;
      const bb = o.geometry.boundingBox;
      bodies.push({ x: e[12], y: e[13], z: e[14], r: o.geometry.boundingSphere.radius, zHalf: (bb.max.z - bb.min.z) / 2 });
    });
    const low = bodies.filter((b) => b.z < 6.5);
    const hits = [];
    for (let i = 0; i < low.length; i++) for (let j = i + 1; j < low.length; j++) {
      const a = low[i], b = low[j];
      const dxy = Math.hypot(a.x - b.x, a.y - b.y);
      if (dxy < 1.0) continue; // коаксіальні збірки (коронне+конічне, спільний апекс) — за задумом
      const pen = a.r + b.r - dxy;
      const zOv = Math.abs(a.z - b.z) < a.zHalf + b.zHalf;
      if (pen > 1.3 && zOv) hits.push({ pen, za: a.z, zb: b.z });
    }
    expect(hits).toEqual([]);
  });
});
