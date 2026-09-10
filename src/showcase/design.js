/**
 * The exhibit's escapement: the pallets are the CONJUGATE PROFILES of the action.
 *
 * No meshes here and no time. `leverModel.js` builds the shapes described here and
 * `motion.js` reads the poses, so the picture and the movement are one solution read
 * twice rather than two ideas that have to be kept in step.
 *
 * **Why the faces are derived and not drawn.** Three earlier attempts chose face angles
 * and then measured what the contact did; every one of them recoiled through the whole
 * impulse, because for a pallet whose corner creeps backwards as it lifts, no straight
 * face at any angle lets the wheel advance. The lesson is that the face is not free: it is
 * whatever curve keeps the tooth in contact through the motion the escapement exists for.
 *
 * So the action is stated first — the lever's travel, the recoil the draw gives back, the
 * wheel's advance, the drop — and each face is then TRACED: for every lever angle in a
 * phase, the acting tooth's toe is put where that phase says the wheel stands, and its
 * place is written down in the lever's frame. The run of those points IS the face. A
 * pallet built on it holds the tooth through the whole phase by construction, and the
 * angles a watchmaker would quote — the draw, the pallet's lift — come out as
 * measurements of the result; `report()` returns them.
 *
 * The check is independent: the suite walks a whole beat and asserts, with a polygon
 * intersection that knows nothing of this construction, that the tooth touches the stone
 * at every pose and enters it at none.
 *
 * **What is chosen** is named below with its reason. Exactly two figures are magnified
 * (`EXAGGERATION`), because a real lock and a real drop are fractions of a degree and
 * would be invisible at the size this is watched. The lever's travel, the balance's lift
 * and the proportions of time are the real thing.
 */

/** The wheel: 15 club teeth. Kept from the first exhibit — the silhouette is settled. */
export const TEETH = 15;
export const WHEEL_R = 1.5;
export const WHEEL_ROOT = 0.95;
export const PITCH = (Math.PI * 2) / TEETH;

/** The line of centres: the wheel at 0, the lever's pivot, then the balance's axis. */
export const FORK_D = 2.35;
export const BAL_D = 2.0;

/** The pallets span two and a half teeth — the classic span, and the reason one lock
 *  stands half a pitch from the other. */
export const SPAN = 2.5;
export const PALLET_ANG = (SPAN / 2) * PITCH;

/** The lever's whole travel, banking to banking. Real levers run 8–12°. */
export const LEVER_HALF = (5 * Math.PI) / 180;
/**
 * The run to the banking: the last of the travel, after the tooth has left the pallet. The
 * wheel is free through it and spends the drop, and the lever is carried home — in a real
 * escapement by the draw of the lock that has just caught on the other stone. Showing it
 * is the only moment where the draw's work is visible (decided in the design round).
 */
export const LEVER_RUN = (0.6 * Math.PI) / 180;

/**
 * THE ONE MAGNIFICATION. A real lock is about a hundredth of the wheel's radius deep and a
 * real drop about a degree. At the size this exhibit is watched, both would be nothing at
 * all. These two are multiplied by it and nothing else is. The viewer is told (`show.exag`).
 */
export const EXAGGERATION = 4;
/** The free flight from leaving one pallet to meeting the other. Nominal 1° of the wheel. */
export const DROP = ((1 * Math.PI) / 180) * EXAGGERATION;

/**
 * The draw: the angle the locking face makes with the radius through the contact. This is
 * REAL (10–15° in a watch) and it is an input, because it is the figure a watchmaker
 * specifies. What follows from it is the recoil — how far the wheel gives back while the
 * lock is pushed off — and that is solved per stone, since the two stones meet their teeth
 * at different angles and the same draw costs them different amounts.
 */
export const DRAW = (12 * Math.PI) / 180;

/**
 * How much of the travel is spent pushing the lock off — the depth of the lock, seen from
 * the lever. This is THE MAGNIFIED ONE: a real lock is worth about a sixteenth of the
 * lever's travel, and here it is worth a sixth. Nominal 0.375°, times `EXAGGERATION`.
 */
export const LEVER_UNLOCK = ((0.375 * Math.PI) / 180) * EXAGGERATION;

/** The club tooth: the stick body (kept) with an impulse plane across its head. */
export const TOOTH = {
  tw: 0.18,      // the toe's half-chord, in pitches
  bw: 0.3,       // the base's width, in pitches
  lean: 0.5,     // how far back the base sits, in pitches
  tip: 0.2,      // the outer fraction that stands radial
  impDrop: 0.11, // how far the impulse plane falls from the toe back to the heel
  impBack: 0.26, // how far back it reaches, in pitches
};

/** How far the stone's body reaches behind its acting faces. */
export const STONE_BACK = 0.22;

/** The balance's amplitude — the swing between beats, not part of the escaping. */
export const AMPLITUDE = (270 * Math.PI) / 180;
/** The notch's half-width and the pin's radius: the pin fills it with working clearance. */
export const NOTCH_HALF = 0.085;
/** How deep the slot is cut into the lever's end: the pin is in the notch only inside it. */
export const NOTCH_DEPTH = 0.26;
export const PIN_R = 0.075;
/**
 * The lift: how much of the balance's swing the escapement occupies. Real watches run
 * 44–52°, so 50° here — an input rather than an accident, because the pin's orbit follows
 * from it: near the crossing the lever moves with the balance at the ratio
 * PIN_ORBIT / NOTCH_D, and the lever has 2·LEVER_HALF to travel.
 */
export const LIFT = (50 * Math.PI) / 180;


/**
 * The safety action: the guard pin, the safety roller and the crescent cut into it.
 *
 * What holds the lever between beats is the draw, and the draw is an argument, not a
 * catch. The catch is this: the guard pin stands beside the safety roller, and if the
 * lever is knocked off its banking the pin butts the roller and stops — long before the
 * lock could be pushed off. The one moment it is allowed through is the moment the impulse
 * pin is in the notch, and that is what the crescent is: a bite taken out of the roller,
 * facing the lever exactly then.
 *
 * The pin's arc is CLOSEST to the balance at the middle of the lever's travel, so a pin
 * that clears the roller on the banking will foul it a little way in. That is not a defect
 * to design out — it is the whole mechanism.
 */
export const SAFETY_R = 0.3;
export const GUARD_R = 0.045;
/**
 * How far along its travel the lever gets before the guard stops it, as a fraction. It has
 * to be less than the unlocking's share (`LEVER_UNLOCK / travel`), or the lock would be off
 * before the catch caught: half of it, so the margin is visible rather than nominal.
 */
export const GUARD_RUN = 0.5 * (LEVER_UNLOCK / (2 * LEVER_HALF));

// ── plane geometry ────────────────────────────────────────────────
export const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
export const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
export const add = ([x, y], [u, v]) => [x + u, y + v];
export const sub = ([x, y], [u, v]) => [x - u, y - v];
export const scale = ([x, y], k) => [x * k, y * k];
const len = ([x, y]) => Math.hypot(x, y);

/** A point of the LEVER's frame, placed in the world at lever angle ψ. */
export const toWorld = (p, lever) => add(rot2(p, lever), [FORK_D, 0]);
/** A point of the world, seen in the LEVER's frame. */
export const toLever = (p, lever) => rot2(sub(p, [FORK_D, 0]), -lever);

// ── the tooth ─────────────────────────────────────────────────────
export const TOE_OFF = (TOOTH.tw / 2) * PITCH;
/** The acting toe: the leading corner of tooth `i` at wheel angle `w`. */
export const toe = (w, i = 0) => polar(WHEEL_R, i * PITCH + w + TOE_OFF);

/** A tooth's outline in the wheel's frame — one source for the mesh and the tests. */
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

// ── the action, stated before anything is drawn ───────────────────
/**
 * One stone's share of a beat: where the lever is and where the wheel stands, as `u` runs
 * 0 → 1 across the lever's whole travel.
 *
 * The wheel gives the recoil back while the lock is being pushed off, then takes the
 * impulse. The drop is not in here: through it the wheel is free and the lever is already
 * home against its other banking.
 */
/**
 * The recoil that produces the wanted draw on this stone's locking face. The face is the
 * toe's path in the lever's frame while the lock is pushed off, so its angle to the radius
 * is a rising function of the recoil: bisection finds the recoil that lands on `DRAW`.
 * Solved once per stone at load — twenty passes over a closed form, not a scan.
 */
function solveRecoil(face) {
  const drawOf = (recoil) => {
    const a = actionWith(face, recoil);
    const p = toLever(toe(a.wheel(0)), a.lever(0));
    const q = toLever(toe(a.wheel(a.uUnlock)), a.lever(a.uUnlock));
    const d = sub(q, p);
    const mid = toWorld(scale(add(p, q), 0.5), 0);
    const rad = scale(mid, 1 / len(mid));
    const ang = Math.atan2(d[0] * rad[1] - d[1] * rad[0], d[0] * rad[0] + d[1] * rad[1]);
    const fold = ang > Math.PI / 2 ? ang - Math.PI : ang < -Math.PI / 2 ? ang + Math.PI : ang;
    return Math.abs(fold);
  };
  let lo = 1e-6, hi = (3 * Math.PI) / 180;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (drawOf(mid) > DRAW) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The action for a given recoil — the shape `solveRecoil` searches over. */
function actionWith(face, recoil) {
  const s = face === 'entry' ? -1 : 1;
  const bank = s * LEVER_HALF;             // the banking this stone locks against
  const dir = -s;                          // the way the lever travels to unlock it
  const wLock = s * PALLET_ANG - TOE_OFF;  // the wheel angle whose toe sits on the lock
  const uUnlock = LEVER_UNLOCK / (2 * LEVER_HALF);
  const uDrop = 1 - LEVER_RUN / (2 * LEVER_HALF);
  // A beat moves the wheel half a pitch, no more and no less, so the impulse is what the
  // other two leave: it is a result, not a third choice.
  const impulse = PITCH / 2 + recoil - DROP;
  return {
    s, bank, dir, wLock, uUnlock, uDrop, recoil, impulse,
    lever: (u) => bank + dir * 2 * LEVER_HALF * u,
    wheel: (u) => {
      if (u <= uUnlock) return wLock - recoil * (u / uUnlock);
      if (u <= uDrop) return wLock - recoil + impulse * ((u - uUnlock) / (uDrop - uUnlock));
      return wLock - recoil + impulse + DROP * ((u - uDrop) / (1 - uDrop));
    },
    phase: (u) => (u <= uUnlock ? 'unlock' : u <= uDrop ? 'impulse' : 'drop'),
  };
}

/** The recoil each stone needs for the one draw, solved once. */
export const RECOIL = { entry: solveRecoil('entry'), exit: solveRecoil('exit') };

/** One stone's share of a beat. */
export function action(face) {
  return actionWith(face, RECOIL[face]);
}

/**
 * The acting faces, traced. Each sample puts the toe where the action says the wheel
 * stands at that lever angle, and writes it down in the lever's frame; the run of points
 * is the face. The locking face is the first `uUnlock` of the travel and the impulse face
 * the rest — they meet at the locking corner, which is where the release happens.
 */
export function faceLocus(face, n = 24) {
  const a = action(face);
  const lock = [], imp = [];
  for (let i = 0; i <= n; i++) {
    const u = (a.uUnlock * i) / n;
    lock.push(toLever(toe(a.wheel(u)), a.lever(u)));
  }
  for (let i = 0; i <= n; i++) {
    const u = a.uUnlock + ((a.uDrop - a.uUnlock) * i) / n;
    imp.push(toLever(toe(a.wheel(u)), a.lever(u)));
  }
  return { lock, imp, corner: lock[lock.length - 1] };
}

/**
 * The stone: the two traced faces, closed by a body that stands off them AWAY from the
 * wheel. Nothing of the body can then reach a tooth the faces are not acting on.
 */
export function stonePoly(face, n = 24) {
  const { lock, imp } = faceLocus(face, n);
  const front = [...lock, ...imp.slice(1)];
  const back = front.map((p) => {
    const w = toWorld(p, 0);
    return toLever(scale(w, (len(w) + STONE_BACK) / len(w)), 0);
  });
  return [...front, ...back.reverse()];
}

/**
 * Where the wheel stands and what is holding it, at a point of this stone's share of the
 * beat. The phase IS the part of the action in use, because the faces were traced from
 * the phases: the caption reads the model instead of keeping a schedule of its own.
 */
export function poseAt(face, u) {
  const a = action(face);
  return { lever: a.lever(u), wheel: a.wheel(u), phase: a.phase(u) };
}

/**
 * The lever's angle from the balance's, through the pin in the notch — closed form.
 *
 * The pin's centre stands `PIN_ORBIT` from the balance's axis and the notch is a straight
 * slot along the lever, so contact reads «the pin's centre is `NOTCH_HALF + PIN_R` from the
 * slot's centre line». That is `A·cos ψ + B·sin ψ = C`, whose two roots are the slot's two
 * flanks; `side` names the banking the lever is coming off, which is the flank being
 * pushed. `null` means the pin is not in the notch — the lever stays where it is, which is
 * the lock.
 */
export function leverFromPin(theta, side, orbit = PIN_ORBIT) {
  const pin = [FORK_D + BAL_D - Math.cos(theta) * orbit, -Math.sin(theta) * orbit];
  const v = sub(pin, [FORK_D, 0]);
  // The clearance is the DIFFERENCE, not the sum: a pin of radius PIN_R inside a slot of
  // half-width NOTCH_HALF touches a flank when its centre is that much off the centre line.
  // With the sum, the play came to 11° of lever against 10° of travel — the lever would have
  // crossed in one jump the moment it was released.
  const C = side * (NOTCH_HALF - PIN_R);
  const r = len(v);
  if (Math.abs(C) > r) return null;
  // The pin has to be IN the notch, not merely somewhere on the line the notch lies along.
  // Without this the equation was solved by the pin on the far side of the balance, and the
  // lever appeared to be driven three times a beat, once from 218° away.
  if (r > BAL_D - orbit + NOTCH_DEPTH) return null;
  const base = Math.atan2(-v[0], v[1]);
  const off = Math.acos(C / r);
  const roots = [base + off, base - off].map((x) => Math.atan2(Math.sin(x), Math.cos(x)));
  const home = side * LEVER_HALF;
  // Chosen from a range wider than the lever's own travel, and NOT clipped to it: an angle
  // past a banking means the flank has stopped holding the lever, and the caller decides
  // that by clamping. Clipping here instead dropped the root at that moment and the lever
  // fell back onto the other flank — a visible stutter one frame before the drop ended.
  const reachable = roots.filter((x) => Math.abs(x) <= 3 * LEVER_HALF);
  if (!reachable.length) return null;
  return reachable.reduce((best, x) => (Math.abs(x - home) < Math.abs(best - home) ? x : best));
}

/** The figures a watchmaker would quote — measurements of the result, never inputs. */
export function report() {
  const out = {};
  const angleToRadius = (p, q) => {
    const d = sub(q, p);
    const mid = toWorld(scale(add(p, q), 0.5), 0);
    const rad = scale(mid, 1 / len(mid));
    const a = Math.atan2(d[0] * rad[1] - d[1] * rad[0], d[0] * rad[0] + d[1] * rad[1]);
    // A face is a line, not an arrow: fold onto a half turn so the figure reads the way a
    // watchmaker quotes it, off the radius, whichever end it was traced from.
    return a > Math.PI / 2 ? a - Math.PI : a < -Math.PI / 2 ? a + Math.PI : a;
  };
  const bend = (pts) => {
    const p0 = pts[0], d = sub(pts[pts.length - 1], p0), l = len(d);
    return pts.reduce((worst, p) => {
      const v = sub(p, p0);
      return Math.max(worst, Math.abs((v[0] * d[1] - v[1] * d[0]) / l));
    }, 0);
  };
  for (const face of ['entry', 'exit']) {
    const { lock, imp } = faceLocus(face);
    out[face] = {
      draw: angleToRadius(lock[0], lock[lock.length - 1]),
      impulse: angleToRadius(imp[0], imp[imp.length - 1]),
      lockLen: len(sub(lock[lock.length - 1], lock[0])),
      impLen: len(sub(imp[imp.length - 1], imp[0])),
      lockBend: bend(lock),
      impBend: bend(imp),
    };
  }
  return out;
}

/** Do two polygons overlap? Edge crossings, then containment — the independent check. */
export function overlap(p, q) {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const seg = (a, b, c, d) => {
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++)
      if (seg(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length])) return true;
  const inside = (pt, poly) => {
    let hit = false;
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const [xi, yi] = poly[i], [xk, yk] = poly[k];
      if ((yi > pt[1]) !== (yk > pt[1]) && pt[0] < ((xk - xi) * (pt[1] - yi)) / (yk - yi) + xi) hit = !hit;
    }
    return hit;
  };
  return inside(p[0], q) || inside(q[0], p);
}

/**
 * The pin's orbit that spends exactly `LIFT` of the balance's swing on the lever's travel.
 *
 * Not a formula: a closed form in the small-angle limit was out by a seventh, because the
 * pin's distance from the pivot changes as it swings and the two ends of the travel are
 * held by different flanks. So the engagement is MEASURED — sweep the balance, ask the
 * notch for the lever at each step, and see over how much of the swing an answer exists —
 * and the orbit is bisected until that measurement lands on the lift asked for.
 */
function liftFor(orbit) {
  let lo = null, hi = null;
  for (let i = 0; i <= 1440; i++) {
    const theta = (-Math.PI / 2) + (Math.PI * i) / 1440;
    const held = [1, -1].some((side) => {
      const psi = leverFromPin(theta, side, orbit);
      return psi !== null && Math.abs(psi) <= LEVER_HALF;
    });
    if (held) { if (lo === null) lo = theta; hi = theta; }
  }
  return lo === null ? 0 : hi - lo;
}

export const PIN_ORBIT = (() => {
  let lo = 0.05, hi = BAL_D * 0.9;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    // More orbit is more leverage on the notch, so less of the swing is spent on the travel.
    if (liftFor(mid) > LIFT) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** What that orbit actually spends — measured, and the tests hold it to the aim. */
export const LIFT_MEASURED = liftFor(PIN_ORBIT);

export const NOTCH_D = BAL_D - PIN_ORBIT;


/**
 * Where the guard pin sits on the lever — solved, not placed. Its distance to the balance
 * falls as the lever leaves its banking, and the pin must reach the roller exactly when the
 * lever has used `GUARD_RUN` of its travel. Bisection on that distance.
 */
export const GUARD_D = (() => {
  const reach = (d, lever) => {
    const g = toWorld([d, 0], lever);
    return Math.hypot(g[0] - (FORK_D + BAL_D), g[1]) - (SAFETY_R + GUARD_R);
  };
  const at = LEVER_HALF - GUARD_RUN * 2 * LEVER_HALF;   // the lever, that far off its banking
  let lo = BAL_D - SAFETY_R - GUARD_R - 0.4, hi = BAL_D - SAFETY_R - GUARD_R + 0.4;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (reach(mid, at) > 0) lo = mid; else hi = mid;    // further out reaches sooner
  }
  return (lo + hi) / 2;
})();

/** The guard's place in the world, and where it stands on the balance's own dial. */
export const guardAt = (lever) => toWorld([GUARD_D, 0], lever);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function guardOnRoller(theta, lever) {
  const g = guardAt(lever);
  const v = sub(g, [FORK_D + BAL_D, 0]);
  return { dist: len(v), angle: wrapPi(Math.atan2(v[1], v[0]) - theta - Math.PI) };
}

/**
 * The crescent's half-angle — measured, not cut to taste. It has to be open for every pose
 * of the engagement, and for the guard's own width on the way in and out; anything wider is
 * a hole in the safety and anything narrower is a lever that jams on a correct beat.
 */
export const CRESCENT_HALF = (() => {
  // Swept along the ENGAGEMENT itself — the balance's angle, the lever it drives through
  // the notch, the guard's place on the roller — because the crescent has to be open for
  // the poses that actually happen. An earlier version tried to match the lever's travel
  // against the balance's on two sampled grids; the two rarely landed on each other, so it
  // measured almost nothing and cut a crescent too narrow to let the lever cross at all.
  let worst = 0;
  const N = 4000;
  for (let i = 0; i <= N; i++) {
    const theta = -LIFT + (2 * LIFT * i) / N;
    for (const side of [1, -1]) {
      const psi = leverFromPin(theta, side);
      if (psi === null) continue;
      const lever = Math.max(-LEVER_HALF, Math.min(LEVER_HALF, psi));
      const { dist, angle } = guardOnRoller(theta, lever);
      if (dist < SAFETY_R + GUARD_R) worst = Math.max(worst, Math.abs(angle));
    }
  }
  return worst + GUARD_R / SAFETY_R;                    // the guard's own width, in radians
})();

/** How deep the crescent is cut: enough to let the pin through at its deepest reach. */
export const CRESCENT_DEPTH = (() => {
  let deepest = SAFETY_R;
  for (let i = 0; i <= 200; i++) {
    const lever = -LEVER_HALF + (2 * LEVER_HALF * i) / 200;
    deepest = Math.min(deepest, guardOnRoller(0, lever).dist - GUARD_R);
  }
  return Math.max(0.04, SAFETY_R - deepest + 0.02);
})();

/**
 * The clearance between the guard and the roller at a pose: positive is clear, negative
 * would be the pin inside the roller, which is what never happens.
 *
 * Inside the crescent the roller is cut away to `SAFETY_R − CRESCENT_DEPTH`, which is why
 * the pin passes at all; outside it the full radius is in the way.
 */
export function guardGap(theta, lever) {
  const { dist, angle } = guardOnRoller(theta, lever);
  const radius = Math.abs(angle) <= CRESCENT_HALF ? SAFETY_R - CRESCENT_DEPTH : SAFETY_R;
  return dist - (radius + GUARD_R);
}

/**
 * How far the lever can travel from a banking before the guard stops it — the answer to
 * «what holds it». `1` means the guard is not in the way at all, which is the case through
 * the engagement, and is why a correct beat never feels this constraint.
 */
export function guardLimit(theta, bank, dir) {
  const travel = 2 * LEVER_HALF;
  const gapAt = (f) => guardGap(theta, bank + dir * travel * f);
  // The FIRST crossing, not the far end: the guard blocks partway across and clears again
  // beyond, so asking only where the lever would finish says «nothing in the way» exactly
  // when something is.
  const N = 200;
  let prev = 0;
  for (let i = 1; i <= N; i++) {
    const f = i / N;
    if (gapAt(f) < 0) {
      let lo = prev, hi = f;
      for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2; if (gapAt(m) >= 0) lo = m; else hi = m; }
      return lo;
    }
    prev = f;
  }
  return 1;
}
