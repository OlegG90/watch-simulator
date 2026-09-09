import * as THREE from 'three';
import { makeHand } from './gear.js';

// ── Shared parameters of the going train ──────────────────────────
export const M = 0.35;        // tooth module (shared by the train's meshings)
export const WHEEL_T = 0.7;   // wheel thickness
export const PINION_T = 1.2;  // pinion thickness (longer: they mesh on another plane)
export const Z_STEP = 1.1;    // step between the z-planes of neighbouring arbors
export const AXLE_R = 0.3;    // arbor radius

// ── Shared helpers ────────────────────────────────────────────────
export const pitchR = (z, m = M) => (m * z) / 2;
export const mod = (a, m) => ((a % m) + m) % m;
export const deg = (d) => (d * Math.PI) / 180;
export const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/**
 * Starting phase of the driven pinion: its tooth must sit in a space of the
 * driving wheel along the line of centres (theta — the direction from driver to
 * driven). Derived from the condition that when the driver's space faces theta,
 * the driven tooth faces theta + PI.
 */
export function meshPhase(theta, ZA, ZB, phiA) {
  const stepA = (2 * Math.PI) / ZA;
  const stepB = (2 * Math.PI) / ZB;
  const tau = mod(theta - phiA, stepA); // how far the driver turns to align the space
  return theta + Math.PI - stepB / 2 + (ZA / ZB) * tau;
}

/**
 * A cylinder along the Z axis (arbor, tube, pillar). A three.js cylinder stands
 * along Y by default, hence the 90° rotation.
 */
export function makeAxle({ r, len, z = 0, x = 0, y = 0, segments = 12, castShadow = false }, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  return mesh;
}

/**
 * Tag a subtree as belonging to a module (`userData.mod`).
 *
 * Scene groups are mixed by purpose: the barrel arbor carries the barrel wheel
 * (train), the spring (energy) and the hub wheel of the differential (power
 * reserve) all at once. Membership is therefore decided not by the parent group
 * but by WHO built the part — every module tags its own right after assembly.
 *
 * The first tag wins: a module that adds parts to somebody else's group later does
 * not overwrite what is already tagged.
 */
export function tagModule(root, id) {
  root.traverse((o) => {
    if (o.userData.mod === undefined) o.userData.mod = id;
  });
}

/**
 * Tag WHICH variant is installed in the socket.
 *
 * The module (`mod`) is the socket: the highlight, the camera and the section talk
 * to it and do not want to know what is inside. The variant matters only to code
 * that works with the swap itself: show/hide, count the parts.
 */
export function tagVariant(root, id) {
  root.traverse((o) => {
    if (o.userData.variant === undefined) o.userData.variant = id;
  });
}

/**
 * Hand + hub in a shared subgroup: the subgroup lets a hand take its own angle on
 * top of its arbor's rotation (real-time mode).
 */
export function makeHandAssembly(
  { length, width, tail = 0.25, hubR, hubH = 0.24, z, segments = 16 },
  material
) {
  const g = new THREE.Group();
  const hand = makeHand({ length, width, tail }, material);
  hand.position.z = z;
  g.add(hand);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, hubH, segments), material);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = z;
  g.add(hub);
  return g;
}
