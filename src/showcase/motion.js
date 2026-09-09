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
 * The active pallet: the lock is held by each in turn. The lock's index is the rounded
 * `u − 0.5` (locks sit on half-integers): an even one is held by the entry pallet — a
 * convention taken from the first frame, where the seating was measured on it.
 */
export function activePallet(u) {
  return Math.round(u - 0.5) % 2 === 0 ? 'entry' : 'exit';
}
