import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { buildShowcase, TEETH, WHEEL_R, FORK_D, BAL_D, WHEEL_LOCK_PHASE } from '../src/showcase/leverModel.js';

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

  it('у посадці вістря стоїть на запірній грані вхідної палети', () => {
    // Той самий скан, що дав WHEEL_LOCK_PHASE, — як гард: з нульовою фазою
    // вістря стоїть на півкроку повз камінь, і цей тест червоніє.
    const m = buildShowcase();
    m.group.updateMatrixWorld(true);
    const stone = byPallet(m, 'entry')[0];
    // Контакт — у площині колеса: Z тут ні до чого (камінь товщий за колесо
    // й виступає над ним), тож міряємо в XY, як скан, що дав фазу.
    const l2w = (x, y) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(stone.matrixWorld);
      return new THREE.Vector2(v.x, v.y);
    };
    const A = l2w(-0.17, -0.31), B = l2w(-0.17 + Math.tan(10 * Math.PI / 180) * 0.62, 0.31);
    const segDist = (p) => {
      const ab = B.clone().sub(A);
      const t = Math.max(0, Math.min(1, p.clone().sub(A).dot(ab) / ab.lengthSq()));
      return p.clone().sub(A.clone().add(ab.multiplyScalar(t))).length();
    };
    const STEP = (Math.PI * 2) / TEETH;
    let best = Infinity;
    for (let i = 0; i < TEETH; i++) {
      const a = m.wheelPivot.rotation.z + i * STEP;
      best = Math.min(best, segDist(new THREE.Vector2(1.5 * Math.cos(a), 1.5 * Math.sin(a))));
    }
    expect(best).toBeLessThan(0.01);
    expect(WHEEL_LOCK_PHASE).not.toBe(0);
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
