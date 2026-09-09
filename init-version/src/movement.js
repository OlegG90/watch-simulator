import * as THREE from 'three';
import { makeGear, makeEscapeWheel, makeHand } from './gear.js';
import { buildEscapement } from './escapement.js';

// ── Movement parameters ───────────────────────────────────────────
const M = 0.35;        // tooth module (shared by every meshing)
const WHEEL_T = 0.7;   // wheel thickness
const PINION_T = 1.2;  // pinion thickness (longer: they mesh on another plane)
const Z_STEP = 1.1;    // step between the z-planes of neighbouring arbors
const AXLE_R = 0.3;    // arbor radius

/**
 * The going train: every arbor carries a pinion (driven by the previous wheel) and its
 * own wheel (driving the next pinion). The barrel has only a wheel; the escape arbor has
 * a pinion + the escape wheel (a stub for now, the escapement comes in Phase 3).
 */
const TRAIN = [
  { name: 'Barrel',       wheel: 48, axleTop: 2.6 },                              // a taller arbor — for the ratchet
  { name: 'Centre wheel', pinion: 12, wheel: 40, crossings: 4, axleTop: 7.4 },    // arbor up to the cannon pinion
  { name: 'Third wheel',  pinion: 12, wheel: 36, crossings: 4 },
  { name: 'Fourth wheel', pinion: 12, wheel: 32, crossings: 3, axleTop: 5.15 },   // arbor for the seconds hand
  { name: 'Escape wheel', pinion: 12, escapeTeeth: 15 },
];

// Direction (in the XY plane) from arbor k to arbor k+1 — the movement curls into an arc.
const MESH_ANGLES = [0, 35, 70, 105].map((d) => (d * Math.PI) / 180);

const pitchR = (z) => (M * z) / 2;
const mod = (a, m) => ((a % m) + m) % m;

/**
 * Starting phase of the driven pinion: its tooth must sit in a space of the driving wheel
 * along the line of centres (theta — the direction from driver to driven). Derived from
 * the condition that when the driver's space faces theta, the driven tooth faces
 * theta + PI.
 */
function meshPhase(theta, ZA, ZB, phiA) {
  const stepA = (2 * Math.PI) / ZA;
  const stepB = (2 * Math.PI) / ZB;
  const tau = mod(theta - phiA, stepA); // how far the driver turns to align the space
  return theta + Math.PI - stepB / 2 + (ZA / ZB) * tau;
}

export function buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat }) {
  const root = new THREE.Group();
  const arbors = [];
  const handRefs = {};

  // ── Laying out the arbors + kinematics (each arbor's speed and phase) ──
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
      name: spec.name,
      spec,
      pos,
      omega,
      phi,
      pinionZ: (k - 1) * Z_STEP, // pinion in the wheel plane of the previous arbor
      wheelZ: k * Z_STEP,
    });
  });

  // ── Laying out the escapement: the fork and balance continue the movement's arc ──
  const ESC_R = 4.9; // the escape wheel's outer radius
  const escDir = (140 * Math.PI) / 180;
  const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));
  const escPos = arbors[4].pos;
  const anchorPos = escPos.clone().add(dir2(escDir).multiplyScalar(ESC_R * 1.5));
  const balancePos = anchorPos.clone().add(dir2(escDir).multiplyScalar(6.0));

  // ── Laying out the motion works (hands) and the winding ──
  // Cannon pinion (12) → minute wheel (36); minute pinion (10) → hour wheel (40) → ×12.
  const P1 = arbors[1].pos;
  const MW_M1 = 0.28;                  // module of the cannon → minute pair
  const MW_M2 = (MW_M1 * 48) / 50;     // module of the pinion → hour pair (same centre distance)
  const MW_ANGLE = (-65 * Math.PI) / 180;
  const mwPos = P1.clone().add(dir2(MW_ANGLE).multiplyScalar(((12 + 36) / 2) * MW_M1));
  // Winding: the ratchet on the barrel arbor → the crown wheel → the stem with the crown.
  const RATCH_M = 0.33;
  const CW_ANGLE = (200 * Math.PI) / 180;
  const cwPos = arbors[0].pos.clone().add(dir2(CW_ANGLE).multiplyScalar(((28 + 18) / 2) * RATCH_M));
  const crownPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(5.2));

  // ── Centring the movement about the origin ──
  const outerR = (s) => (s.escapeTeeth ? ESC_R + 0.3 : pitchR(s.wheel) + M * 1.3);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const extents = [
    ...arbors.map((a) => ({ pos: a.pos, r: outerR(a.spec) })),
    { pos: anchorPos, r: 1.5 },
    { pos: balancePos, r: 3.8 },
    { pos: P1, r: 9.2 },        // the minute hand's sweep
    { pos: mwPos, r: 5.6 },     // the minute wheel
    { pos: cwPos, r: 3.4 },     // the crown wheel
    { pos: crownPos, r: 1.8 },  // the winding crown
  ];
  for (const e of extents) {
    minX = Math.min(minX, e.pos.x - e.r); maxX = Math.max(maxX, e.pos.x + e.r);
    minY = Math.min(minY, e.pos.y - e.r); maxY = Math.max(maxY, e.pos.y + e.r);
  }
  root.position.set(-(minX + maxX) / 2, -(minY + maxY) / 2, 0);
  const size = { w: maxX - minX, h: maxY - minY };

  // ── Meshes ──
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
    if (a.spec.escapeTeeth) {
      const e = makeEscapeWheel(
        { teeth: a.spec.escapeTeeth, outerR: ESC_R, rootR: 3.8, thickness: 0.5, bore: AXLE_R * 0.9 },
        brass
      );
      e.position.z = a.wheelZ;
      // Phasing: at E=0 a tooth tip stands against the entry pallet
      // (the wheel's world angle = phi + E, the pallet at escDir + 30°).
      const stepE = (2 * Math.PI) / a.spec.escapeTeeth;
      e.rotation.z = mod(escDir + Math.PI / 6 - a.phi, stepE);
      g.add(e);
    }
    if (k === 0) {
      // The spring barrel — a cylinder behind the wheel.
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(pitchR(48) - 1.2, pitchR(48) - 1.2, 1.8, 48),
        brass
      );
      drum.rotation.x = Math.PI / 2;
      drum.position.z = -1.4;
      drum.castShadow = true;
      g.add(drum);
    }

    // Arbor: from the lowest to the highest part of the node.
    const zFrom = k === 0 ? -2.6 : a.pinionZ - 1.0;
    const zTo = a.spec.axleTop ?? a.wheelZ + 1.0;
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(AXLE_R, AXLE_R, zTo - zFrom, 20),
      axleMat
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.z = (zFrom + zTo) / 2;
    axle.castShadow = true;
    g.add(axle);

    root.add(g);
    a.group = g;
  });

  // ── The escapement node (fork + balance) ──
  const escapement = buildEscapement(
    { brass, steel, ruby, springMat, axleMat },
    {
      wheelPos: escPos,
      dirAngle: escDir,
      wheelR: ESC_R,
      zW: arbors[4].wheelZ,
      anchorPos,
      balancePos,
      escTeeth: TRAIN[4].escapeTeeth,
    }
  );
  root.add(escapement.group);

  // ── Main plate (back plate) + ruby jewels under the arbors ──
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const plateMargin = 1.8;
  let plateR = Math.hypot(size.w, size.h) * 0.5 + plateMargin;
  for (const e of extents) {
    plateR = Math.max(plateR, Math.hypot(e.pos.x - cx, e.pos.y - cy) + e.r + plateMargin);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR, 0.8, 96), plateMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(cx, cy, -3.2);
  plate.receiveShadow = true;
  root.add(plate);

  const jewelPts = [...arbors.map((a) => a.pos), anchorPos];
  if (Math.hypot(balancePos.x - cx, balancePos.y - cy) < plateR - 1) jewelPts.push(balancePos);
  for (const p of jewelPts) {
    const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 20), ruby);
    jewel.rotation.x = Math.PI / 2;
    jewel.position.set(p.x, p.y, -2.65);
    root.add(jewel);
  }

  // ── Motion works + hands ──
  // The cannon pinion and the minute hand sit on the centre wheel's arbor (turning with
  // it); the hour wheel is coaxial, twelve times slower.
  const Z_MW = 7.2, Z_HR = 7.9;
  const phi1 = arbors[1].phi;

  const cannonSub = new THREE.Group(); // cannon pinion + tube + minute hand
  {
    const cannon = makeGear({ teeth: 12, module: MW_M1, thickness: 0.8, bore: AXLE_R * 0.9 }, steel);
    cannon.position.z = Z_MW;
    cannonSub.add(cannon);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 16), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = Z_MW - 0.4 + 1.1 + 0.45;
    cannonSub.add(pipe);
    const minuteHandG = new THREE.Group();
    const minuteHand = makeHand({ length: 8.8, width: 0.6 }, bluedMat);
    minuteHand.position.z = 8.9;
    minuteHandG.add(minuteHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.28, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 8.9;
    minuteHandG.add(hub);
    cannonSub.add(minuteHandG);
    handRefs.minute = minuteHandG;
  }
  arbors[1].group.add(cannonSub);

  const mwArbor = new THREE.Group(); // the minute wheel and its pinion
  mwArbor.position.set(mwPos.x, mwPos.y, 0);
  {
    const wheel = makeGear({ teeth: 36, module: MW_M1, thickness: 0.55, bore: 0.2, crossings: 4 }, brass);
    wheel.position.z = Z_MW;
    mwArbor.add(wheel);
    const pinion = makeGear({ teeth: 10, module: MW_M2, thickness: 0.7, bore: 0.2 }, steel);
    pinion.position.z = Z_HR;
    mwArbor.add(pinion);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 16), axleMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.z = (Z_MW + Z_HR) / 2 + 0.05;
    mwArbor.add(axle);
  }
  root.add(mwArbor);

  const hourGroup = new THREE.Group(); // the hour wheel and the hour hand
  hourGroup.position.set(P1.x, P1.y, 0);
  {
    const wheel = makeGear({ teeth: 40, module: MW_M2, thickness: 0.5, bore: 0.68, crossings: 4 }, brass);
    wheel.position.z = Z_HR;
    hourGroup.add(wheel);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.6, 16), brass);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = Z_HR + 0.35;
    hourGroup.add(pipe);
    const hourHandG = new THREE.Group();
    const hourHand = makeHand({ length: 5.6, width: 0.7 }, bluedMat);
    hourHand.position.z = 8.5;
    hourHandG.add(hourHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.24, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 8.5;
    hourHandG.add(hub);
    hourGroup.add(hourHandG);
    handRefs.hour = hourHandG;
  }
  root.add(hourGroup);

  // Phasing the motion-works meshings (the same «tooth into a space» condition).
  const phiMW = meshPhase(MW_ANGLE, 12, 36, phi1);
  const phiHW = meshPhase(MW_ANGLE + Math.PI, 10, 40, phiMW);

  // The seconds hand — on the fourth wheel's arbor (a small seconds, not at the centre).
  {
    const secondHandG = new THREE.Group();
    const secondHand = makeHand({ length: 3.9, width: 0.4, tail: 0.3 }, bluedMat);
    secondHand.position.z = 5.0;
    secondHandG.add(secondHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 5.0;
    secondHandG.add(hub);
    arbors[3].group.add(secondHandG);
    handRefs.second = secondHandG;
  }

  // ── Winding: the ratchet on the barrel arbor → the crown wheel → the crown ──
  const winderGroup = new THREE.Group();
  const ratchetG = new THREE.Group();
  ratchetG.position.set(arbors[0].pos.x, arbors[0].pos.y, 0);
  const ratchet = makeGear({ teeth: 28, module: RATCH_M, thickness: 0.5, bore: AXLE_R * 0.9 }, steel);
  ratchet.position.z = 2.0;
  ratchetG.add(ratchet);
  winderGroup.add(ratchetG);

  const cwG = new THREE.Group();
  cwG.position.set(cwPos.x, cwPos.y, 0);
  const crownWheel = makeGear({ teeth: 18, module: RATCH_M, thickness: 0.5, bore: 0.2 }, steel);
  crownWheel.position.z = 2.0;
  cwG.add(crownWheel);
  const phiCW = meshPhase(CW_ANGLE, 28, 18, 0);
  cwG.rotation.z = phiCW;
  winderGroup.add(cwG);

  // The click — it holds the ratchet.
  {
    const clickPivot = arbors[0].pos.clone().add(dir2((120 * Math.PI) / 180).multiplyScalar(6.0));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12), axleMat);
    post.rotation.x = Math.PI / 2;
    post.position.set(clickPivot.x, clickPivot.y, 1.6);
    winderGroup.add(post);
    const tip = arbors[0].pos.clone().add(dir2((104 * Math.PI) / 180).multiplyScalar(4.45));
    const d = tip.clone().sub(clickPivot);
    const clickBar = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.32, 0.3), steel);
    clickBar.position.set((clickPivot.x + tip.x) / 2, (clickPivot.y + tip.y) / 2, 2.0);
    clickBar.rotation.z = Math.atan2(d.y, d.x);
    winderGroup.add(clickBar);
  }

  // The stem and the winding crown.
  const stemLen = crownPos.clone().sub(cwPos).length() + 1.0;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, stemLen, 12), axleMat);
  stem.rotation.z = CW_ANGLE - Math.PI / 2;
  stem.position.set((cwPos.x + crownPos.x) / 2, (cwPos.y + crownPos.y) / 2, 2.0);
  winderGroup.add(stem);

  const crownOrient = new THREE.Group();
  crownOrient.position.set(crownPos.x, crownPos.y, 2.0);
  crownOrient.rotation.z = CW_ANGLE - Math.PI / 2;
  const knurl = steel.clone();
  knurl.flatShading = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.5, 14), knurl);
  crown.castShadow = true;
  crownOrient.add(crown);
  winderGroup.add(crownOrient);
  root.add(winderGroup);

  // Winding animation: the crown and the ratchet turn, the barrel wheel does not
  // (in reality the barrel arbor is wound relative to its case).
  let windPending = 0, windAngle = 0, crownSpin = 0;
  const winder = {
    group: winderGroup,
    wind() { windPending += Math.PI * 4; },
    update(dt) {
      if (windPending <= 0) return;
      const d = Math.min(dt * 5, windPending);
      windPending -= d;
      windAngle += d;
      crownSpin += d * (28 / 18) * 2.3;
      ratchetG.rotation.z = windAngle;
      cwG.rotation.z = phiCW - windAngle * (28 / 18);
      crown.rotation.y = crownSpin;
    },
  };

  // ── Focus points (for the labels and the camera presets) ──
  const focusPoints = [
    ...arbors.map((a) => ({ name: a.name, pos: a.pos, z: a.wheelZ, r: outerR(a.spec) })),
    { name: 'Pallet fork', pos: anchorPos, z: arbors[4].wheelZ, r: 2.2 },
    { name: 'Balance', pos: balancePos, z: arbors[4].wheelZ + 1.3, r: 3.6 },
    { name: 'Hands', pos: P1, z: 8.6, r: 4.5 },
    { name: 'Winding', pos: cwPos, z: 2.0, r: 4.5 },
  ];

  // ── Kinematics: every arbor's angle from the barrel's angle ──
  function update(driveAngle) {
    for (const a of arbors) a.group.rotation.z = a.phi + a.omega * driveAngle;
    handRefs.hour.rotation.z = 0;
    handRefs.minute.rotation.z = 0;
    handRefs.second.rotation.z = 0;
    // Motion works: from the centre wheel (the cannon = the centre arbor).
    const dR1 = arbors[1].omega * driveAngle; // R1 - phi1
    mwArbor.rotation.z = phiMW - (12 / 36) * dR1;
    hourGroup.rotation.z = phiHW + (10 / 40) * (12 / 36) * dR1; // = centre / 12
  }
  update(0);

  // The main entry point: time → balance/fork → the escape wheel's angle → the whole train.
  function setTime(t, { beatHz, amplitude }) {
    const E = escapement.update(t, beatHz, amplitude);
    update(E / arbors[4].omega);
    return E;
  }

  function clockAngle(unit) {
    return Math.PI / 2 - unit * Math.PI * 2;
  }

  // Real-time mode: the fourth arbor drives the movement, while the hour/minute hands
  // compensate for the model's simplified teaching ratios.
  function setClockTime(date, { beatHz, amplitude }) {
    const h = date.getHours() % 12;
    const m = date.getMinutes();
    const s = date.getSeconds();
    const ms = date.getMilliseconds();
    const secondUnit = (s + ms / 1000) / 60;
    const minuteUnit = (m + secondUnit) / 60;
    const hourUnit = (h + minuteUnit) / 12;
    const t = h * 3600 + m * 60 + s + ms / 1000;

    escapement.update(t, beatHz, amplitude);
    update((clockAngle(secondUnit) - arbors[3].phi) / arbors[3].omega);
    handRefs.minute.rotation.z = clockAngle(minuteUnit) - arbors[1].group.rotation.z;
    handRefs.hour.rotation.z = clockAngle(hourUnit) - hourGroup.rotation.z;
    return { secondUnit, minuteUnit, hourUnit };
  }

  return {
    root, arbors, update, setTime, setClockTime, escapement, size, focusPoints, winder,
    bounds: { minX, maxX, minY, maxY, cx, cy, plateR },
    motionWorks: { cannonSub, mwArbor, hourGroup },
  };
}
