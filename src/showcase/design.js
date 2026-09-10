/**
 * The exhibit's escapement, solved rather than staged.
 *
 * No meshes here and no time: this is the geometry of one Swiss lever escapement and the
 * contact between its parts. `leverModel.js` builds the shapes described here and
 * `motion.js` reads the poses solved here, so the picture and the movement cannot
 * disagree — they are one solution read twice.
 *
 * **How the contact is solved.** Three surfaces can stop the wheel, and each gives a
 * closed form, because every one of them is «a point on a circle meets a straight face»:
 *
 * 1. the tooth's TOE against the pallet's LOCKING face — the lock, and the recoil the
 *    draw takes back while the lever unlocks it;
 * 2. the tooth's TOE against the pallet's IMPULSE face — the first half of the impulse;
 * 3. the pallet's OUTER CORNER against the tooth's own IMPULSE PLANE — the second half.
 *    A club tooth exists for exactly this: the pallet finishes on the tooth's plane.
 *
 * At any lever angle the wheel stands where the FIRST of those three stops it. Which one
 * is binding is the phase — the caption reads the model rather than a schedule. When none
 * of them is in reach, nothing holds the wheel: that is the drop.
 *
 * The wheel's half-pitch advance per beat is a RESULT, not an input: the two locking
 * corners stand two and a half pitches apart, so from one lock to the next the wheel turns
 * that less the two whole pitches the teeth repeat by. The tests check it as a result.
 *
 * **What is chosen** is named below with its reason. Exactly two figures are magnified
 * (`EXAGGERATION`) because a real lock and a real drop are fractions of a degree and would
 * be invisible at any honest viewing distance. The face angles, the lever's travel, the
 * balance's lift and the proportions of time are the real thing.
 */

/** The wheel: 15 club teeth. Kept from the first exhibit — the silhouette is settled. */
export const TEETH = 15;
export const WHEEL_R = 1.5;
export const WHEEL_ROOT = 0.95;
export const PITCH = (Math.PI * 2) / TEETH;

/** The line of centres: the wheel at 0, the lever's pivot, then the balance's axis. */
export const FORK_D = 2.35;
export const BAL_D = 2.0;

/** The pallets span two and a half teeth: the classic span, and the reason one lock
 *  stands half a pitch from the other. */
export const SPAN = 2.5;
/** Where each acting corner sits, measured at the wheel from the line of centres. */
export const PALLET_ANG = (SPAN / 2) * PITCH;

/** The lever's whole travel, banking to banking. Real levers run 8–12°. */
export const LEVER_HALF = (5 * Math.PI) / 180;

/** The draw on the locking faces. Real: 10–15°. It is what holds the lever on its banking
 *  — and what makes the wheel recoil a little while the lock is being pushed off. */
export const DRAW = (12 * Math.PI) / 180;

/**
 * THE ONE MAGNIFICATION. A real lock is about a hundredth of the wheel's radius deep and a
 * real drop about a degree. At the size this exhibit is watched, both would be nothing at
 * all. These two are multiplied by it and nothing else is. The viewer is told (`show.exag`).
 */
export const EXAGGERATION = 4;
/** How deep the acting corner dips inside the circle the toes sweep. Nominal 0.02. */
export const LOCK_DEPTH = 0.02 * EXAGGERATION;
/** The free flight from leaving one pallet to meeting the other. Nominal 1° of the wheel. */
export const DROP = ((1 * Math.PI) / 180) * EXAGGERATION;

/**
 * The club tooth. The stick body is the one the exhibit already had — thin, leaning with
 * the travel. What is new is the head: the flat tip becomes an impulse plane, dropping
 * from the leading toe back to the heel, and the pallet finishes the impulse on it.
 */
export const TOOTH = {
  tw: 0.18,      // the toe's half-chord, in pitches
  bw: 0.3,       // the base's width, in pitches
  lean: 0.5,     // how far back the base sits, in pitches
  tip: 0.2,      // the outer fraction that stands radial
  impDrop: 0.11, // how far the impulse plane falls from the toe to the heel
  impBack: 0.26, // how far back it reaches, in pitches
};

/** The stone's faces, measured from the acting corner. */
export const STONE = { lock: 0.26, imp: 0.30, thick: 0.2 };

/**
 * The pallet's impulse face, as an angle from the tangent to the wheel at the acting
 * corner. Solved, not chosen: `solveImpulse()` in the tests finds the angle for which the
 * lever's travel is spent exactly on the wheel rotation the pallet owes — half a pitch,
 * less the drop, plus the recoil. Baked here because the solve is a scan and this module
 * is imported by the page; the test re-runs the scan and fails if these drift.
 */
export const IMPULSE_ANG = { entry: 0.4014, exit: 0.3927 };

/** The balance's amplitude — the swing between beats, not part of the escaping. */
export const AMPLITUDE = (270 * Math.PI) / 180;
/** The notch's half-width and the pin's radius: the pin fills it with working clearance. */
export const NOTCH_HALF = 0.085;
export const PIN_R = 0.075;
/**
 * The lift: how much of the balance's swing the escapement occupies. Real watches run
 * 44–52°, so 50° here — and it is an input rather than an accident, because the pin's
 * orbit is solved from it. Near the crossing the lever moves with the balance at the ratio
 * PIN_ORBIT / NOTCH_D, and the lever has 2·LEVER_HALF to travel.
 */
export const LIFT = (50 * Math.PI) / 180;
export const PIN_ORBIT = (BAL_D * 2 * LEVER_HALF) / (LIFT + 2 * LEVER_HALF);
/** What is left of the span: the notch's distance from the lever's pivot. */
export const NOTCH_D = BAL_D - PIN_ORBIT;

/** The guard pin and the safety roller: true clearances, not yet acting (issue #40). */
export const SAFETY_R = 0.3;
export const GUARD_R = 0.045;
export const GUARD_CLEAR = 0.03;
export const GUARD_D = BAL_D - SAFETY_R - GUARD_R - GUARD_CLEAR;

// ── plane geometry ────────────────────────────────────────────────
export const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
export const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const add = ([x, y], [u, v]) => [x + u, y + v];
export const sub = ([x, y], [u, v]) => [x - u, y - v];
export const scale = ([x, y], k) => [x * k, y * k];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The lever's frame: a point of it, placed in the world at lever angle ψ. */
export const toWorld = (p, lever) => add(rot2(p, lever), [FORK_D, 0]);

// ── the tooth ─────────────────────────────────────────────────────
/** The toe: the leading corner, at the full radius. `i` counts teeth, `w` turns the wheel. */
export const toeAngle = (i, w = 0) => i * PITCH + w + (TOOTH.tw / 2) * PITCH;

/** A tooth's outline in the wheel's frame — one source for the mesh and for the tests. */
export function toothPoly(i, w = 0) {
  const { tw, bw, lean, tip, impDrop, impBack } = TOOTH;
  const a = i * PITCH + w;
  const rS = WHEEL_R - tip * (WHEEL_R - WHEEL_ROOT);
  const d = (tw / 2) * PITCH;
  return [
    polar(WHEEL_ROOT, a - (lean + bw / 2) * PITCH),  // the trailing base
    polar(rS, a - d),                                // the bend, trailing side
    polar(WHEEL_R - impDrop, a - impBack * PITCH),   // the heel — the impulse plane starts
    polar(WHEEL_R, a + d),                           // the toe — leading, full radius
    polar(rS, a + d),                                // the bend, leading side
    polar(WHEEL_ROOT, a - (lean - bw / 2) * PITCH),  // the leading base
  ];
}

/** The tooth's impulse plane, in the wheel's frame: from the heel out to the toe. */
export function toothImpulse(i, w = 0) {
  const p = toothPoly(i, w);
  return { from: p[2], to: p[3] };
}

// ── the stone ─────────────────────────────────────────────────────
/**
 * A pallet stone in the LEVER's frame — pivot at the origin, notch along +x.
 *
 * The stone is the parallelogram a real one is. Its acting corner sits `LOCK_DEPTH` inside
 * the circle the toes sweep, and that is what gives the lock its depth: a tooth stopped
 * here rests on the locking face that much above the corner. The locking face runs outward
 * along the wheel's radius through the corner, turned by the DRAW — that turn is why the
 * wheel's pressure holds the lever down on its banking instead of pushing it off. The
 * impulse face runs forward from the same corner, climbing out of the toes' circle at
 * `IMPULSE_ANG`, so a toe riding along it lifts the pallet as the wheel advances.
 */
export function stoneFaces(face, impulse = IMPULSE_ANG[face]) {
  const s = face === 'entry' ? -1 : 1;
  const ang = s * PALLET_ANG;
  // The corner is placed for the pose it locks in — the lever on ITS banking, not at the
  // mid-position. Placing it at the middle put the corner nearly twice as deep by the time
  // the lever reached the banking, and the locking face then ended below the toes' circle:
  // the tooth sailed over the stone instead of resting on it.
  const bank = s * LEVER_HALF;
  const A = rot2(sub(polar(WHEEL_R - LOCK_DEPTH, ang), [FORK_D, 0]), -bank);
  const out = rot2(polar(1, ang), -bank);          // away from the wheel's centre
  const fwd = rot2(out, Math.PI / 2);             // the way the teeth travel past it
  const lockDir = rot2(out, s * DRAW);
  // The impulse face runs FORWARD and slightly INWARD. That slope is the whole mechanism
  // of the impulse: the tooth pushes forward along the face, the face's normal points
  // outward, and the pallet is lifted. A face climbing the other way would let the wheel
  // recoil as the pallet rose, which is the opposite of an impulse.
  const impDir = rot2(fwd, -impulse);
  return { A, lockDir, impDir, corner: add(A, scale(impDir, STONE.imp)) };
}

/** The stone's outline, for the mesh and the tests. */
export function stonePoly(face, impulse = IMPULSE_ANG[face]) {
  const { A, lockDir, impDir } = stoneFaces(face, impulse);
  const u = scale(lockDir, STONE.lock);
  const v = scale(impDir, STONE.imp);
  return [A, add(A, u), add(add(A, u), v), add(A, v)];
}

// ── contact ───────────────────────────────────────────────────────
/**
 * The wheel angles at which a point of the WHEEL at radius `r` lands on a line of the
 * LEVER. Both roots of `cos·nx + sin·ny = c`; the caller lifts them to the turn it is on.
 */
function toeOnFace(r, offset, P0, dir, lever) {
  const a0 = toWorld(P0, lever);
  const d = rot2(dir, lever);
  const n = [-d[1], d[0]];
  const c = (a0[0] * n[0] + a0[1] * n[1]) / r;
  if (Math.abs(c) > 1) return [];
  const base = Math.atan2(n[1], n[0]);
  const off = Math.acos(c);
  return [base + off, base - off].map((x) => x - offset);
}

/**
 * The wheel angles at which a point of the LEVER lands on a line of the WHEEL — the same
 * equation from the other side. The lever's point is fixed in the world; turning the wheel
 * by `w` turns the line, which is the same as turning the point by −w, so the unknown sits
 * inside `γ − w` and comes out as `w = γ − (angle of n ± acos c)`.
 */
function cornerOnPlane(leverPoint, lever, from, to) {
  const q = toWorld(leverPoint, lever);
  const rho = Math.hypot(q[0], q[1]);
  const d = sub(to, from);
  const len = Math.hypot(d[0], d[1]);
  const n = [-d[1] / len, d[0] / len];
  const c = (from[0] * n[0] + from[1] * n[1]) / rho;
  if (Math.abs(c) > 1) return [];
  const gamma = Math.atan2(q[1], q[0]);
  const base = Math.atan2(n[1], n[0]);
  const off = Math.acos(c);
  return [gamma - (base + off), gamma - (base - off)];
}

/** The same contact one turn of a tooth later: lift an angle to the first one at or past `near`. */
const lift = (w, near) => w + PITCH * Math.ceil((near - w) / PITCH - 1e-12);

/**
 * Where the wheel stands at this lever angle, and what is holding it there.
 *
 * Each of the three surfaces is asked for the wheel angle at which it would take the
 * tooth, the answers are lifted onto the turn the wheel is on, those whose contact would
 * fall off the end of a face are dropped, and the earliest survivor wins: the wheel turns
 * until the first surface stops it. The winner's name is the phase — the caption reads
 * this, it does not keep a schedule of its own. `null` means nothing is in reach, which is
 * the drop.
 */
export function contact(face, lever, near, impulse = IMPULSE_ANG[face]) {
  const { A, lockDir, impDir, corner } = stoneFaces(face, impulse);
  const toeOff = (TOOTH.tw / 2) * PITCH;
  const found = [];

  /** Where along a face of the stone the toe would sit, in that face's own length. */
  const alongFace = (w, P0, dir) => {
    const toe = polar(WHEEL_R, toeAngle(0, w));
    const o = toWorld(P0, lever), u = rot2(dir, lever);
    return (toe[0] - o[0]) * u[0] + (toe[1] - o[1]) * u[1];
  };
  /** Where along the tooth's plane the stone's corner would sit, as a fraction. */
  const alongPlane = (w) => {
    const local = rot2(toWorld(corner, lever), -w);
    const { from, to } = toothImpulse(0);
    const d = sub(to, from);
    return ((local[0] - from[0]) * d[0] + (local[1] - from[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  };

  // The guard is asked at the RAW root, not at the lifted one: lifting by a pitch means a
  // different tooth takes the same contact, and asking tooth zero where it stands at the
  // lifted angle asks about a point that is nowhere near the face.
  const take = (kind, roots, at, lo, hi) => {
    for (const r of roots) {
      const t = at(r);
      if (t >= lo - 1e-9 && t <= hi + 1e-9) found.push({ kind, wheel: lift(r, near), t });
    }
  };

  take('lock', toeOnFace(WHEEL_R, toeOff, A, lockDir, lever), (w) => alongFace(w, A, lockDir), 0, STONE.lock);
  take('impulse', toeOnFace(WHEEL_R, toeOff, A, impDir, lever), (w) => alongFace(w, A, impDir), 0, STONE.imp);
  const { from, to } = toothImpulse(0);
  take('plane', cornerOnPlane(corner, lever, from, to), alongPlane, 0, 1);

  if (!found.length) return null;
  return found.reduce((best, c) => (c.wheel < best.wheel ? c : best));
}

/** Every candidate at this pose — for the tests and for looking at what the solver saw. */
export function candidates(face, lever, near, impulse = IMPULSE_ANG[face]) {
  const { A, lockDir, impDir, corner } = stoneFaces(face, impulse);
  const toeOff = (TOOTH.tw / 2) * PITCH;
  const { from, to } = toothImpulse(0);
  const alongFace = (w, P0, dir) => {
    const toe = polar(WHEEL_R, toeAngle(0, w));
    const o = toWorld(P0, lever), u = rot2(dir, lever);
    return (toe[0] - o[0]) * u[0] + (toe[1] - o[1]) * u[1];
  };
  const alongPlane = (w) => {
    const local = rot2(toWorld(corner, lever), -w);
    const d = sub(to, from);
    return ((local[0] - from[0]) * d[0] + (local[1] - from[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  };
  return {
    lock: toeOnFace(WHEEL_R, toeOff, A, lockDir, lever).map((r) => ({ w: lift(r, near), t: alongFace(r, A, lockDir), max: STONE.lock })),
    impulse: toeOnFace(WHEEL_R, toeOff, A, impDir, lever).map((r) => ({ w: lift(r, near), t: alongFace(r, A, impDir), max: STONE.imp })),
    plane: cornerOnPlane(corner, lever, from, to).map((r) => ({ w: lift(r, near), t: alongPlane(r), max: 1 })),
  };
}
