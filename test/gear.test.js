import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeGear, makeEscapeWheel, makeBevelGear, makeSpiralRibbon, makeHand } from '../src/gear.js';

const mat = () => new THREE.MeshStandardMaterial();

const noNaN = (mesh) => {
  const a = mesh.geometry.attributes.position.array;
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
  return true;
};

describe('makeGear', () => {
  it('зберігає ділильний радіус r = m·z/2 у userData', () => {
    const g = makeGear({ teeth: 40, module: 0.35, thickness: 0.7, bore: 0.27 }, mat());
    expect(g.userData.gear.teeth).toBe(40);
    expect(g.userData.gear.pitchR).toBeCloseTo((0.35 * 40) / 2, 12);
  });

  it('геометрія без NaN; зовнішній радіус ≈ pitchR + m·addendum', () => {
    const m = 0.35, z = 36;
    const g = makeGear({ teeth: z, module: m, thickness: 0.7, bore: 0.27, crossings: 4 }, mat());
    expect(noNaN(g)).toBe(true);
    const pos = g.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
    // + bevel-фаска m·0.1
    expect(maxR).toBeGreaterThan((m * z) / 2 + m * 0.9);
    expect(maxR).toBeLessThan((m * z) / 2 + m * 1.3);
  });
});

describe('makeEscapeWheel', () => {
  it('без NaN; вістря на заданому зовнішньому радіусі', () => {
    const w = makeEscapeWheel({ teeth: 15, outerR: 4.9, rootR: 3.8, thickness: 0.5, bore: 0.27 }, mat());
    expect(noNaN(w)).toBe(true);
    const pos = w.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
    expect(maxR).toBeCloseTo(4.9, 6);
    expect(w.userData.escape.teeth).toBe(15);
  });
});

describe('makeBevelGear', () => {
  it('вершина конуса в нулі: z − r/tanδ ∈ [0, thickness] для всіх вершин', () => {
    const pitchDeg = Math.atan(16 / 8) * (180 / Math.PI); // 63.435°
    const thickness = 0.45;
    const g = makeBevelGear({ teeth: 16, module: 0.33, thickness, bore: 0.2, pitchAngleDeg: pitchDeg }, mat());
    expect(noNaN(g)).toBe(true);
    const gcot = 1 / Math.tan((pitchDeg * Math.PI) / 180);
    const pos = g.geometry.attributes.position; // Float32 → допуск 1e-6
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      const lift = pos.getZ(i) - r * gcot; // залишок = вихідна екструзія
      expect(lift).toBeGreaterThanOrEqual(-1e-6);
      expect(lift).toBeLessThanOrEqual(thickness + 1e-6);
    }
  });

  it('вінець на аксіальній відстані R/tanδ від вершини', () => {
    const pitchDeg = Math.atan(8 / 16) * (180 / Math.PI); // 26.565°
    const R = (0.33 * 8) / 2;
    const g = makeBevelGear({ teeth: 8, module: 0.33, thickness: 0.6, bore: 0.15, pitchAngleDeg: pitchDeg }, mat());
    const expectAxial = R / Math.tan((pitchDeg * Math.PI) / 180); // 2.64
    // Точка ділильного кола в локальних координатах меша:
    const pos = g.geometry.attributes.position;
    let best = Infinity, bestZ = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      if (Math.abs(r - R) < best) { best = Math.abs(r - R); bestZ = pos.getZ(i); }
    }
    expect(bestZ).toBeGreaterThan(expectAxial - 0.05);
    expect(bestZ).toBeLessThan(expectAxial + 0.6 + 0.1); // + товщина екструзії + допуск найближчої вершини
  });
});

describe('makeSpiralRibbon', () => {
  it('setShape задає радіуси витків точно', () => {
    const s = makeSpiralRibbon({ height: 1.5, segments: 300 }, mat());
    s.userData.setShape({ innerR: 1.05, outerR: 6.8, turns: 3.4 });
    expect(noNaN(s)).toBe(true);
    const pos = s.geometry.attributes.position;
    let minR = Infinity, maxR = 0;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    }
    expect(minR).toBeCloseTo(1.05, 6);
    expect(maxR).toBeCloseTo(6.8, 6);
  });

  it('стиснення: більший заряд → менший зовнішній радіус, більше витків', () => {
    const s = makeSpiralRibbon({ height: 1.5, segments: 300 }, mat());
    const outerAt = (c) => {
      s.userData.setShape({ innerR: 1.05, outerR: 6.8 - 1.2 * c, turns: 3.4 + 3.6 * c });
      const pos = s.geometry.attributes.position;
      let maxR = 0;
      for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
      return maxR;
    };
    expect(outerAt(0)).toBeGreaterThan(outerAt(0.5));
    expect(outerAt(0.5)).toBeGreaterThan(outerAt(1));
  });
});

describe('makeHand', () => {
  it('вістря на length, хвіст на −length·tail', () => {
    const h = makeHand({ length: 7.0, tail: 0.25, width: 0.6 }, mat());
    h.geometry.computeBoundingBox();
    expect(h.geometry.boundingBox.max.x).toBeCloseTo(7.0, 6);
    expect(h.geometry.boundingBox.min.x).toBeCloseTo(-7.0 * 0.25, 6);
  });
});
