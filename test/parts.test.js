import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBalanceWheel, REF_R, rimHalfHeight } from '../src/parts/balanceWheel.js';

/**
 * `parts/` is the drawing both models share. Two other guards compare things with each
 * other — the three modules among themselves, and the movement against the exhibit — and
 * neither of them can see a change made HERE, because both sides move together and stay
 * equal. That blind spot is why the drawing is also written out, in numbers, below.
 */
const mat = () => new THREE.MeshStandardMaterial();
const wheelAt = (radius) => buildBalanceWheel({ radius, brass: mat() });

const census = (w) => {
  const by = {};
  w.traverse((o) => { if (o.isMesh) by[o.geometry.type] = (by[o.geometry.type] || 0) + 1; });
  return by;
};

describe('the shared balance wheel', () => {
  it('is a rim, eighteen timing pins and two crossings — stated, not compared', () => {
    // Eighteen is not decoration: the pins stand in groups of 2, 3 and 4 on each half of
    // the rim, so a watchmaker can say which pin is which. Lose one and the groups stop
    // reading, and no comparison between the two models would notice — they share this file.
    expect(census(wheelAt(REF_R)))
      .toEqual({ ExtrudeGeometry: 1, CylinderGeometry: 18, BoxGeometry: 2 });
  });

  it('the rim is a machined band, and round enough to read as one', () => {
    const w = wheelAt(REF_R);
    const rim = w.children.find((o) => o.geometry.type === 'ExtrudeGeometry').geometry;
    rim.computeBoundingBox();
    const b = rim.boundingBox.getSize(new THREE.Vector3());
    // A rectangular section: 0.06 of radial width either side of 1.75, 0.11 of height
    // either side of the plane. The height is what the developed section quotes.
    expect(b.x).toBeCloseTo(2 * (REF_R + 0.06), 4);
    expect(b.z).toBeCloseTo(2 * 0.11, 4);
    expect(rimHalfHeight(REF_R)).toBeCloseTo(0.11, 12);
    // The rim is the one curve seen from across the room; at half the segments the
    // silhouette goes visibly faceted, and nothing else in the model would say so.
    expect(rim.attributes.position.count).toBe(5376);
  });

  it('a bigger wheel is the same drawing, not a redrawn one', () => {
    // The movement's rim is 1.95 against the exhibit's 1.75. Under a uniform scale every
    // LENGTH grows with the radius and every ANGLE stays exactly where it was — which is
    // what makes it one drawing at two sizes. Getting that backwards (scaling the pins'
    // angular spacing too) moves the pins to different places on the rim.
    const small = wheelAt(REF_R), big = wheelAt(1.95);
    const k = 1.95 / REF_R;
    expect(big.userData.balanceScale).toBeCloseTo(k, 12);
    expect(census(big)).toEqual(census(small));

    const angles = (w) => w.children
      .filter((o) => o.geometry.type === 'CylinderGeometry')
      .map((o) => o.rotation.z.toFixed(9)).sort();
    expect(angles(big), 'the pins moved round the rim').toEqual(angles(small));

    const radii = (w) => w.children
      .filter((o) => o.geometry.type === 'CylinderGeometry')
      .map((o) => o.position.length()).sort((a, b) => a - b);
    const rs = radii(small), rb = radii(big);
    for (let i = 0; i < rs.length; i++) expect(rb[i] / rs[i]).toBeCloseTo(k, 9);
    expect(rimHalfHeight(1.95) / rimHalfHeight(REF_R)).toBeCloseTo(k, 12);
  });
});
