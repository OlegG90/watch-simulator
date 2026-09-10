import * as THREE from 'three';

/**
 * The balance wheel — one drawing, used by the exhibit and by the movement.
 *
 * `parts/` is deliberately neutral ground. The exhibit imports nothing from the movement
 * and the movement imports nothing from the exhibit: that isolation is a decision made
 * with the owner, and either direction of import would break it. A third module that
 * neither of them owns does not.
 *
 * The part had two drawings — a machined rim with eighteen timing pins in the exhibit, a
 * bent wire with four screws in the movement. The exhibit's is the better one, so it is
 * the one that stayed; what was wrong was having two, which is the same failure the fork
 * and the balance already had inside the movement.
 *
 * **The sections follow the radius**, as the fork's follow its escape wheel: they are
 * quoted at the exhibit's rim (1.75) and scaled by whatever radius the caller asks for.
 * The movement's 1.95 is eleven per cent larger, so the effect is small — but it makes
 * the two pictures one drawing at two sizes rather than two drawings that agree.
 *
 * What is NOT here is mounting: the staff, the hub, the roller table, the safety roller,
 * the impulse pin. Those differ because the exhibit and each module carry the wheel
 * differently, and that difference is real.
 */

/** The radius the sections below are quoted at — the exhibit's rim. */
export const REF_R = 1.75;

/** The rim's rectangular section at the reference radius: half radial width, half height. */
const RIM_HALF = 0.06;
const RIM_H_HALF = 0.11;

/** The timing pins: two semicircles, each carrying groups of 2, 3 and 4. */
const PIN = { r: 0.1, h: 0.24, stand: 0.17, pitch: 0.16, gap: 0.5, groups: [2, 3, 4] };

/** The crossings: two bars across the rim. */
const SPOKE = { w: 0.15, t: 0.15, shorten: 0.05 };

/**
 * Half the rim's height at a given wheel radius.
 *
 * The developed section says how thick the rim reads, and it used to say it by a number
 * typed out in `lever.js` and again in `tourbillon.js` — a number that described a torus
 * that no longer exists. It is derived here so the section cannot drift from the meshes.
 */
export const rimHalfHeight = (radius) => RIM_H_HALF * (radius / REF_R);

/**
 * The wheel: the rim, two crossings and eighteen timing pins, all in the group's own
 * plane (z = 0). The caller places it.
 */
export function buildBalanceWheel({ radius, brass }) {
  const k = radius / REF_R;
  const group = new THREE.Group();
  // Declared so a guard can normalise by it and compare the sections that are left.
  group.userData.balanceScale = k;

  // A rectangular band, not a round wire: an extruded annulus, so the section reads as a
  // machined rim.
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius + RIM_HALF * k, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius - RIM_HALF * k, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const rimGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 2 * RIM_H_HALF * k, bevelEnabled: false, curveSegments: 112,
  });
  rimGeo.translate(0, 0, -RIM_H_HALF * k);
  rimGeo.computeVertexNormals();
  const rim = new THREE.Mesh(rimGeo, brass);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  // Each half of the rim carries groups of 2, 3 and 4 pins with a gap between groups, and
  // each half is centred in its own semicircle, so the joint between the halves stays clear.
  const pinGeo = new THREE.CylinderGeometry(PIN.r * k, PIN.r * k, PIN.h * k, 12);
  const total = PIN.groups.reduce((s, n) => s + n, 0);
  // `pitch` and `gap` are ANGLES along the rim, and an angle does not scale with the
  // radius — a uniform scale keeps every angle and lets the arc lengths follow the radius
  // by themselves. Scaling them too puts the pins somewhere else on the rim, which is a
  // different drawing at a different size rather than the same one.
  const span = (total - 1) * PIN.pitch + (PIN.groups.length - 1) * PIN.gap;
  for (const start of [0, Math.PI]) {
    let a = start + (Math.PI - span) / 2;
    for (const n of PIN.groups) {
      for (let i = 0; i < n; i++) {
        const pin = new THREE.Mesh(pinGeo, brass);
        const r = radius + PIN.stand * k;
        pin.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        pin.rotation.z = a - Math.PI / 2; // the axis along the radius
        pin.castShadow = true;
        group.add(pin);
        a += PIN.pitch;
      }
      a += PIN.gap;
    }
  }

  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2 * radius - SPOKE.shorten * k, SPOKE.w * k, SPOKE.t * k), brass,
    );
    spoke.rotation.z = a;
    spoke.castShadow = true;
    group.add(spoke);
  }

  return group;
}
