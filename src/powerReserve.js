import * as THREE from 'three';
import { makeGear, makeBevelGear } from './gear.js';
import { deg, dir2, meshPhase, makeAxle, makeHandAssembly, tagModule, pitchR } from './common.js';

// ── Coaxial bevel differential above the barrel ───────────────────
// Both inputs are already on the barrel arbor: the ratchet (w) drives the upper sun
// through a straight tube (RA = 1), the barrel wheel (β) drives the lower one via
// the hub wheel (32) → compound idler (8/20) → the wheel on the lower sun's tube
// (20), RB = 4. The centre distance is the same for both pairs: (32+8)·m/2 = (20+20)·m/2 = 6.0.
const PRT_M = 0.3;
const PRT_HUB = 32;
const PRT_P = 8;
const PRT_W = 20;
const PRT_G = 20;
export const RA = 1;                                   // ratchet → upper sun
export const RB = (PRT_HUB / PRT_P) * (PRT_W / PRT_G); // barrel → lower sun = 4
const PRT_ANGLE = deg(160);                            // direction of the compound idler from the barrel

/**
 * The node's centre distances. Both pairs have the SAME one — which is exactly why
 * there is one idler rather than two. Derived here once: until then this same
 * expression also sat in `readouts.js`, and in `section.js` as well.
 */
const CENTRE_HUB = ((PRT_HUB + PRT_P) / 2) * PRT_M;   // hub ↔ idler
const CENTRE_SUN = ((PRT_W + PRT_G) / 2) * PRT_M;     // idler ↔ sun's wheel

export const PR_EMPTY = deg(150);            // «empty»
export const PR_FULL = deg(30);              // fully wound
export const SWEEP = PR_EMPTY - PR_FULL;     // 120°
const C0 = 0.75;                             // initial charge

const DIFF_M = 0.28;              // module of the differential's bevel gears
const SUN_T = 16;          // δ_sun = atan(16/10) ≈ 58°
const PLANET_T = 10;              // δ_planet ≈ 32°
/** Radii of the dial and the hand — the developed section takes them from here instead of typing them. */
const DIAL_R = 3.05, PR_HAND_L = 2.5;
const DELTA_SUN = Math.atan(SUN_T / PLANET_T);
const DELTA_PL = Math.atan(PLANET_T / SUN_T);
const Z_DIFF = 5.8;               // the shared apex of suns and planets
/** The module's Z levels — shared with the developed section. */
const LAYERS = { hubWheel: 1.85, idlerWheel: 3.3, suns: Z_DIFF, arm: Z_DIFF + 2.15, dial: Z_DIFF + 2.75, hand: Z_DIFF + 3.05 };

/** Body thicknesses. The same ones for the meshes and for the section — otherwise they drift apart. */
const T = { wheel: 0.5, sun: 0.4, planet: 0.38, dial: 0.1, hand: 0.14 };

/** The charge is DERIVED from the differential's two inputs, not a state variable of its own. */
export const chargeOf = (w, beta) => C0 + (RA * w - RB * beta) / (2 * SWEEP);

/** How much further the ratchet can be turned before the full-wind stop (c = 1). */
export const windRoomAt = (w, beta) => Math.max(0, ((1 - chargeOf(w, beta)) * 2 * SWEEP) / RA);

/** Auto-wind: the ratchet advance at which the carrier (the hand) stands still: dθ_C = 0. */
export const autoWindDelta = (dBeta) => (RB / RA) * dBeta;

/** Layout of the node (positions + contribution to the scene bounds). */
export function layoutPowerReserve(barrelPos) {
  const idlerPos = barrelPos.clone().add(dir2(PRT_ANGLE).multiplyScalar(CENTRE_HUB));
  return {
    idlerPos,
    extents: [{ pos: idlerPos, r: ((PRT_W * PRT_M) / 2) + PRT_M * 1.3 }],
  };
}

/**
 * What the node can say about itself BEFORE a single mesh exists.
 *
 * The third phase beside `layout…()` and `build…()`: the layout answers «where it
 * stands», the build «what it is made of», and this «what its numbers are». Until
 * now `readouts.js` and `section.js` answered those questions, each with its own
 * list of constants and its own copy of the formulas.
 *
 * Parts say WHAT they hang from (`anchor`) and how far along they are shifted
 * (`u`) — where this node actually stands is known to the section's composer, not
 * to the module.
 */
export function profile() {
  const L = LAYERS;
  return {
    ratio: RB,
    centres: { hub: CENTRE_HUB, sun: CENTRE_SUN, equal: Math.abs(CENTRE_HUB - CENTRE_SUN) < 1e-9 },
    sweep: SWEEP,
    parts: [
      { anchor: 'barrel', u: 0, z0: L.hubWheel, z1: L.hubWheel + T.wheel, r: pitchR(PRT_HUB, PRT_M), kind: 'wheel' },
      { anchor: 'barrel', u: CENTRE_HUB, z0: L.hubWheel, z1: L.hubWheel + T.wheel, r: pitchR(PRT_P, PRT_M), kind: 'pinion' },
      { anchor: 'barrel', u: CENTRE_HUB, z0: L.idlerWheel, z1: L.idlerWheel + T.wheel, r: pitchR(PRT_W, PRT_M), kind: 'wheel' },
      { anchor: 'barrel', u: 0, z0: L.idlerWheel, z1: L.idlerWheel + T.wheel, r: pitchR(PRT_G, PRT_M), kind: 'wheel' },
      { anchor: 'barrel', u: 0, z0: L.suns - T.sun / 2, z1: L.suns + T.sun / 2, r: pitchR(SUN_T, DIFF_M), kind: 'sun' },
      { anchor: 'barrel', u: 0, z0: L.dial, z1: L.dial + T.dial, r: DIAL_R, kind: 'flat' },
      { anchor: 'barrel', u: 0, z0: L.hand, z1: L.hand + T.hand, r: PR_HAND_L, kind: 'hand', labelKey: 'part.powerReserve' },
    ],
    zTicks: [L.suns],
  };
}

/**
 * The power-reserve indicator's meshes. The classic differential relation:
 * S_up + S_low = 2·carrier, so the carrier-hand shows the difference between
 * winding and consumption.
 *
 * The hub wheel (the going input) is attached to the barrel arbor; everything else
 * lives on its own group, coaxial with the barrel.
 */
export function buildPowerReserve({ brass, steel, axleMat, ruby, plateMat, bluedMat }, L,
  { barrelPos, barrelGroup, barrelPhi }) {
  const { idlerPos } = L;
  const group = new THREE.Group();
  group.position.set(barrelPos.x, barrelPos.y, 0);

  // ── Hub wheel (the going input, β) — on the barrel wheel's tube ──
  const hubParts = [];
  {
    const hubWheel = makeGear({ teeth: PRT_HUB, module: PRT_M, thickness: T.wheel, bore: 0.62, crossings: 4 }, brass);
    hubWheel.position.z = 1.85;
    barrelGroup.add(hubWheel);
    const hubPipe = makeAxle({ r: 0.42, len: 1.3, z: 1.05 }, brass);
    barrelGroup.add(hubPipe);
    hubParts.push(hubWheel, hubPipe);
  }

  // ── Compound idler: pinion (8, in the hub wheel's plane) + wheel (20) ──
  const idlerG = new THREE.Group();
  idlerG.position.set(idlerPos.x - barrelPos.x, idlerPos.y - barrelPos.y, 0);
  {
    const p = makeGear({ teeth: PRT_P, module: PRT_M, thickness: T.wheel, bore: 0.14 }, steel);
    p.position.z = 1.85;
    idlerG.add(p);
    const w = makeGear({ teeth: PRT_W, module: PRT_M, thickness: T.wheel, bore: 0.14, crossings: 3 }, steel);
    w.position.z = 3.3;
    idlerG.add(w);
    idlerG.add(makeAxle({ r: 0.13, len: 3.1, z: 2.45, segments: 10 }, axleMat));
  }
  group.add(idlerG);

  // ── Lower sun + the wheel on its tube (the going input ×4) ──
  const sunLow = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: T.sun, bore: 0.72, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF;
    sun.rotation.x = Math.PI; // inverted: rim below, teeth facing the planets
    sunLow.add(sun);
    const g = makeGear({ teeth: PRT_G, module: PRT_M, thickness: T.wheel, bore: 0.72, crossings: 3 }, steel);
    g.position.z = 3.3;
    sunLow.add(g);
    sunLow.add(makeAxle({ r: 0.68, len: 1.6, z: 4.2, segments: 14 }, steel));
  }
  group.add(sunLow);

  // ── Upper sun — on the tube from the ratchet (the winding input, RA = 1) ──
  const sunUp = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: T.sun, bore: 0.5, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF; // apex at the centre, rim on top
    sunUp.add(sun);
    sunUp.add(makeAxle({ r: 0.45, len: 3.3, z: 4.55 }, steel)); // from the ratchet up to the sun
  }
  group.add(sunUp);

  // ── The carrier «cage»: a ring around the suns, planets on inner pivots,
  //    a bridge over the upper sun, and the hand ──
  const carrier = new THREE.Group();
  const planets = [];
  {
    const cage = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.12, 10, 48), axleMat);
    cage.position.z = Z_DIFF;
    carrier.add(cage);
    for (const s of [+1, -1]) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.75, 10), axleMat);
      stub.rotation.z = Math.PI / 2;
      stub.position.set(s * 1.97, 0, Z_DIFF);
      carrier.add(stub);
      const pg = new THREE.Group();
      pg.position.z = Z_DIFF;
      pg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s, 0, 0));
      const planet = makeBevelGear(
        { teeth: PLANET_T, module: DIFF_M, thickness: T.planet, bore: 0.4, pitchAngleDeg: (DELTA_PL * 180) / Math.PI },
        brass
      );
      planet.userData.dir = s;
      pg.add(planet);
      planets.push(planet);
      carrier.add(pg);
      carrier.add(makeAxle({ r: 0.12, len: 2.15, x: s * 3.35, z: Z_DIFF + 1.08, segments: 10 }, axleMat));
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.24, 0.12), axleMat);
    arm.position.z = Z_DIFF + 2.15; // the bridge over the upper sun
    carrier.add(arm);
    carrier.add(makeAxle({ r: 0.25, len: 0.9, z: Z_DIFF + 2.6 }, axleMat));
    carrier.add(makeHandAssembly(
      { length: PR_HAND_L, width: 0.32, tail: 0.3, hubR: 0.28, hubH: 0.22, z: Z_DIFF + 3.05, segments: 14 },
      bluedMat
    ));
  }
  group.add(carrier);

  // ── The dial sector above the barrel (not a full ring — the differential shows through) ──
  {
    const pad = deg(8); // the sector's margins beyond the hand's travel
    const fan = new THREE.Mesh(
      new THREE.RingGeometry(0.7, DIAL_R, 48, 1, PR_FULL - pad, SWEEP + 2 * pad), plateMat
    );
    fan.position.z = Z_DIFF + 2.75;
    group.add(fan);
    const hubRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 32), plateMat);
    hubRing.position.z = Z_DIFF + 2.75;
    group.add(hubRing);
    const arc = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.85, 48, 1, PR_FULL, SWEEP), brass);
    arc.position.z = Z_DIFF + 2.77;
    group.add(arc);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const a = PR_EMPTY - SWEEP * f;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), f === 0 ? ruby : steel);
      tick.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, Z_DIFF + 2.81);
      tick.rotation.z = a;
      group.add(tick);
    }
  }

  // ── Phasing of the going-input pairs ──
  const thHI = Math.atan2(idlerPos.y - barrelPos.y, idlerPos.x - barrelPos.x);
  const phiP8 = meshPhase(thHI, PRT_HUB, PRT_P, barrelPhi);        // hub (β) → the compound's pinion
  const phiG20 = meshPhase(thHI + Math.PI, PRT_W, PRT_G, phiP8);   // the compound's wheel → the sun's tube
  // The carrier's constant is chosen so the initial charge equals C0 (the hand at 60°).
  const KC = (PR_EMPTY - C0 * SWEEP) - phiG20 / 2;

  /**
   * The differential's pose from its two inputs; returns the charge clamped to [0,1].
   * @param w    the ratchet's angle (winding)
   * @param beta the barrel wheel's angle (going)
   */
  function update(w, beta) {
    // The «−»: the winding axis counter-rotates relative to the barrel wheel's travel.
    sunUp.rotation.z = -w;
    idlerG.rotation.z = phiP8 - (PRT_HUB / PRT_P) * beta;
    sunLow.rotation.z = phiG20 + RB * beta;
    carrier.rotation.z = (sunUp.rotation.z + sunLow.rotation.z) / 2 + KC; // the differential condition
    const spin = ((sunUp.rotation.z - sunLow.rotation.z) / 2) * (SUN_T / PLANET_T);
    for (const p of planets) p.rotation.z = spin * p.userData.dir;
    return Math.min(1, Math.max(0, chargeOf(w, beta)));
  }

  for (const o of [group, ...hubParts]) tagModule(o, 'powerReserve');

  return {
    group, carrier, hand: carrier, sunUp, sunLow, idler: idlerG,
    emptyAngle: PR_EMPTY, fullAngle: PR_FULL, update,
  };
}
