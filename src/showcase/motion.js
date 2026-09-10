import { AMPLITUDE, LEVER_HALF, PITCH, action, leverFromPin, poseAt } from './design.js';

/**
 * The showcase's motion — the escapement running, not a schedule of it.
 *
 * The balance is the input and everything else follows from contact. Its swing is a sine,
 * as a free oscillator's very nearly is; the pin on its roller reaches into the lever's
 * notch and pushes; and the lever's travel is what `design.js` traced its pallets from, so
 * the wheel's angle is read off the action rather than eased through a window.
 *
 * **Who pushes whom changes at the release, and so does the flank in contact.** While the
 * lock is being pushed off, the balance drives the lever and the pin lies against the
 * trailing flank of the notch. Once the tooth is on the impulse face the wheel drives the
 * lever, which now runs ahead of the balance and is held back by the other flank — which
 * is how the impulse reaches the balance at all. The swap is not a special case in the
 * code: it is the two roots of one contact changing places.
 *
 * Everything is a pure function of time in beats: pause and stepping are a stop and a
 * manual advance, with no memory in any integrator.
 */

/** The showcase's tempo: slow, so the lock is visible; speed is the panel's multiplier. */
export const BEAT_HZ = 1.0;
export { AMPLITUDE };
/** The lever's half travel — what the exhibit's parts ask for when they need its swing. */
export const FORK_MAX = LEVER_HALF;

const TRAVEL = 2 * LEVER_HALF;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

/** Which stone escapes on a beat. The first frame is a lock on the entry pallet. */
export const faceOfBeat = (n) => (((n % 2) + 2) % 2 === 0 ? 'entry' : 'exit');

/**
 * The turn the wheel is on, so that a beat advances it half a pitch.
 *
 * Each stone's action is written about its own lock, and the two locks stand two and a
 * half pitches apart. Adding the right whole number of pitches turns those two local
 * accounts into one running angle — and that the step comes out at half a pitch exactly is
 * the escapement's own doing, not an adjustment made here.
 */
const turnOf = (n) => (((n % 2) + 2) % 2 === 0 ? n / 2 : (n - 1) / 2 - 2);

/**
 * The balance: a sine, zero twice per beat — the escaping happens at the zero.
 *
 * It swings the way it does because the wheel does not get a choice. The teeth travel
 * anticlockwise and the pallets were traced from that, so the lever has to cross from the
 * entry pallet's banking on the even beats; the pin can only carry it that way round if
 * the balance turns this way. Flip the sign and the exhibit runs its stages backwards.
 */
export function balanceAngle(u, ampDeg) {
  const amp = ampDeg === undefined ? AMPLITUDE : (ampDeg * Math.PI) / 180;
  return -amp * Math.sin(Math.PI * u);
}

/**
 * Everything at time `u`, in beats: the balance, the lever, the wheel, the stage and the
 * stone doing the work.
 *
 * The lever's progress across its travel is decided by the pin. The notch's two flanks
 * give two contacts; the lever lies on the trailing one while it is being pushed and on
 * the leading one once it is running ahead. With the pin out of the notch there is nothing
 * to push it, so it stands on a banking and the wheel is locked.
 */
export function pose(u) {
  const n = Math.round(u);
  const beatFace = faceOfBeat(n);
  const a = action(beatFace);
  const theta = balanceAngle(u);
  const roots = [1, -1]
    .map((side) => leverFromPin(theta, side))
    .filter((x) => x !== null)
    .map((psi) => clamp(a.dir * (psi - a.bank), 0, TRAVEL)); // progress, held by the bankings
  const engaged = roots.length > 0;
  let p;
  if (!engaged) p = u < n ? 0 : TRAVEL;            // before the crossing, or home after it
  else {
    const lo = Math.min(...roots), hi = Math.max(...roots);
    p = lo <= a.uUnlock * TRAVEL ? lo : hi;
  }
  const t = p / TRAVEL;
  const d = poseAt(beatFace, t);
  // Out of the notch and past the crossing, the tooth is already sitting on the NEXT
  // stone's lock: the stone being named is the one holding, not the one that just let go.
  const holding = !engaged && u > n ? faceOfBeat(n + 1) : beatFace;
  return {
    u: t,
    theta,
    face: holding,
    lever: d.lever,
    wheel: d.wheel + turnOf(n) * PITCH,
    phase: !engaged || t <= 0 ? 'lock' : d.phase,
  };
}

/** The wheel's angle at time `u`. */
export const wheelAngle = (u) => pose(u).wheel;
/** The lever's angle at time `u`. */
export const forkAngle = (u) => pose(u).lever;
/** What is happening at time `u`: lock → unlock → impulse → drop. */
export const phaseName = (u) => pose(u).phase;
/** Which stone is doing the work — or holding the lock, between beats. */
export const activePallet = (u) => pose(u).face;

let MARKS = null;
/**
 * The middle of each stage of a beat, as offsets from the beat's start.
 *
 * There is no schedule left to read the boundaries off, so they are found the only honest
 * way there is: walk a beat finely, watch where the stage changes, and take the middle of
 * each run. Solved once — the beats are alike.
 */
function beatMarks() {
  if (MARKS) return MARKS;
  const N = 4000;
  const runs = [];
  for (let i = 0; i <= N; i++) {
    const u = -0.5 + i / N;
    const ph = phaseName(u);
    const last = runs[runs.length - 1];
    if (!last || last.phase !== ph) runs.push({ phase: ph, from: u, to: u });
    else last.to = u;
  }
  // The window opens and closes inside the lock, so the lock arrives as two runs that are
  // one stage: join them round the edge, or «Step» would stop twice in the same state.
  const spans = runs.map((r) => ({ phase: r.phase, from: r.from + 0.5, to: r.to + 0.5 }));
  if (spans.length > 1 && spans[0].phase === spans[spans.length - 1].phase) {
    const first = spans.shift();
    const last = spans[spans.length - 1];
    last.to = first.to + 1;
  }
  MARKS = spans
    .map((r) => ({ phase: r.phase, at: (((r.from + r.to) / 2) % 1 + 1) % 1 }))
    .sort((x, y) => x.at - y.at);
  return MARKS;
}

/** The stages of a beat and where their middles fall — for the panel and the tests. */
export const stages = () => beatMarks().map((m) => ({ ...m }));

/**
 * The next stage's middle, in beats — what one press of «Step» advances to.
 *
 * A uniform step cannot do this job: the stages are of very different lengths, and the
 * shortest of them is a small fraction of a beat, so any fixed step wide enough to be
 * useful would jump straight over it (issue #39). Each press lands in the MIDDLE of the
 * next stage instead, as far from its own boundaries as the stage allows.
 */
export function stepFrom(u) {
  const marks = beatMarks();
  // The marks are offsets into a beat's window, and a beat's window runs from one lock to
  // the next — from half a beat before the crossing to half a beat after it.
  const start = Math.floor(u) - 1;
  for (let k = start; k < start + 4; k++) {
    for (const m of marks) {
      const w = k - 0.5 + m.at;
      if (w > u + 1e-9) return w;
    }
  }
  return u + 0.5;
}
