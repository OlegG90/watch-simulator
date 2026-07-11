import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';

// ── Хелпери ───────────────────────────────────────────────────────
const TWO = Math.PI * 2;
const mod = (a, q) => ((a % q) + q) % q;
const wrap = (a) => { a = mod(a, TWO); return a > Math.PI ? a - TWO : a; };

const mat = () => new THREE.MeshStandardMaterial();
const buildFresh = () =>
  buildMovement({
    brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
    springMat: new THREE.LineBasicMaterial(), plateMat: mat(), bluedMat: mat(), springSteel: mat(),
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

// ── Спуск ─────────────────────────────────────────────────────────
describe('спуск (escapement)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };
  const Tb = 1 / params.beatHz;
  const halfStep = Math.PI / 15;

  it('анкерне колесо: спокій між ударами, +π/15 за удар', () => {
    const E = (u) => m.setTime(u * Tb, params);
    const restA = E(0.45), restB = E(0.55), restNext = E(1.45);
    expect(restB - restA).toBeCloseTo(0, 12);
    expect(restNext - restA).toBeCloseTo(halfStep, 12);
  });

  it('баланс: амплітуда на пів-ударі, нуль на ударі', () => {
    const A = (params.amplitude * Math.PI) / 180;
    m.setTime(0.5 * Tb, params);
    expect(m.escapement.balance.rotation.z).toBeCloseTo(A, 9);
    m.setTime(1.0 * Tb, params);
    expect(m.escapement.balance.rotation.z).toBeCloseTo(0, 9);
  });

  it('вилка чергується ±0.14 рад у спокоях', () => {
    m.setTime(0.5 * Tb, params); const f0 = m.escapement.fork.rotation.z;
    m.setTime(1.5 * Tb, params); const f1 = m.escapement.fork.rotation.z;
    m.setTime(2.5 * Tb, params); const f2 = m.escapement.fork.rotation.z;
    expect(Math.abs(f0)).toBeCloseTo(0.14, 9);
    expect(f1).toBeCloseTo(-f0, 9);
    expect(f2).toBeCloseTo(f0, 9);
  });

  it('період секундного колеса = 32 с при 2.5 уд/с', () => {
    m.setTime(0, params); const r0 = m.arbors[3].group.rotation.z;
    m.setTime(60, params); const r1 = m.arbors[3].group.rotation.z;
    expect(60 / (Math.abs(r1 - r0) / TWO)).toBeCloseTo(32, 6);
  });
});

// ── Моторний механізм і центральна секунда ────────────────────────
describe('моторний механізм + центральна секунда', () => {
  it('годинна вісь = центральне колесо / 12, той самий напрям', () => {
    m.update(0); const c0 = m.arbors[1].group.rotation.z, h0 = m.motionWorks.hourGroup.rotation.z;
    m.update(3); const c1 = m.arbors[1].group.rotation.z, h1 = m.motionWorks.hourGroup.rotation.z;
    expect((h1 - h0) / (c1 - c0)).toBeCloseTo(1 / 12, 12);
  });

  it('центральна секунда : хвилинна вісь = 60', () => {
    m.update(0); const s0 = m.centralSeconds.center.rotation.z, c0 = m.arbors[1].group.rotation.z;
    m.update(1); const s1 = m.centralSeconds.center.rotation.z, c1 = m.arbors[1].group.rotation.z;
    expect((s1 - s0) / (c1 - c0)).toBeCloseTo(60, 10);
  });

  it('інваріанти моторних пар (12→36, 10→40) = 0', () => {
    const P1 = m.arbors[1].pos;
    const mw = m.motionWorks.mwArbor.position;
    for (const drive of [0, 1.7]) {
      m.update(drive);
      const e1 = meshInvariant(P1, mw, 12, 36, m.arbors[1].group.rotation.z, m.motionWorks.mwArbor.rotation.z);
      const e2 = meshInvariant(mw, P1, 10, 40, m.motionWorks.mwArbor.rotation.z, m.motionWorks.hourGroup.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });

  it('інваріанти пар центральної секунди (48→20, 20→8) = 0', () => {
    const P3 = m.arbors[3].pos, P1 = m.arbors[1].pos;
    const idler = m.centralSeconds.idler.position;
    for (const drive of [0, 0.9]) {
      m.update(drive);
      const e1 = meshInvariant(P3, idler, 48, 20, m.arbors[3].group.rotation.z, m.centralSeconds.idler.rotation.z);
      const e2 = meshInvariant(idler, P1, 20, 8, m.centralSeconds.idler.rotation.z, m.centralSeconds.center.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });
});

// ── Режим реального часу ──────────────────────────────────────────
describe('реальний час (setClockTime)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('стрілки стають точно на годинникові кути; спуск лишається зчепленим', () => {
    const phi4 = m.arbors[4].phi;
    for (const [hh, mm, ss, beatT] of [[3, 0, 0, 0.4], [9, 0, 30, 12.6], [12, 30, 15, 101.9], [6, 45, 52, 250.3]]) {
      const E = m.escapement.update(beatT, params.beatHz, params.amplitude);
      m.setClockTime(new Date(2026, 0, 1, hh, mm, ss, 0), beatT, params);
      const su = ss / 60, mu = (mm + su) / 60, hu = ((hh % 12) + mu) / 12;
      expect(wrap(worldZ(findHand(m.centralSeconds.center), m.root) - clockAngle(su))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.motionWorks.cannonSub), m.root) - clockAngle(mu))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.motionWorks.hourGroup), m.root) - clockAngle(hu))).toBeCloseTo(0, 9);
      expect(m.arbors[4].group.rotation.z - phi4 - E).toBeCloseTo(0, 9);
    }
  });
});

// ── Заведення ─────────────────────────────────────────────────────
describe('заведення (winding)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('charge похідний від диференціала: хід витрачає, клік докручує, кламп на упорі', () => {
    const f = buildFresh(); // c₀ = 0.75
    expect(f.winder.charge).toBeCloseTo(0.75, 9);
    // Хід до зупинки (емуляція демо-гейта charge>0): 0.75·2·SWEEP/RB = π/6 рад
    // барабана ≈ 106.7 c при 2.5 уд/с.
    let t = 0;
    while (f.winder.charge > 0 && t < 200) { t += 0.1; f.setTime(t, params); }
    expect(f.winder.charge).toBe(0);
    expect(t).toBeGreaterThan(100);
    expect(t).toBeLessThan(115);
    // Клік = 2π храповика → +RA·2π/(2·SWEEP) = 0.375 заряду.
    f.winder.wind();
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(f.winder.charge).toBeCloseTo(0.375, 2);
    // Кламп на упорі: багато кліків → рівно 1 (головка перестає крутитись).
    for (let k = 0; k < 5; k++) { f.winder.wind(); for (let i = 0; i < 300; i++) f.winder.update(0.05); }
    expect(f.winder.charge).toBe(1);
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
    const { hand, emptyAngle, fullAngle } = f.powerReserve;
    const expectAt = (c) => emptyAngle + (fullAngle - emptyAngle) * c;
    expect(hand.rotation.z).toBeCloseTo(expectAt(0.75), 9); // початковий заряд
    f.winder.wind(); // 0.75 + 0.375 → кламп на 1 (упор)
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(hand.rotation.z).toBeCloseTo(expectAt(1), 9);
  });

  it('стрілка монотонно йде до «порожньо» під час ходу', () => {
    const f = buildFresh();
    const angles = [];
    for (let i = 0; i < 5; i++) { angles.push(f.powerReserve.hand.rotation.z); f.setTime(15 * (i + 1), params); }
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]); // до PR_EMPTY (150°)
  });

  it('умова диференціала: Δводило = (ΔS_up + ΔS_low)/2 при заведенні й ході', () => {
    const f = buildFresh();
    const pr = f.powerReserve;
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
    const pr = f.powerReserve;
    const low0 = pr.sunLow.rotation.z;
    f.winder.wind(); for (let i = 0; i < 100; i++) f.winder.update(0.02);
    expect(pr.sunLow.rotation.z).toBe(low0);          // барабан тримає передача
    const up1 = pr.sunUp.rotation.z;
    f.setTime(10, params);
    expect(pr.sunUp.rotation.z).toBe(up1);            // храповик тримає собачка
    expect(pr.sunLow.rotation.z).not.toBe(low0);      // а нижнє рухається
  });

  it('інваріанти зачеплень шляхів диференціала = 0 (A1→A2, барабан→проміжне→B)', () => {
    const f = buildFresh();
    const pr = f.powerReserve;
    const A0 = f.arbors[0].pos;
    const D = { x: pr.group.position.x, y: pr.group.position.y };
    const I = { x: pr.group.position.x + pr.idler.position.x, y: pr.group.position.y + pr.idler.position.y };
    // Кілька станів: заведення + хід.
    f.winder.wind(); for (let i = 0; i < 60; i++) f.winder.update(0.02);
    for (const t of [0, 7.3]) {
      f.setTime(t, params);
      const eA = meshInvariant(A0, D, 14, 56, f.winder.ratchet.rotation.z, pr.sunUp.rotation.z);
      const eBI = meshInvariant(A0, I, 48, 14, f.arbors[0].group.rotation.z, pr.idler.rotation.z);
      const eIB = meshInvariant(I, D, 14, 8, pr.idler.rotation.z, pr.sunLow.rotation.z);
      expect(eA).toBeLessThan(1e-9);
      expect(eBI).toBeLessThan(1e-9);
      expect(eIB).toBeLessThan(1e-9);
    }
  });

  it('реальний час = автопідзавод: стрілка запасу ходу стоїть, храповик докручується', () => {
    const f = buildFresh();
    const pr = f.powerReserve;
    const hand0 = pr.hand.rotation.z;
    const ratchet0 = f.winder.ratchet.rotation.z;
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 0), 0.5, params);
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 30), 30.5, params);
    expect(pr.hand.rotation.z).toBeCloseTo(hand0, 9);            // запас не падає
    expect(f.winder.ratchet.rotation.z).toBeGreaterThan(ratchet0); // автопідзавод крутить храповик
  });
});

// ── Компоновка ────────────────────────────────────────────────────
describe('компоновка (layout)', () => {
  it('усі точки фокуса всередині платини', () => {
    const { cx, cy, plateR } = m.bounds;
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
