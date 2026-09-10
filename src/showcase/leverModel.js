import * as THREE from 'three';
import { pose } from './motion.js';
import {
  TEETH, WHEEL_R, WHEEL_ROOT, PITCH, FORK_D, BAL_D, LEVER_HALF,
  NOTCH_D, NOTCH_HALF, NOTCH_DEPTH, PIN_ORBIT, PIN_R, SAFETY_R, GUARD_R, GUARD_D,
  toothPoly, stonePoly, faceLocus, polar,
} from './design.js';
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
 *   B=(4.35,0)  the balance's axis: the wheel with its roller table, the impulse pin
 *               hanging from the table down into the fork's slot.
 *
 * The Z stack (the true order of a Swiss escapement, not an invention):
 *   the wheel at z≈0 → the pallet stones in its plane → the fork's body higher
 *   (z≈0.85) → the balance wheel above it, its roller table carrying the impulse
 *   pin down into the slot → the hairspring above the balance (z≈2.05), its outer
 *   end in a fixed stud.
 * The hairspring illustrates breathing, it does not model the regulator (see `spring.js`).
 *
 * **Nothing about the escapement's geometry is decided in this file.** The teeth, the
 * pallet stones, the notch, the pin and their clearances all come from `design.js`, which
 * traces the pallets from the action they have to perform. This file gives those outlines
 * a thickness, hangs them off the right pivots and lights the stone that is working.
 * Where a number appears below it is a number about the MODEL — how tall the plinth is,
 * how thick the rim reads — never about the escapement.
 */

export { TEETH, WHEEL_R, FORK_D, BAL_D };

// Numbers about the MODEL, not about the escapement: how thick a part reads, how high it
// sits. The escapement's own figures live in design.js.
const WHEEL_T = 0.35;
/** The fork's body above the wheel; the roller's pin hangs down into its notch. */
const FORK_Z = 0.85;
/** The balance wheel's plane: the rim, the roller table as its centre, and the spokes. */
const RIM_Z = 1.55;
const BAL_RIM_R = 1.75;
/** The rim's rectangular section: half the radial width and half the height. */
const RIM_HALF = 0.06;
const RIM_H_HALF = 0.11;
/** The stone's thickness across the wheel's plane, and how high it hangs. */
const STONE_T = 0.5;
const STONE_Z = 0.1;
/** The impulse pin hangs from the roller table down into the notch at FORK_Z. */
const PIN_TOP = RIM_Z - 0.09;
const PIN_BOTTOM = 0.4;

const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

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
 * the teeth, a symmetrical valley with a dip. The outer TIP of the height stands radial:
 * the end of each tooth straightens instead of leaning.
 *
 * The middle of a tip stays exactly at (WHEEL_R, i·pitch): the lock seating is measured
 * along that alone, so re-profiling the faces and valleys does not disturb it.
 */
function makeClubWheel(material) {
  const step = PITCH;
  // The outline comes from design.toothPoly(): the wheel's shape, the contact solution and
  // the tests all read the same polygon, so none of them can check a healthy copy.
  const LEAN = 0.5;                       // the valley's dip follows the stick's lean
  const VALLEY_R = WHEEL_ROOT * 0.88;
  const shape = new THREE.Shape();
  for (let i = 0; i < TEETH; i++) {
    const a = i * step;
    const [tbc, tkn, heel, toeC, lkn, lbc] = toothPoly(i);
    const dip = polar(VALLEY_R, a + (0.5 - LEAN) * step); // the bottom of the valley
    if (i === 0) shape.moveTo(...tbc);
    else shape.lineTo(...tbc); // the trailing face up to the bend
    shape.lineTo(...tkn);
    shape.lineTo(...heel);  // the heel: where the tooth's own impulse plane starts
    shape.lineTo(...toeC);  // up the impulse plane to the toe, the leading corner
    shape.lineTo(...lkn);   // the radial end down
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
 * A pallet stone, extruded from the outline `design.js` traced for it. The outline is
 * already in the lever's frame, so the stone needs no seating of its own: it is added to
 * the fork's group where it stands.
 */
function makeStone(material, face) {
  const pts = stonePoly(face);
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: STONE_T, bevelEnabled: false });
  geo.translate(0, 0, -STONE_T / 2);
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

  // ── The fork: one lever stamping — pivot boss, tapered pallet arms, a tapering
  // shank with the fork slot, the counterweight lobe. Same steel at the same height
  // throughout, so the overlapping plates read as one forging (their thicknesses
  // differ by a hundredth — shared faces are never coplanar). The stones keep their
  // solved seats; the arms only reach for them.
  const forkPivot = new THREE.Group();
  forkPivot.position.set(FORK_D, 0, 0);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16), steel);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = FORK_Z;
  boss.castShadow = true;
  forkPivot.add(boss);

  // A flat plate from a corner list, at the fork's height.
  const plate = (pts, t) => {
    const s = new THREE.Shape();
    s.moveTo(...pts[0]);
    for (const p of pts.slice(1)) s.lineTo(...p);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -t / 2);
    const m = new THREE.Mesh(g, steel);
    m.position.z = FORK_Z;
    m.castShadow = true;
    return m;
  };
  // The shank: the counterweight lobe behind the pivot, tapering out to the notch.
  const notchMouth = NOTCH_D - NOTCH_DEPTH;
  forkPivot.add(plate([[-0.95, 0.3], [notchMouth, 0.12], [notchMouth, -0.12], [-0.95, -0.3]], 0.24));

  const jewels = {};
  // The stones stand where design.js traced them; the arms are built to reach that same
  // place, so the assembly cannot drift away from the geometry it is drawn from.
  for (const face of ['entry', 'exit']) {
    // The stone's material is its own instance: highlighting the working stone dims and
    // lights them separately, which a shared material cannot do.
    const stone = makeStone(ruby.clone(), face);
    stone.position.z = STONE_Z;
    stone.userData.pallet = { face };
    forkPivot.add(stone);
    jewels[face] = stone;
    const corner = faceLocus(face).corner;
    const l = Math.hypot(corner[0], corner[1]);
    const nx = -corner[1] / l, ny = corner[0] / l;                 // across the arm
    const bx = (-corner[0] / l) * 0.1, by = (-corner[1] / l) * 0.1; // rooted behind the pivot
    forkPivot.add(plate(
      [[bx + nx * 0.19, by + ny * 0.19],
       [corner[0] + nx * 0.13, corner[1] + ny * 0.13],
       [corner[0] - nx * 0.13, corner[1] - ny * 0.13],
       [bx - nx * 0.19, by - ny * 0.19]], 0.26));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, FORK_Z - STONE_Z), steel);
    post.position.set(corner[0], corner[1], (FORK_Z + STONE_Z) / 2);
    post.castShadow = true;
    forkPivot.add(post);
  }
  // The notch: two prongs with the slot between them. Its half-width and its depth are the
  // ones the contact is solved with — the pin drives the lever by touching these flanks,
  // so a prong drawn anywhere else would be a picture of a different escapement.
  for (const s of [1, -1]) {
    forkPivot.add(plate([
      [notchMouth, s * (NOTCH_HALF + 0.13)],
      [NOTCH_D + 0.12, s * (NOTCH_HALF + 0.13)],
      [NOTCH_D + 0.12, s * NOTCH_HALF],
      [notchMouth + 0.04, s * NOTCH_HALF],
    ], 0.26));
  }
  // The guard pin, with its true clearance to the safety roller. It does not act yet — the
  // safety action is its own piece of work — but it stands where it would.
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(GUARD_R, GUARD_R, 0.34, 10), darkSteel);
  guard.rotation.x = Math.PI / 2;
  guard.position.set(GUARD_D, 0, FORK_Z);
  forkPivot.add(guard);
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16), steel);
  counter.rotation.x = Math.PI / 2;
  counter.position.set(-0.55, 0, FORK_Z);
  counter.castShadow = true;
  forkPivot.add(counter);
  group.add(forkPivot);

  // ── The banking bridge: the limiting pins stand on it, not in the air. Two slim
  // bars under the pins, joined at the fork's post into a U. The fork's side carries
  // it: the balance side is swept by the impulse pin's orbit (from x≈3.93), so there
  // is nothing to stand on there. Tops at 0.60 — clear of the rocking fork above (the
  // boss from 0.65) and ending short of the pin's orbit ahead.
  // The pins' position follows the swing: half the tail's width + arm·tan(FORK_MAX).
  const bridgeBar = (w, d, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, 0.12), steel);
    m.position.set(x, y, 0.54);
    m.castShadow = true;
    group.add(m);
  };
  bridgeBar(1.45, 0.12, 3.025, 0.2);
  bridgeBar(1.45, 0.12, 3.025, -0.2);
  bridgeBar(0.18, 0.64, FORK_D, 0); // the cross-piece embracing the fork's post
  // The pins stand where the shank reaches them at the end of its travel: half the shank's
  // width plus the arm times the tangent of the swing. Move the swing and they follow.
  const bankArm = 1.0;
  for (const s of [1, -1]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), darkSteel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(FORK_D + bankArm, s * (0.12 + bankArm * Math.tan(LEVER_HALF)), FORK_Z);
    group.add(pin);
  }

  // ── The balance: one assembly on the staff — the rim, the roller table as its
  // centre, and the impulse pin hanging from the table down into the fork's slot.
  // The pin's orbit is unchanged, so the fork needs nothing new.
  const balancePivot = new THREE.Group();
  balancePivot.position.set(FORK_D + BAL_D, 0, 0);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 12), darkSteel);
  staff.rotation.x = Math.PI / 2;
  staff.position.z = 0.9;
  balancePivot.add(staff);
  // The roller table carries the impulse pin; below it the safety roller, whose radius and
  // clearance the guard pin is built to (design.js). Both turn with the balance.
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(PIN_ORBIT + 0.16, PIN_ORBIT + 0.16, 0.18, 32), steel);
  roller.rotation.x = Math.PI / 2;
  roller.position.z = RIM_Z;
  roller.castShadow = true;
  balancePivot.add(roller);
  const safety = new THREE.Mesh(new THREE.CylinderGeometry(SAFETY_R, SAFETY_R, 0.16, 32), steel);
  safety.rotation.x = Math.PI / 2;
  safety.position.z = FORK_Z;
  safety.castShadow = true;
  balancePivot.add(safety);
  const jewel = new THREE.Mesh(new THREE.CylinderGeometry(PIN_R, PIN_R, PIN_TOP - PIN_BOTTOM, 12), ruby);
  jewel.rotation.x = Math.PI / 2;
  jewel.position.set(-PIN_ORBIT, 0, (PIN_TOP + PIN_BOTTOM) / 2);
  jewel.castShadow = true;
  balancePivot.add(jewel);
  // The rim is a rectangular band, not a round wire: an extruded annulus, so the
  // section reads as a machined rim. Outer and inner radii match the old tube's
  // envelope (BAL_RIM_R ± RIM_HALF), hence the spokes and the timing pins need nothing new.
  const rimShape = new THREE.Shape();
  rimShape.absarc(0, 0, BAL_RIM_R + RIM_HALF, 0, Math.PI * 2, false);
  const rimHole = new THREE.Path();
  rimHole.absarc(0, 0, BAL_RIM_R - RIM_HALF, 0, Math.PI * 2, true);
  rimShape.holes.push(rimHole);
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 2 * RIM_H_HALF, bevelEnabled: false, curveSegments: 112 });
  rimGeo.translate(0, 0, -RIM_H_HALF);
  rimGeo.computeVertexNormals();
  const rim = new THREE.Mesh(rimGeo, brass);
  rim.position.z = RIM_Z;
  rim.castShadow = true;
  balancePivot.add(rim);
  // The rim is two halves of pins: each semicircle carries groups of 2, 3 and 4 pins with
  // a gap between groups (cf. the demonstration model). Each half is centred in its own
  // semicircle, so the joint between the halves stays clear.
  const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.24, 12);
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
        pin.position.set(Math.cos(a) * (BAL_RIM_R + 0.17), Math.sin(a) * (BAL_RIM_R + 0.17), RIM_Z);
        pin.rotation.z = a - Math.PI / 2; // the axis along the radius
        pin.castShadow = true;
        balancePivot.add(pin);
        a += pitch;
      }
      a += gap;
    }
  }
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(2 * BAL_RIM_R - 0.05, 0.15, 0.15), brass);
    spoke.rotation.z = a;
    spoke.position.z = RIM_Z;
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

  // The first frame is a lock — a half-integer beat is the middle of one — and 1.5 rather
  // than 0.5 so the stone holding it is the entry pallet, which is where the exhibit's
  // description starts the story.
  update(1.5);

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
    const p = pose(u);
    wheelPivot.rotation.z = p.wheel;
    forkPivot.rotation.z = p.lever;
    balancePivot.rotation.z = p.theta;
    spring.update(p.theta);
    for (const [face, stone] of Object.entries(jewels))
      stone.material.emissiveIntensity = face === p.face ? 0.9 : 0.25;
  }

  return { group, home, update, wheelPivot, forkPivot, balancePivot, jewels };
}
