import * as THREE from 'three';
import { makeGear, makeBevelGear, makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';
import { buildHairspring } from './hairspring.js';

/**
 * The double-axis tourbillon: a cage inside a cage, the inner one turning about an axis
 * at a right angle to the outer.
 *
 * This is the module the socket was built for. It hands back the same
 * `{ rotating, fixed, update → β, nodes, motion }` as the other two and `index.js` has no
 * special case for it — how many nested cages a variant has, and about what they turn, is
 * its own business. If that had needed an exception, the socket's whole claim was wrong.
 *
 * **The train, and why its ratios are not free.**
 *
 * The escapement itself must behave exactly as it does in every other module: the escape
 * wheel advances half a tooth per beat RELATIVE TO ITS FORK, and both ride in the inner
 * cage. Follow the drive:
 *
 *   the fixed wheel on the plate  →  the pinion rolling around it, carried by the outer
 *   cage (turns β·Zf/Zp)  →  a bevel pair, because the next axis is at a right angle
 *   (turns the inner cage by another Zb1/Zb2)  →  inside the inner cage, the escape
 *   pinion rolls around a wheel fixed to the outer cage and coaxial with the inner axis
 *   (turns the escape wheel by Zf2/Zp2 of the inner cage's own turn).
 *
 * Multiply them and the escape wheel's turn relative to its fork is
 * `β · (Zf/Zp) · (Zb1/Zb2) · (Zf2/Zp2)`, and the beat requires that to be exactly `β`.
 * **So the product of the three ratios is 1** — a constraint on the tooth counts, not a
 * number anyone chose, and a test holds it. Within it there is still a choice: here the
 * bevel doubles the rate and the inner train halves it again, so the inner cage turns
 * twice for every turn of the outer, which is what a double-axis is for.
 *
 * **The angle is the real 90°**, and the inner cage is smaller than the outer for the same
 * reason a real one is: it has to swing through the height the outer cage leaves it.
 */

export const VARIANT_ID = 'doubleAxis';

/** Local Z levels of the outer cage (from its base) — shared with the developed section. */
export const LAYERS = { bottom: -0.55, pin: 0, axis: 1.85, top: 4.25 };

/**
 * The inner cage's radius. Not chosen for looks: turning about a horizontal axis at
 * `LAYERS.axis`, it sweeps a circle of this radius, and that circle has to stay between
 * the outer cage's plates. What is left over is the clearance to them.
 *
 * This is why the outer cage is TALLER here than in the single-axis module. The balance
 * is the same size in every variant — that is a decided rule, so that a swap shows a
 * different construction rather than a different picture — and a balance of that size
 * needs an inner cage big enough to carry it, which in turn needs the height to swing
 * through. The cage's height is a consequence of the balance, not a free choice.
 */
export const innerR = () => Math.min(LAYERS.axis - LAYERS.bottom, LAYERS.top - LAYERS.axis) - 0.05;

/** Body thicknesses — the same numbers in the meshes and in the section. */
const T = { ring: 0.12 };

/**
 * What the variant says about itself in the section, before any mesh exists.
 *
 * The outer cage is the same tower the single-axis one draws; inside it the inner cage
 * appears as its swept band, because that is what it occupies whatever angle it is caught
 * at. A section cannot draw a rotation, but it can draw the room one takes.
 */
export function profile(zBase = 0, { cageR } = {}) {
  const r = innerR();
  return {
    parts: [
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.bottom, z1: zBase + LAYERS.top, r: cageR, kind: 'cage',
        labelKey: `part.${VARIANT_ID}` },
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.axis - r, z1: zBase + LAYERS.axis + r, r,
        kind: 'cage' },
    ],
  };
}

const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/** A round bar between two points of a plane, at a given local height. */
function bar(from, to, w, t, material, z = 0) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, z);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

export function buildDoubleAxis(
  { steel, brass, ruby, springSteel, axleMat, plateMat },
  {
    escTeeth = 15,
    fixedTeeth = 10, pinionTeeth = 10, moduleT = 0.26,
    bevelDrive = 18, bevelDriven = 9, bevelModule = 0.16,
    innerFixedTeeth = 6, innerPinionTeeth = 12, innerModule = 0.12,
    cageR = 4.3,
  }
) {
  const cage = new THREE.Group();   // the outer cage — the rotating part, on the arbor
  const fixed = new THREE.Group();  // what stands still in the scene

  // ── The ratios, and the constraint that binds them ──────────────
  const escPerBeta = fixedTeeth / pinionTeeth;                 // the rolling on the plate
  const bevelRatio = bevelDrive / bevelDriven;                 // through the right angle
  const innerPerBeta = escPerBeta * bevelRatio;                // the inner cage's own turn
  const escPerInner = innerFixedTeeth / innerPinionTeeth;      // the rolling inside it
  // The beat's requirement, stated where it can be read: the escape wheel must turn by β
  // relative to its fork, and the fork rides in the inner cage.
  const escPerFork = innerPerBeta * escPerInner;

  const { bottom: zBot, pin: zPin, axis: zAxis, top: zTop } = LAYERS;
  const escOff = (moduleT * (fixedTeeth + pinionTeeth)) / 2;   // the rolling pinion's centre
  const rInner = innerR();

  // ── The fixed wheel on the plate, and its post ──────────────────
  const fixedWheel = makeGear({ teeth: fixedTeeth, module: moduleT, thickness: 0.4, bore: 0.5 }, steel);
  fixedWheel.position.z = zPin;
  fixed.add(fixedWheel);
  const fixedPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.0, 12), axleMat);
  fixedPost.rotation.x = Math.PI / 2;
  fixedPost.position.z = zPin - 1.0;
  fixed.add(fixedPost);

  // ── The rolling pinion, carried by the outer cage, and its shaft up to the bevel ──
  const rollSub = new THREE.Group();
  rollSub.position.set(escOff, 0, 0);
  const rollPinion = makeGear({ teeth: pinionTeeth, module: moduleT, thickness: 0.4, bore: 0.18 }, steel);
  rollPinion.position.z = zPin;
  rollSub.add(rollPinion);
  const rollShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, zAxis - zPin + 0.6, 10), axleMat);
  rollShaft.rotation.x = Math.PI / 2;
  rollShaft.position.z = (zPin + zAxis) / 2;
  rollSub.add(rollShaft);

  // ── The bevel pair: the two axes meet at a right angle, and they MEET — the vertical
  // shaft stands at (escOff, 0) and the inner cage's axis runs along X at zAxis, so they
  // cross at exactly (escOff, 0, zAxis). A bevel pair that does not share a point is a
  // drawing of a gear, not a gear.
  const gamma = Math.atan2(bevelDrive, bevelDriven);           // the driver's pitch angle
  const bevelUp = makeBevelGear({
    teeth: bevelDrive, module: bevelModule, thickness: 0.26, bore: 0.16,
    pitchAngleDeg: (gamma * 180) / Math.PI,
  }, steel);
  // The cone's apex sits at the crossing, opening downwards along the shaft.
  bevelUp.rotation.x = Math.PI;
  bevelUp.position.z = zAxis;
  rollSub.add(bevelUp);
  cage.add(rollSub);

  // ── The inner cage: a right angle to the outer, and the same trick the power-reserve
  // planets use — a carrier turned by a quaternion, an ordinary spin about its own Z.
  const innerCarrier = new THREE.Group();
  innerCarrier.position.z = zAxis;
  innerCarrier.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  const innerCage = new THREE.Group();
  innerCarrier.add(innerCage);
  cage.add(innerCarrier);

  // Its own bevel, on the inner axis, meeting the other at the crossing point. In the
  // carrier's frame the crossing is at local z = escOff along the axis.
  const bevelIn = makeBevelGear({
    teeth: bevelDriven, module: bevelModule, thickness: 0.26, bore: 0.16,
    pitchAngleDeg: 90 - (gamma * 180) / Math.PI,
  }, steel);
  bevelIn.position.z = escOff;
  innerCage.add(bevelIn);

  // The cage itself: two rings on the axis, joined by pillars.
  const ringMat = plateMat.clone();
  ringMat.side = THREE.DoubleSide;
  const innerRings = [];
  for (const z of [-0.62, 0.62]) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rInner, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rInner - 0.22, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T.ring, bevelEnabled: false, curveSegments: 40 });
    geo.translate(0, 0, -T.ring / 2);
    const ring = new THREE.Mesh(geo, ringMat);
    ring.position.z = z;
    ring.castShadow = true;
    innerCage.add(ring);
    innerRings.push(ring);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.24, 8), ringMat);
    pillar.rotation.x = Math.PI / 2;
    pillar.position.set(Math.cos(a) * (rInner - 0.11), Math.sin(a) * (rInner - 0.11), 0);
    pillar.castShadow = true;
    innerCage.add(pillar);
  }

  // ── Inside the inner cage: the escapement, whole ────────────────
  // The wheel fixed to the OUTER cage, coaxial with the inner axis: the escape pinion
  // rolls around it as the inner cage turns, and that rolling is the escapement's drive.
  const innerOff = (innerModule * (innerFixedTeeth + innerPinionTeeth)) / 2;
  const innerFixed = makeGear({ teeth: innerFixedTeeth, module: innerModule, thickness: 0.22, bore: 0.1 }, steel);
  innerFixed.position.z = -0.18;
  innerCarrier.add(innerFixed);          // on the carrier, so it does NOT turn with the cage

  const escSub = new THREE.Group();
  escSub.position.set(innerOff, 0, 0);
  const escR = Math.min(0.62, rInner - innerOff - 0.12);
  const escWheel = makeEscapeWheel(
    { teeth: escTeeth, outerR: escR, rootR: escR - 0.2, thickness: 0.13, bore: 0.07, crossings: 3 },
    brass
  );
  escWheel.position.z = 0.16;
  escSub.add(escWheel);
  const escPinion = makeGear({ teeth: innerPinionTeeth, module: innerModule, thickness: 0.22, bore: 0.07 }, steel);
  escPinion.position.z = -0.18;
  escSub.add(escPinion);
  const escAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), axleMat);
  escAxle.rotation.x = Math.PI / 2;
  escSub.add(escAxle);
  innerCage.add(escSub);

  // The fork, between the wheel's rim and the balance at the centre.
  const palletMat = ruby.clone();
  const fork = new THREE.Group();
  const forkPivot = new THREE.Vector2(innerOff * 0.5, 0);
  fork.position.set(forkPivot.x, forkPivot.y, 0.42);
  {
    const inward = Math.PI;
    for (const s of [+1, -1]) {
      const rimPt = new THREE.Vector2(innerOff, 0)
        .add(dir2(inward + s * (30 * Math.PI) / 180).multiplyScalar(escR - 0.06));
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.12, 0.1, steel));
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.14), palletMat);
      stone.position.set(local.x, local.y, 0);
      stone.rotation.z = inward + s * (30 * Math.PI) / 180;
      stone.castShadow = true;
      fork.add(stone);
    }
    const stemEnd = dir2(inward).multiplyScalar(forkPivot.length() - 0.18);
    fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.1, 0.1, steel));
    const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), axleMat);
    forkAxle.rotation.x = Math.PI / 2;
    fork.add(forkAxle);
  }
  innerCage.add(fork);

  // The balance, at the inner cage's centre — coaxial with its axis, as the single-axis
  // module's balance is coaxial with its cage.
  const balR = Math.min(1.95, rInner - 0.35);   // the same balance as every other module
  const balance = new THREE.Group();
  balance.position.z = 0.72;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, 0.12, 14, 56), brass);
  rim.castShadow = true;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balR * 2 - 0.1, 0.11, 0.11), brass);
    spoke.rotation.z = a;
    balance.add(spoke);
  }
  // The timing screws the other modules' balances carry. The balance is the same balance
  // in every variant — that is the decided rule — and «the same» has to include what it is
  // made of, or the comparison would be counting my haste rather than the mechanism.
  const screwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI * 2) / 4 + Math.PI / 8;
    const screw = new THREE.Mesh(screwGeo, steel);
    screw.position.set(Math.cos(a) * balR, Math.sin(a) * balR, 0.06);
    screw.rotation.z = a;
    screw.rotation.x = Math.PI / 2;
    screw.castShadow = true;
    balance.add(screw);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), steel);
    head.position.set(Math.cos(a) * (balR + 0.07), Math.sin(a) * (balR + 0.07), 0.06);
    head.rotation.z = a;
    head.rotation.x = Math.PI / 2;
    head.castShadow = true;
    balance.add(head);
  }
  const balHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12), steel);
  balHub.rotation.x = Math.PI / 2;
  balance.add(balHub);
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balance.add(balAxle);
  innerCage.add(balance);

  const hair = buildHairspring({ balR, dirAngle: 0, springSteel, steel });
  hair.group.position.z = 0.95;
  innerCage.add(hair.group);
  const hairGroup = hair.group;

  // ── The outer cage's plates and pillars ─────────────────────────
  const cagePlateMat = plateMat.clone();
  cagePlateMat.side = THREE.DoubleSide;
  const cagePlates = [];
  const cagePillars = [];
  const topPlateGroup = new THREE.Group();
  const bottomPlateGroup = new THREE.Group();
  const PLATE_T = 0.11;
  function makeCagePlate(z, target) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, cageR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, cageR - 0.32, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PLATE_T, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015,
      bevelSegments: 2, curveSegments: 48,
    });
    geo.translate(0, 0, -PLATE_T / 2);
    const ring = new THREE.Mesh(geo, cagePlateMat);
    ring.position.z = z;
    ring.castShadow = true;
    ring.receiveShadow = true;
    target.add(ring);
    cagePlates.push(ring);
    // Two spokes only, and across the inner cage's axis rather than over it: three would
    // have swept through the very thing this module exists to show.
    for (const a of [Math.PI / 2, -Math.PI / 2]) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(cageR * 0.94, 0.3, 0.09), cagePlateMat);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * cageR * 0.47, Math.sin(a) * cageR * 0.47, z);
      spoke.castShadow = true;
      target.add(spoke);
      cagePlates.push(spoke);
    }
  }
  makeCagePlate(zBot, bottomPlateGroup);
  makeCagePlate(zTop, topPlateGroup);
  cage.add(bottomPlateGroup);
  cage.add(topPlateGroup);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const h = zTop - zBot;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, h, 10), cagePlateMat);
    pillar.rotation.x = Math.PI / 2;
    pillar.position.set(Math.cos(a) * (cageR - 0.16), Math.sin(a) * (cageR - 0.16), (zBot + zTop) / 2);
    pillar.castShadow = true;
    cage.add(pillar);
    cagePillars.push(pillar);
  }
  // The bearings the inner axis turns in: a post on each side, on the outer cage.
  for (const s of [1, -1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), cagePlateMat);
    post.rotation.z = Math.PI / 2;
    post.rotation.y = Math.PI / 2;
    post.position.set(s * (rInner + 0.45), 0, zAxis);
    post.castShadow = true;
    cage.add(post);
  }

  // ── Beat kinematics — the same phase every module runs on ───────
  const phase = {};
  function update(t, beatHz, ampDeg) {
    const { thetaB, beta, forkAngle } = beatPhase(t, beatHz, ampDeg, escTeeth, phase);
    innerCage.rotation.z = beta * innerPerBeta;   // the second axis
    rollSub.rotation.z = beta * escPerBeta;       // rolling on the plate's fixed wheel
    escSub.rotation.z = beta * escPerFork;        // = β, by the constraint above
    fork.rotation.z = forkAngle;
    balance.rotation.z = thetaB;
    hair.update(thetaB);
    return beta;                                  // the arbor's angle: the socket's contract
  }
  update(0, 2.5, 220);

  for (const g of [cage, fixed, bottomPlateGroup, topPlateGroup]) {
    tagModule(g, 'escapement');
    tagVariant(g, VARIANT_ID);
  }

  const view = { cageOpacity: 1.0, topPlate: true };
  function setCageOpacity(v) {
    cagePlateMat.transparent = v < 1;
    cagePlateMat.opacity = v;
    cagePlateMat.needsUpdate = true;
  }
  function setTopPlateVisible(v) { topPlateGroup.visible = v; }
  const nodes = [
    { kind: 'flag', labelKey: 'part.fixedWheel', obj: fixed, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.balance', obj: balance, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.innerCage', obj: innerCage, prop: 'visible' },
    { kind: 'range', labelKey: 'gui.cageOpacity', obj: view, prop: 'cageOpacity',
      min: 0.15, max: 1.0, step: 0.05, onChange: setCageOpacity },
    { kind: 'flag', labelKey: 'gui.cageTopPlate', obj: view, prop: 'topPlate',
      onChange: setTopPlateVisible },
  ];

  /**
   * What the module DOES.
   *
   * `escapeTurns` is null on purpose, and the modal shows a dash for it. The question it
   * asks — how many turns the escape wheel makes for one turn of the arbor — has an answer
   * only while everything turns about one axis. Here the wheel's motion is a composition of
   * rotations about axes at a right angle, and there is no scalar to report. Inventing one
   * would be exactly the kind of number this project refuses to print.
   *
   * `innerTurns` does exist: the inner cage turns about a definite axis at a definite rate.
   */
  const motion = { escapeTurns: null, hasCage: true, innerTurns: innerPerBeta };

  return {
    cage, fixed, update, nodes, motion,
    balance, fork, escSub, innerCage, innerCarrier, rollSub, hairGroup,
    cageR, balR, innerR: rInner, escPerBeta, innerPerBeta, escPerInner, escPerFork,
    setCageOpacity, setTopPlateVisible, cagePlates, cagePillars, topPlateGroup, bottomPlateGroup,
  };
}
