import * as THREE from 'three';
import { wheelAngle, forkAngle, balanceAngle, activePallet } from './motion.js';
import { buildSpring, SPRING_R1 } from './spring.js';

/**
 * A self-contained model of the lever escapement — a separate exhibit, not a module of
 * the movement.
 *
 * Isolated by a decision made with the owner: no synchronisation with the escapement
 * socket, no embeddability, no shared builders. The file imports nothing but three —
 * any import from `movement/`, `escapement/` or `lesson/` would turn the showcase into
 * an appendage of the movement (a text test in `test/showcase.test.js` guards this).
 *
 * Layout (seen from above, the X axis is the line of centres):
 *   W=(0,0)     escape wheel, 15 club teeth, travel anticlockwise;
 *   P=(2.35,0)  the fork's pivot: pallets on both sides of the line of centres;
 *   B=(4.35,0)  the balance's axis: a roller with the impulse pin in the fork's slot.
 *
 * The Z stack (the true order of a Swiss escapement, not an invention):
 *   the wheel at z≈0 → the pallet stones in its plane → the fork's body higher
 *   (z≈0.85) → the roller below the fork, its pin reaching up into the slot → the
 *   balance above everything → the hairspring above the balance (z≈2.05), its outer
 *   end in a fixed stud.
 * The hairspring illustrates breathing, it does not model the regulator (see `spring.js`).
 *
 * The exact face angles are solved, not nominal: the stone stands as a column above the
 * wheel, the locking corner seats on the lock's tip (seatPallet), and the impulse face
 * then follows the tip's retreat. The geometry hands the phase machine the pivot groups
 * and the stones — it needs nothing else.
 */

export const TEETH = 15;
export const WHEEL_R = 1.5;
const WHEEL_ROOT = 0.95;
const WHEEL_T = 0.35;
/** A stick tooth: the width of tip/base and the lean with the travel, as fractions of a pitch. */
const CLUB_TOOTH = { tw: 0.18, bw: 0.3, lean: 0.5 };

/** W→P: the fork's pivot. P→B: the balance's axis (the fork's travel fits between them). */
export const FORK_D = 2.35;
export const BAL_D = 2.0;

/**
 * The stones stand as a column ABOVE the wheel and reach into the tooth band with the
 * locking corner only: the earlier seating (centre inside the band) hid a tip inside the
 * body (−0.46 at lock) — no rotation of the whole stone cured that, because the body is
 * 0.34×0.62 across the teeth's path. Contact is by corner A, with a micro-clearance EPS.
 *
 * The zone (an angle) says WHICH tip to catch: the one nearest the zone at the moment of
 * lock. The exact position and rotation come from seatPallet() solving for them rather
 * than from numbers: the corner seats on the tip, the face gets its DRAW.
 */
const PALLET_ANG = (26 * Math.PI) / 180;
const EXIT_ANG = (30.65 * Math.PI) / 180;
// Seating the drop (why the exit one is not a mirrored ±26°): the exit lock's zero minus
// the entry lock's zero must equal half a tooth — otherwise one phase does not seat both.
// Measured: 30.65° (zeros 22.45°/10.75°, a difference of 11.7° against the required 12° —
// the remaining 0.3° is split evenly by minimax). The anticlockwise direction of travel
// breaks the pair's mirror symmetry.
const JEWEL_W = 0.28;
const JEWEL_H = 0.62;
const JEWEL_T = 0.5;
/** The nominal draw angle of the locking face from the radius. */
const LOCK_DRAW = (10 * Math.PI) / 180;
/** The length of the locking bevel from the corner; beyond it, the impulse face. */
const LOCK_LEN = 0.07;
/** The impulse face's length: the tip slides down it for the whole unlocking. */
const IMP_LEN = 0.35;
/** The contact micro-clearance: the face touches, the bodies do not intersect. */
const SEAT_EPS = 0.004;
/**
 * The measured rotations of a stone in the fork's frame and the angles of the impulse
 * faces (local, from the outline's +x). Method: the scan .openchamber/seat10.mjs —
 * seating the corner on the lock's tip, minimax of the intersection over a FULL cycle
 * (the entry and exit halves separately — the optimum keeps the entry engagement).
 * Entry −31°/128° (cycle −0.024, against +0.025), exit −110°/122° (cycle −0.040, against
 * +0.058). What remains is a staged touch at the moment of drop/unlocking, not a pass
 * straight through: the bodies do not hide the teeth. The asymmetry comes from the teeth
 * leaning with the travel: there is no mirror here, just as there was none in the exit zone.
 */
const SEAT = {
  entry: { rot: (-31 * Math.PI) / 180, imp: (128 * Math.PI) / 180 },
  exit: { rot: (-110 * Math.PI) / 180, imp: (122 * Math.PI) / 180 },
};
/** The stone's geometry — for the seating tests, so the numbers are not duplicated. */
export const JEWEL_GEOM = { w: JEWEL_W, h: JEWEL_H, lean: Math.tan(LOCK_DRAW) * JEWEL_H, lockLen: LOCK_LEN };

/** The fork's body above the wheel; the roller's pin reaches up into the slot. */
const FORK_Z = 0.85;
const ROLLER_Z = 0.35;
const ROLLER_R = 0.55;
const PIN_R = 0.42;   // the impulse pin's orbit about the balance axis
const STONE_R = 0.09;

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * A stone's local outline: A (the locking corner) → K (the end of the bevel carrying the
 * draw) → M (the impulse face, along the tip's retreat — the direction measured by
 * tracing the relative motion, seat8.mjs: 134°/124°) → the outer body. The module's own
 * figure: the guards in the tests compose from it rather than duplicating the outline.
 */
export function palletOutline(imp) {
  const w = JEWEL_W / 2, h = JEWEL_H / 2;
  const lean = Math.tan(LOCK_DRAW) * JEWEL_H;
  const A = [-w, -h];
  const e = norm2([lean, 2 * h]);
  const K = [A[0] + (lean / e) * LOCK_LEN, A[1] + ((2 * h) / e) * LOCK_LEN];
  const M = [K[0] + Math.cos(imp) * IMP_LEN, K[1] + Math.sin(imp) * IMP_LEN];
  return [A, K, M, [-w + lean, h], [w, h - 0.3], [w, -h]];
}
const norm2 = ([x, y]) => Math.hypot(x, y);

/** A wheel tooth in the wheel's frame (the convex quad of the addendum): a figure for the guards. */
export function clubToothQuad(i) {
  const step = (Math.PI * 2) / TEETH;
  const { tw: TW, bw: BW, lean: LEAN } = CLUB_TOOTH;
  const a = i * step;
  return [
    polar(WHEEL_ROOT, a - (LEAN + BW / 2) * step),
    polar(WHEEL_R, a - (TW / 2) * step),
    polar(WHEEL_R, a + (TW / 2) * step),
    polar(WHEEL_ROOT, a - (LEAN - BW / 2) * step),
  ];
}

/**
 * Seating a stone in the fork's frame by solving: which tip — the one nearest the zone at
 * the moment of lock; corner A seats on it with a micro-clearance along the bevel's outer
 * normal; the rotation and the impulse are measured (SEAT). The fork's arms reach for that
 * same point, so the assembly does not drift away from the seating.
 */
function seatPallet(face) {
  // The exit zone is below the line of centres (−EXIT_ANG): the minus is left over from
  // the old `side`, and without it the seating catches a tooth of the upper half.
  const zone = face === 'entry' ? PALLET_ANG : -EXIT_ANG;
  const lockU = face === 'entry' ? 0.5 : 1.5;
  const { rot, imp } = SEAT[face];
  const wAng = wheelAngle(lockU), fAng = forkAngle(lockU);
  const step = (Math.PI * 2) / TEETH;
  let tip = 0, best = Infinity;
  for (let i = 0; i < TEETH; i++) {
    // A full circle, not mod the pitch: (zone − tooth_i) mod pitch does not depend on i.
    const raw = (zone - (wAng + i * step)) % (Math.PI * 2);
    const d = Math.abs(raw > Math.PI ? raw - Math.PI * 2 : raw < -Math.PI ? raw + Math.PI * 2 : raw);
    if (d < best) { best = d; tip = i; }
  }
  const T = polar(WHEEL_R, wAng + tip * step);
  // The outer normal comes from the bevel A→K itself, not from the lean formula: one source.
  const [A, K] = palletOutline(imp);
  const ex = K[0] - A[0], ey = K[1] - A[1];
  const el = Math.hypot(ex, ey);
  let nl = [ey / el, -ex / el];
  if (nl[0] * (0 - A[0]) + nl[1] * (-0.075 - A[1]) > 0) nl = [-nl[0], -nl[1]];
  const nw = rot2(rot2(nl, rot), fAng);
  const target = [T[0] - SEAT_EPS * nw[0], T[1] - SEAT_EPS * nw[1]];
  const rel = rot2([target[0] - FORK_D, target[1]], -fAng);
  const off = rot2(A, rot);
  return { x: rel[0] - off[0], y: rel[1] - off[1], rot, imp, tip };
}

/**
 * The lock phase: a constant extra rotation of the wheel, so a tip seats on the locking
 * face. Measured by minimax over both locks (between them the wheel travels exactly half
 * a tooth — the exit one is measured at δ + half a pitch): 22.58°, residual 0.004. At zero
 * the tip stands half a pitch past the stone. Staging of the first frame, not physics.
 */
export const WHEEL_LOCK_PHASE = 0.3941;

/** A box between two XY points at a given height. */
function bar(from, to, w, t, z, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, z);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * The wheel with stick teeth: thin long trapezoids leaning in the direction of travel
 * (travel is anticlockwise, +angle): the base thicker, the tip a little narrower, the base
 * shifted back by half a pitch — so the stick leads with its tip along the travel; between
 * the teeth, a symmetrical valley with a dip.
 *
 * The middle of a tip stays exactly at (WHEEL_R, i·pitch): the lock seating is measured
 * along that alone, so re-profiling the faces and valleys does not disturb it.
 */
function makeClubWheel(material) {
  const step = (Math.PI * 2) / TEETH;
  // Fractions of a pitch: TW — the tip's width, BW — the base's width, LEAN — the base's
  // shift backwards (the stick's lean with the travel). The numbers live in CLUB_TOOTH: the
  // wheel's outline and the quad for the guards come from one source, otherwise the test
  // checks a healthy copy.
  const { tw: TW, bw: BW, lean: LEAN } = CLUB_TOOTH;
  const VALLEY_R = WHEEL_ROOT * 0.88;
  const shape = new THREE.Shape();
  for (let i = 0; i < TEETH; i++) {
    const a = i * step;
    const tbc = polar(WHEEL_ROOT, a - (LEAN + BW / 2) * step); // the trailing base
    const ttc = polar(WHEEL_R, a - (TW / 2) * step); // the trailing corner of the tip
    const ltc = polar(WHEEL_R, a + (TW / 2) * step); // the leading corner of the tip
    const lbc = polar(WHEEL_ROOT, a - (LEAN - BW / 2) * step); // the leading base
    const dip = polar(VALLEY_R, a + (0.5 - LEAN) * step); // the bottom of the valley
    if (i === 0) shape.moveTo(...tbc);
    else shape.lineTo(...tbc); // the trailing face up to the tip
    shape.lineTo(...ttc);
    shape.lineTo(...ltc); // the flat tip, its middle exactly at (WHEEL_R, a)
    shape.lineTo(...lbc); // the leading face down
    shape.lineTo(...dip); // the valley across to the next tooth
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  for (let i = 0; i < 4; i++) {
    const seg = (Math.PI * 2) / 4;
    const w = new THREE.Path();
    w.absarc(0, 0, 0.55, i * seg + 0.3, (i + 1) * seg - 0.3, false);
    w.lineTo(...polar(0.7, (i + 1) * seg - 0.3));
    w.absarc(0, 0, 0.7, (i + 1) * seg - 0.3, i * seg + 0.3, true);
    w.closePath();
    shape.holes.push(w);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WHEEL_T, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -WHEEL_T / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.club = { teeth: TEETH, outerR: WHEEL_R, rootR: WHEEL_ROOT };
  return mesh;
}

/**
 * A pallet stone as a broken outline: the locking bevel with its draw, the impulse face
 * along the tip's retreat, and a blind outer body. Both stones have the same shape (a
 * mirrored one would present a blind back — the exit seating then met at no phase at all);
 * the orientation comes from the seating's rotation, not from the shape.
 */
function makePallet(material, imp) {
  const pts = palletOutline(imp);
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: JEWEL_T, bevelEnabled: false });
  geo.translate(0, 0, -JEWEL_T / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function buildShowcase() {
  const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x555a62, roughness: 0.4, metalness: 0.8 });
  const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });
  const ruby = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: 0.4, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
  });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.85, metalness: 0.2 });

  const group = new THREE.Group();
  const V2 = (x, y) => new THREE.Vector2(x, y);

  // ── The stand: a museum plinth, not a main plate ──
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.5, 1.0, 48), stoneMat);
  pedestal.position.y = -3.2;
  pedestal.receiveShadow = true;
  group.add(pedestal);
  // Slim posts up to the three axes — the exhibit stands in the open, not in a slab.
  const pillar = (x, top) => {
    const h = top + 2.7;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 10), darkSteel);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 0, -2.7 + h / 2);
    m.castShadow = true;
    group.add(m);
  };
  pillar(0, -0.3);
  pillar(FORK_D, 0.7);
  pillar(FORK_D + BAL_D, -0.3);

  // ── The escape wheel on its own axis ──
  const wheelPivot = new THREE.Group();
  const wheel = makeClubWheel(brass);
  wheelPivot.add(wheel);
  const wheelAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 12), darkSteel);
  wheelAxle.rotation.x = Math.PI / 2;
  wheelAxle.position.z = -0.3;
  wheelPivot.add(wheelAxle);
  group.add(wheelPivot);

  // ── The fork: pivot, arms out to the stones, tail with the slot for the roller ──
  const forkPivot = new THREE.Group();
  forkPivot.position.set(FORK_D, 0, 0);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16), steel);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = FORK_Z;
  boss.castShadow = true;
  forkPivot.add(boss);

  const jewels = {};
  const jewelZ = 0.1;
  // Each stone's seating is a solution of seatPallet(): the corner on the lock's tip.
  // The arms reach for that same point — the assembly does not drift from the seating.
  for (const face of ['entry', 'exit']) {
    const seat = seatPallet(face);
    // The stone's material is its own instance: highlighting the active pair dims and
    // lights the stones separately, which a shared material cannot do.
    const stone = makePallet(ruby.clone(), seat.imp);
    stone.position.set(seat.x, seat.y, jewelZ);
    stone.rotation.z = seat.rot;
    stone.userData.pallet = { face, imp: seat.imp };
    forkPivot.add(stone);
    jewels[face] = stone;
    // The arm: a horizontal bar in the fork's plane + a post down to the stone.
    const top = V2(seat.x, seat.y);
    forkPivot.add(bar(V2(0, 0), top, 0.24, 0.26, FORK_Z, steel));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, FORK_Z - jewelZ), steel);
    post.position.set(top.x, top.y, (FORK_Z + jewelZ) / 2);
    post.castShadow = true;
    forkPivot.add(post);
  }
  // The tail out to the roller: the slot embraces the impulse pin.
  const tailEnd = FORK_D + BAL_D - PIN_R; // the world X of the roller's pin
  forkPivot.add(bar(V2(0.3, 0), V2(tailEnd - FORK_D - 0.15, 0), 0.26, 0.26, FORK_Z, steel));
  for (const s of [1, -1]) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.26), steel);
    horn.position.set(tailEnd - FORK_D + 0.1, s * 0.165, FORK_Z);
    horn.castShadow = true;
    forkPivot.add(horn);
  }
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), darkSteel);
  guard.rotation.x = Math.PI / 2;
  guard.position.set(tailEnd - FORK_D - 0.35, 0, FORK_Z);
  forkPivot.add(guard);
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16), steel);
  counter.rotation.x = Math.PI / 2;
  counter.position.set(-0.55, 0, FORK_Z);
  counter.castShadow = true;
  forkPivot.add(counter);
  group.add(forkPivot);

  // ── The banking pins for the fork's travel — fixed, the tail strikes them ──
  // The position follows the swing: half the tail's width + arm·tan(FORK_MAX).
  for (const s of [1, -1]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), darkSteel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(FORK_D + 1.0, s * 0.2, FORK_Z);
    group.add(pin);
  }

  // ── The balance: arbor, roller with its pin, rim. No hairspring — see the header ──
  const balancePivot = new THREE.Group();
  balancePivot.position.set(FORK_D + BAL_D, 0, 0);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 12), darkSteel);
  staff.rotation.x = Math.PI / 2;
  staff.position.z = 0.9;
  balancePivot.add(staff);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, 0.18, 32), steel);
  roller.rotation.x = Math.PI / 2;
  roller.position.z = ROLLER_Z;
  roller.castShadow = true;
  balancePivot.add(roller);
  const jewel = new THREE.Mesh(new THREE.CylinderGeometry(STONE_R, STONE_R, 0.7, 10), ruby);
  jewel.rotation.x = Math.PI / 2;
  jewel.position.set(-PIN_R, 0, 0.7);
  jewel.castShadow = true;
  balancePivot.add(jewel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 14, 56), brass);
  rim.position.z = 1.55;
  rim.castShadow = true;
  balancePivot.add(rim);
  // The rim is two halves of pins: each semicircle carries groups of 2, 3 and 4 pins with
  // a gap between groups (cf. the demonstration model). Each half is centred in its own
  // semicircle, so the joint between the halves stays clear.
  const pinGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10);
  const groupSizes = [2, 3, 4];
  const pitch = 0.16; // the step inside a group
  const gap = 0.5;    // the gap between groups
  const totalPins = groupSizes.reduce((s, n) => s + n, 0);
  const span = (totalPins - 1) * pitch + (groupSizes.length - 1) * gap;
  for (const start of [0, Math.PI]) {
    let a = start + (Math.PI - span) / 2;
    for (const n of groupSizes) {
      for (let i = 0; i < n; i++) {
        const pin = new THREE.Mesh(pinGeo, brass);
        pin.position.set(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 1.55);
        pin.rotation.z = a - Math.PI / 2; // the axis along the radius
        pin.castShadow = true;
        balancePivot.add(pin);
        a += pitch;
      }
      a += gap;
    }
  }
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.15, 0.15), brass);
    spoke.rotation.z = a;
    spoke.position.z = 1.55;
    spoke.castShadow = true;
    balancePivot.add(spoke);
  }
  group.add(balancePivot);

  // ── The hairspring: it breathes with the balance; a bridge holds the outer end ──
  // The bridge starts at the fork's fixed axis (its boss turns about it): a post upwards,
  // an arm over the hairspring, and a dropped pin down to the stud of the outer end.
  const SPRING_Z = 2.05;
  const balX = FORK_D + BAL_D;
  const studX = balX + SPRING_R1;
  const spring = buildSpring({ cx: balX, cy: 0, z: SPRING_Z, material: springSteel });
  group.add(spring.mesh);
  const collet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), darkSteel);
  collet.rotation.x = Math.PI / 2;
  collet.position.z = SPRING_Z;
  balancePivot.add(collet); // the collet sits on the arbor — it travels with the balance
  const arborUp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), darkSteel);
  arborUp.rotation.x = Math.PI / 2;
  arborUp.position.set(FORK_D, 0, 1.5);
  group.add(arborUp);
  group.add(bar(V2(FORK_D, 0), V2(studX, 0), 0.14, 0.12, 2.3, steel));
  const dropPin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), darkSteel);
  dropPin.rotation.x = Math.PI / 2;
  dropPin.position.set(studX, 0, 2.15);
  group.add(dropPin);
  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), darkSteel);
  stud.position.set(studX, 0, SPRING_Z);
  stud.castShadow = true;
  group.add(stud);

  // The first frame's seating — a lock on the entry pallet (u=0.5: a half-integer is a
  // locked state, the wheel's phase exactly WHEEL_LOCK_PHASE, the highlight already on it).
  update(0.5);

  group.visible = false;

  const home = {
    pos: new THREE.Vector3(5.2, 2.6, 8.0),
    target: new THREE.Vector3(2.0, 0, 0.2),
  };

  /**
   * The showcase's step: the pose at phase time `u` (beats) — wheel, fork, balance and the
   * highlight on the active pair. A pure function of time: the panel's pause and stepping
   * are a stop and a manual advance of `u`, and no state accumulates anywhere.
   */
  function update(u) {
    const bal = balanceAngle(u);
    wheelPivot.rotation.z = wheelAngle(u);
    forkPivot.rotation.z = forkAngle(u);
    balancePivot.rotation.z = bal;
    spring.update(bal);
    const active = activePallet(u);
    for (const [face, stone] of Object.entries(jewels))
      stone.material.emissiveIntensity = face === active ? 0.9 : 0.25;
  }

  return { group, home, update, wheelPivot, forkPivot, balancePivot, jewels };
}
