import * as THREE from 'three';

/**
 * The balance wheel — one builder for every escapement module.
 *
 * **The balance is the same balance in every variant.** That is a decision, not a
 * coincidence: swapping the module has to show a different construction rather than a
 * different picture, so the one part every escapement has in common is deliberately
 * identical in all of them. It was written down as a rule and then built three times —
 * once in `lever.js`, once in `tourbillon.js`, once in `doubleAxis.js` — and the three
 * drifted, in ways nobody decided: one had timing screws and another did not, and the
 * rims were different thicknesses.
 *
 * The drift was invisible because the test that guarded the rule compared radii, and the
 * radii agreed. It surfaced from the side: the cost table reported the newest module as
 * having fewer parts than the one it is meant to be more complex than — a number about how
 * carefully each was drawn rather than about the mechanisms.
 *
 * So it is built once here. What stays with each module is what is genuinely its own: the
 * staff it turns on and the roller with its impulse pin, which are mounting rather than
 * balance, and differ because the modules mount it differently.
 */

/** The rim's section — the same number in the meshes and in the developed section. */
export const RIM_T = 0.18;

/** How many timing screws sit on the rim, and how far apart. */
const SCREWS = 4;

/**
 * The wheel: rim, two crossings, four timing screws with their heads, and the hub.
 *
 * Returns the group to be added wherever the module hangs it; the caller supplies the
 * staff. `radius` is the rim's centre-line radius, and every module passes the same one.
 */
export function buildBalanceWheel({ radius, brass, steel }) {
  const group = new THREE.Group();

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, RIM_T, 16, 64), brass);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 2 - 0.15, 0.16, 0.16), brass);
    spoke.rotation.z = a;
    spoke.castShadow = true;
    group.add(spoke);
  }

  // The timing screws stand out radially, offset from the crossings so they do not sit on
  // top of them.
  const screwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12);
  const headGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12);
  for (let i = 0; i < SCREWS; i++) {
    const a = (i * Math.PI * 2) / SCREWS + Math.PI / 8;
    const screw = new THREE.Mesh(screwGeo, steel);
    screw.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.08);
    screw.rotation.z = a;
    screw.rotation.x = Math.PI / 2;
    screw.castShadow = true;
    group.add(screw);
    const head = new THREE.Mesh(headGeo, steel);
    head.position.set(Math.cos(a) * (radius + 0.07), Math.sin(a) * (radius + 0.07), 0.08);
    head.rotation.z = a;
    head.rotation.x = Math.PI / 2;
    head.castShadow = true;
    group.add(head);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  return group;
}
