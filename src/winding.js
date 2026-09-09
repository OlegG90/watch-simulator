import * as THREE from 'three';
import { makeGear, makeBevelGear } from './gear.js';
import { AXLE_R, deg, dir2, mod, meshPhase, makeAxle, tagModule } from './common.js';

// ── Winding: crown → stem → bevel pair → crown wheel → ratchet ──
export const RATCHET_T = 28;
export const CROWN_T = 18;   // ratchet on the barrel arbor / crown wheel
export const BEVEL_W = 16;
export const BEVEL_P = 8;      // 90° bevel pair, 2:1
export const RATCH_M = 0.33;                 // module of the ratchet ↔ crown-wheel pair
export const CW_ANGLE = deg(225);            // direction of the winding node from the barrel
const WIND_Z = 2.6;                          // the winding deck (above the differential's hub wheel)
/** The module's Z levels — shared with the developed section. */
export const LAYERS = { deck: WIND_Z, apex: WIND_Z + 0.65 };
const CLICK_LIFT = 0.07;                     // the click's lift over a tooth, rad

// The pitch-cone angles complement each other: δ_w + δ_p = 90°, tan δ_w = Zw/Zp.
const DELTA_W = Math.atan(BEVEL_W / BEVEL_P); // ≈63.4° — the bevel wheel
const DELTA_P = Math.atan(BEVEL_P / BEVEL_W); // ≈26.6° — the pinion on the stem

/** Layout of the winding node (positions + contribution to the scene bounds). */
export function layoutWinding(barrelPos) {
  const cwPos = barrelPos.clone().add(dir2(CW_ANGLE).multiplyScalar(((RATCHET_T + CROWN_T) / 2) * RATCH_M));
  const bevelPinionPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.64)); // centre of the bevel pinion's rim
  const crownPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(5.6));        // the crown out at the edge
  const clickPivot = barrelPos.clone().add(dir2(deg(120)).multiplyScalar(6.0));
  return {
    cwPos, bevelPinionPos, crownPos, clickPivot,
    windZ: WIND_Z,
    extents: [
      { pos: cwPos, r: 3.4 },          // crown wheel + bevel wheel
      { pos: bevelPinionPos, r: 1.3 }, // bevel pinion on the stem
      { pos: crownPos, r: 1.5 },       // the winding crown
    ],
  };
}

/**
 * The winding meshes. A 90° bevel pair as in a real calibre: the apices of both
 * pitch cones meet at one point on the intersection of the axes (Z_APEX), so the
 * cones touch along a shared generator rather than at their edges.
 *
 * The click is winding's «non-return valve»: it lets rotation through in the
 * winding direction (jumping over the teeth) and blocks the spring from unwinding
 * back through the winding chain, so the spring's energy has one way out — the train.
 */
export function buildWinding({ steel, axleMat }, L, barrelPos) {
  const { cwPos, crownPos, clickPivot } = L;
  const group = new THREE.Group();
  const Z_APEX = WIND_Z + 0.65; // shared apex of the cones (spaced out for the spacer, B3)
  const stepBP = (2 * Math.PI) / BEVEL_P;
  const stepR = (2 * Math.PI) / RATCHET_T;

  // ── The ratchet on the barrel arbor (held by the click) — thickened, with a chamfer ──
  const ratchetG = new THREE.Group();
  ratchetG.position.set(barrelPos.x, barrelPos.y, 0);
  const ratchetMat = steel.clone();
  ratchetMat.color = new THREE.Color(0xa3adb8);
  ratchetMat.roughness = 0.28;
  ratchetMat.metalness = 0.92;
  const ratchet = makeGear(
    { teeth: RATCHET_T, module: RATCH_M, thickness: 0.72, bore: AXLE_R * 0.9, crossings: 5 }, ratchetMat
  );
  ratchet.position.z = WIND_Z;
  ratchetG.add(ratchet);
  // A decorative chamfer ring on top of the ratchet.
  const ratchetRim = new THREE.Mesh(new THREE.RingGeometry(RATCHET_T * RATCH_M / 2 - 0.35, RATCHET_T * RATCH_M / 2 + 0.02, 48), ratchetMat);
  ratchetRim.position.z = WIND_Z + 0.36;
  ratchetG.add(ratchetRim);
  group.add(ratchetG);

  // ── The crown node: flat crown wheel + spacer + bevel wheel coaxially on top (B3) ──
  const cwG = new THREE.Group();
  cwG.position.set(cwPos.x, cwPos.y, 0);
  const crownWheel = makeGear({ teeth: CROWN_T, module: RATCH_M, thickness: 0.5, bore: 0.2 }, steel);
  crownWheel.position.z = WIND_Z;
  cwG.add(crownWheel);
  // Spacer washer between the crown wheel and the bevel wheel (B3).
  const spacer = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 20), steel);
  spacer.rotation.x = Math.PI / 2;
  spacer.position.z = WIND_Z + 0.34;
  cwG.add(spacer);
  // A thin shim above the spacer.
  const spacerRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.85, 20), axleMat);
  spacerRing.position.z = WIND_Z + 0.42;
  cwG.add(spacerRing);
  const phiCW = meshPhase(CW_ANGLE, RATCHET_T, CROWN_T, 0);
  const bevelWheel = makeBevelGear(
    { teeth: BEVEL_W, module: RATCH_M, thickness: 0.45, bore: 0.2, pitchAngleDeg: (DELTA_W * 180) / Math.PI },
    steel
  );
  bevelWheel.position.z = Z_APEX;
  bevelWheel.rotation.z = mod(CW_ANGLE - phiCW, (2 * Math.PI) / BEVEL_W); // a space faces the line of contact
  cwG.add(bevelWheel);
  cwG.add(makeAxle({ r: 0.18, len: 2.35, z: WIND_Z + 0.32 }, axleMat));
  cwG.rotation.z = phiCW;
  group.add(cwG);

  // ── The click: a curved lever with a spring and a ruby tip ──
  const clickG = new THREE.Group();
  clickG.position.set(clickPivot.x, clickPivot.y, WIND_Z);
  {
    clickG.add(makeAxle({ r: 0.18, len: 1.4, z: -0.4 }, axleMat));
    const tip = barrelPos.clone().add(dir2(deg(104)).multiplyScalar(4.45));
    const d = tip.clone().sub(clickPivot);
    const L = d.length();
    const ang = Math.atan2(d.y, d.x);
    // A curved lever — Extrude with a bevel (rather than a Box).
    const clickShape = new THREE.Shape();
    clickShape.moveTo(0, -0.16);
    clickShape.lineTo(L * 0.72, -0.18);
    clickShape.lineTo(L, -0.10);
    clickShape.lineTo(L, 0.10);
    clickShape.lineTo(L * 0.72, 0.18);
    clickShape.lineTo(0, 0.16);
    clickShape.closePath();
    const clickGeo = new THREE.ExtrudeGeometry(clickShape, {
      depth: 0.30, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2,
    });
    clickGeo.translate(0, 0, -0.15);
    const clickBar = new THREE.Mesh(clickGeo, steel);
    clickBar.rotation.z = ang;
    clickBar.castShadow = true;
    clickBar.receiveShadow = true;
    clickG.add(clickBar);
    // The ruby stone on the click's tip.
    const clickRubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xc0304a, roughness: 0.12, metalness: 0.0,
      transmission: 0.28, thickness: 0.3, ior: 1.76,
      emissive: 0x1a050a, emissiveIntensity: 0.2,
    });
    const clickStone = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.32), clickRubyMat);
    clickStone.position.set(d.x, d.y, 0);
    clickG.add(clickStone);
    // The click spring — an arc from the back of the lever to the main plate.
    const springAnchor = new THREE.Vector2(-1.1, -0.9);
    const ctrl = new THREE.Vector2(L * 0.18, -0.85);
    const springCurve = new THREE.QuadraticBezierCurve(new THREE.Vector2(0, 0), ctrl, springAnchor);
    const springPts = springCurve.getPoints(10);
    const springShape = new THREE.Shape();
    springShape.moveTo(-0.06, 0);
    springShape.lineTo(0.06, 0);
    // the spring as a thin ribbon — extruded along a curve through Tube
    const springLine = new THREE.CatmullRomCurve3(springPts.map((p) => new THREE.Vector3(p.x, p.y, 0)));
    const springGeo = new THREE.TubeGeometry(springLine, 10, 0.04, 5, false);
    const springMat = steel.clone();
    springMat.roughness = 0.35;
    const springMesh = new THREE.Mesh(springGeo, springMat);
    clickG.add(springMesh);
  }
  group.add(clickG);

  // ── The bevel pinion on the stem: its cone apex is at the same Z_APEX point ──
  const pinionG = new THREE.Group();
  pinionG.position.set(cwPos.x, cwPos.y, Z_APEX);
  pinionG.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(Math.cos(CW_ANGLE), Math.sin(CW_ANGLE), 0)
  );
  const bevelPinion = makeBevelGear(
    { teeth: BEVEL_P, module: RATCH_M, thickness: 0.6, bore: 0.15, pitchAngleDeg: (DELTA_P * 180) / Math.PI },
    steel
  );
  const PSI_P = mod(CW_ANGLE + Math.PI - stepBP / 2, stepBP); // a pinion tooth into a wheel space
  bevelPinion.rotation.z = PSI_P;
  pinionG.add(bevelPinion);
  group.add(pinionG);

  // ── The horizontal stem from the pinion to the crown — one continuous shaft, no step ──
  const stemStart = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.2));
  const stemEnd = crownPos.clone();
  const stemLen = stemEnd.clone().sub(stemStart).length();
  const stemMid = stemStart.clone().add(stemEnd).multiplyScalar(0.5);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, stemLen + 0.5, 14),
    axleMat
  );
  stem.rotation.z = CW_ANGLE - Math.PI / 2;
  stem.position.set(stemMid.x, stemMid.y, Z_APEX);
  stem.castShadow = true;
  group.add(stem);

  const crownOrient = new THREE.Group();
  crownOrient.position.set(crownPos.x, crownPos.y, Z_APEX);
  crownOrient.rotation.z = CW_ANGLE - Math.PI / 2;
  // The crown as on the Reverso Gyrotourbillon: one solid cylinder with fine coin knurling.
  const crownBaseMat = steel.clone();
  crownBaseMat.roughness = 0.28;
  crownBaseMat.metalness = 0.92;
  const crownGroup = new THREE.Group();
  // The crown body — a single cylinder; the knurling is integrated as 36 thin ridges flush with the body.
  const crownCore = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 1.42, 40), crownBaseMat);
  crownCore.castShadow = true;
  crownCore.receiveShadow = true;
  crownGroup.add(crownCore);
  // Fine knurling — 36 narrow ridges along the Y axis (the crown's axis), sunk in so the body reads as one piece.
  const ridgeGeo = new THREE.BoxGeometry(0.06, 1.38, 0.045);
  for (let i = 0; i < 36; i++) {
    const a = (i * Math.PI * 2) / 36;
    const ridge = new THREE.Mesh(ridgeGeo, crownBaseMat);
    ridge.position.set(Math.cos(a) * 1.085, 0, Math.sin(a) * 1.085);
    ridge.rotation.y = -a;
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    crownGroup.add(ridge);
  }
  // The upper chamfer — a conical transition to the cap (Y axis).
  const topBevel = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 0.14, 40), crownBaseMat);
  topBevel.position.y = 0.71;
  topBevel.castShadow = true;
  crownGroup.add(topBevel);
  const botBevel = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.92, 0.14, 40), crownBaseMat);
  botBevel.position.y = -0.71;
  botBevel.castShadow = true;
  crownGroup.add(botBevel);
  // The cap — a flat polished disc flush with the chamfer, with an engraved logo.
  const capMat = steel.clone();
  capMat.roughness = 0.16;
  capMat.metalness = 0.96;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.05, 32), capMat);
  cap.position.y = 0.805;
  cap.castShadow = true;
  crownGroup.add(cap);
  // The engraving — a thin ring on the cap.
  const logoRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.36, 24), capMat);
  logoRing.rotation.x = Math.PI / 2;
  logoRing.position.y = 0.835;
  logoRing.rotation.z = 0.12;
  crownGroup.add(logoRing);
  // The gasket.
  const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.85, metalness: 0.05 });
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 20), gasketMat);
  gasket.rotation.x = Math.PI / 2;
  gasket.position.y = -0.79;
  crownGroup.add(gasket);
  // The crown turns about its own longitudinal Y axis (the stem's axis), so it is grouped through an intermediate node.
  const crown = new THREE.Group();
  crown.add(crownGroup);
  crownOrient.add(crown);
  group.add(crownOrient);

  // The stem/crown rotation accumulates separately: auto-wind does not add to it
  // (in a real automatic the winding crown does not turn).
  let crownSpin = 0, lastW = 0;

  /**
   * The node's pose from the ratchet angle `w`.
   * The «−» on the ratchet: the winding axis counter-rotates relative to the barrel's travel.
   *
   * `spinCrown = false` — auto-wind in real-time mode: the ratchet advances by itself
   * and the click ticks, but the stem and crown stay put.
   */
  function setAngle(w, { spinCrown = true } = {}) {
    const dw = w - lastW;
    lastW = w;
    ratchetG.rotation.z = -w;
    // The click jumps over the teeth: a slow lift with the tooth phase, a sharp drop (the «tick»).
    clickG.rotation.z = CLICK_LIFT * (mod(w, stepR) / stepR);
    if (!spinCrown) return;
    cwG.rotation.z = phiCW + w * (RATCHET_T / CROWN_T);            // crown wheel + bevel wheel
    crownSpin += dw * (RATCHET_T / CROWN_T) * (BEVEL_W / BEVEL_P); // the stem: 16 → 8 = ×2
    bevelPinion.rotation.z = PSI_P - crownSpin;
    crown.rotation.y = -crownSpin;
  }

  tagModule(group, 'winding');
  return { group, ratchet: ratchetG, click: clickG, crownWheelGroup: cwG, setAngle };
}
