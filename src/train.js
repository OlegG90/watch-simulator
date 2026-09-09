import * as THREE from 'three';
import { makeGear } from './gear.js';
import { M, WHEEL_T, PINION_T, Z_STEP, AXLE_R, pitchR, deg, meshPhase, makeAxle, tagModule } from './common.js';

/**
 * The going train: every arbor carries a pinion (driven by the previous wheel)
 * and its own wheel (driving the next pinion). The barrel arbor has only a wheel
 * (the barrel itself with the spring lives in `barrel.js`); the last arbor carries
 * a pinion and serves as the rotating tourbillon cage (the escape wheel lives
 * inside the cage, see `escapement/tourbillon.js`).
 */
export const TRAIN = [
  { nameKey: 'part.barrel',      wheel: 48, axleTop: 2.3, crossings: 5 },    // taller: the power-reserve differential tubes sit above
  { nameKey: 'part.centre',      pinion: 12, wheel: 40, crossings: 4, axleTop: 7.4 }, // arbor up to the cannon pinion
  { nameKey: 'part.third',       pinion: 12, wheel: 36, crossings: 4 },
  { nameKey: 'part.fourth',      pinion: 12, wheel: 32, crossings: 3, axleTop: 5.15 }, // arbor for the seconds hand
  { nameKey: 'part.escapeArbor', pinion: 12, escapeTeeth: 15 },              // = the tourbillon cage
];

// Direction (in the XY plane) from arbor k to arbor k+1 — the train is coiled into
// a tight loop (compact layout): every step turns more sharply, so the tail almost
// closes on the barrel. The wheels lie on different Z planes, so overlapping in XY
// is safe. The last angle (fourth → escape arbor) is 170°: there is room there for
// the rotating tourbillon cage (checked with a numeric layout prototype).
export const MESH_ANGLES = [0, 78, 150, 170].map(deg);

/** Arbor radius for the scene bounds; the escape arbor is measured by the tourbillon cage. */
export const arborOuterR = (spec, cageR) => (spec.escapeTeeth ? cageR : pitchR(spec.wheel) + M * 1.3);

/**
 * Layout of the train arbors plus the kinematics of each one (speed and phase).
 * No meshes are created here — only the layout geometry the scene bounds need.
 */
export function layoutTrain() {
  const arbors = [];
  let pos = new THREE.Vector2(0, 0);
  TRAIN.forEach((spec, k) => {
    let omega = 1; // speed relative to the barrel (barrel = 1)
    let phi = 0;
    if (k > 0) {
      const prev = arbors[k - 1];
      const ZA = TRAIN[k - 1].wheel;
      const ZB = spec.pinion;
      const theta = MESH_ANGLES[k - 1];
      const d = pitchR(ZA) + pitchR(ZB); // centre distance across the pitch circles
      pos = prev.pos
        .clone()
        .add(new THREE.Vector2(Math.cos(theta), Math.sin(theta)).multiplyScalar(d));
      omega = -prev.omega * (ZA / ZB); // an external meshing reverses the direction
      phi = meshPhase(theta, ZA, ZB, prev.phi);
    }
    arbors.push({
      nameKey: spec.nameKey,
      spec,
      pos,
      omega,
      phi,
      pinionZ: (k - 1) * Z_STEP, // pinion in the wheel plane of the previous arbor
      wheelZ: k * Z_STEP,
    });
  });
  return arbors;
}

/** Train meshes: pinion + wheel + arbor on every node. Fills `a.group`. */
export function buildTrain({ brass, steel, axleMat }, arbors, root) {
  arbors.forEach((a, k) => {
    const g = new THREE.Group();
    g.position.set(a.pos.x, a.pos.y, 0);

    if (a.spec.pinion) {
      const p = makeGear(
        { teeth: a.spec.pinion, module: M, thickness: PINION_T, bore: AXLE_R * 0.9 },
        steel
      );
      p.position.z = a.pinionZ;
      g.add(p);
    }
    if (a.spec.wheel) {
      const w = makeGear(
        { teeth: a.spec.wheel, module: M, thickness: WHEEL_T, bore: AXLE_R * 0.9, crossings: a.spec.crossings || 0 },
        brass
      );
      w.position.z = a.wheelZ;
      g.add(w);
    }

    // Arbor: from the lowest to the highest part of the node.
    const zFrom = k === 0 ? -2.6 : a.pinionZ - 1.0;
    const zTo = a.spec.axleTop ?? a.wheelZ + 1.0;
    g.add(makeAxle(
      { r: AXLE_R, len: zTo - zFrom, z: (zFrom + zTo) / 2, segments: 20, castShadow: true },
      axleMat
    ));

    tagModule(g, 'train');
    // arbor index: lets one train node be highlighted instead of the whole chain
    g.traverse((o) => { if (o.userData.arbor === undefined) o.userData.arbor = k; });
    root.add(g);
    a.group = g;
  });
}
