/**
 * Live numbers for the station cards.
 *
 * The main rule: **nothing is typed in by hand**. Every number here is derived from
 * the same constants that build the geometry and the kinematics. Otherwise a card
 * promising «verified by a test» would start lying at the first change to the code —
 * move `beatHz`, say, and a hard-coded «12.0 s» becomes untrue.
 */
import { TRAIN, layoutTrain } from '../train.js';
import { M, pitchR } from '../common.js';
import { SPRING_TURNS_0, SPRING_TURNS_C, SPRING_SQUEEZE } from '../barrel.js';
import { profile as motionProfile } from '../motionWorks.js';
import { RATCHET_T, CROWN_T, BEVEL_W, BEVEL_P, RATCH_M } from '../winding.js';
import { profile as reserveProfile, RA, RB, SWEEP } from '../powerReserve.js';

// Arithmetic rounding rather than `toFixed`: that allocates a string on every call,
// and this is a hot path. Every quantity here is positive, so the difference between
// «half away from zero» (toFixed) and «half up» (Math.round) never arises.
const round = (x, n = 2) => { const p = 10 ** n; return Math.round(x * p) / p; };

let RATIOS = null;

/**
 * The arbors' ratios relative to the barrel — by the same rule as in `layoutTrain`.
 *
 * Computed once: `TRAIN` never changes, and this array sits on a hot path
 * (`readouts` is called every frame). The result is **shared — do not mutate it**.
 */
export function trainRatios() {
  if (RATIOS) return RATIOS;
  const out = [{ nameKey: TRAIN[0].nameKey, omega: 1, pair: null }];
  for (let k = 1; k < TRAIN.length; k++) {
    const zw = TRAIN[k - 1].wheel, zp = TRAIN[k].pinion;
    out.push({ nameKey: TRAIN[k].nameKey, omega: -out[k - 1].omega * (zw / zp), pair: `${zw}/${zp}` });
  }
  RATIOS = out;
  return RATIOS;
}

/** Half a tooth pitch of the escape wheel — how far it travels per beat of the balance. */
export const halfStep = () => Math.PI / TRAIN[4].escapeTeeth;

/** The cage's period of rotation: 2π / (half-step · beats per second). */
export const cagePeriod = (beatHz) => (2 * Math.PI) / (halfStep() * beatHz);

/** The fourth wheel's period — from the ratio of its speed to the cage's. */
export function secondsWheelPeriod(beatHz) {
  const r = trainRatios();
  return cagePeriod(beatHz) * Math.abs(r[4].omega / r[3].omega);
}

/** How much model time the wind lasts from charge `c` down to zero, at a given rate. */
export function runTime(beatHz, c = 1) {
  const r = trainRatios();
  const drivePerSec = (halfStep() * beatHz) / r[4].omega; // the barrel's angle gained per second
  return (c * 2 * SWEEP) / RB / drivePerSec;
}

/** The charge gained per click (a quarter turn of the ratchet). */
export const chargePerClick = () => (RA * (Math.PI / 2)) / (2 * SWEEP);

/**
 * The motion works: both pairs, and the proof that their centre distance is the same.
 *
 * The numbers come from the module itself — only the rounding for display is left
 * here. Until now this same centre-distance expression was written out three times:
 * in the module, here, and in the developed section.
 */
export function motionWorks() {
  const { hourRatio, centres, modules } = motionProfile(layoutTrain());
  return {
    hourRatio,
    centreA: round(centres.mw1, 3),
    centreB: round(centres.mw2, 3),
    equal: centres.equal,
    modules: [modules[0], round(modules[1], 4)],
  };
}

/** Centre seconds: 48→20→8 multiplies the fourth arbor's speed by 6. */
export function centralSeconds() {
  const r = trainRatios();
  const { step, idler } = motionProfile(layoutTrain()).cs;
  return { step, total: Math.abs(r[3].omega / r[1].omega) * step, idler };
}

/** The power-reserve train: the same centre distance in both pairs — hence a single idler. */
export function reserveTrain() {
  const { ratio, centres } = reserveProfile();
  return { ratio, centreA: round(centres.hub, 3), centreB: round(centres.sun, 3), equal: centres.equal };
}

/** Winding: how many turns the crown makes per turn of the ratchet. */
export const crownPerRatchet = () => (RATCHET_T / CROWN_T) * (BEVEL_W / BEVEL_P);

/** The pitch-cone angles of the winding pair — they complement each other to 90°. */
export function bevelAngles() {
  const w = (Math.atan(BEVEL_W / BEVEL_P) * 180) / Math.PI;
  const p = (Math.atan(BEVEL_P / BEVEL_W) * 180) / Math.PI;
  return { wheel: round(w, 1), pinion: round(p, 1), sum: round(w + p, 1) };
}

/** The ratchet's tooth pitch — this is what the click ticks over. */
export const ratchetStepDeg = () => round(360 / RATCHET_T, 2);

/** The spring's shape at a given charge. `out` is an optional buffer for the hot path. */
export function springAt(c, out = {}) {
  out.turns = round(SPRING_TURNS_0 + SPRING_TURNS_C * c, 1);
  out.squeeze = round(SPRING_SQUEEZE * c, 2);
  return out;
}

/** The barrel wheel's radius — where the scale of the whole movement comes from. */
export const barrelR = () => round(pitchR(TRAIN[0].wheel, M), 2);

let CONST = null;

/**
 * The things that do not depend on the settings at all — the movement's own constants.
 * Computed once; these nested objects are shared by every snapshot.
 */
function constants() {
  if (CONST) return CONST;
  CONST = {
    ratios: trainRatios(),
    halfStepDeg: round((halfStep() * 180) / Math.PI, 1),
    clickPct: Math.round(chargePerClick() * 1000) / 10,
    mw: motionWorks(),
    cs: centralSeconds(),
    reserve: reserveTrain(),
    bevel: bevelAngles(),
    crownTurns: round(crownPerRatchet(), 2),
    ratchetStep: ratchetStepDeg(),
    barrelR: barrelR(),
    sweepDeg: Math.round((SWEEP * 180) / Math.PI),
  };
  return CONST;
}

/**
 * A snapshot of every number for a card: the constants from the constants, the
 * variables from the current settings and charge.
 *
 * The function sits in the render loop, so it must not allocate: the constants come
 * from `constants()`, and a caller on the hot path passes its own `out` buffer and
 * reuses it every frame. Without a buffer a fresh object is returned — snapshots stay
 * independent for anyone comparing two calls.
 */
export function readouts({ beatHz, amplitude, speed, charge }, out = {}) {
  const k = constants();
  const run = runTime(beatHz, 1);

  out.beatHz = beatHz;
  out.amplitude = amplitude;
  out.speed = speed;
  out.charge = charge;
  out.chargePct = Math.round(charge * 100);
  out.cagePeriod = round(cagePeriod(beatHz), 1);
  out.secondsPeriod = round(secondsWheelPeriod(beatHz), 1);
  out.fullRun = Math.round(run);
  // Speed multiplies model time, so on screen the wind «burns down» faster.
  out.fullRunMin = round(run / 60 / Math.max(speed, 0.1), 1);
  out.spring = springAt(charge, out.spring);

  out.ratios = k.ratios;
  out.halfStepDeg = k.halfStepDeg;
  out.clickPct = k.clickPct;
  out.mw = k.mw;
  out.cs = k.cs;
  out.reserve = k.reserve;
  out.bevel = k.bevel;
  out.crownTurns = k.crownTurns;
  out.ratchetStep = k.ratchetStep;
  out.barrelR = k.barrelR;
  out.sweepDeg = k.sweepDeg;
  return out;
}
