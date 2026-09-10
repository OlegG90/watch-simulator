import * as THREE from 'three';
import { buildBalanceWheel as buildWheel, rimHalfHeight } from '../parts/balanceWheel.js';

/**
 * The movement's balance — one builder for every escapement module.
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
 * The wheel itself now comes from `parts/balanceWheel.js`, which the exhibit draws from
 * too: the movement had a bent wire with four screws where the exhibit had a machined rim
 * with eighteen timing pins, and one part with two drawings is the same failure one step
 * further out. What is left here is the movement's own mounting — the hub the staff
 * passes through, which the exhibit does differently because it mounts the wheel
 * differently.
 */

/** Half the rim's height, for the developed section — derived, never typed. */
export { rimHalfHeight };

/**
 * The wheel plus the hub it sits on. Returns the group to be added wherever the module
 * hangs it; the caller supplies the staff. `radius` is the rim's centre-line radius, and
 * every module passes the same one.
 */
export function buildBalanceWheel({ radius, brass, steel }) {
  const group = new THREE.Group();
  group.add(buildWheel({ radius, brass }));

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  return group;
}
