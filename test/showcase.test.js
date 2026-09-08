import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { buildShowcase, TEETH, WHEEL_R, FORK_D, BAL_D, WHEEL_LOCK_PHASE, JEWEL_GEOM, palletOutline, clubToothQuad } from '../src/showcase/leverModel.js';
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

  it('осі на лінії центрів: вилка на FORK_D, баланс далі на BAL_D', () => {
    const m = buildShowcase();
    expect(m.forkPivot.position.x).toBeCloseTo(FORK_D, 12);
    expect(m.forkPivot.position.y).toBeCloseTo(0, 12);
    expect(m.balancePivot.position.x).toBeCloseTo(FORK_D + BAL_D, 12);
    expect(m.balancePivot.position.y).toBeCloseTo(0, 12);
  });

  it('у замках вістря стоїть на фасці активної палети — вхідному й вихідному', () => {
    // Той самий мінімакс, що дав WHEEL_LOCK_PHASE і посадку вихідної, —
    // як гард: вихідний замок міряється на δ + півзубця, бо колесо між
    // замками просувається. Контакт — короткий фасок A→K, не вся грань:
    // вістря сідає ріжком. Саботаж: нульова фаза або фасок повз вістря —
    // і цей тест червоніє.
    const m = buildShowcase();
    const l2w = (stone, x, y) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(stone.matrixWorld);
      return new THREE.Vector2(v.x, v.y);
    };
    const STEP = (Math.PI * 2) / TEETH;
    const w = JEWEL_GEOM.w / 2, h = JEWEL_GEOM.h / 2;
    const e = Math.hypot(JEWEL_GEOM.lean, 2 * h);
    const kx = -w + (JEWEL_GEOM.lean / e) * JEWEL_GEOM.lockLen;
    const ky = -h + ((2 * h) / e) * JEWEL_GEOM.lockLen;
    for (const [u, face] of [[0.5, 'entry'], [1.5, 'exit'], [2.5, 'entry']]) {
      m.update(u);
      m.group.updateMatrixWorld(true);
      const stone = byPallet(m, face)[0];
      const A = l2w(stone, -w, -h), B = l2w(stone, kx, ky);
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

  it('замкове вістря — ЗОВНІ тіла каменя: без поховання', () => {
    // Близькість до лінії грані burial не бачить: вістря всередині тіла
    // теж дає малу відстань до грані. Цей гард ловить саме поховання.
    // Саботаж: стара посадка центром у смузі — вістря всередині, червоний.
    const m = buildShowcase();
    const inside = ([x, y], poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    for (const [u, face, tip] of [[0.5, 'entry', 0], [1.5, 'exit', 12]]) {
      m.update(u);
      m.group.updateMatrixWorld(true);
      const stone = byPallet(m, face)[0];
      const poly = palletOutline(stone.userData.pallet.imp).map(([x, y]) =>
        new THREE.Vector3(x, y, 0).applyMatrix4(stone.matrixWorld));
      const wA = m.wheelPivot.rotation.z;
      const STEP = (Math.PI * 2) / TEETH;
      const t = [WHEEL_R * Math.cos(wA + tip * STEP), WHEEL_R * Math.sin(wA + tip * STEP)];
      expect(inside(t, poly.map((v) => [v.x, v.y])), `вістря в тілі ${face}@${u}`).toBe(false);
    }
  });

  it('камені стоять запірною гранню назустріч зубцям, а не спиною', () => {
    // Верхній кут запірної грані — на мінус-x локально (звідти йдуть зубці).
    // Віддзеркалений камінь кладе туди глуху спину, а замок-гард цього не бачить:
    // він міряє лінію в просторі, не фізичне ребро. Саботаж: віддзеркалити
    // контур по x — і цей тест червоніє, а замок — ні.
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

  it('за цикл — без наскрізного проходження, навпроти — колесо під ріжком', () => {
    // Поріг −0.05 відділяє burial (стара посадка: −0.46 у замку, −0.6
    // у транзиті; зламаний розворот: червоніє одразу) від постановочного
    // дотику в момент падіння/зриву (виміряно −0.040/−0.024, див. SEAT —
    // зубець торкається там, де має торкатись). Навпроти (+0.01) зубець
    // проходить ПІД місцем зачепа з видимим зазором (виміряно +0.025/+0.058).
    // Фігури — з самого модуля (palletOutline, clubToothQuad), не дубль.
    const segDist = (p1, p2, p3, p4) => {
      const s = (a, b) => [a[0] - b[0], a[1] - b[1]];
      const d = (a, b) => a[0] * b[0] + a[1] * b[1];
      const n = (a) => Math.hypot(a[0], a[1]);
      const d1 = s(p2, p1), d2 = s(p4, p3), r = s(p1, p3);
      const a = d(d1, d1), e = d(d2, d2), f = d(d2, r);
      let t1, t2;
      if (a <= 1e-12 && e <= 1e-12) return n(r);
      if (a <= 1e-12) { t1 = 0; t2 = Math.max(0, Math.min(1, f / e)); }
      else {
        const c = d(d1, r);
        if (e <= 1e-12) { t2 = 0; t1 = Math.max(0, Math.min(1, -c / a)); }
        else {
          const b = d(d1, d2), den = a * e - b * b;
          t1 = den > 1e-12 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
          t2 = (b * t1 + f) / e;
          if (t2 < 0) { t2 = 0; t1 = Math.max(0, Math.min(1, -c / a)); }
          else if (t2 > 1) { t2 = 1; t1 = Math.max(0, Math.min(1, (b - c) / a)); }
        }
      }
      return n(s([p1[0] + d1[0] * t1, p1[1] + d1[1] * t1], [p3[0] + d2[0] * t2, p3[1] + d2[1] * t2]));
    };
    const inPoly = ([x, y], poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const ptSeg = (p, a, b) => {
      const ab = [b[0] - a[0], b[1] - a[1]];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
      return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
    };
    const clearance = (tooth, stone) => {
      let dmin = Infinity, cross = false;
      for (let i = 0; i < tooth.length; i++) for (let j = 0; j < stone.length; j++) {
        const dd = segDist(tooth[i], tooth[(i + 1) % tooth.length], stone[j], stone[(j + 1) % stone.length]);
        if (dd < 1e-9) cross = true;
        if (dd < dmin) dmin = dd;
      }
      if (!cross && !tooth.some((p) => inPoly(p, stone)) && !stone.some((p) => inPoly(p, tooth))) return dmin;
      let depth = Infinity;
      for (const p of tooth) if (inPoly(p, stone)) for (let j = 0; j < stone.length; j++) depth = Math.min(depth, ptSeg(p, stone[j], stone[(j + 1) % stone.length]));
      for (const p of stone) if (inPoly(p, tooth)) for (let i = 0; i < tooth.length; i++) depth = Math.min(depth, ptSeg(p, tooth[i], tooth[(i + 1) % tooth.length]));
      return -(depth === Infinity ? 0 : depth);
    };
    const m = buildShowcase();
    const toWorld = (mesh, pts) => pts.map(([x, y]) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld);
      return [v.x, v.y];
    });
    const rotQ = (q, a) => q.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    let worst = 0;
    const opp = {};
    for (let u = 0.5; u <= 2.5001; u += 0.01) {
      m.update(u);
      m.group.updateMatrixWorld(true);
      const wA = m.wheelPivot.rotation.z;
      const teeth = [];
      for (let i = 0; i < TEETH; i++) teeth.push(rotQ(clubToothQuad(i), wA));
      for (const face of ['entry', 'exit']) {
        const stone = byPallet(m, face)[0];
        const poly = toWorld(stone, palletOutline(stone.userData.pallet.imp));
        let g = Infinity;
        for (const t of teeth) g = Math.min(g, clearance(t, poly));
        if (g < worst) worst = g;
        // Відпущений камінь у момент чужого замка: колесо йде під ріжком.
        if ((Math.abs(u - 1.5) < 0.005 && face === 'entry') ||
            (Math.abs(u - 0.5) < 0.005 && face === 'exit') ||
            (Math.abs(u - 2.5) < 0.005 && face === 'exit')) opp[`${face}@${u.toFixed(1)}`] = g;
      }
    }
    expect(worst, 'транзитний мінімум').toBeGreaterThan(-0.05);
    for (const [k, v] of Object.entries(opp)) expect(v, `зазор ${k}`).toBeGreaterThan(0.01);
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
