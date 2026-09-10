import { TEETH, WHEEL_LOCK_PHASE } from './leverModel.js';

/**
 * The showcase's motion — its own phase kinematics.
 *
 * The shape of the curves repeats `escapement/beat.js` (half a tooth per beat, the fork
 * unlocking inside a ±0.12 window), but the code does NOT import it: the showcase is
 * isolated by decision, and its timing synchronises with nothing, so there is no
 * commonality here — only an incidental agreement of shape. The duplication is small
 * (smoothstep and the phase decomposition), and documented here rather than smeared
 * over the code in silence.
 *
 * Everything is a pure function of time in beats `u`: pause and stepping are just a
 * stop and a manual advance of `u`, with no memory in any integrator.
 */

/** The showcase's tempo: slow, so the lock is visible; speed is the panel's multiplier. */
export const BEAT_HZ = 1.0;
/** The balance's amplitude, degrees. */
export const AMPLITUDE = 270;
/** The fork's swing, rad: the tail travels between the banking pins. */
export const FORK_MAX = 0.07;
/** Half-width of the unlocking window, as a fraction of a beat. */
export const FLIP_W = 0.12;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The phase decomposition: beat number, unlocking progress, alternating side. */
export function phaseAt(u) {
  const n = Math.round(u);
  const ss = smooth((u - n) / (2 * FLIP_W) + 0.5);
  const sigma = ((n % 2) + 2) % 2 === 0 ? 1 : -1;
  return { n, ss, sigma };
}

/** The wheel: half a tooth per beat, on top of the measured lock phase. */
export function wheelAngle(u) {
  const { n, ss } = phaseAt(u);
  return WHEEL_LOCK_PHASE + (Math.PI / TEETH) * (n - 1 + ss);
}

/** The fork: flipping between the banking pins, the side alternating on every beat. */
export function forkAngle(u) {
  const { ss, sigma } = phaseAt(u);
  return -FORK_MAX * sigma * (2 * ss - 1);
}

/** The balance: a sine, zero twice per beat — unlocking happens at the zero. */
export function balanceAngle(u, ampDeg = AMPLITUDE) {
  return ((ampDeg * Math.PI) / 180) * Math.sin(Math.PI * u);
}

/**
 * The phase's name for the caption: outside the window it is the lock; inside, the
 * window divides into unlocking → impulse → drop. This is staging of the sequence, not
 * measured contact: the real boundaries will be settled by seating the drop.
 */
export function phaseName(u) {
  if (Math.abs(u - Math.round(u)) > FLIP_W) return 'lock';
  const { ss } = phaseAt(u);
  if (ss < 1 / 3) return 'unlock';
  if (ss < 2 / 3) return 'impulse';
  return 'drop';
}

/**
 * The inverse of `smooth()`: the x at which the eased progress reaches `p`.
 * (The closed form of x²(3−2x) = p on [0, 1].)
 */
const smoothInv = (p) => 0.5 - Math.sin(Math.asin(1 - 2 * p) / 3);

/**
 * One solved number places every boundary in this file: the x at which the eased
 * progress reaches ⅔, where the drop begins. Its mirror (1 − X_DROP) is where the
 * unlocking ends.
 *
 * The stages are cut at thirds of the EASED progress `ss`, not of time, so their widths
 * in time are unequal — the impulse, easing fastest, is the narrowest of the four at
 * about 0.054 beat. Hence these offsets are solved rather than chosen.
 */
const X_DROP = smoothInv(2 / 3);
/**
 * The middle of a stage, as an offset from the beat: the unlocking's is at −MID_OFF, the
 * impulse's at the beat itself, the drop's at +MID_OFF, and the lock's at the
 * half-integer where the fork rests on its banking pin.
 */
const MID_OFF = FLIP_W * X_DROP;
/** Where the drop begins, as an offset from the beat — the pallets change hands here. */
const DROP_START = FLIP_W * (2 * X_DROP - 1);

/**
 * The next stage's middle, in beats — what one press of «Step» advances to.
 *
 * A uniform step cannot do this job. It was ⅛ of a beat, wider than the impulse it was
 * meant to reveal, so stepping jumped straight from unlocking to drop and the exhibit
 * could not show the stage it exists for. Widening the window or shrinking the step
 * would only move the collision: the fix is that there is no step constant any more.
 * Each press lands in the MIDDLE of the next stage, so every stage is visited exactly
 * once per beat, as far from its own boundaries as the stage allows.
 */
export function stepFrom(u) {
  const n = Math.round(u);
  const mids = [];
  for (const k of [n - 1, n, n + 1]) mids.push(k - MID_OFF, k, k + MID_OFF, k + 0.5);
  return mids.find((m) => m > u + 1e-9) ?? u + 0.5;
}

/**
 * The pallet doing the work. Locks sit on half-integers and each is held by a pallet in
 * turn; an even index is the entry pallet — a convention taken from the first frame,
 * where the seating was measured on it.
 *
 * The handover is at the DROP, not at the beat. One pallet is unlocked and then
 * impulsed — the same stone through both stages — and only when the tooth falls does the
 * other receive it. The rounding used to hand over half a window early, at the beat
 * itself; nothing showed it while a step of ⅛ beat skipped over that point, and the
 * moment stepping landed on the beat exactly, the caption sat on a discontinuity: the
 * name flipped between two frames of the same impulse.
 */
export function activePallet(u) {
  const n = Math.round(u);
  const held = u < n + DROP_START ? n - 1 : n; // the lock that is working
  return ((held % 2) + 2) % 2 === 0 ? 'entry' : 'exit';
}
