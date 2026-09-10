import * as THREE from 'three';
import { makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';
import { buildHairspring } from './hairspring.js';
import { buildBalanceWheel } from './balance.js';

/**
 * The Swiss lever escapement — the simplest module in the socket.
 *
 * There is no cage: the escape wheel sits directly on the escape arbor (`arbor4`),
 * so it turns by exactly β. The fork and the balance stand on the plate and turn
 * about their own axes.
 *
 * WHAT SWAPS PLACES. In the tourbillon the balance stands at the centre of the
 * arbor, while the escape wheel is offset by 2.6 and rolls around the fixed wheel.
 * Here it is the other way round: the escape wheel occupies the centre (otherwise
 * the train would not drive it), and the balance is offset by that same distance.
 * The same parts with their roles swapped — that is what the swap shows.
 *
 * ASSUMPTION: in a real lever escapement the balance stands further from the escape
 * wheel. We keep it at 2.6 with a radius of 1.95 — exactly as in the tourbillon —
 * so that nothing but the node's construction itself moves on a swap.
 */

/** The variant's identifier in the escapement socket. */
export const VARIANT_ID = 'lever';

/** Local Z levels (from the socket's base). There are no plates — hence the low silhouette. */
export const LAYERS = { escape: 0.55, fork: 0.95, balance: 1.75, hair: 2.25 };

/** The balance's offset from the escape arbor — where the tourbillon keeps its escape wheel. */
export const BALANCE_OFF = 2.6;
/** The balance rim's radius — deliberately the same as in the tourbillon (see the assumption). */
export const BALANCE_R = 1.95;

/** The escape wheel's radius — the same as in the tourbillon cage. */
export const ESC_R = 1.5;

/**
 * The lock phase: a constant extra rotation of the wheel, so that in the locked
 * states a tooth tip stands on the active pallet's stone. The wheel advances half a
 * step per beat and the pallets are mirrored — one constant serves both, with a
 * spread of ±1.6° from the centre of the stone (the stone's half-width is ~6°, so
 * the tip stays on it). This is not contact physics but staging: β and the motion
 * curves are untouched.
 */
export const ESC_LOCK_PHASE = Math.PI / 10;

const PALLET_HALF = (30 * Math.PI) / 180; // pallets at ±30° from the line of centres
const ROLLER_R = 0.55;                    // radius of the roller carrying the impulse pin

/** The fork's pivot — between the escape wheel and the balance. */
export const FORK_PIVOT = BALANCE_OFF * 0.48;
/** The fork's furthest point from its pivot — the section takes its half-width from here. */
export const FORK_REACH = BALANCE_OFF - FORK_PIVOT - ROLLER_R;

/**
 * Body thicknesses. The same numbers go into the meshes and into the section — until
 * now the section had its own eyeballed ±0.18 / ±0.14 / ±0.1, and they had already
 * drifted away from the meshes.
 */
const T = { escape: 0.35, fork: 0.4, balRim: 0.18 };

const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/**
 * What the variant says about itself in the section — before any mesh exists.
 *
 * `u` is measured from the escape arbor, `z` from the socket's base (`zBase` is added
 * by the composer). Three bodies at their heights, no plates — hence the low flat silhouette.
 */
export function profile(zBase = 0) {
  const band = (z, half) => ({ z0: zBase + z - half, z1: zBase + z + half });
  return {
    parts: [
      { anchor: 'escape', u: 0, ...band(LAYERS.escape, T.escape / 2), r: ESC_R, kind: 'wheel', labelKey: `part.${VARIANT_ID}` },
      { anchor: 'escape', u: FORK_PIVOT, ...band(LAYERS.fork, T.fork / 2), r: FORK_REACH, kind: 'flat' },
      { anchor: 'escape', u: BALANCE_OFF, ...band(LAYERS.balance, T.balRim), r: BALANCE_R, kind: 'flat' },
    ],
  };
}

/** A box between two points in the XY plane (the fork's arms and stem). */
function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

export function buildLever(
  { steel, brass, springSteel, axleMat },
  { escTeeth = 15, escR = ESC_R, escDirLocal = 0 }
) {
  const rotating = new THREE.Group(); // on the escape arbor — turns by β
  const fixed = new THREE.Group();    // on the plate — its own axes of rotation

  // ── The escape wheel: at the centre of the arbor, rigidly on it ──
  const escWheel = makeEscapeWheel(
    { teeth: escTeeth, outerR: escR, rootR: escR - 0.5, thickness: T.escape, bore: 0.18, crossings: 3 },
    brass
  );
  escWheel.position.z = LAYERS.escape;
  escWheel.rotation.z = ESC_LOCK_PHASE; // lock phase — a tip on a pallet, not between teeth
  rotating.add(escWheel);
  const escAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10), axleMat);
  escAxle.rotation.x = Math.PI / 2;
  escAxle.position.z = LAYERS.escape - 0.2;
  rotating.add(escAxle);

  const balCenter = dir2(escDirLocal).multiplyScalar(BALANCE_OFF);

  // ── The fork: between the escape wheel and the balance ──
  // Ruby pallets — a physical material with refraction, as in the tourbillon: a stone
  // should let light through rather than be a matte block.
  const palletMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: T.fork, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  const impulseRubyMat = palletMat.clone();
  impulseRubyMat.emissiveIntensity = 0.18;

  const fork = new THREE.Group();
  const forkPivot = dir2(escDirLocal).multiplyScalar(FORK_PIVOT);
  fork.position.set(forkPivot.x, forkPivot.y, LAYERS.fork);
  {
    for (const s of [+1, -1]) {
      // A point on the escape wheel's rim (its centre is the origin).
      const rimPt = dir2(escDirLocal + s * PALLET_HALF).multiplyScalar(escR - 0.12);
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.3, 0.28, steel));
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
      stone.rotation.z = escDirLocal + s * PALLET_HALF;
      stone.castShadow = true;
      fork.add(stone);
    }
    // The stem out to the balance roller, plus the horns.
    const stemEnd = dir2(escDirLocal).multiplyScalar(FORK_REACH);
    fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.26, 0.28, steel));
    for (const s of [+1, -1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.28), steel);
      const perp = dir2(escDirLocal + Math.PI / 2).multiplyScalar(s * 0.22);
      horn.position.set(stemEnd.x + perp.x, stemEnd.y + perp.y, 0);
      horn.rotation.z = escDirLocal;
      horn.castShadow = true;
      fork.add(horn);
    }
    const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.3, 12), axleMat);
    forkAxle.rotation.x = Math.PI / 2;
    fork.add(forkAxle);
  }
  fixed.add(fork);

  // ── The balance: offset by BALANCE_OFF, the same size as in the tourbillon ──
  const balance = new THREE.Group();
  balance.position.set(balCenter.x, balCenter.y, LAYERS.balance);
  const balR = BALANCE_R;
  // The wheel itself comes from the one builder every module shares: it is the same
  // balance by decision, and building it here again is how «the same» stops being true.
  balance.add(buildBalanceWheel({ radius: balR, brass, steel }));
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 12), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.5;
  balance.add(balAxle);
  // The impulse pin on the roller — it faces the fork.
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10), impulseRubyMat);
  pin.rotation.x = Math.PI / 2;
  const pinPos = dir2(escDirLocal + Math.PI).multiplyScalar(ROLLER_R);
  pin.position.set(pinPos.x, pinPos.y, -0.45);
  pin.castShadow = true;
  balance.add(pin);
  fixed.add(balance);

  // ── The hairspring: above the balance, the shared module ──
  const hair = buildHairspring({ balR, dirAngle: escDirLocal, springSteel, steel });
  hair.group.position.set(balCenter.x, balCenter.y, LAYERS.hair);
  fixed.add(hair.group);

  const phase = {};

  function update(t, beatHz, ampDeg) {
    const { thetaB, beta, forkAngle } = beatPhase(t, beatHz, ampDeg, escTeeth, phase);
    // The escape wheel has no angle of its own: it is rigid on the arbor, and the
    // arbor is already turned by β. That is why it makes a turn in 12 s rather than in
    // 6, as in the tourbillon, where it rides the cage and adds the cage's turn to its own.
    fork.rotation.z = forkAngle;
    balance.rotation.z = thetaB;
    hair.update(thetaB);
    return beta;
  }
  update(0, 2.5, 220);

  for (const g of [rotating, fixed]) {
    tagModule(g, 'escapement');
    tagVariant(g, VARIANT_ID);
  }

  // The free-mode node knobs. The variant declares them itself: the composer must not
  // know what stands in the socket, and until now the panel addressed the tourbillon by
  // name — so that module's parts could be shown beside somebody else's.
  const nodes = [
    { kind: 'flag', labelKey: 'part.escapeWheel', obj: escWheel, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.fork', obj: fork, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.balance', obj: balance, prop: 'visible' },
  ];

  // The escape wheel sits directly on the escape arbor — exactly one turn per turn of
  // the arbor; there is no cage, so there is no cage period either.
  const motion = { escapeTurns: 1, hasCage: false };

  return { rotating, fixed, update, nodes, motion, balance, fork, escWheel, hairGroup: hair.group, balR };
}
