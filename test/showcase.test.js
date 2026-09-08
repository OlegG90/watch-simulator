import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { buildShowcase, TEETH, WHEEL_R, FORK_D, BAL_D, WHEEL_LOCK_PHASE, JEWEL_GEOM } from '../src/showcase/leverModel.js';
import { wheelAngle, forkAngle, balanceAngle, phaseName, activePallet, FORK_MAX, AMPLITUDE } from '../src/showcase/motion.js';
import { buildSpring, SPRING_N, SPRING_R0, SPRING_R1 } from '../src/showcase/spring.js';

const noNaN = (root) => {
  let ok = true;
  root.traverse((o) => {
    if (o.isMesh) {
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) ok = false;
    }
  });
  return ok;
};

const byPallet = (m, face) => {
  const found = [];
  m.group.traverse((o) => { if (o.userData.pallet?.face === face) found.push(o); });
  return found;
};

describe('вітрина анкерного спуску (геометрія)', () => {
  it('колесо: 15 клубових зубців, вістря на заданому радіусі', () => {
    const m = buildShowcase();
    let wheel = null;
    m.group.traverse((o) => { if (o.userData.club) wheel = o; });
    expect(wheel).not.toBeNull();
    expect(wheel.userData.club.teeth).toBe(TEETH);
    const pos = wheel.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
    expect(maxR).toBeCloseTo(WHEEL_R, 6);
    expect(noNaN(m.group)).toBe(true);
  });

  it('два камені — вхідний і вихідний — центрами в смузі зубців', () => {
    // Камінь поза смугою не зустрів би жодного зубця: зачеплення не було б із чим.
    const m = buildShowcase();
    m.group.updateMatrixWorld(true);
    for (const face of ['entry', 'exit']) {
      const found = byPallet(m, face);
      expect(found, `камінь ${face}`).toHaveLength(1);
      const p = found[0].getWorldPosition(new THREE.Vector3());
      const r = Math.hypot(p.x, p.y);
      expect(r, `радіус каменя ${face}`).toBeGreaterThan(1.02);
      expect(r, `радіус каменя ${face}`).toBeLessThan(WHEEL_R);
    }
  });

  it('осі на лінії центрів: вилка на FORK_D, баланс далі на BAL_D', () => {
    const m = buildShowcase();
    expect(m.forkPivot.position.x).toBeCloseTo(FORK_D, 12);
    expect(m.forkPivot.position.y).toBeCloseTo(0, 12);
    expect(m.balancePivot.position.x).toBeCloseTo(FORK_D + BAL_D, 12);
    expect(m.balancePivot.position.y).toBeCloseTo(0, 12);
  });

  it('у замках вістря стоїть на грані активної палети — вхідному й вихідному', () => {
    // Той самий мінімакс, що дав WHEEL_LOCK_PHASE і посадку вихідної, —
    // як гард: вихідний замок міряється на δ + півзубця, бо колесо між
    // замками просувається. Саботаж: нульова фаза або дзеркальна вихідна
    // (грань від зубців) — і цей тест червоніє.
    const m = buildShowcase();
    const l2w = (stone, x, y) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(stone.matrixWorld);
      return new THREE.Vector2(v.x, v.y);
    };
    const STEP = (Math.PI * 2) / TEETH;
    for (const [u, face] of [[0.5, 'entry'], [1.5, 'exit'], [2.5, 'entry']]) {
      m.update(u);
      m.group.updateMatrixWorld(true);
      const stone = byPallet(m, face)[0];
      const w = JEWEL_GEOM.w / 2, h = JEWEL_GEOM.h / 2;
      const A = l2w(stone, -w, -h), B = l2w(stone, -w + JEWEL_GEOM.lean, h);
      const ab = B.clone().sub(A);
      const len2 = ab.lengthSq();
      let best = Infinity;
      for (let i = 0; i < TEETH; i++) {
        const a = m.wheelPivot.rotation.z + i * STEP;
        const p = new THREE.Vector2(1.5 * Math.cos(a), 1.5 * Math.sin(a));
        const t = Math.max(0, Math.min(1, p.clone().sub(A).dot(ab) / len2));
        best = Math.min(best, p.clone().sub(A.clone().addScaledVector(ab, t)).length());
      }
      expect(best, `замок ${face}@${u}`).toBeLessThan(0.01);
    }
    expect(WHEEL_LOCK_PHASE).not.toBe(0);
  });

  it('камені стоять запірною гранню назустріч зубцям, а не спиною', () => {
    // Верхній кут запірної грані — на мінус-x локально (звідти йдуть зубці).
    // Дзеркальний камінь кладе туди глуху спину, а замок-гард цього не бачить:
    // він міряє лінію в просторі, не фізичне ребро. Саботаж: mirror −1 —
    // і цей тест червоніє, а замок — ні.
    const m = buildShowcase();
    for (const face of ['entry', 'exit']) {
      const stone = byPallet(m, face)[0];
      const pos = stone.geometry.attributes.position;
      let topY = -Infinity, topX = 0;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > topY) { topY = pos.getY(i); topX = pos.getX(i); }
      }
      expect(topY, `верх каменя ${face}`).toBeCloseTo(JEWEL_GEOM.h / 2, 6);
      expect(topX, `клин каменя ${face}`).toBeLessThan(0);
    }
  });

  it('вітрина не імпортує рух: ізоляція за рішенням', () => {
    // Самодостатність — не домовленість, а структура: жодного імпорту з
    // механізму, гнізда чи шару уроку в усій теці showcase/.
    const dir = new URL('../src/showcase/', import.meta.url);
    for (const f of readdirSync(dir)) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      for (const mod of ['movement', 'escapement', 'lesson', 'settings', 'motionWorks']) {
        expect(src, `${f} тягне ${mod}`).not.toMatch(new RegExp(`from\\s+['"][^'"]*${mod}`));
      }
    }
  });
});

describe('рух вітрини (фазова кінематика)', () => {
  it('колесо йде півзубця за удар', () => {
    expect(wheelAngle(1.5) - wheelAngle(0.5)).toBeCloseTo(Math.PI / TEETH, 12);
    expect(wheelAngle(2.5) - wheelAngle(1.5)).toBeCloseTo(Math.PI / TEETH, 12);
  });

  it('вилка стоїть в упорах у замках і міняє сторону кожного удару', () => {
    expect(Math.abs(forkAngle(0.5))).toBeCloseTo(FORK_MAX, 12);
    expect(Math.abs(forkAngle(1.5))).toBeCloseTo(FORK_MAX, 12);
    expect(Math.sign(forkAngle(0.5))).toBe(-Math.sign(forkAngle(1.5)));
  });

  it('баланс у нулі на перекиданнях і в розмаху між ними', () => {
    expect(balanceAngle(0)).toBeCloseTo(0, 12);
    expect(balanceAngle(1)).toBeCloseTo(0, 12);
    expect(Math.abs(balanceAngle(0.5))).toBeCloseTo((AMPLITUDE * Math.PI) / 180, 12);
  });

  it('підпис фази: замок поза вікном, зрив → імпульс → падіння всередині', () => {
    expect(phaseName(2.5)).toBe('lock');
    expect(phaseName(3 - 0.1)).toBe('unlock');
    expect(phaseName(3)).toBe('impulse');
    expect(phaseName(3 + 0.1)).toBe('drop');
  });

  it('замок тримають по черзі: вхідна, вихідна, вхідна', () => {
    expect(activePallet(0.5)).toBe('entry');
    expect(activePallet(1.5)).toBe('exit');
    expect(activePallet(2.5)).toBe('entry');
  });

  it('update ставить пози без NaN на замках і посеред перекидання', () => {
    const m = buildShowcase();
    for (const u of [0.5, 0.9, 1.0, 1.1, 1.5, 3.25]) {
      m.update(u);
      for (const p of [m.wheelPivot, m.forkPivot, m.balancePivot])
        expect(Number.isFinite(p.rotation.z), `u=${u}`).toBe(true);
    }
    expect(noNaN(m.group)).toBe(true);
  });
});

describe('пружина вітрини (дихання)', () => {
  const springMat = () => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });

  it('зовнішній кінець стоїть у колодці, внутрішній їде з балансом', () => {
    const s = buildSpring({ cx: 0, cy: 0, z: 0, material: springMat() });
    const railMid = (i) => {
      const p = s.mesh.geometry.attributes.position.array;
      return [(p[i * 6] + p[i * 6 + 3]) / 2, (p[i * 6 + 1] + p[i * 6 + 4]) / 2];
    };
    s.update(0);
    const outer0 = railMid(SPRING_N - 1), inner0 = railMid(0);
    expect(Math.hypot(...outer0)).toBeCloseTo(SPRING_R1, 6);
    expect(Math.hypot(...inner0)).toBeCloseTo(SPRING_R0, 6);
    s.update(1.0);
    const outer1 = railMid(SPRING_N - 1), inner1 = railMid(0);
    expect(Math.hypot(outer1[0] - outer0[0], outer1[1] - outer0[1])).toBeCloseTo(0, 9);
    const a0 = Math.atan2(inner0[1], inner0[0]);
    const a1 = Math.atan2(inner1[1], inner1[0]);
    expect(a1 - a0).toBeCloseTo(1.0, 6);
  });

  it('той самий буфер між кадрами: алокацій нема, NaN нема', () => {
    const s = buildSpring({ cx: 0, cy: 0, z: 0, material: springMat() });
    const pos = s.mesh.geometry.attributes.position;
    const buf = pos.array;
    s.update(0.37);
    s.update(1.61);
    expect(pos.array).toBe(buf);
    for (let i = 0; i < buf.length; i++) expect(Number.isFinite(buf[i])).toBe(true);
  });
});
