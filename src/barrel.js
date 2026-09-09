import * as THREE from 'three';
import { makeSpiralRibbon } from './gear.js';
import { pitchR, makeAxle, tagModule } from './common.js';

// The spring's shape as a function of charge c ∈ [0,1]. Lifted out of `setCharge`
// because the «Energy» station card shows the same numbers — it must read them
// rather than duplicate them.
export const SPRING_INNER_R = 1.05;
export const SPRING_SQUEEZE = 1.2;   // how far the outer coil leaves the wall at c = 1
export const SPRING_TURNS_0 = 3.4;   // turns when relaxed
export const SPRING_TURNS_C = 3.6;   // turns gained up to full wind
/** The module's Z levels — shared with the developed section. */
export const LAYERS = { drumCentre: -1.5, drumHeight: 2.0 };
export const springShape = (c, relaxedOuterR) => ({
  innerR: SPRING_INNER_R,
  outerR: relaxedOuterR - SPRING_SQUEEZE * c,
  turns: SPRING_TURNS_0 + SPRING_TURNS_C * c,
});

/**
 * The energy module: an open barrel with a visible mainspring.
 *
 * The barrel is deliberately capless — the coiled mainspring is visible. The
 * spring's shape (outer radius and number of turns) is a function of the charge
 * `c ∈ [0,1]` computed by the power-reserve differential; the spring itself holds
 * no state.
 *
 * The group is attached to the barrel arbor (arbor0), so it turns with it.
 */
export function buildBarrel({ brass, steel, springSteel }, { wheelTeeth }) {
  const group = new THREE.Group();
  const R = pitchR(wheelTeeth) - 1.2; // 7.2 — the barrel's inner radius
  const zC = -1.5, drumH = 2.0;

  // The barrel wall — an open cylinder (no cap), the opening faces +Z.
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, drumH, 48, 1, true), brass);
  wall.rotation.x = Math.PI / 2;
  wall.position.z = zC;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // The barrel floor (the far face, −Z).
  const floor = makeAxle({ r: R, len: 0.2, z: zC - drumH / 2 + 0.1, segments: 48 }, brass);
  floor.receiveShadow = true;
  group.add(floor);

  // The bushing of the barrel arbor, around which the spring is coiled.
  group.add(makeAxle({ r: 0.85, len: drumH * 0.9, z: zC, segments: 24, castShadow: true }, steel));

  // The mainspring — a spiral ribbon from the bushing to the wall (setShape sets its state).
  const relaxedOuterR = R - 0.4;
  const spring = makeSpiralRibbon({ height: drumH - 0.5, segments: 600 }, springSteel);
  spring.position.z = zC;
  group.add(spring);

  /** The spring's shape from the charge: tighter = more turns and a smaller outer radius. */
  function setCharge(c) {
    spring.userData.setShape(springShape(c, relaxedOuterR));
  }
  setCharge(0); // relaxed — until the first syncDiff

  tagModule(group, 'barrel');
  return { group, spring, setCharge, relaxedOuterR };
}
