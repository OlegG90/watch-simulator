import * as THREE from 'three';
import { makeGear, makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';
import { buildHairspring } from './hairspring.js';

// ── Escapement constants (the same as in escapement.js) ───────────
/** Local Z levels of the cage (from its base) — shared with the developed section. */
export const LAYERS = { bottom: -0.55, pin: 0, escape: 0.55, fork: 0.95, balance: 1.75, hair: 2.25, top: 2.6 };

/** The balance rim's radius: either its own size, or whatever the cage leaves it. */
export const balanceR = (cageR) => Math.min(1.95, cageR - 1.95);

/** Body thicknesses — the same numbers in the meshes and in the section. */
const T = { balRim: 0.18 };

/**
 * What the variant says about itself in the section — before any mesh exists.
 *
 * A tower of two plates: everything else is inside it, so what the section shows is
 * the cage rather than its contents. `u` is measured from the escape arbor, `z` from
 * the socket's base.
 */
export function profile(zBase = 0, { cageR } = {}) {
  return {
    parts: [
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.bottom, z1: zBase + LAYERS.top, r: cageR, kind: 'cage',
        labelKey: `part.${VARIANT_ID}` },
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.balance - T.balRim, z1: zBase + LAYERS.balance + T.balRim,
        r: balanceR(cageR), kind: 'flat' },
    ],
  };
}

const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Tourbillon: the whole escapement (escape wheel + fork + balance with its
 * hairspring) sits in a rotating cage. The escape pinion (Zp) rolls around the FIXED
 * wheel (Zf) at the centre of the cage; when Zf = Zp, the cage angle θ_cage equals
 * the escapement's beat β, so the drive to the train does not change (θ_cage takes
 * over from the old escape-wheel angle).
 *
 * update(t, beatHz, ampDeg) → θ_cage (the cage's angle; it drives the whole train).
 *
 * The geometry is compact, in the cage's local coordinates (the centre = the fixed
 * wheel's axis). The cage is added as a child of a group that already turns by
 * θ_cage (here: arbor4.group); the fixed wheel is added separately, to a fixed group.
 */
/** The variant's identifier in the escapement socket. */
export const VARIANT_ID = 'tourbillon';

export function buildTourbillon(
  { steel, brass, ruby, springSteel, axleMat, plateMat },
  { escTeeth = 15, fixedTeeth = 10, pinionTeeth = 10, moduleT = 0.26, cageR = 4.3, escDirLocal = 0 }
) {
  const cage = new THREE.Group();   // the rotating part (add to arbor4.group)
  const fixed = new THREE.Group();  // the fixed part (add to root at cagePos)

  // Z levels (local; the cage is placed at zBase in movement).
  const zPin = 0;      // the plane of the fixed wheel and the escape pinion (the meshing)
  const zEsc = 0.55;   // the escape wheel
  const zFork = 0.95;  // the fork
  const zBal = 1.75;   // the balance
  const zHair = 2.25;  // the hairspring
  const zBot = -0.55, zTop = 2.6; // the cage plates

  // The escape node rolls around the fixed wheel: relative to the cage it turns by
  // β·(Zf/Zp), and together with the cage by another β. Hence the escape wheel's faster
  // absolute turn. There is one formula: it moves the mesh, and the number for the
  // module comparison is taken from it too.
  const escPerBeta = fixedTeeth / pinionTeeth;
  const escOff = moduleT * (fixedTeeth + pinionTeeth) / 2; // centre of the escape node from the cage's centre
  const escCenter = dir2(escDirLocal).multiplyScalar(escOff);
  const escR = Math.min(1.7, cageR - escOff - 0.2); // the escape wheel stays inside the cage

  // ── The fixed wheel (fourth wheel) — at the centre, does NOT turn with the cage ──
  const fixedWheel = makeGear({ teeth: fixedTeeth, module: moduleT, thickness: 0.4, bore: 0.5 }, steel);
  fixedWheel.position.z = zPin;
  fixed.add(fixedWheel);
  // The fixed wheel's pillar (from the plate up to the centre of the cage).
  const fixedPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.0, 12), axleMat);
  fixedPost.rotation.x = Math.PI / 2;
  fixedPost.position.z = zPin - 1.0;
  fixed.add(fixedPost);

  // ── The escape node (wheel + pinion) — rolls around the fixed wheel ──
  const escSub = new THREE.Group();
  escSub.position.set(escCenter.x, escCenter.y, 0);
  const escWheel = makeEscapeWheel(
    { teeth: escTeeth, outerR: escR, rootR: escR - 0.5, thickness: 0.35, bore: 0.18, crossings: 3 },
    brass
  );
  escWheel.position.z = zEsc;
  escSub.add(escWheel);
  const escPinion = makeGear({ teeth: pinionTeeth, module: moduleT, thickness: 0.4, bore: 0.18 }, steel);
  escPinion.position.z = zPin;
  escSub.add(escPinion);
  const escAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 10), axleMat);
  escAxle.rotation.x = Math.PI / 2;
  escAxle.position.z = zEsc - 0.15;
  escSub.add(escAxle);
  cage.add(escSub);

  // ── The fork (lever) — between the escape wheel and the balance at the centre ──
  // Ruby pallets — a faceted physical material with transmission, so the stone lets
  // light through and catches a highlight, unlike a matte Box.
  const palletMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: 0.4, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  // The balance's impulse stone is physical too — it lets light through.
  const impulseRubyMat = palletMat.clone();
  impulseRubyMat.emissiveIntensity = 0.18;
  const fork = new THREE.Group();
  const forkPivot = dir2(escDirLocal).multiplyScalar(escOff * 0.52); // closer to the centre
  fork.position.set(forkPivot.x, forkPivot.y, zFork);
  {
    // Pallets on the escape wheel's rim, ±30° from the line to the balance.
    const inward = escDirLocal + Math.PI; // from the escape wheel towards the centre
    for (const s of [+1, -1]) {
      const rimPt = escCenter.clone().add(dir2(inward + s * (30 * Math.PI) / 180).multiplyScalar(escR - 0.12));
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.3, 0.28, steel));
      // A faceted prism instead of a Box — the chamfer comes from a bevelled Extrude.
      const pShape = new THREE.Shape();
      const pw = 0.3, ph = 0.6;
      pShape.moveTo(-pw / 2, -ph / 2);
      pShape.lineTo(pw / 2, -ph / 2);
      pShape.lineTo(pw / 2, ph / 2);
      pShape.lineTo(-pw / 2, ph / 2);
      pShape.closePath();
      const pGeo = new THREE.ExtrudeGeometry(pShape, {
        depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2,
      });
      pGeo.translate(0, 0, -0.2);
      const stone = new THREE.Mesh(pGeo, palletMat);
      stone.position.set(local.x, local.y, 0);
      stone.rotation.z = inward + s * (30 * Math.PI) / 180;
      stone.castShadow = true;
      fork.add(stone);
    }
    // The stem towards the centre (the balance), plus the horns.
    const stemEnd = dir2(inward).multiplyScalar(forkPivot.length() - 0.55);
    fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.26, 0.28, steel));
    const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.3, 12), axleMat);
    forkAxle.rotation.x = Math.PI / 2;
    fork.add(forkAxle);
  }
  cage.add(fork);

  // ── The balance — at the CENTRE of the cage (coaxial with the fixed wheel) — enlarged for visibility ──
  const balance = new THREE.Group();
  balance.position.z = zBal;
  const balR = balanceR(cageR);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, T.balRim, 16, 64), brass);
  rim.castShadow = true;
  rim.receiveShadow = true;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balR * 2 - 0.15, 0.16, 0.16), brass);
    spoke.rotation.z = a;
    spoke.castShadow = true;
    balance.add(spoke);
  }
  // Timing screws/weights on the rim — 4 of them crosswise, offset so they do not coincide with the spokes.
  const screwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI * 2) / 4 + Math.PI / 8;
    const sx = Math.cos(a) * balR, sy = Math.sin(a) * balR;
    const screw = new THREE.Mesh(screwGeo, steel);
    screw.position.set(sx, sy, 0.08);
    // The screw sticks out radially.
    screw.rotation.z = a;
    screw.rotation.x = Math.PI / 2;
    screw.castShadow = true;
    balance.add(screw);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), steel);
    head.position.set(Math.cos(a) * (balR + 0.07), Math.sin(a) * (balR + 0.07), 0.08);
    head.rotation.z = a;
    head.rotation.x = Math.PI / 2;
    head.castShadow = true;
    balance.add(head);
  }
  const balHub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  balHub.rotation.x = Math.PI / 2;
  balance.add(balHub);
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 12), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.35;
  balance.add(balAxle);
  // The impulse stone — a rectangular ruby prism with a chamfer (not a cylinder).
  const impulseGeo = new THREE.BoxGeometry(0.18, 0.28, 0.9);
  const pin = new THREE.Mesh(impulseGeo, impulseRubyMat);
  const pinPos = dir2(escDirLocal).multiplyScalar(0.45);
  pin.position.set(pinPos.x, pinPos.y, -0.68);
  balance.add(pin);
  cage.add(balance);

  // ── The hairspring — shared by every escapement variant ──
  const hair = buildHairspring({ balR, dirAngle: escDirLocal, springSteel, steel });
  const hairGroup = hair.group;
  hairGroup.position.z = zHair;
  cage.add(hairGroup);
  const updateHair = hair.update;

  // ── The cage: two plates with body and chamfer + 3 pillars with caps ──
  const cagePlateMat = plateMat.clone();
  cagePlateMat.side = THREE.DoubleSide;
  const cagePillars = [];
  const cagePlates = [];
  const topPlateGroup = new THREE.Group();
  const PLATE_T = 0.11;
  const bottomPlateGroup = new THREE.Group();

  function makeCagePlate(z, targetGroup) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, cageR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, cageR - 0.32, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PLATE_T,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 48,
    });
    geo.translate(0, 0, -PLATE_T / 2);
    const ring = new THREE.Mesh(geo, cagePlateMat);
    ring.position.z = z;
    ring.castShadow = true;
    ring.receiveShadow = true;
    targetGroup.add(ring);
    cagePlates.push(ring);
    for (let i = 0; i < 3; i++) {
      const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const spokeGeo = new THREE.BoxGeometry(cageR * 0.96, 0.32, 0.09);
      const spoke = new THREE.Mesh(spokeGeo, cagePlateMat);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * cageR * 0.48, Math.sin(a) * cageR * 0.48, z);
      spoke.castShadow = true;
      spoke.receiveShadow = true;
      targetGroup.add(spoke);
      cagePlates.push(spoke);
    }
  }
  makeCagePlate(zBot, bottomPlateGroup);
  makeCagePlate(zTop, topPlateGroup);
  cage.add(bottomPlateGroup);
  cage.add(topPlateGroup);

  const pillarH = zTop - zBot;
  for (let i = 0; i < 3; i++) {
    const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const cx = Math.cos(a) * (cageR - 0.28), cy = Math.sin(a) * (cageR - 0.28);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, pillarH, 14), steel);
    stem.rotation.x = Math.PI / 2;
    stem.position.set(cx, cy, (zBot + zTop) / 2);
    stem.castShadow = true;
    cage.add(stem);
    cagePillars.push(stem);
    for (const z of [zBot, zTop]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 14), steel);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(cx, cy, z > 0 ? z - 0.015 : z + 0.015);
      cap.castShadow = true;
      cage.add(cap);
      cagePillars.push(cap);
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.02, 10), axleMat);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(cx, cy, z > 0 ? z + PLATE_T / 2 + 0.04 : z - PLATE_T / 2 - 0.04);
      cage.add(screw);
      cagePillars.push(screw);
    }
  }

  function setCageOpacity(op) {
    const on = op < 1;
    cagePlateMat.transparent = on;
    cagePlateMat.opacity = op;
    cagePlateMat.depthWrite = !on;
    cagePlateMat.needsUpdate = true;
  }
  function setTopPlateVisible(v) { topPlateGroup.visible = v; }

  // ── Phasing the escape wheel: a tip against the entry pallet at β=0 ──
  const stepE = (2 * Math.PI) / escTeeth;
  escWheel.rotation.z = mod(escDirLocal + Math.PI + Math.PI / 6, stepE);

  // ── Beat kinematics (the same as in escapement.js) ──
  // Phase buffer: `update()` runs in the render loop, a new object per frame would be garbage.
  const phase = {};

  function update(t, beatHz, ampDeg) {
    const { thetaB, beta, forkAngle } = beatPhase(t, beatHz, ampDeg, escTeeth, phase);
    escSub.rotation.z = beta * escPerBeta;   // rolling around the fixed wheel
    fork.rotation.z = forkAngle;
    balance.rotation.z = thetaB;
    updateHair(thetaB);
    return beta;                // = θ_cage
  }
  update(0, 2.5, 220);

  // The socket is 'escapement'; which module stands in it is in variant.
  for (const g of [cage, fixed, bottomPlateGroup, topPlateGroup]) {
    tagModule(g, 'escapement');
    tagVariant(g, VARIANT_ID);
  }
  // The free-mode node knobs — see `lever.js`. The cage's transparency and the top
  // plate exist only here: they describe the cage itself, and the lever escapement has
  // no counterpart for them.
  const view = { cageOpacity: 1.0, topPlate: true };
  const nodes = [
    { kind: 'flag', labelKey: 'part.fixedWheel', obj: fixed, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.balance', obj: balance, prop: 'visible' },
    { kind: 'range', labelKey: 'gui.cageOpacity', obj: view, prop: 'cageOpacity',
      min: 0.15, max: 1.0, step: 0.05, onChange: setCageOpacity },
    { kind: 'flag', labelKey: 'gui.cageTopPlate', obj: view, prop: 'topPlate',
      onChange: setTopPlateVisible },
  ];

  // What the module DOES — as opposed to what it costs. Both numbers are derived from
  // the same constants that build the geometry; they cannot be typed in.
  const motion = { escapeTurns: 1 + escPerBeta, hasCage: true };

  return { cage, fixed, update, nodes, motion, balance, fork, escSub, hairGroup, cageR, balR,
           setCageOpacity, setTopPlateVisible, cagePlates, cagePillars, topPlateGroup, bottomPlateGroup };
}

function mod(a, m) { return ((a % m) + m) % m; }
