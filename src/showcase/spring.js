import * as THREE from 'three';

/**
 * The showcase's balance spring — a flat ribbon that breathes.
 *
 * The showcase's subject is the meshing, so the spring here illustrates «the spring
 * breathes» rather than modelling the regulator: there is no Breguet overcoil, and the
 * radial breathing comes from a differential twist (the inner end travels with the
 * balance, the outer stands in the stud) rather than from physics. That is a recorded
 * simplification, not an omission.
 *
 * The shape is a ribbon in a plane (not a tube): the deformation is planar, so the
 * normals are constant (0,0,1) and the vertex buffer is rewritten in place — zero
 * allocations per frame, as the practice for motion requires.
 */

/** Turns, points, radii (the inner one at the arbor's collet, the outer at the stud). */
export const TURNS = 5;
export const SPRING_N = 200;
export const SPRING_R0 = 0.18;
export const SPRING_R1 = 0.95;
const WIDTH = 0.045;

export function buildSpring({ cx, cy, z, material }) {
  const pos = new Float32Array(SPRING_N * 2 * 3);
  const nor = new Float32Array(SPRING_N * 2 * 3);
  for (let i = 0; i < SPRING_N; i++) {
    nor.set([0, 0, 1], (i * 2) * 3);
    nor.set([0, 0, 1], (i * 2 + 1) * 3);
  }
  const idx = [];
  for (let i = 0; i < SPRING_N - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(cx, cy, z);
  mesh.frustumCulled = false; // the vertices move — there is no cached bounding sphere
  mesh.castShadow = true;

  const center = new Float32Array(SPRING_N * 2);
  /**
   * Breathing: point i is turned by the balance's angle with weight (1 − i/(N−1)) —
   * the inner end (i=0) is rigid with the balance, the outer one stands still.
   * Writes into the same buffer, never touches the geometry.
   */
  function update(bal) {
    for (let i = 0; i < SPRING_N; i++) {
      const f = i / (SPRING_N - 1);
      const r = SPRING_R0 + (SPRING_R1 - SPRING_R0) * f;
      const a = f * TURNS * Math.PI * 2 + bal * (1 - f);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      center[i * 2] = x;
      center[i * 2 + 1] = y;
    }
    for (let i = 0; i < SPRING_N; i++) {
      const p = i === 0 ? 0 : i - 1, q = i === SPRING_N - 1 ? i : i + 1;
      let tx = center[q * 2] - center[p * 2], ty = center[q * 2 + 1] - center[p * 2 + 1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const nx = -ty * WIDTH / 2, ny = tx * WIDTH / 2;
      pos.set([center[i * 2] + nx, center[i * 2 + 1] + ny, 0], (i * 2) * 3);
      pos.set([center[i * 2] - nx, center[i * 2 + 1] - ny, 0], (i * 2 + 1) * 3);
    }
    geo.attributes.position.needsUpdate = true;
  }

  update(0);
  return { mesh, update };
}
