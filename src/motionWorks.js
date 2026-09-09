import * as THREE from 'three';
import { makeGear } from './gear.js';
import { AXLE_R, deg, dir2, meshPhase, makeAxle, makeHandAssembly, tagModule, pitchR } from './common.js';

// ── Motion works: cannon (12) → minute (36); pinion (10) → hour (40) = ×12 ──
const CANNON_T = 12;
const MINUTE_T = 36;
const MW_PINION_T = 10;
const HOUR_T = 40;
const MW_M1 = 0.28;                  // module of the cannon → minute pair
const MW_M2 = (MW_M1 * 48) / 50;     // module of the pinion → hour pair (same centre distance)
export const MW_ANGLE = deg(120);           // the minute wheel — above the loop of the train

/**
 * The centre distances of both motion-works pairs. They are EQUAL — which is why
 * both pairs stand on the same two arbors, and why `MW_M2` is derived from `MW_M1`
 * instead of being given separately. Derived here once: until then the same
 * expression also sat in `readouts.js` and `section.js`.
 */
const CENTRE_MW1 = ((CANNON_T + MINUTE_T) / 2) * MW_M1;   // cannon ↔ minute
const CENTRE_MW2 = ((MW_PINION_T + HOUR_T) / 2) * MW_M2;  // pinion ↔ hour
const Z_MW = 7.2, Z_HR = 7.9;
/** The module's Z levels — the developed section reads them too, so the numbers live in one place. */
const LAYERS = { minuteWheel: Z_MW, hourWheel: Z_HR, hands: { hour: 9.9, minute: 10.25, second: 10.7 } };

// ── Centre seconds: the upper bridge from the fourth wheel to the centre ──
const CS_DRIVE = 48;
const CS_IDLER = 20;
const CS_PINION = 8;
/** Hand lengths — the developed section takes them from here instead of typing them. */
const HAND_L = { hour: 5.6, minute: 7.0, second: 7.4 };
const Z_CS = 9.45;
LAYERS.centralSeconds = Z_CS;

/** Body thicknesses. The same ones for the meshes and for the section — otherwise they drift apart. */
const T = { cannon: 0.8, minute: 0.55, mwPinion: 0.7, hour: 0.5, csWheel: 0.45, csPinion: 0.55, hand: 0.14 };

/** Layout of the motion works and the centre seconds (positions + contribution to the bounds). */
export function layoutMotionWorks(arbors) {
  const P1 = arbors[1].pos;
  const mwPos = P1.clone().add(dir2(MW_ANGLE).multiplyScalar(CENTRE_MW1));

  const csFrom = arbors[3].pos;
  const csVec = P1.clone().sub(csFrom);
  // The module is fitted to the actual arbor distance: (48+8)/2 + 20 for the idler.
  const CS_M = csVec.length() / (((CS_DRIVE + CS_PINION) / 2) + CS_IDLER);
  const csIdlerPos = csFrom.clone()
    .add(csVec.clone().normalize().multiplyScalar(((CS_DRIVE + CS_IDLER) / 2) * CS_M));

  return {
    P1, mwPos, CS_M, csIdlerPos,
    csTheta1: Math.atan2(csIdlerPos.y - csFrom.y, csIdlerPos.x - csFrom.x),
    csTheta2: Math.atan2(P1.y - csIdlerPos.y, P1.x - csIdlerPos.x),
    csRatio: CS_DRIVE / CS_PINION, // 6×: fourth arbor → centre-seconds arbor
    extents: [
      { pos: P1, r: 7.9 },        // sweep of the longest centre hand (the seconds one)
      { pos: mwPos, r: 5.6 },     // the minute wheel
      { pos: csFrom, r: (CS_DRIVE * CS_M) / 2 + CS_M * 1.3 }, // the centre-seconds driving wheel
      { pos: csIdlerPos, r: (CS_IDLER * CS_M) / 2 + CS_M * 1.3 },
    ],
  };
}

/**
 * What the module says about itself — before any mesh exists. The third phase
 * beside `layout…()` and `build…()`; see `powerReserve.profile()` for more.
 *
 * It takes the layout, because the centre-seconds module is fitted to the actual
 * arbor distance and is unknown without it.
 */
export function profile(arbors) {
  const { CS_M } = layoutMotionWorks(arbors);
  const L = LAYERS;
  return {
    hourRatio: (CANNON_T / MINUTE_T) * (MW_PINION_T / HOUR_T),   // = 1/12
    centres: { mw1: CENTRE_MW1, mw2: CENTRE_MW2, equal: Math.abs(CENTRE_MW1 - CENTRE_MW2) < 1e-9 },
    modules: [MW_M1, MW_M2],
    cs: { step: CS_DRIVE / CS_PINION, idler: CS_IDLER, module: CS_M },
    parts: [
      { anchor: 'centre', u: 0, z0: L.minuteWheel, z1: L.minuteWheel + T.cannon, r: pitchR(CANNON_T, MW_M1), kind: 'pinion' },
      { anchor: 'centre', u: CENTRE_MW1, z0: L.minuteWheel, z1: L.minuteWheel + T.minute, r: pitchR(MINUTE_T, MW_M1), kind: 'wheel' },
      { anchor: 'centre', u: CENTRE_MW1, z0: L.hourWheel, z1: L.hourWheel + T.mwPinion, r: pitchR(MW_PINION_T, MW_M2), kind: 'pinion' },
      { anchor: 'centre', u: 0, z0: L.hourWheel, z1: L.hourWheel + T.hour, r: pitchR(HOUR_T, MW_M2), kind: 'wheel' },
      // Centre seconds: the driver sits on the fourth arbor, the pinion at the centre.
      { anchor: 'seconds', u: 0, z0: L.centralSeconds, z1: L.centralSeconds + T.csWheel, r: pitchR(CS_DRIVE, CS_M), kind: 'wheel' },
      { anchor: 'centre', u: 0, z0: L.centralSeconds, z1: L.centralSeconds + T.csPinion, r: pitchR(CS_PINION, CS_M), kind: 'pinion' },
      { anchor: 'centre', u: ((CS_IDLER + CS_PINION) / 2) * CS_M,
        z0: L.centralSeconds, z1: L.centralSeconds + T.csWheel, r: pitchR(CS_IDLER, CS_M), kind: 'wheel' },
      // Three hands on one axis — the nested tubes are visible exactly here.
      { anchor: 'centre', u: 0, z0: L.hands.hour, z1: L.hands.hour + T.hand, r: HAND_L.hour, kind: 'hand' },
      { anchor: 'centre', u: 0, z0: L.hands.minute, z1: L.hands.minute + T.hand, r: HAND_L.minute, kind: 'hand' },
      { anchor: 'centre', u: 0, z0: L.hands.second, z1: L.hands.second + T.hand, r: HAND_L.second, kind: 'hand',
        labelKey: 'part.hands' },
    ],
    zTicks: [L.minuteWheel, L.centralSeconds, L.hands.second],
  };
}

/**
 * The time-display meshes: the motion works, the centre-seconds train and three
 * concentric hands on top of the centre arbor.
 *
 * The cannon pinion and the minute hand sit on the centre wheel's arbor (turning
 * with it); the hour wheel is coaxial, twelve times slower; the centre seconds
 * arrive on a separate bridge from the fourth arbor.
 */
export function buildMotionWorks({ brass, steel, axleMat, bluedMat }, L, arbors, root) {
  const { P1, mwPos, CS_M, csIdlerPos } = L;
  const handRefs = {};

  // ── Cannon pinion + tube + minute hand (on the centre wheel's arbor) ──
  const cannonSub = new THREE.Group();
  {
    const cannon = makeGear({ teeth: CANNON_T, module: MW_M1, thickness: T.cannon, bore: AXLE_R * 0.9 }, steel);
    cannon.position.z = Z_MW;
    cannonSub.add(cannon);
    cannonSub.add(makeAxle({ r: 0.4, len: 3.1, z: 8.7, segments: 16 }, steel)); // cannon tube up to the top
    handRefs.minute = makeHandAssembly(
      { length: HAND_L.minute, width: 0.6, hubR: 0.5, hubH: 0.28, z: 10.25 }, bluedMat
    );
    cannonSub.add(handRefs.minute);
  }
  arbors[1].group.add(cannonSub);

  // ── The minute wheel and its pinion ──
  const mwArbor = new THREE.Group();
  mwArbor.position.set(mwPos.x, mwPos.y, 0);
  {
    const wheel = makeGear({ teeth: MINUTE_T, module: MW_M1, thickness: T.minute, bore: 0.2, crossings: 4 }, brass);
    wheel.position.z = Z_MW;
    mwArbor.add(wheel);
    const pinion = makeGear({ teeth: MW_PINION_T, module: MW_M2, thickness: T.mwPinion, bore: 0.2 }, steel);
    pinion.position.z = Z_HR;
    mwArbor.add(pinion);
    mwArbor.add(makeAxle({ r: 0.22, len: 1.9, z: (Z_MW + Z_HR) / 2 + 0.05, segments: 16 }, axleMat));
  }
  root.add(mwArbor);

  // ── The hour wheel and hour hand (coaxial with the centre arbor) ──
  const hourGroup = new THREE.Group();
  hourGroup.position.set(P1.x, P1.y, 0);
  {
    const wheel = makeGear({ teeth: HOUR_T, module: MW_M2, thickness: T.hour, bore: 0.68, crossings: 4 }, brass);
    wheel.position.z = Z_HR;
    hourGroup.add(wheel);
    hourGroup.add(makeAxle({ r: 0.62, len: 2.0, z: 8.9, segments: 16 }, brass)); // hour tube
    handRefs.hour = makeHandAssembly(
      { length: HAND_L.hour, width: 0.7, hubR: 0.62, z: 9.9 }, bluedMat // above every wheel (highest z≈9.45)
    );
    hourGroup.add(handRefs.hour);
  }
  root.add(hourGroup);

  // ── The centre-seconds train: fourth wheel → idler → centre pinion ──
  const csDriveGear = makeGear(
    { teeth: CS_DRIVE, module: CS_M, thickness: T.csWheel, bore: AXLE_R * 0.9, crossings: 4 }, brass
  );
  csDriveGear.position.z = Z_CS;
  arbors[3].group.add(csDriveGear);
  const csDriveAxle = makeAxle({ r: 0.2, len: 5.8, z: 7.2, segments: 16 }, axleMat);
  arbors[3].group.add(csDriveAxle);

  const csIdlerGroup = new THREE.Group();
  csIdlerGroup.position.set(csIdlerPos.x, csIdlerPos.y, 0);
  {
    const idler = makeGear({ teeth: CS_IDLER, module: CS_M, thickness: T.csWheel, bore: 0.18, crossings: 3 }, steel);
    idler.position.z = Z_CS;
    csIdlerGroup.add(idler);
    csIdlerGroup.add(makeAxle({ r: 0.18, len: 1.5, z: Z_CS, segments: 14 }, axleMat));
  }
  root.add(csIdlerGroup);

  const centralSecondsGroup = new THREE.Group();
  centralSecondsGroup.position.set(P1.x, P1.y, 0);
  {
    const pinion = makeGear({ teeth: CS_PINION, module: CS_M, thickness: T.csPinion, bore: 0.18 }, steel);
    pinion.position.z = Z_CS;
    centralSecondsGroup.add(pinion);
    centralSecondsGroup.add(makeAxle({ r: 0.24, len: 2.2, z: 10.0, segments: 16 }, steel));
    handRefs.second = makeHandAssembly(
      { length: HAND_L.second, width: 0.32, tail: 0.18, hubR: 0.32, z: 10.7 }, bluedMat // on top of the minute hand
    );
    centralSecondsGroup.add(handRefs.second);
  }
  root.add(centralSecondsGroup);

  // ── Phasing (the same «tooth into a space» condition as in the going train) ──
  const phiMW = meshPhase(MW_ANGLE, CANNON_T, MINUTE_T, arbors[1].phi);
  const phiHW = meshPhase(MW_ANGLE + Math.PI, MW_PINION_T, HOUR_T, phiMW);
  const phiCSIdler = meshPhase(L.csTheta1, CS_DRIVE, CS_IDLER, arbors[3].phi);
  const phiCSCenter = meshPhase(L.csTheta2, CS_IDLER, CS_PINION, phiCSIdler);

  /**
   * @param dR1 the centre wheel's angle increment (drives the motion works)
   * @param dR3 the fourth arbor's angle increment (drives the centre seconds)
   */
  function update(dR1, dR3) {
    mwArbor.rotation.z = phiMW - (CANNON_T / MINUTE_T) * dR1;
    hourGroup.rotation.z = phiHW + (MW_PINION_T / HOUR_T) * (CANNON_T / MINUTE_T) * dR1; // = centre / 12
    // Two external pairs keep the direction, and 48→8 gives a factor of 6× off the fourth arbor.
    csIdlerGroup.rotation.z = phiCSIdler - (CS_DRIVE / CS_IDLER) * dR3;
    centralSecondsGroup.rotation.z = phiCSCenter + L.csRatio * dR3;
  }

  /** Demo mode: the hands are rigidly coupled to their wheels. */
  function resetHands() {
    handRefs.hour.rotation.z = 0;
    handRefs.minute.rotation.z = 0;
    handRefs.second.rotation.z = 0;
  }

  /** Real time: the hands are laid over the top (the train «slips» beneath them). */
  function setHandAngles({ hour, minute, second }, arbors_) {
    handRefs.second.rotation.z = second - centralSecondsGroup.rotation.z;
    handRefs.minute.rotation.z = minute - arbors_[1].group.rotation.z;
    handRefs.hour.rotation.z = hour - hourGroup.rotation.z;
  }

  for (const o of [cannonSub, mwArbor, hourGroup, csDriveGear, csDriveAxle, csIdlerGroup, centralSecondsGroup]) {
    tagModule(o, 'motionWorks');
  }

  // Node switch: the groups sit on different arbors, so there is no shared `group`,
  // and six names in the interface for the sake of one toggle would be worse.
  const view = { visible: true };
  const shown = [cannonSub, mwArbor, hourGroup, csDriveGear, csIdlerGroup, centralSecondsGroup];
  const setVisible = (v) => { for (const g of shown) g.visible = v; };

  return {
    view, setVisible,
    cannonSub, mwArbor, hourGroup, csDriveGear, csIdlerGroup, centralSecondsGroup,
    handRefs, update, resetHands, setHandAngles,
  };
}
